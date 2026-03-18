import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { execa } from "execa";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerRoundtripTools } from "./roundtrip.js";
import { registerManualTools } from "./manual.js";

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

/** ANSI エスケープシーケンスを除去する */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");
}

function parseVitestOutput(stdout: string, stderr: string): TestResult {
  // ANSI カラーコードを除去してからパース
  const combined = stripAnsi(stdout + "\n" + stderr);

  let passed = 0;
  let failed = 0;
  let duration_ms = 0;
  const failures: TestFailure[] = [];

  // Vitest の出力形式:
  //   全通過: "Tests  1453 passed (1453)"
  //   失敗あり: "Tests  7 failed | 1453 passed (1460)"
  // failed が先に来るため、passed/failed を独立してパースする
  const passedMatch = combined.match(/\bTests\b.*?(\d+)\s+passed/);
  const failedMatch = combined.match(/\bTests\b.*?(\d+)\s+failed/);
  if (passedMatch) passed = parseInt(passedMatch[1]!, 10);
  if (failedMatch) failed = parseInt(failedMatch[1]!, 10);

  // Parse duration: "Duration  12.81s"
  const durationMatch = combined.match(/Duration\s+([\d.]+)s/);
  if (durationMatch) {
    duration_ms = Math.round(parseFloat(durationMatch[1]!) * 1000);
  }

  // "× test name" パターンで失敗テスト名を抽出
  const failurePattern = /[×✕]\s+(.+)/g;
  let match: RegExpExecArray | null;
  while ((match = failurePattern.exec(combined)) !== null) {
    const name = match[1]!.trim();
    if (name) {
      failures.push({ name, message: "Test failed" });
    }
  }

  // 失敗数を検出できたが個別名が取れない場合は FAIL ファイル行にフォールバック
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
  registerRoundtripTools(server);
  registerManualTools(server);

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
