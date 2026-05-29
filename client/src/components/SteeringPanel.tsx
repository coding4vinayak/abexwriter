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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Compass, Plus, Trash2, ArrowUpCircle, ArrowDownCircle } from "lucide-react";

interface SteeringNote {
  id: number;
  bookId: number;
  chapterId: number | null;
  scope: "book" | "chapter";
  note: string;
  isActive: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  bookId: number;
  chapterId?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * A slide-over for managing author directives that get auto-injected into every
 * subsequent AI generation. Examples: "kill off the king in chapter 14",
 * "shift POV to Mira", "tone down violence going forward".
 *
 * Notes are sorted by priority desc — drag is overkill for now, +/- buttons
 * bump priority by 1.
 */
export default function SteeringPanel({ bookId, chapterId, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [draft, setDraft] = useState("");
  const [scope, setScope] = useState<"book" | "chapter">("book");

  const notesQuery = useQuery({
    queryKey: ["/api/books", bookId, "steering"],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/books/${bookId}/steering`, undefined);
      return (await r.json()) as SteeringNote[];
    },
    enabled: open && !!bookId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const body = {
        note: draft.trim(),
        scope,
        chapterId: scope === "chapter" ? chapterId ?? null : null,
        isActive: true,
        priority: 0,
      };
      const r = await apiRequest("POST", `/api/books/${bookId}/steering`, body);
      return (await r.json()) as SteeringNote;
    },
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["/api/books", bookId, "steering"] });
      toast({ title: "Directive added" });
    },
    onError: (e: any) =>
      toast({ title: "Could not add", description: e?.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: number;
      patch: Partial<Pick<SteeringNote, "isActive" | "priority" | "note">>;
    }) => {
      const r = await apiRequest("PUT", `/api/steering/${id}`, patch);
      return (await r.json()) as SteeringNote;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/books", bookId, "steering"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/steering/${id}`, undefined);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/books", bookId, "steering"] }),
  });

  const notes = notesQuery.data ?? [];
  const activeCount = notes.filter((n) => n.isActive).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Compass className="h-5 w-5" /> Steer the story
            <Badge variant="secondary">{activeCount} active</Badge>
          </SheetTitle>
          <SheetDescription>
            Tell the AI what to do next. Active directives are injected into every
            subsequent generation as `AUTHOR DIRECTIVES (must be obeyed)`.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* New directive */}
          <div className="space-y-2 border border-border rounded-md p-3 bg-muted/30">
            <Textarea
              rows={3}
              placeholder="e.g. 'Mira realises she's been lied to, but doesn't confront Jules until chapter 9.'"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Scope:</span>
              <button
                onClick={() => setScope("book")}
                className={`px-2 py-1 rounded-md text-xs ${
                  scope === "book"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background border border-border hover:bg-accent"
                }`}
              >
                Whole book
              </button>
              <button
                onClick={() => setScope("chapter")}
                disabled={!chapterId}
                className={`px-2 py-1 rounded-md text-xs ${
                  scope === "chapter"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background border border-border hover:bg-accent"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                This chapter only{!chapterId && " (open a chapter)"}
              </button>
              <Button
                size="sm"
                className="ml-auto"
                disabled={!draft.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
          </div>

          {/* List */}
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Existing directives ({notes.length})
            </div>
            {notesQuery.isLoading && <Skeleton className="h-20" />}
            {!notesQuery.isLoading && notes.length === 0 && (
              <p className="text-sm italic text-muted-foreground">
                No directives yet. Add one above and the AI will obey it on the next
                generation.
              </p>
            )}
            {notes.map((n) => (
              <div
                key={n.id}
                className={`border rounded-md p-3 space-y-2 ${
                  n.isActive ? "border-border bg-card" : "border-dashed border-border bg-muted/30"
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 text-sm">
                    {n.note}
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Badge variant={n.scope === "book" ? "default" : "secondary"}>
                        {n.scope}
                      </Badge>
                      <span>priority {n.priority}</span>
                      <span>· {new Date(n.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <Switch
                    checked={n.isActive}
                    onCheckedChange={(v) =>
                      updateMutation.mutate({ id: n.id, patch: { isActive: v } })
                    }
                  />
                </div>
                <div className="flex items-center gap-1 justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      updateMutation.mutate({
                        id: n.id,
                        patch: { priority: n.priority + 1 },
                      })
                    }
                    title="Higher priority"
                  >
                    <ArrowUpCircle className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      updateMutation.mutate({
                        id: n.id,
                        patch: { priority: n.priority - 1 },
                      })
                    }
                    title="Lower priority"
                  >
                    <ArrowDownCircle className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm("Delete this directive?")) deleteMutation.mutate(n.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
