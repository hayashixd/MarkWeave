import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execa } from "execa";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..");

interface ManualCaptureResult {
  passed: number;
  failed: number;
  failures: { name: string; error: string }[];
  duration_ms: number;
  success: boolean;
}

interface GenerateManualResult {
  output_path: string;
  file_size_kb: number;
  duration_ms: number;
  success: boolean;
  error?: string;
}

/**
 * マニュアル関連の MCP ツールを登録する
 */
export function registerManualTools(server: McpServer): void {
  // ── ツール1: manual_capture ──────────────────────
  server.tool(
    "manual_capture",
    "Run Playwright manual screenshot capture (npm run manual:capture) and return structured results",
    {},
    async () => {
      const start = Date.now();

      const proc = await execa(
        "npx",
        ["playwright", "test", "e2e/manual-capture/", "--headed"],
        {
          cwd: PROJECT_ROOT,
          reject: false,
          timeout: 300_000,
        }
      );

      const combined = proc.stdout + "\n" + proc.stderr;
      const duration_ms = Date.now() - start;

      // "N passed" / "N failed" をパース
      const passedMatch = combined.match(/(\d+)\s+passed/);
      const failedMatch = combined.match(/(\d+)\s+failed/);
      const passed = passedMatch ? parseInt(passedMatch[1]!, 10) : 0;
      const failed = failedMatch ? parseInt(failedMatch[1]!, 10) : 0;

      // 失敗テストの名前とエラーをパース
      const failures: { name: string; error: string }[] = [];
      const failureBlocks = combined.matchAll(
        /\d+\)\s+\[chromium\]\s+›\s+(.+?)\n[\s\S]*?Error:\s+(.+?)(?=\n\s*\n|\n\s*\d+\)|\n\s*\d+ (passed|failed)|$)/g
      );
      for (const block of failureBlocks) {
        failures.push({
          name: block[1]!.trim(),
          error: block[2]!.trim(),
        });
      }

      const result: ManualCaptureResult = {
        passed,
        failed,
        failures,
        duration_ms,
        success: failed === 0 && proc.exitCode === 0,
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // ── ツール2: demo_capture ──────────────────────────
  server.tool(
    "demo_capture",
    "Run Playwright demo GIF capture (e2e/demo-capture/) and return structured results. Outputs animated GIFs to doc-public/demo-gifs/.",
    {},
    async () => {
      const start = Date.now();

      const proc = await execa(
        "npx",
        ["playwright", "test", "e2e/demo-capture/", "--project", "demo-chromium", "--headed"],
        {
          cwd: PROJECT_ROOT,
          reject: false,
          timeout: 300_000,
        }
      );

      const combined = proc.stdout + "\n" + proc.stderr;
      const duration_ms = Date.now() - start;

      const passedMatch = combined.match(/(\d+)\s+passed/);
      const failedMatch = combined.match(/(\d+)\s+failed/);
      const passed = passedMatch ? parseInt(passedMatch[1]!, 10) : 0;
      const failed = failedMatch ? parseInt(failedMatch[1]!, 10) : 0;

      const failures: { name: string; error: string }[] = [];
      const failureBlocks = combined.matchAll(
        /\d+\)\s+\[demo-chromium\]\s+›\s+(.+?)\n[\s\S]*?Error:\s+(.+?)(?=\n\s*\n|\n\s*\d+\)|\n\s*\d+ (passed|failed)|$)/g
      );
      for (const block of failureBlocks) {
        failures.push({
          name: block[1]!.trim(),
          error: block[2]!.trim(),
        });
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { passed, failed, failures, duration_ms, success: failed === 0 && proc.exitCode === 0 },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ── ツール3: generate_manual ──────────────────────
  server.tool(
    "generate_manual",
    "Regenerate HTML manual from Markdown and screenshots (node docs/generate-manual.cjs) and return result",
    {},
    async () => {
      const start = Date.now();

      let result: GenerateManualResult;

      try {
        const proc = await execa("node", ["docs/generate-manual.cjs"], {
          cwd: PROJECT_ROOT,
          reject: false,
          timeout: 60_000,
        });

        const combined = proc.stdout + "\n" + proc.stderr;
        const duration_ms = Date.now() - start;

        // "Generated: /path/to/file" をパース
        const generatedMatch = combined.match(/Generated:\s*(.+)/);
        const outputPath = generatedMatch
          ? generatedMatch[1]!.trim()
          : "doc-public/manuals/user-manual.html";

        // "File size: N KB" をパース
        const sizeMatch = combined.match(/File size:\s*([\d.]+)\s*KB/);
        const fileSizeKb = sizeMatch ? parseFloat(sizeMatch[1]!) : 0;

        result = {
          output_path: outputPath,
          file_size_kb: fileSizeKb,
          duration_ms,
          success: proc.exitCode === 0,
          error: proc.exitCode !== 0 ? combined.trim() : undefined,
        };
      } catch (err) {
        result = {
          output_path: "",
          file_size_kb: 0,
          duration_ms: Date.now() - start,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );
}
