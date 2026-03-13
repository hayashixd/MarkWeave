import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { execa } from "execa";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..");

interface TestFailure {
  name: string;
  message: string;
}

interface TestResult {
  passed: number;
  failed: number;
  failures: TestFailure[];
  duration_ms: number;
}

function parseVitestOutput(stdout: string, stderr: string): TestResult {
  const combined = stdout + "\n" + stderr;

  let passed = 0;
  let failed = 0;
  let duration_ms = 0;
  const failures: TestFailure[] = [];

  // Parse "Tests  N passed (N)" or "Tests  N passed | M failed (T)"
  const testsLine = combined.match(
    /Tests\s+(?:(\d+)\s+passed)?(?:\s*\|\s*)?(?:(\d+)\s+failed)?\s*\((\d+)\)/
  );
  if (testsLine) {
    passed = parseInt(testsLine[1] ?? "0", 10);
    failed = parseInt(testsLine[2] ?? "0", 10);
  }

  // Parse duration: "Duration  12.81s"
  const durationMatch = combined.match(/Duration\s+([\d.]+)s/);
  if (durationMatch) {
    duration_ms = Math.round(parseFloat(durationMatch[1]!) * 1000);
  }

  // Parse failure blocks: "FAIL src/..." followed by error details
  // Vitest outputs "× test name" for failed tests
  const failurePattern = /[×✕]\s+(.+?)(?:\n[\s\S]*?(?:Error|AssertionError):\s*(.+?)(?:\n|$))?/g;
  let match: RegExpExecArray | null;
  while ((match = failurePattern.exec(combined)) !== null) {
    failures.push({
      name: match[1]!.trim(),
      message: match[2]?.trim() ?? "Test failed",
    });
  }

  // If we detected failed count but didn't parse individual failures,
  // try a simpler approach: look for "FAIL" file lines
  if (failed > 0 && failures.length === 0) {
    const failFilePattern = /FAIL\s+(.+\.(?:test|spec)\.(?:ts|tsx))/g;
    while ((match = failFilePattern.exec(combined)) !== null) {
      failures.push({
        name: match[1]!.trim(),
        message: "Test file failed (see full output for details)",
      });
    }
  }

  return { passed, failed, failures, duration_ms };
}

function parseCargoTestOutput(stdout: string, stderr: string): TestResult {
  const combined = stdout + "\n" + stderr;

  let passed = 0;
  let failed = 0;
  let duration_ms = 0;
  const failures: TestFailure[] = [];

  // Parse "test result: ok. N passed; M failed; ..."
  const resultMatch = combined.match(
    /test result:\s*\w+\.\s*(\d+)\s+passed;\s*(\d+)\s+failed/
  );
  if (resultMatch) {
    passed = parseInt(resultMatch[1]!, 10);
    failed = parseInt(resultMatch[2]!, 10);
  }

  // Parse duration: "finished in Ns"
  const durationMatch = combined.match(/finished in ([\d.]+)s/);
  if (durationMatch) {
    duration_ms = Math.round(parseFloat(durationMatch[1]!) * 1000);
  }

  // Parse failure names: "---- module::test_name stdout ----"
  const failurePattern = /---- (.+?) stdout ----[\s\S]*?(?:panicked at|assertion .+? failed).*?:\s*(.+?)(?:\n|$)/g;
  let match: RegExpExecArray | null;
  while ((match = failurePattern.exec(combined)) !== null) {
    failures.push({
      name: match[1]!.trim(),
      message: match[2]?.trim() ?? "Test panicked",
    });
  }

  // Fallback: parse "failures:" section listing test names
  if (failed > 0 && failures.length === 0) {
    const failSection = combined.match(/failures:\s*\n([\s\S]*?)(?:\ntest result:|$)/);
    if (failSection) {
      const lines = failSection[1]!.split("\n").filter((l) => l.trim().length > 0);
      for (const line of lines) {
        const name = line.trim();
        if (name && !name.startsWith("---")) {
          failures.push({ name, message: "Test failed" });
        }
      }
    }
  }

  return { passed, failed, failures, duration_ms };
}

export function registerTools(server: McpServer): void {
  server.tool(
    "run_tests",
    "Run project tests (unit/rust/all) and return structured results",
    {
      scope: z.enum(["unit", "rust", "all"]).describe(
        "Test scope: 'unit' for vitest, 'rust' for cargo test, 'all' for both"
      ),
      filter: z.string().optional().describe(
        "Optional filter pattern to pass to the test runner"
      ),
    },
    async ({ scope, filter }) => {
      const results: TestResult[] = [];

      if (scope === "unit" || scope === "all") {
        const args = ["run"];
        if (filter) {
          args.push("--", "-t", filter);
        }
        const start = Date.now();
        try {
          const proc = await execa("npx", ["vitest", ...args], {
            cwd: PROJECT_ROOT,
            reject: false,
            timeout: 300_000,
          });
          const result = parseVitestOutput(proc.stdout, proc.stderr);
          if (result.duration_ms === 0) {
            result.duration_ms = Date.now() - start;
          }
          results.push(result);
        } catch (err) {
          results.push({
            passed: 0,
            failed: 1,
            failures: [
              {
                name: "vitest",
                message: err instanceof Error ? err.message : String(err),
              },
            ],
            duration_ms: Date.now() - start,
          });
        }
      }

      if (scope === "rust" || scope === "all") {
        const tauriDir = path.join(PROJECT_ROOT, "src-tauri");
        const args = ["test"];
        if (filter) {
          args.push("--", filter);
        }
        const start = Date.now();
        try {
          const proc = await execa("cargo", args, {
            cwd: tauriDir,
            reject: false,
            timeout: 300_000,
          });
          const result = parseCargoTestOutput(proc.stdout, proc.stderr);
          if (result.duration_ms === 0) {
            result.duration_ms = Date.now() - start;
          }
          results.push(result);
        } catch (err) {
          results.push({
            passed: 0,
            failed: 1,
            failures: [
              {
                name: "cargo test",
                message: err instanceof Error ? err.message : String(err),
              },
            ],
            duration_ms: Date.now() - start,
          });
        }
      }

      // Merge results if multiple scopes
      const merged: TestResult = {
        passed: results.reduce((sum, r) => sum + r.passed, 0),
        failed: results.reduce((sum, r) => sum + r.failed, 0),
        failures: results.flatMap((r) => r.failures),
        duration_ms: results.reduce((sum, r) => sum + r.duration_ms, 0),
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(merged, null, 2),
          },
        ],
      };
    }
  );
}
