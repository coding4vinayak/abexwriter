import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { TEMP_USER_ID, countWords } from "@/lib/utils";
import ChapterSidebar from "@/components/editor/ChapterSidebar";
import EditorToolbar from "@/components/editor/EditorToolbar";
import SteeringPanel from "@/components/SteeringPanel";
import VersionHistory from "@/components/VersionHistory";
import GenerateChapterDialog from "@/components/GenerateChapterDialog";
import HumanizeDialog from "@/components/HumanizeDialog";
import ImageGenerateDialog from "@/components/ImageGenerateDialog";
import ChapterImageGallery from "@/components/ChapterImageGallery";
import ExpandContinueDialog from "@/components/ExpandContinueDialog";
import ContextBudget from "@/components/ContextBudget";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Book, Chapter } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export default function Editor() {
  const { bookId, chapterId } = useParams();
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Side-panel state.
  const [steeringOpen, setSteeringOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [humanizeOpen, setHumanizeOpen] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [expandOpen, setExpandOpen] = useState(false);
  const [summarizing, setSummarizing] = useState(false);

  // Fetch book data
  const { data: book, isLoading: isLoadingBook } = useQuery({
    queryKey: ["/api/books", bookId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/books/${bookId}`, undefined);
      return res.json() as Promise<Book>;
    },
  });

  // Fetch chapters for this book
  const { data: chapters, isLoading: isLoadingChapters } = useQuery({
    queryKey: ["/api/books", bookId, "chapters"],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/books/${bookId}/chapters`,
        undefined,
      );
      return res.json() as Promise<Chapter[]>;
    },
  });

  // Fetch active chapter content
  const { data: currentChapter, isLoading: isLoadingChapter } = useQuery({
    queryKey: ["/api/chapters", chapterId],
    queryFn: async () => {
      if (!chapterId) return null;
      const res = await apiRequest("GET", `/api/chapters/${chapterId}`, undefined);
      return res.json() as Promise<Chapter>;
    },
    enabled: !!chapterId,
  });

  // Set active chapter when data is loaded or chapterId changes
  useEffect(() => {
    if (currentChapter) {
      setActiveChapter(currentChapter);
      setContent(currentChapter.content || "");
    } else if (chapters && chapters.length > 0 && !chapterId) {
      setActiveChapter(chapters[0]);
      setContent(chapters[0].content || "");
    }
  }, [currentChapter, chapters, chapterId]);

  // ───────────────────────────────────────────────────────────────────────
  // Mutations
  // ───────────────────────────────────────────────────────────────────────
  const saveChapterMutation = useMutation({
    mutationFn: async ({ id, content }: { id: number; content: string }) => {
      const res = await apiRequest("PUT", `/api/chapters/${id}`, { content });
      return res.json() as Promise<Chapter>;
    },
    onSuccess: (data) => {
      setActiveChapter(data);
      toast({
        title: "Chapter saved",
        description: "Your changes have been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/chapters", String(data.id)] });
      queryClient.invalidateQueries({
        queryKey: ["/api/books", String(data.bookId), "chapters"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });

      // Track word-count delta for the heatmap (kept from original).
      const currentWordCount = countWords(content);
      const previousWordCount = activeChapter?.content
        ? countWords(activeChapter.content)
        : 0;
      const wordCountDiff = Math.max(0, currentWordCount - previousWordCount);
      if (wordCountDiff > 0) {
        try {
          apiRequest("POST", "/api/writing-activities", {
            userId: TEMP_USER_ID,
            bookId: data.bookId,
            chapterId: data.id,
            wordCount: wordCountDiff,
            activityDate: new Date().toISOString().split("T")[0],
          })
            .then(() =>
              apiRequest("POST", "/api/check-achievements", { userId: TEMP_USER_ID })
                .then((r) => r.json())
                .then((newAchievements) => {
                  if (newAchievements?.length > 0) {
                    newAchievements.forEach((a: any) =>
                      toast({
                        title: "Achievement Unlocked!",
                        description: `You've earned "${a.achievement.name}"`,
                      }),
                    );
                    queryClient.invalidateQueries({ queryKey: ["/api/user-achievements"] });
                  }
                }),
            )
            .then(() => {
              queryClient.invalidateQueries({ queryKey: ["/api/writing-activities"] });
              queryClient.invalidateQueries({ queryKey: ["/api/writing-streak"] });
            });
        } catch (e) {
          console.error("Error recording writing activity:", e);
        }
      }

      setIsSaving(false);
    },
    onError: () => {
      toast({
        title: "Error saving chapter",
        description: "There was a problem saving your changes.",
        variant: "destructive",
      });
      setIsSaving(false);
    },
  });

  const createChapterMutation = useMutation({
    mutationFn: async (chapterData: {
      title: string;
      bookId: number;
      orderIndex: number;
      status: "outline" | "draft";
    }) => {
      const res = await apiRequest("POST", "/api/chapters", chapterData);
      return res.json() as Promise<Chapter>;
    },
    onSuccess: (data) => {
      toast({ title: "Chapter created", description: `"${data.title}" has been created.` });
      queryClient.invalidateQueries({
        queryKey: ["/api/books", String(data.bookId), "chapters"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setActiveChapter(data);
      setContent(data.content || "");
    },
    onError: () =>
      toast({
        title: "Error creating chapter",
        description: "There was a problem creating the chapter.",
        variant: "destructive",
      }),
  });

  const updateOutlineMutation = useMutation({
    mutationFn: async ({ id, outline }: { id: number; outline: string }) => {
      const res = await apiRequest("PUT", `/api/books/${id}`, { outline });
      return res.json() as Promise<Book>;
    },
    onSuccess: (data) => {
      toast({ title: "Outline updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/books", String(data.id)] });
    },
    onError: () =>
      toast({
        title: "Error updating outline",
        description: "There was a problem updating the outline.",
        variant: "destructive",
      }),
  });

  // ───────────────────────────────────────────────────────────────────────
  // Handlers
  // ───────────────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!activeChapter) return;
    setIsSaving(true);
    saveChapterMutation.mutate({ id: activeChapter.id, content });
  };

  const handleCreateChapter = (title: string) => {
    if (!book) return;
    createChapterMutation.mutate({
      title,
      bookId: book.id,
      orderIndex: chapters ? chapters.length : 0,
      status: "outline",
    });
  };

  const handleUpdateOutline = (outline: string) => {
    if (!book) return;
    updateOutlineMutation.mutate({ id: book.id, outline });
  };

  const handleAutoEdit = () => {
    toast({
      title: "Auto-Edit not wired yet",
      description:
        "The humanizer / cliché-remover passes ship in a follow-up PR. Use AI Generate for now.",
    });
  };

  /** Replace the chapter content with a freshly-generated version. */
  const handleGenerated = (text: string, _generationId: number) => {
    if (!activeChapter) return;
    setContent(text);
    setIsSaving(true);
    saveChapterMutation.mutate({ id: activeChapter.id, content: text });
  };

  /** Called from the Versions drawer when the user applies a saved version. */
  const handleAppliedFromVersions = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/chapters", String(activeChapter?.id)] });
    if (activeChapter) {
      apiRequest("GET", `/api/chapters/${activeChapter.id}`, undefined)
        .then((r) => r.json())
        .then((c: Chapter) => {
          setContent(c.content || "");
          setActiveChapter(c);
        })
        .catch(() => undefined);
    }
  };

  /** Feature 1: Summarize chapter */
  const handleSummarize = async () => {
    if (!activeChapter || !book) return;
    // We need provider/model — use last stored preference
    let provider = "openai";
    let model = "";
    let mode: "byok" | "platform" = "byok";
    let apiKeyId: number | undefined;
    try {
      const last = localStorage.getItem("abexwriter:lastModel");
      if (last) {
        const v = JSON.parse(last);
        if (v.provider) provider = v.provider;
        if (v.model) model = v.model;
        if (v.mode) mode = v.mode;
      }
    } catch { /* ignore */ }

    // Get the first active key for this provider
    try {
      const keysRes = await apiRequest("GET", "/api/api-keys", undefined);
      const keys = (await keysRes.json()) as any[];
      const key = keys.find((k: any) => k.provider === provider && k.isActive);
      if (key) apiKeyId = key.id;

      if (!model) {
        const provRes = await apiRequest("GET", "/api/llm/providers", undefined);
        const provData = (await provRes.json()) as { providers: any[] };
        const prov = provData.providers.find((p: any) => p.id === provider);
        if (prov?.models?.[0]) model = prov.models[0].id;
      }
    } catch { /* ignore */ }

    if (!model || (!apiKeyId && mode === "byok")) {
      toast({
        title: "Configure API key first",
        description: "Go to Settings > API Keys to add a key before summarizing.",
        variant: "destructive",
      });
      return;
    }

    setSummarizing(true);
    try {
      const body: any = { provider, model, mode };
      if (apiKeyId) body.apiKeyId = apiKeyId;
      const res = await apiRequest("POST", `/api/chapters/${activeChapter.id}/summarize`, body);
      const data = await res.json();
      toast({
        title: "Chapter summarized",
        description: data.summary?.slice(0, 100) + "…",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/books", String(book.id), "bible"] });
      queryClient.invalidateQueries({ queryKey: ["/api/books", String(book.id), "chapter-summaries"] });
    } catch (err: any) {
      toast({
        title: "Summarize failed",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSummarizing(false);
    }
  };

  /** Feature 2: Expand/continue — append result to content */
  const handleExpanded = (newText: string, _generationId: number) => {
    if (!activeChapter) return;
    const updated = content + "\n\n" + newText;
    setContent(updated);
    setIsSaving(true);
    saveChapterMutation.mutate({ id: activeChapter.id, content: updated });
  };

  return (
    <div className="flex-1 flex overflow-hidden h-screen">
      <ChapterSidebar
        book={book}
        chapters={chapters}
        activeChapterId={activeChapter?.id}
        isLoading={isLoadingBook || isLoadingChapters}
        onCreateChapter={handleCreateChapter}
        onUpdateOutline={handleUpdateOutline}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <EditorToolbar
          chapter={activeChapter}
          bookId={book?.id}
          content={content}
          onSave={handleSave}
          onAutoEdit={handleAutoEdit}
          onGenerateContent={() => {
            if (!activeChapter) return;
            setGenerateOpen(true);
          }}
          onOpenSteering={() => setSteeringOpen(true)}
          onOpenVersions={() => setVersionsOpen(true)}
          onHumanize={() => {
            if (!activeChapter || !content.trim()) return;
            setHumanizeOpen(true);
          }}
          onGenerateImage={() => {
            if (!activeChapter) return;
            setImageDialogOpen(true);
          }}
          onSummarize={handleSummarize}
          onExpand={() => {
            if (!activeChapter || !content.trim()) return;
            setExpandOpen(true);
          }}
          isSaving={isSaving}
        />

        {/* Feature 6: Context Budget Display */}
        {book && <ContextBudget bookId={book.id} chapterId={activeChapter?.id} />}

        <div className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 py-6 bg-background max-h-[calc(100vh-60px)]">
          {isLoadingChapter || (chapterId && !currentChapter) ? (
            <div className="max-w-3xl mx-auto bg-card shadow-sm rounded-lg p-6 border border-border">
              <Skeleton className="h-[600px] w-full" />
            </div>
          ) : activeChapter ? (
            <div className="max-w-3xl mx-auto bg-card shadow-sm rounded-lg p-6 border border-border">
              <Textarea
                id="chapter-content"
                className="w-full h-full min-h-[500px] text-foreground text-base leading-relaxed focus:outline-none font-sans resize-none border-0 p-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-card"
                placeholder="Start typing your chapter content here, or click 'AI Generate' to draft from your outline."
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>
          ) : (
            <div className="max-w-3xl mx-auto bg-card shadow-sm rounded-lg p-6 border border-border text-center">
              <div className="py-12">
                <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center mb-4">
                  <i className="fas fa-book text-muted-foreground text-xl"></i>
                </div>
                <h4 className="text-lg font-medium text-foreground mb-2">
                  No Chapter Selected
                </h4>
                <p className="text-sm text-muted-foreground mb-6">
                  {chapters && chapters.length > 0
                    ? "Select a chapter from the sidebar to start editing."
                    : "Create your first chapter to start writing."}
                </p>
                {chapters && chapters.length === 0 && (
                  <Button
                    onClick={() => handleCreateChapter("Chapter 1")}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    Create First Chapter
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Side panels */}
      {book && (
        <SteeringPanel
          bookId={book.id}
          chapterId={activeChapter?.id}
          open={steeringOpen}
          onOpenChange={setSteeringOpen}
        />
      )}
      {activeChapter && (
        <VersionHistory
          chapterId={activeChapter.id}
          open={versionsOpen}
          onOpenChange={setVersionsOpen}
          onApplied={handleAppliedFromVersions}
        />
      )}
      {book && activeChapter && (
        <GenerateChapterDialog
          open={generateOpen}
          onOpenChange={setGenerateOpen}
          bookId={book.id}
          chapterId={activeChapter.id}
          chapterTitle={activeChapter.title}
          chapterOutline={activeChapter.outline ?? ""}
          onGenerated={handleGenerated}
        />
      )}
      {book && activeChapter && (
        <HumanizeDialog
          open={humanizeOpen}
          onOpenChange={setHumanizeOpen}
          initialText={content}
          bookId={book.id}
          chapterId={activeChapter.id}
          onAccept={(text, _genId) => {
            setContent(text);
            setIsSaving(true);
            saveChapterMutation.mutate({ id: activeChapter.id, content: text });
          }}
        />
      )}
      {book && activeChapter && (
        <ExpandContinueDialog
          open={expandOpen}
          onOpenChange={setExpandOpen}
          bookId={book.id}
          chapterId={activeChapter.id}
          currentContent={content}
          onExpanded={handleExpanded}
        />
      )}
      {book && activeChapter && (
        <ImageGenerateDialog
          open={imageDialogOpen}
          onOpenChange={setImageDialogOpen}
          bookId={book.id}
          chapterId={activeChapter.id}
        />
      )}
      {activeChapter && (
        <ChapterImageGallery
          chapterId={activeChapter.id}
          open={galleryOpen}
          onOpenChange={setGalleryOpen}
        />
      )}
    </div>
  );
}
