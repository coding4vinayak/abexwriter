import { useState } from "react";
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
  DialogTrigger
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatNumber, formatRelativeDate } from "@/lib/utils";
import { Book, Chapter } from "@shared/schema";
import { PlusIcon, Wand2, CogIcon, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
  onUpdateOutline
}: ChapterSidebarProps) {
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [isNewChapterDialogOpen, setIsNewChapterDialogOpen] = useState(false);
  const [isOutlineDialogOpen, setIsOutlineDialogOpen] = useState(false);
  const [isGenerateChaptersDialogOpen, setIsGenerateChaptersDialogOpen] = useState(false);
  const [outlineText, setOutlineText] = useState(book?.outline || "");
  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);
  const [isGeneratingChapters, setIsGeneratingChapters] = useState(false);
  const [generatedChapters, setGeneratedChapters] = useState<{title: string, outline: string}[]>([]);
  const [selectedChapters, setSelectedChapters] = useState<{title: string, outline: string}[]>([]);

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
    // In a real implementation, this would call the LLM API
    setTimeout(() => {
      const generatedOutline = "A fantasy novel about a young wizard's journey to discover ancient powers and save the realm from an ancient evil that threatens to return.";
      setOutlineText(generatedOutline);
      setIsGeneratingOutline(false);
      toast({
        title: "Outline generated",
        description: "The AI has generated a new outline for your book.",
      });
    }, 1500);
  };
  
  const handleGenerateChapters = () => {
    setIsGeneratingChapters(true);
    setGeneratedChapters([]);
    
    // In a real implementation, this would call the LLM API with the book title and outline
    setTimeout(() => {
      const chapters = [
        {
          title: "The Awakening",
          outline: "The protagonist discovers they have magical abilities after an unexpected incident in their village."
        },
        {
          title: "The Mentor's Call",
          outline: "An aging wizard takes the protagonist under their wing to teach them about their newfound powers."
        },
        {
          title: "First Trials",
          outline: "The protagonist faces their first real challenges and begins to understand the responsibility of their power."
        },
        {
          title: "Dark Revelations",
          outline: "Ancient scrolls reveal a prophecy about the return of an ancient evil force that once nearly destroyed the realm."
        },
        {
          title: "Journey to the Lost Temple",
          outline: "The protagonist and their mentor embark on a journey to find an ancient artifact that could help defeat the coming darkness."
        }
      ];
      
      setGeneratedChapters(chapters);
      setSelectedChapters(chapters); // Select all by default
      setIsGeneratingChapters(false);
      
      toast({
        title: "Chapters generated",
        description: "The AI has suggested chapter structures for your book.",
      });
    }, 2000);
  };
  
  const handleCreateGeneratedChapters = () => {
    // In a real implementation, this would create all the selected chapters at once
    selectedChapters.forEach(chapter => {
      onCreateChapter(chapter.title);
      // And would also set the outline for each chapter
    });
    
    setIsGenerateChaptersDialogOpen(false);
    
    toast({
      title: "Chapters created",
      description: `Added ${selectedChapters.length} AI-generated chapters to your book.`,
    });
  };

  return (
    <div className="w-72 border-r border-gray-200 bg-white overflow-y-auto custom-scrollbar">
      {isLoading ? (
        // Loading state
        <>
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
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
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h3 className="text-md font-medium text-gray-800 truncate">
              {book?.title || "Book Project"}
            </h3>
            <div className="flex space-x-2">
              <button 
                className="text-gray-500 hover:text-primary"
                title="Add Chapter"
                onClick={() => setIsNewChapterDialogOpen(true)}
              >
                <PlusIcon className="h-4 w-4" />
              </button>
              <button 
                className="text-gray-500 hover:text-primary"
                title="Project Settings"
              >
                <CogIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
          
          <div className="p-3">
            {/* Project Info */}
            {book && (
              <div className="mb-4 p-3 bg-gray-50 rounded-md border border-gray-200">
                <div className="mb-2">
                  <span className="text-xs font-medium text-gray-500">Created</span>
                  <p className="text-sm text-gray-700">{formatDate(book.createdAt)}</p>
                </div>
                <div className="mb-2">
                  <span className="text-xs font-medium text-gray-500">Last Updated</span>
                  <p className="text-sm text-gray-700">{formatRelativeDate(book.updatedAt)}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-gray-500">Word Count</span>
                  <p className="text-sm text-gray-700">{formatNumber(book.wordCount)} words</p>
                </div>
              </div>
            )}
            
            {/* Book Outline */}
            <div className="mb-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 px-1">Outline</h4>
              <div className="bg-gray-50 rounded-md border border-gray-200 p-3 mb-2">
                <p className="text-sm text-gray-700 line-clamp-3">
                  {book?.outline || "No outline yet. Create one to help structure your book."}
                </p>
                {book && <div className="mt-2">
                  <BookExportButton book={book} />
                </div>}
                <button 
                  onClick={() => {
                    setOutlineText(book?.outline || "");
                    setIsOutlineDialogOpen(true);
                  }} 
                  className="mt-1 text-xs text-primary hover:text-primary-600 font-medium"
                >
                  Edit Outline
                </button>
              </div>
              <button 
                onClick={handleGenerateOutline}
                disabled={isGeneratingOutline}
                className="text-xs text-primary hover:text-primary-600 flex items-center font-medium"
              >
                <Wand2 className="h-3 w-3 mr-1.5" /> 
                {isGeneratingOutline ? "Generating..." : "Generate New Outline"}
              </button>
            </div>
            
            {/* Chapters List */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 px-1">Chapters</h4>
                <div className="flex space-x-3">
                  <button 
                    onClick={() => setIsGenerateChaptersDialogOpen(true)}
                    className="text-xs text-primary hover:text-primary-600 font-medium flex items-center"
                  >
                    <Wand2 className="h-3 w-3 mr-1" />
                    AI Generate
                  </button>
                  <button className="text-xs text-primary hover:text-primary-600 font-medium">
                    Reorder
                  </button>
                </div>
              </div>
              
              {chapters.length > 0 ? (
                <div className="space-y-1">
                  {chapters.map((chapter, index) => (
                    <Link 
                      key={chapter.id}
                      href={`/editor/${book?.id}/chapter/${chapter.id}`}
                    >
                      <div 
                        className={`flex items-center px-2 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md cursor-pointer group transition-colors
                          ${chapter.id === activeChapterId ? "bg-primary-50 border-l-4 border-primary" : ""}
                        `}
                      >
                        <span className="mr-3 text-xs text-gray-400">{index + 1}</span>
                        <span className={`flex-1 truncate ${chapter.status === 'outline' ? 'italic' : ''}`}>
                          {chapter.title}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatNumber(chapter.wordCount)} words
                        </span>
                      </div>
                    </Link>
                  ))}
                  
                  <Button 
                    onClick={() => setIsNewChapterDialogOpen(true)}
                    variant="outline" 
                    className="w-full mt-2"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" /> Add Chapter
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 px-4 text-center bg-gray-50 rounded-md border border-gray-200">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <i className="fas fa-file-alt text-gray-400"></i>
                  </div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">No Chapters Yet</h4>
                  <p className="text-xs text-gray-500 mb-4">Create your first chapter to start writing</p>
                  <Button 
                    onClick={() => setIsNewChapterDialogOpen(true)}
                    className="bg-primary hover:bg-primary-600 text-white"
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
                <DialogDescription>
                  Enter a title for your new chapter.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Input
                  id="chapter-title"
                  placeholder="Chapter title"
                  className="w-full"
                  value={newChapterTitle}
                  onChange={(e) => setNewChapterTitle(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsNewChapterDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-primary hover:bg-primary-600 text-white"
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
                  <Button
                    variant="outline"
                    onClick={() => setIsOutlineDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="bg-primary hover:bg-primary-600 text-white"
                    onClick={handleSaveOutline}
                  >
                    Save Outline
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          {/* Generate Chapters Dialog */}
          <Dialog open={isGenerateChaptersDialogOpen} onOpenChange={setIsGenerateChaptersDialogOpen}>
            <DialogContent className="sm:max-w-[700px]">
              <DialogHeader>
                <DialogTitle>AI-Generated Chapters</DialogTitle>
                <DialogDescription>
                  Generate chapter suggestions based on your book's title and outline.
                </DialogDescription>
              </DialogHeader>
              
              {isGeneratingChapters ? (
                <div className="py-8 flex flex-col items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                  <p className="text-sm text-gray-500">Creating chapter suggestions based on your book...</p>
                </div>
              ) : generatedChapters.length > 0 ? (
                <div className="py-4">
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">
                      Select the chapters you want to include in your book:
                    </p>
                    
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                      {generatedChapters.map((chapter, idx) => (
                        <div 
                          key={idx} 
                          className="p-3 border border-gray-200 rounded-md hover:border-gray-300 transition-colors"
                        >
                          <div className="flex items-center mb-2">
                            <input
                              type="checkbox"
                              id={`chapter-${idx}`}
                              checked={selectedChapters.some(c => c.title === chapter.title)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedChapters([...selectedChapters, chapter]);
                                } else {
                                  setSelectedChapters(
                                    selectedChapters.filter(c => c.title !== chapter.title)
                                  );
                                }
                              }}
                              className="h-4 w-4 text-primary rounded border-gray-300 mr-3"
                            />
                            <label htmlFor={`chapter-${idx}`} className="flex-1 font-medium">
                              Chapter {idx + 1}: {chapter.title}
                            </label>
                          </div>
                          <p className="text-sm text-gray-600 pl-7">{chapter.outline}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-4">
                  <p className="text-sm text-gray-600 mb-4">
                    The AI will analyze your book's title and outline to suggest a chapter structure.
                  </p>
                </div>
              )}
              
              <DialogFooter>
                {generatedChapters.length === 0 ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setIsGenerateChaptersDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="bg-primary hover:bg-primary-600 text-white"
                      onClick={handleGenerateChapters}
                      disabled={isGeneratingChapters}
                    >
                      <Wand2 className="h-4 w-4 mr-2" />
                      Generate Chapter Suggestions
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="mr-auto">
                      <Button
                        variant="outline"
                        onClick={handleGenerateChapters}
                        disabled={isGeneratingChapters}
                      >
                        <Wand2 className="h-4 w-4 mr-2" />
                        Regenerate
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setIsGenerateChaptersDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        className="bg-primary hover:bg-primary-600 text-white"
                        onClick={handleCreateGeneratedChapters}
                        disabled={selectedChapters.length === 0}
                      >
                        Add {selectedChapters.length} Chapters
                      </Button>
                    </div>
                  </>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
