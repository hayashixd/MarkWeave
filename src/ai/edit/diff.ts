import type { DiffSegment } from './types';

function splitSentences(text: string): string[] {
  const result: string[] = [];
  let current = '';

  for (let i = 0; i < text.length; i++) {
    current += text[i];
    const char = text[i];

    if (char === '\u3002') {
      result.push(current);
      current = '';
    } else if (char === '.' && i + 1 < text.length && text[i + 1] === ' ') {
      current += text[i + 1];
      i++;
      result.push(current);
      current = '';
    } else if (char === '\n') {
      result.push(current);
      current = '';
    }
  }

  if (current) {
    result.push(current);
  }

  return result;
}

function lcsTable(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }

  return dp;
}

function buildDiffFromLcs(
  a: string[],
  b: string[],
  dp: number[][],
): DiffSegment[] {
  const segments: DiffSegment[] = [];
  let i = a.length;
  let j = b.length;

  const stack: DiffSegment[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      stack.push({ type: 'unchanged', text: a[i - 1]! });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      stack.push({ type: 'added', text: b[j - 1]! });
      j--;
    } else {
      stack.push({ type: 'removed', text: a[i - 1]! });
      i--;
    }
  }

  stack.reverse();

  for (const seg of stack) {
    const last = segments[segments.length - 1];
    if (last && last.type === seg.type) {
      last.text += seg.text;
    } else {
      segments.push({ ...seg });
    }
  }

  return segments;
}

export function computeInlineDiff(
  original: string,
  modified: string,
): DiffSegment[] {
  if (original === modified) {
    return [{ type: 'unchanged', text: original }];
  }

  const originalSentences = splitSentences(original);
  const modifiedSentences = splitSentences(modified);

  const dp = lcsTable(originalSentences, modifiedSentences);
  return buildDiffFromLcs(originalSentences, modifiedSentences, dp);
}
