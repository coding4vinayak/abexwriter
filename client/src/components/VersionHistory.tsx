import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { History, Check, FileX } from "lucide-react";
import { formatRelativeDate, countWords } from "@/lib/utils";

interface Generation {
  id: number;
  userId: number;
  bookId: number | null;
  chapterId: number | null;
  kind: string;
  status: "pending" | "completed" | "failed" | "applied" | "discarded";
  provider: string;
  model: string;
  mode: "byok" | "platform";
  output: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costMicroCents: number;
  durationMs: number;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface Props {
  chapterId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a generation is successfully applied so the parent can reload chapter content. */
  onApplied?: () => void;
}

const moneyFromMicroCents = (mc: number) =>
  mc < 1000 ? `$${(mc / 100_000).toFixed(6)}` : `$${(mc / 100_000).toFixed(4)}`;

/**
 * Drawer listing every Generation that targeted this chapter (chapter_content,
 * rewrite, expand, etc.). Click "Preview" → side-by-side modal with the chosen
 * version. "Apply" copies that version into the chapter content.
 */
export default function VersionHistory({ chapterId, open, onOpenChange, onApplied }: Props) {
  const { toast } = useToast();
  const [previewing, setPreviewing] = useState<Generation | null>(null);

  const generationsQuery = useQuery({
    queryKey: ["/api/generations", { chapterId }],
    queryFn: async () => {
      const r = await apiRequest(
        "GET",
        `/api/generations?chapterId=${chapterId}&limit=100`,
        undefined,
      );
      return (await r.json()) as Generation[];
    },
    enabled: open && !!chapterId,
  });

  const applyMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest("POST", `/api/generations/${id}/apply`, {});
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Version applied to chapter" });
      queryClient.invalidateQueries({ queryKey: ["/api/chapters", String(chapterId)] });
      queryClient.invalidateQueries({ queryKey: ["/api/generations", { chapterId }] });
      setPreviewing(null);
      onApplied?.();
    },
    onError: (err: any) =>
      toast({ title: "Apply failed", description: err?.message, variant: "destructive" }),
  });

  const generations = generationsQuery.data ?? [];

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <History className="h-5 w-5" /> Version history
            </SheetTitle>
            <SheetDescription>
              Every AI generation that targeted this chapter. Click Preview to read,
              Apply to make it the chapter content.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-2">
            {generationsQuery.isLoading && (
              <>
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </>
            )}
            {!generationsQuery.isLoading && generations.length === 0 && (
              <p className="text-sm italic text-muted-foreground py-8 text-center">
                No generations yet for this chapter.
              </p>
            )}
            {generations.map((g) => (
              <div
                key={g.id}
                className={`border rounded-md p-3 ${
                  g.status === "applied" ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary">{g.kind}</Badge>
                      <Badge
                        variant={
                          g.status === "applied"
                            ? "default"
                            : g.status === "failed"
                            ? "destructive"
                            : "outline"
                        }
                      >
                        {g.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {g.provider} · {g.model}
                      </span>
                      {g.mode === "platform" && (
                        <Badge variant="outline" className="text-[10px]">
                          platform
                        </Badge>
                      )}
                    </div>
                    {g.errorMessage ? (
                      <p className="mt-1 text-xs text-destructive">{g.errorMessage}</p>
                    ) : (
                      <p className="mt-1 text-sm line-clamp-2 text-muted-foreground">
                        {g.output.replace(/\s+/g, " ").slice(0, 180)}…
                      </p>
                    )}
                    <div className="mt-1 text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
                      <span>{formatRelativeDate(g.createdAt)}</span>
                      <span>· {countWords(g.output).toLocaleString()} words</span>
                      <span>· {g.totalTokens.toLocaleString()} tokens</span>
                      <span>· {moneyFromMicroCents(g.costMicroCents)}</span>
                      <span>· {(g.durationMs / 1000).toFixed(1)}s</span>
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewing(g)}
                    disabled={g.status === "failed" || !g.output}
                  >
                    Preview
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => applyMutation.mutate(g.id)}
                    disabled={
                      g.status === "failed" || g.status === "applied" || applyMutation.isPending
                    }
                  >
                    <Check className="h-3.5 w-3.5 mr-1" /> Apply
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Preview modal */}
      <Dialog open={!!previewing} onOpenChange={(v) => !v && setPreviewing(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              <span className="font-mono text-sm">
                {previewing?.provider} · {previewing?.model}
              </span>
              <span className="text-xs text-muted-foreground ml-2">
                {previewing && formatRelativeDate(previewing.createdAt)}
              </span>
            </DialogTitle>
            <DialogDescription>
              {previewing && (
                <>
                  {countWords(previewing.output).toLocaleString()} words ·{" "}
                  {previewing.totalTokens.toLocaleString()} tokens ·{" "}
                  {moneyFromMicroCents(previewing.costMicroCents)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 -mx-6 px-6 py-4 bg-muted/30 rounded-md whitespace-pre-wrap text-sm leading-relaxed">
            {previewing?.output || (
              <span className="italic text-muted-foreground">
                <FileX className="inline h-4 w-4 mr-1" />
                (empty)
              </span>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPreviewing(null)}>
              Close
            </Button>
            <Button
              onClick={() => previewing && applyMutation.mutate(previewing.id)}
              disabled={!previewing || applyMutation.isPending}
            >
              <Check className="h-4 w-4 mr-1" /> Apply this version
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
