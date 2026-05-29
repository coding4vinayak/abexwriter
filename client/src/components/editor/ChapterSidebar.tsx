import { useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatNumber, formatRelativeDate } from "@/lib/utils";
import { Book, Chapter } from "@shared/schema";
import { PlusIcon, Wand2, CogIcon, GripVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import BookExportButton from "../BookExportButton";

interface ChapterSidebarProps {
  book?: Book;
  chapters?: Chapter[];
  activeChapterId?: number;
  isLoading: boolean;
  onCreateChapter: (title: string) => void;
  onUpdateOutline: (outline: string) => void;
}

export default function ChapterSidebar({
  book,
  chapters = [],
  activeChapterId,
  isLoading,
  onCreateChapter,
  onUpdateOutline,
}: ChapterSidebarProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [isNewChapterDialogOpen, setIsNewChapterDialogOpen] = useState(false);
  const [isOutlineDialogOpen, setIsOutlineDialogOpen] = useState(false);
  const [outlineText, setOutlineText] = useState(book?.outline || "");
  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);

  // Drag-and-drop state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const dragRef = useRef<number | null>(null);

  const handleCreateChapter = () => {
    if (!newChapterTitle.trim()) {
      toast({
        title: "Chapter title required",
        description: "Please enter a title for your new chapter.",
        variant: "destructive",
      });
      return;
    }
    onCreateChapter(newChapterTitle);
    setNewChapterTitle("");
    setIsNewChapterDialogOpen(false);
  };

  const handleSaveOutline = () => {
    onUpdateOutline(outlineText);
    setIsOutlineDialogOpen(false);
  };

  const handleGenerateOutline = () => {
    setIsGeneratingOutline(true);
    setTimeout(() => {
      const generatedOutline =
        "A fantasy novel about a young wizard's journey to discover ancient powers and save the realm from an ancient evil that threatens to return.";
      setOutlineText(generatedOutline);
      setIsGeneratingOutline(false);
      toast({
        title: "Outline generated",
        description: "The AI has generated a new outline for your book.",
      });
    }, 1500);
  };

  // ─── Drag and Drop Handlers ────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, index: number) => {
    dragRef.current = index;
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropIndex(index);
  };

  const handleDragLeave = () => {
    setDropIndex(null);
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    setDragIndex(null);
    setDropIndex(null);

    const sourceIndex = dragRef.current;
    if (sourceIndex === null || sourceIndex === targetIndex) return;
    if (!book) return;

    // Reorder locally
    const reordered = [...chapters];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    const chapterIds = reordered.map((c) => c.id);

    try {
      await apiRequest("PUT", "/api/chapters/reorder", {
        bookId: book.id,
        chapterIds,
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/books", String(book.id), "chapters"],
      });
      toast({ title: "Chapters reordered" });
    } catch {
      toast({
        title: "Reorder failed",
        description: "Could not save the new chapter order.",
        variant: "destructive",
      });
    }
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDropIndex(null);
    dragRef.current = null;
  };

  return (
    <div className="w-72 border-r border-border bg-card overflow-y-auto custom-scrollbar">
      {isLoading ? (
        <>
          <div className="px-4 py-3 border-b border-border bg-muted">
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="p-3 space-y-4">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-6 w-24" />
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="px-4 py-3 border-b border-border bg-muted flex items-center justify-between">
            <h3 className="text-md font-medium text-foreground truncate">
              {book?.title || "Book Project"}
            </h3>
            <div className="flex space-x-2">
              <button
                className="text-muted-foreground hover:text-primary"
                title="Add Chapter"
                onClick={() => setIsNewChapterDialogOpen(true)}
              >
                <PlusIcon className="h-4 w-4" />
              </button>
              <button
                className="text-muted-foreground hover:text-primary"
                title="Project Settings"
              >
                <CogIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="p-3">
            {/* Project Info */}
            {book && (
              <div className="mb-4 p-3 bg-muted/50 rounded-md border border-border">
                <div className="mb-2">
                  <span className="text-xs font-medium text-muted-foreground">Created</span>
                  <p className="text-sm text-foreground">{formatDate(book.createdAt)}</p>
                </div>
                <div className="mb-2">
                  <span className="text-xs font-medium text-muted-foreground">Last Updated</span>
                  <p className="text-sm text-foreground">{formatRelativeDate(book.updatedAt)}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Word Count</span>
                  <p className="text-sm text-foreground">{formatNumber(book.wordCount)} words</p>
                </div>
              </div>
            )}

            {/* Book Outline */}
            <div className="mb-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
                Outline
              </h4>
              <div className="bg-muted/50 rounded-md border border-border p-3 mb-2">
                <p className="text-sm text-foreground line-clamp-3">
                  {book?.outline || "No outline yet. Create one to help structure your book."}
                </p>
                {book && (
                  <div className="mt-2">
                    <BookExportButton book={book} />
                  </div>
                )}
                <button
                  onClick={() => {
                    setOutlineText(book?.outline || "");
                    setIsOutlineDialogOpen(true);
                  }}
                  className="mt-1 text-xs text-primary hover:text-primary/80 font-medium"
                >
                  Edit Outline
                </button>
              </div>
              <button
                onClick={handleGenerateOutline}
                disabled={isGeneratingOutline}
                className="text-xs text-primary hover:text-primary/80 flex items-center font-medium"
              >
                <Wand2 className="h-3 w-3 mr-1.5" />
                {isGeneratingOutline ? "Generating..." : "Generate New Outline"}
              </button>
            </div>

            {/* Chapters List */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
                  Chapters
                </h4>
                <button
                  onClick={() => setIsNewChapterDialogOpen(true)}
                  className="text-xs text-primary hover:text-primary/80 font-medium flex items-center"
                >
                  <PlusIcon className="h-3 w-3 mr-1" />
                  Add
                </button>
              </div>

              {chapters.length > 0 ? (
                <div className="space-y-1">
                  {chapters.map((chapter, index) => (
                    <div
                      key={chapter.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, index)}
                      onDragEnd={handleDragEnd}
                      className="relative"
                    >
                      {/* Drop indicator */}
                      {dropIndex === index && dragIndex !== index && (
                        <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary rounded-full z-10" />
                      )}
                      <Link href={`/editor/${book?.id}/chapter/${chapter.id}`}>
                        <div
                          className={`flex items-center px-2 py-2 text-sm font-medium text-foreground hover:bg-accent rounded-md cursor-pointer group transition-colors
                            ${chapter.id === activeChapterId ? "bg-accent border-l-4 border-primary" : ""}
                            ${dragIndex === index ? "opacity-50" : ""}
                          `}
                        >
                          <GripVertical className="h-3 w-3 mr-1 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab" />
                          <span className="mr-2 text-xs text-muted-foreground">
                            {index + 1}
                          </span>
                          <span
                            className={`flex-1 truncate ${chapter.status === "outline" ? "italic" : ""}`}
                          >
                            {chapter.title}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatNumber(chapter.wordCount)} w
                          </span>
                        </div>
                      </Link>
                    </div>
                  ))}

                  <Button
                    onClick={() => setIsNewChapterDialogOpen(true)}
                    variant="outline"
                    className="w-full mt-2"
                    size="sm"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" /> Add Chapter
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 px-4 text-center bg-muted/50 rounded-md border border-border">
                  <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
                    <i className="fas fa-file-alt text-muted-foreground"></i>
                  </div>
                  <h4 className="text-sm font-medium text-foreground mb-2">No Chapters Yet</h4>
                  <p className="text-xs text-muted-foreground mb-4">
                    Create your first chapter to start writing
                  </p>
                  <Button
                    onClick={() => setIsNewChapterDialogOpen(true)}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    size="sm"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" /> Add First Chapter
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* New Chapter Dialog */}
          <Dialog open={isNewChapterDialogOpen} onOpenChange={setIsNewChapterDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create New Chapter</DialogTitle>
                <DialogDescription>Enter a title for your new chapter.</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Input
                  id="chapter-title"
                  placeholder="Chapter title"
                  className="w-full"
                  value={newChapterTitle}
                  onChange={(e) => setNewChapterTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateChapter();
                  }}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsNewChapterDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={handleCreateChapter}
                >
                  Create Chapter
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Outline Dialog */}
          <Dialog open={isOutlineDialogOpen} onOpenChange={setIsOutlineDialogOpen}>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Edit Book Outline</DialogTitle>
                <DialogDescription>
                  Provide an outline for your book to help structure your writing.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Textarea
                  id="book-outline"
                  placeholder="Enter your book outline..."
                  className="w-full min-h-[200px]"
                  value={outlineText}
                  onChange={(e) => setOutlineText(e.target.value)}
                />
              </div>
              <DialogFooter className="flex justify-between items-center">
                <Button
                  variant="outline"
                  onClick={handleGenerateOutline}
                  disabled={isGeneratingOutline}
                  className="mr-auto"
                >
                  <Wand2 className="h-4 w-4 mr-2" />
                  {isGeneratingOutline ? "Generating..." : "Generate Outline"}
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsOutlineDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    onClick={handleSaveOutline}
                  >
                    Save Outline
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
