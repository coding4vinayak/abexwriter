import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  bookId: number;
  chapterId?: number;
  modelContextWindow?: number;
}

interface BookBible {
  premise?: string | null;
  setting?: string | null;
  themes?: string | null;
  styleGuide?: string | null;
  glossary?: string | null;
  rollingSummary?: string | null;
  entities?: any;
}

interface SteeringNote {
  note: string;
  isActive: boolean;
}

interface ChapterSummary {
  summary: string;
  keyEvents: any;
}

/** Rough token estimate: ~4 chars per token */
function estimateTokens(text: string | null | undefined): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export default function ContextBudget({ bookId, chapterId, modelContextWindow = 128000 }: Props) {
  const { data: bible } = useQuery({
    queryKey: ["/api/books", bookId, "bible"],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/books/${bookId}/bible`, undefined);
      return (await r.json()) as BookBible | null;
    },
  });

  const { data: steering } = useQuery({
    queryKey: ["/api/books", bookId, "steering", "active"],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/books/${bookId}/steering?activeOnly=true`, undefined);
      return (await r.json()) as SteeringNote[];
    },
  });

  const { data: summaries } = useQuery({
    queryKey: ["/api/books", bookId, "chapter-summaries"],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/books/${bookId}/chapter-summaries`, undefined);
      return (await r.json()) as ChapterSummary[];
    },
  });

  const breakdown = useMemo(() => {
    // Bible entities
    const entitiesText = bible?.entities ? JSON.stringify(bible.entities) : "";
    const bibleEntitiesTokens = estimateTokens(entitiesText);

    // Rolling summary
    const rollingSummaryTokens = estimateTokens(bible?.rollingSummary);

    // Steering notes
    const steeringText = (steering ?? []).map((n) => n.note).join("\n");
    const steeringTokens = estimateTokens(steeringText);

    // Chapter summaries (used as rolling context)
    const summariesText = (summaries ?? []).map((s) => s.summary).join("\n");
    const summariesTokens = estimateTokens(summariesText);

    // Bible overview (premise + setting + themes + styleGuide + glossary)
    const overviewText = [
      bible?.premise,
      bible?.setting,
      bible?.themes,
      bible?.styleGuide,
      bible?.glossary,
    ]
      .filter(Boolean)
      .join("\n");
    const overviewTokens = estimateTokens(overviewText);

    // Previous chapter ending (estimate ~375 tokens for 1500 chars)
    const prevChapterTokens = 375;

    const total =
      bibleEntitiesTokens +
      rollingSummaryTokens +
      steeringTokens +
      summariesTokens +
      overviewTokens +
      prevChapterTokens;

    return {
      bibleEntities: bibleEntitiesTokens,
      rollingSummary: rollingSummaryTokens + summariesTokens,
      steering: steeringTokens,
      overview: overviewTokens,
      prevChapter: prevChapterTokens,
      total,
    };
  }, [bible, steering, summaries]);

  const percentage = Math.min(100, Math.round((breakdown.total / modelContextWindow) * 100));
  const color =
    percentage < 50
      ? "bg-green-500"
      : percentage < 80
        ? "bg-yellow-500"
        : "bg-red-500";

  const formatTokens = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="w-full px-4 py-1.5 border-b border-border bg-card/50">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="whitespace-nowrap">Context:</span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${color}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="whitespace-nowrap font-mono">
                {formatTokens(breakdown.total)} / {formatTokens(modelContextWindow)} ({percentage}%)
              </span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs space-y-1 max-w-xs">
          <p className="font-medium">Context budget breakdown (estimated tokens):</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            <span>Bible overview:</span>
            <span className="text-right font-mono">{formatTokens(breakdown.overview)}</span>
            <span>Bible entities:</span>
            <span className="text-right font-mono">{formatTokens(breakdown.bibleEntities)}</span>
            <span>Rolling summary:</span>
            <span className="text-right font-mono">{formatTokens(breakdown.rollingSummary)}</span>
            <span>Steering notes:</span>
            <span className="text-right font-mono">{formatTokens(breakdown.steering)}</span>
            <span>Previous chapter:</span>
            <span className="text-right font-mono">{formatTokens(breakdown.prevChapter)}</span>
          </div>
          <p className="text-muted-foreground pt-1">
            {percentage < 50
              ? "Plenty of room for generation output."
              : percentage < 80
                ? "Moderate usage — consider trimming older context."
                : "High context usage — generation quality may suffer."}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
