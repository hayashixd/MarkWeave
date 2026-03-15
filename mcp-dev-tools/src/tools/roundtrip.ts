import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { execa } from "execa";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
      // npx tsx -e で変換関数を呼び出し、JSON を stdout に出力する
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
              + JSON.stringify(inputLines[i] ?? '<missing>') + ' → '
              + JSON.stringify(outputLines[i] ?? '<missing>')
            );
          }
        }

        console.log(JSON.stringify({
          input,
          output,
          is_identical: input === output,
          diff,
        }));
      `;

      try {
        const proc = await execa("npx", ["tsx", "-e", script], {
          cwd: PROJECT_ROOT,
          reject: false,
          timeout: 30_000,
        });

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

        const combined = proc.stdout + "\n" + proc.stderr;

        // Parse test counts
        let passed = 0;
        let failed = 0;
        const testsLine = combined.match(
          /Tests\s+(?:(\d+)\s+passed)?(?:\s*\|\s*)?(?:(\d+)\s+failed)?\s*\((\d+)\)/
        );
        if (testsLine) {
          passed = parseInt(testsLine[1] ?? "0", 10);
          failed = parseInt(testsLine[2] ?? "0", 10);
        }

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
