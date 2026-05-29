import { useMemo } from "react";

interface DiffViewProps {
  before: string;
  after: string;
}

type DiffSegment = {
  text: string;
  type: "same" | "added" | "removed";
};

/**
 * Simple word-level diff using a basic LCS approach.
 * Splits both strings into words, finds longest common subsequence,
 * then classifies each word as same/added/removed.
 */
function computeWordDiff(before: string, after: string): DiffSegment[] {
  const wordsA = before.split(/(\s+)/);
  const wordsB = after.split(/(\s+)/);

  // Build LCS table (optimised for reasonable lengths)
  const maxLen = 2000;
  const a = wordsA.slice(0, maxLen);
  const b = wordsB.slice(0, maxLen);

  const m = a.length;
  const n = b.length;

  // Use a simplified approach for very long texts
  if (m * n > 4_000_000) {
    return simpleDiff(before, after);
  }

  // Standard LCS
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to get the diff
  const segments: DiffSegment[] = [];
  let i = m;
  let j = n;

  const result: DiffSegment[] = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      result.push({ text: a[i - 1], type: "same" });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ text: b[j - 1], type: "added" });
      j--;
    } else {
      result.push({ text: a[i - 1], type: "removed" });
      i--;
    }
  }

  result.reverse();

  // Merge consecutive segments of same type
  const merged: DiffSegment[] = [];
  for (const seg of result) {
    if (merged.length > 0 && merged[merged.length - 1].type === seg.type) {
      merged[merged.length - 1].text += seg.text;
    } else {
      merged.push({ ...seg });
    }
  }

  return merged;
}

/** Fallback for very long texts: simple word set comparison */
function simpleDiff(before: string, after: string): DiffSegment[] {
  const wordsA = before.split(/\s+/).filter(Boolean);
  const wordsB = after.split(/\s+/).filter(Boolean);

  const setA = new Set(wordsA);
  const setB = new Set(wordsB);

  const segments: DiffSegment[] = [];

  // Show removed words (from before)
  const removed = wordsA.filter((w) => !setB.has(w));
  if (removed.length > 0) {
    segments.push({ text: removed.join(" "), type: "removed" });
  }

  // Show after text with new words highlighted
  for (const word of wordsB) {
    if (!setA.has(word)) {
      segments.push({ text: word + " ", type: "added" });
    } else {
      segments.push({ text: word + " ", type: "same" });
    }
  }

  // Merge consecutive
  const merged: DiffSegment[] = [];
  for (const seg of segments) {
    if (merged.length > 0 && merged[merged.length - 1].type === seg.type) {
      merged[merged.length - 1].text += seg.text;
    } else {
      merged.push({ ...seg });
    }
  }
  return merged;
}

export default function DiffView({ before, after }: DiffViewProps) {
  const segments = useMemo(() => computeWordDiff(before, after), [before, after]);

  return (
    <div className="text-sm leading-relaxed whitespace-pre-wrap font-sans p-3 bg-muted/30 rounded-md border border-border max-h-96 overflow-y-auto">
      {segments.map((seg, idx) => {
        if (seg.type === "removed") {
          return (
            <span
              key={idx}
              className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 line-through"
            >
              {seg.text}
            </span>
          );
        }
        if (seg.type === "added") {
          return (
            <span
              key={idx}
              className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
            >
              {seg.text}
            </span>
          );
        }
        return <span key={idx}>{seg.text}</span>;
      })}
    </div>
  );
}
