import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { execa } from "execa";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import os from "node:os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..");

/**
 * ラウンドトリップ関連の MCP ツールを登録する
 */
export function registerRoundtripTools(server: McpServer): void {
  // ── ツール1: roundtrip_check ──────────────────────
  server.tool(
    "roundtrip_check",
    "Check Markdown round-trip: MD → TipTap JSON → MD and compare input/output",
    {
      markdown: z
        .string()
        .describe("Markdown string to round-trip through the converter"),
    },
    async ({ markdown }) => {
      // tsx -e はESMのimport文が動作しないため、一時ファイル経由で実行する
      const script = `
import { markdownToTipTap } from './src/lib/markdown-to-tiptap.ts';
import { tiptapToMarkdown } from './src/lib/tiptap-to-markdown.ts';

const input = ${JSON.stringify(markdown)};
const doc = markdownToTipTap(input);
const output = tiptapToMarkdown(doc);

const diff = [];
const inputLines = input.split('\\n');
const outputLines = output.split('\\n');
const maxLen = Math.max(inputLines.length, outputLines.length);
for (let i = 0; i < maxLen; i++) {
  if (inputLines[i] !== outputLines[i]) {
    diff.push(
      'L' + (i + 1) + ': '
      + JSON.stringify(inputLines[i] ?? '<missing>') + ' => '
      + JSON.stringify(outputLines[i] ?? '<missing>')
    );
  }
}

process.stdout.write(JSON.stringify({
  input,
  output,
  is_identical: input === output,
  diff,
}) + '\\n');
`;

      const tmpFile = path.join(PROJECT_ROOT, `__roundtrip_tmp_${Date.now()}.ts`);
      try {
        await fs.writeFile(tmpFile, script, "utf-8");
        const proc = await execa("npx", ["tsx", tmpFile], {
          cwd: PROJECT_ROOT,
          reject: false,
          timeout: 30_000,
        });

        await fs.unlink(tmpFile).catch(() => {});

        if (proc.exitCode !== 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    error: "Conversion script failed",
                    stderr: proc.stderr,
                    exitCode: proc.exitCode,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        // stdout は JSON 文字列なのでそのまま返す
        const result = JSON.parse(proc.stdout);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err) {
        await fs.unlink(tmpFile).catch(() => {});
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  error: err instanceof Error ? err.message : String(err),
                },
                null,
                2
              ),
            },
          ],
        };
      }
    }
  );

  // ── ツール2: run_roundtrip_regression ──────────────
  server.tool(
    "run_roundtrip_regression",
    "Run the roundtrip regression test suite (npm run test:roundtrip) and return structured results",
    {},
    async () => {
      const start = Date.now();
      try {
        const proc = await execa(
          "npx",
          ["vitest", "run", "src/lib/__tests__/roundtrip.test.ts"],
          {
            cwd: PROJECT_ROOT,
            reject: false,
            timeout: 120_000,
          }
        );

        // ANSI カラーコードを除去してからパース
        // eslint-disable-next-line no-control-regex
        const combined = (proc.stdout + "\n" + proc.stderr).replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");

        // Parse test counts
        // Vitest 出力例: "Tests  105 passed (105)" / "Tests  2 failed | 103 passed (105)"
        let passed = 0;
        let failed = 0;
        const passedMatch = combined.match(/\bTests\b.*?(\d+)\s+passed/);
        const failedMatch = combined.match(/\bTests\b.*?(\d+)\s+failed/);
        if (passedMatch) passed = parseInt(passedMatch[1]!, 10);
        if (failedMatch) failed = parseInt(failedMatch[1]!, 10);

        // Parse duration
        let duration_ms = Date.now() - start;
        const durationMatch = combined.match(/Duration\s+([\d.]+)s/);
        if (durationMatch) {
          duration_ms = Math.round(parseFloat(durationMatch[1]!) * 1000);
        }

        // Parse snapshot info
        let snapshots_written = 0;
        let snapshots_failed = 0;
        const snapWritten = combined.match(/Snapshots\s+(\d+)\s+written/);
        if (snapWritten) {
          snapshots_written = parseInt(snapWritten[1]!, 10);
        }
        const snapFailed = combined.match(/Snapshots\s+(\d+)\s+failed/);
        if (snapFailed) {
          snapshots_failed = parseInt(snapFailed[1]!, 10);
        }

        // Collect failure names
        const failures: string[] = [];
        const failurePattern = /[×✕]\s+(.+)/g;
        let match: RegExpExecArray | null;
        while ((match = failurePattern.exec(combined)) !== null) {
          failures.push(match[1]!.trim());
        }

        const result = {
          passed,
          failed,
          snapshots_written,
          snapshots_failed,
          failures,
          duration_ms,
          success: proc.exitCode === 0,
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  passed: 0,
                  failed: 1,
                  snapshots_written: 0,
                  snapshots_failed: 0,
                  failures: [
                    err instanceof Error ? err.message : String(err),
                  ],
                  duration_ms: Date.now() - start,
                  success: false,
                },
                null,
                2
              ),
            },
          ],
        };
      }
    }
  );
}
