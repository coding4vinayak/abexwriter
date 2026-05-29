import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useLocation } from "wouter";
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
import InlineAICommand from "@/components/InlineAICommand";
import ResearchPanel from "@/components/ResearchPanel";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Book, Chapter } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export default function Editor() {
  const { bookId, chapterId } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedContent, setLastSavedContent] = useState("");
  const [autoSaveLabel, setAutoSaveLabel] = useState<string | null>(null);

  // Focus mode
  const [focusMode, setFocusMode] = useState(false);

  // Inline AI Command
  const [commandOpen, setCommandOpen] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const selectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

  // Research panel
  const [researchOpen, setResearchOpen] = useState(false);

  // Side-panel state
  const [steeringOpen, setSteeringOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [humanizeOpen, setHumanizeOpen] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [expandOpen, setExpandOpen] = useState(false);
  const [summarizing, setSummarizing] = useState(false);

  // isDirty
  const isDirty = content !== lastSavedContent;

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
      const res = await apiRequest("GET", `/api/books/${bookId}/chapters`, undefined);
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
      setLastSavedContent(currentChapter.content || "");
    } else if (chapters && chapters.length > 0 && !chapterId) {
      setActiveChapter(chapters[0]);
      setContent(chapters[0].content || "");
      setLastSavedContent(chapters[0].content || "");
    }
  }, [currentChapter, chapters, chapterId]);

  // ───────────────────────────────────────────────────────────────────────
  // Auto-save (Feature 3): debounce 2000ms after last keystroke
  // ───────────────────────────────────────────────────────────────────────
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!activeChapter) return;
    if (content === lastSavedContent) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      // Auto-save
      saveChapterMutation.mutate({ id: activeChapter.id, content });
      setAutoSaveLabel("Auto-saved");
      setTimeout(() => setAutoSaveLabel(null), 2000);
    }, 2000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [content, activeChapter?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ───────────────────────────────────────────────────────────────────────
  // Unsaved changes warning (Feature 12)
  // ───────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // ───────────────────────────────────────────────────────────────────────
  // Keyboard Shortcuts (Feature 4)
  // ───────────────────────────────────────────────────────────────────────
  const shortcutHandlers = useMemo(
    () => ({
      save: () => handleSave(),
      generate: () => {
        if (activeChapter) setGenerateOpen(true);
      },
      humanize: () => {
        if (activeChapter && content.trim()) setHumanizeOpen(true);
      },
      expand: () => {
        if (activeChapter && content.trim()) setExpandOpen(true);
      },
      steer: () => setSteeringOpen(true),
      versions: () => setVersionsOpen(true),
      focusMode: () => setFocusMode((f) => !f),
      commandPalette: () => {
        // Get selected text from textarea
        const ta = textareaRef.current;
        if (ta) {
          const start = ta.selectionStart;
          const end = ta.selectionEnd;
          selectionRef.current = { start, end };
          if (start !== end) {
            setSelectedText(content.slice(start, end));
          } else {
            // Select the current paragraph
            const before = content.slice(0, start);
            const after = content.slice(start);
            const paraStart = before.lastIndexOf("\n\n") + 2 || 0;
            const paraEnd = after.indexOf("\n\n");
            const end2 = paraEnd === -1 ? content.length : start + paraEnd;
            setSelectedText(content.slice(paraStart, end2));
            selectionRef.current = { start: paraStart, end: end2 };
          }
        } else {
          setSelectedText(content.slice(0, 500));
          selectionRef.current = { start: 0, end: 500 };
        }
        setCommandOpen(true);
      },
    }),
    [activeChapter, content] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useKeyboardShortcuts(shortcutHandlers);

  // ───────────────────────────────────────────────────────────────────────
  // Mutations
  // ───────────────────────────────────────────────────────────────────────
  const saveChapterMutation = useMutation({
    mutationFn: async ({ id, content: c }: { id: number; content: string }) => {
      const res = await apiRequest("PUT", `/api/chapters/${id}`, { content: c });
      return res.json() as Promise<Chapter>;
    },
    onSuccess: (data) => {
      setActiveChapter(data);
      setLastSavedContent(data.content || "");
      if (!autoSaveLabel) {
        toast({
          title: "Chapter saved",
          description: "Your changes have been saved successfully.",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/chapters", String(data.id)] });
      queryClient.invalidateQueries({
        queryKey: ["/api/books", String(data.bookId), "chapters"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });

      // Track word-count delta
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
      setLastSavedContent(data.content || "");
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
  const handleSave = useCallback(() => {
    if (!activeChapter) return;
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    setIsSaving(true);
    saveChapterMutation.mutate({ id: activeChapter.id, content });
  }, [activeChapter, content]); // eslint-disable-line react-hooks/exhaustive-deps

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
        "The humanizer / cliche-remover passes ship in a follow-up PR. Use AI Generate for now.",
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
          setLastSavedContent(c.content || "");
          setActiveChapter(c);
        })
        .catch(() => undefined);
    }
  };

  /** Summarize chapter */
  const handleSummarize = async () => {
    if (!activeChapter || !book) return;
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
    } catch {
      /* ignore */
    }

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
    } catch {
      /* ignore */
    }

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
        description: data.summary?.slice(0, 100) + "...",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/books", String(book.id), "bible"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/books", String(book.id), "chapter-summaries"],
      });
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

  /** Expand/continue */
  const handleExpanded = (newText: string, _generationId: number) => {
    if (!activeChapter) return;
    const updated = content + "\n\n" + newText;
    setContent(updated);
    setIsSaving(true);
    saveChapterMutation.mutate({ id: activeChapter.id, content: updated });
  };

  /** Inline AI command result */
  const handleCommandResult = (newText: string) => {
    const { start, end } = selectionRef.current;
    const updated = content.slice(0, start) + newText + content.slice(end);
    setContent(updated);
  };

  /** Insert research text */
  const handleResearchInsert = (text: string) => {
    const updated = content + text;
    setContent(updated);
  };

  // Focus mode: ESC to exit
  useEffect(() => {
    if (!focusMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFocusMode(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [focusMode]);

  // ───────────────────────────────────────────────────────────────────────
  // Render: Focus Mode
  // ───────────────────────────────────────────────────────────────────────
  if (focusMode) {
    const wordCount = countWords(content);
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center">
        <div className="w-full max-w-2xl px-6 py-8 flex-1 flex flex-col">
          <Textarea
            ref={textareaRef}
            className="flex-1 w-full text-foreground text-lg leading-relaxed font-serif resize-none border-0 p-0 shadow-none focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
            placeholder="Write freely..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 text-xs text-muted-foreground">
          <span>{wordCount.toLocaleString()} words</span>
          {isDirty && <span className="text-yellow-500">Unsaved</span>}
          {autoSaveLabel && <span className="text-green-500">{autoSaveLabel}</span>}
          <span>Press ESC to exit focus mode</span>
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────
  // Render: Normal Mode
  // ───────────────────────────────────────────────────────────────────────
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
          onResearch={() => setResearchOpen(true)}
          onFocusMode={() => setFocusMode(true)}
          isSaving={isSaving}
          isDirty={isDirty}
          autoSaveLabel={autoSaveLabel}
        />

        {/* Context Budget Display */}
        {book && <ContextBudget bookId={book.id} chapterId={activeChapter?.id} />}

        <div className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 py-6 bg-background max-h-[calc(100vh-60px)]">
          {isLoadingChapter || (chapterId && !currentChapter) ? (
            <div className="max-w-3xl mx-auto bg-card shadow-sm rounded-lg p-6 border border-border">
              <Skeleton className="h-[600px] w-full" />
            </div>
          ) : activeChapter ? (
            <div className="max-w-3xl mx-auto bg-card shadow-sm rounded-lg p-6 border border-border">
              <Textarea
                ref={textareaRef}
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

      {/* Inline AI Command Palette */}
      <InlineAICommand
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        selectedText={selectedText}
        onResult={handleCommandResult}
      />

      {/* Research Panel */}
      <ResearchPanel
        open={researchOpen}
        onOpenChange={setResearchOpen}
        onInsert={handleResearchInsert}
      />
    </div>
  );
}
