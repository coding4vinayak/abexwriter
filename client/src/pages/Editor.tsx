import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { TEMP_USER_ID, formatDate, formatRelativeDate, countWords } from "@/lib/utils";
import ChapterSidebar from "@/components/editor/ChapterSidebar";
import EditorToolbar from "@/components/editor/EditorToolbar";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Book, Chapter } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export default function Editor() {
  const { bookId, chapterId } = useParams();
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch book data
  const { data: book, isLoading: isLoadingBook } = useQuery({
    queryKey: ["/api/books", bookId],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/books/${bookId}`,
        undefined
      );
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
        undefined
      );
      return res.json() as Promise<Chapter[]>;
    },
  });

  // Fetch active chapter content
  const { data: currentChapter, isLoading: isLoadingChapter } = useQuery({
    queryKey: ["/api/chapters", chapterId],
    queryFn: async () => {
      // Only fetch if chapterId is provided
      if (!chapterId) return null;
      
      const res = await apiRequest(
        "GET",
        `/api/chapters/${chapterId}`,
        undefined
      );
      return res.json() as Promise<Chapter>;
    },
    enabled: !!chapterId, // Only run the query if chapterId exists
  });

  // Set active chapter when data is loaded or chapterId changes
  useEffect(() => {
    if (currentChapter) {
      setActiveChapter(currentChapter);
      setContent(currentChapter.content || "");
    } else if (chapters && chapters.length > 0 && !chapterId) {
      // If no chapter is selected but we have chapters, default to the first one
      setActiveChapter(chapters[0]);
      setContent(chapters[0].content || "");
    }
  }, [currentChapter, chapters, chapterId]);

  // Mutation to save chapter content
  const saveChapterMutation = useMutation({
    mutationFn: async ({ id, content }: { id: number, content: string }) => {
      const res = await apiRequest(
        "PUT",
        `/api/chapters/${id}`,
        { content }
      );
      return res.json() as Promise<Chapter>;
    },
    onSuccess: (data) => {
      setActiveChapter(data);
      toast({
        title: "Chapter saved",
        description: "Your changes have been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/chapters", String(data.id)] });
      queryClient.invalidateQueries({ queryKey: ["/api/books", String(data.bookId), "chapters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      
      // Record writing activity for the heatmap
      const currentWordCount = countWords(content);
      const previousWordCount = activeChapter?.content ? countWords(activeChapter.content) : 0;
      const wordCountDiff = Math.max(0, currentWordCount - previousWordCount);
      
      if (wordCountDiff > 0) {
        // Only record activity if new words were written
        try {
          apiRequest(
            "POST",
            "/api/writing-activities",
            {
              userId: TEMP_USER_ID,
              bookId: data.bookId,
              chapterId: data.id,
              wordCount: wordCountDiff,
              activityDate: new Date().toISOString().split('T')[0]
            }
          ).then(() => {
            // Check for new achievements
            apiRequest(
              "POST",
              "/api/check-achievements",
              { userId: TEMP_USER_ID }
            ).then((res) => res.json())
              .then((newAchievements) => {
                if (newAchievements && newAchievements.length > 0) {
                  // Notify user of new achievements
                  newAchievements.forEach((achievement: any) => {
                    toast({
                      title: "Achievement Unlocked!",
                      description: `You've earned "${achievement.achievement.name}"`,
                      variant: "default",
                    });
                  });
                  // Invalidate achievements queries
                  queryClient.invalidateQueries({ queryKey: ["/api/user-achievements"] });
                }
              });
              
            // Invalidate writing activity and streak queries
            queryClient.invalidateQueries({ queryKey: ["/api/writing-activities"] });
            queryClient.invalidateQueries({ queryKey: ["/api/writing-streak"] });
          });
        } catch (error) {
          // Silently handle error - not critical for main functionality
          console.error("Error recording writing activity:", error);
        }
      }
      
      setIsSaving(false);
    },
    onError: (error) => {
      toast({
        title: "Error saving chapter",
        description: "There was a problem saving your changes.",
        variant: "destructive",
      });
      setIsSaving(false);
    },
  });

  // Create new chapter mutation
  const createChapterMutation = useMutation({
    mutationFn: async (chapterData: { 
      title: string, 
      bookId: number, 
      orderIndex: number,
      status: "outline" | "draft"
    }) => {
      const res = await apiRequest(
        "POST",
        "/api/chapters",
        chapterData
      );
      return res.json() as Promise<Chapter>;
    },
    onSuccess: (data) => {
      toast({
        title: "Chapter created",
        description: `"${data.title}" has been created.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/books", String(data.bookId), "chapters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      // Set the new chapter as active
      setActiveChapter(data);
      setContent(data.content || "");
    },
    onError: (error) => {
      toast({
        title: "Error creating chapter",
        description: "There was a problem creating the chapter.",
        variant: "destructive",
      });
    },
  });

  // Update book outline mutation
  const updateOutlineMutation = useMutation({
    mutationFn: async ({ id, outline }: { id: number, outline: string }) => {
      const res = await apiRequest(
        "PUT",
        `/api/books/${id}`,
        { outline }
      );
      return res.json() as Promise<Book>;
    },
    onSuccess: (data) => {
      toast({
        title: "Outline updated",
        description: "Book outline has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/books", String(data.id)] });
    },
    onError: (error) => {
      toast({
        title: "Error updating outline",
        description: "There was a problem updating the outline.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!activeChapter) return;
    
    setIsSaving(true);
    saveChapterMutation.mutate({
      id: activeChapter.id,
      content: content
    });
  };

  const handleCreateChapter = (title: string) => {
    if (!book) return;
    
    const newOrderIndex = chapters ? chapters.length : 0;
    createChapterMutation.mutate({
      title,
      bookId: book.id,
      orderIndex: newOrderIndex,
      status: "outline"
    });
  };

  const handleUpdateOutline = (outline: string) => {
    if (!book) return;
    
    updateOutlineMutation.mutate({
      id: book.id,
      outline
    });
  };

  const handleAutoEdit = () => {
    toast({
      title: "Auto-edit initiated",
      description: "AI is now analyzing and improving your chapter...",
    });
    
    // In a real implementation, this would call the LLM API for editing
    setTimeout(() => {
      toast({
        title: "Auto-edit complete",
        description: "Your chapter has been edited and improved.",
      });
    }, 2000);
  };

  const handleGenerateContent = () => {
    if (!activeChapter) return;
    
    // Check if the content is empty or just contains an outline
    const currentContent = content || "";
    const hasSubstantialContent = currentContent.length > 200;
    
    if (hasSubstantialContent) {
      // Show dialog to confirm replacement or enhancement
      if (!window.confirm("This chapter already has content. Do you want the AI to enhance it or create new content based on the outline?")) {
        return;
      }
    }
    
    toast({
      title: "AI generation initiated",
      description: "Generating chapter content with AI...",
    });
    
    // In a real implementation, this would call the LLM API for generation
    setTimeout(() => {
      // Parse the chapter outline if it exists
      const outline = activeChapter.outline || "";
      let headings: string[] = [];
      
      if (outline) {
        // Extract potential headings from the outline (assume headings are separated by newlines or bullet points)
        headings = outline
          .split(/\n|•|-|\./).filter(line => line.trim().length > 0)
          .map(line => line.trim())
          .slice(0, 5); // Limit to 5 headings
      }

      // Create content with headings from the outline
      let generatedContent = `# ${activeChapter.title}\n\n`;
      
      if (headings.length > 0) {
        // Create sections based on extracted headings
        headings.forEach(heading => {
          generatedContent += `## ${heading}\n\n`;
          generatedContent += `This section covers "${heading}". The AI will generate 2-3 paragraphs of relevant content for this section based on the book's theme and previous chapters.\n\n`;
        });
        
        generatedContent += `## Conclusion\n\nA thoughtful conclusion that wraps up the key points discussed in this chapter and sets up what's coming next.\n\n`;
      } else {
        // Generate default content structure
        generatedContent += "## Introduction\n\n";
        generatedContent += "An engaging introduction that sets the scene for this chapter and connects it to the overall narrative.\n\n";
        
        generatedContent += "## Main Content\n\n";
        generatedContent += "The main content of the chapter would explore the key themes and advance the narrative. This section would typically be 3-5 paragraphs long with rich descriptions and character development.\n\n";
        
        generatedContent += "## Conclusion\n\n";
        generatedContent += "A thoughtful conclusion that wraps up the key points and sets up what's coming next.\n\n";
      }
      
      // Set the generated content
      setContent(generatedContent);
      
      toast({
        title: "Content generation complete",
        description: "Content structure has been generated based on your outline. Review and enhance as needed.",
      });
    }, 2000);
  };

  // If there's a request to edit the chapter
  useEffect(() => {
    if (isEditing && activeChapter) {
      // Focus on the textarea
      const textarea = document.getElementById("chapter-content");
      if (textarea) {
        textarea.focus();
      }
    }
  }, [isEditing, activeChapter]);

  return (
    <div className="flex-1 flex overflow-hidden h-screen">
      {/* Chapter Navigation Sidebar */}
      <ChapterSidebar 
        book={book}
        chapters={chapters}
        activeChapterId={activeChapter?.id}
        isLoading={isLoadingBook || isLoadingChapters}
        onCreateChapter={handleCreateChapter}
        onUpdateOutline={handleUpdateOutline}
      />
      
      {/* Editor Main Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Editor Toolbar */}
        <EditorToolbar 
          chapter={activeChapter}
          onSave={handleSave}
          onAutoEdit={handleAutoEdit}
          onGenerateContent={handleGenerateContent}
          isSaving={isSaving}
        />
        
        {/* Editor Content Area */}
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
                placeholder="Start typing your chapter content here..."
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
                <h4 className="text-lg font-medium text-foreground mb-2">No Chapter Selected</h4>
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
    </div>
  );
}
