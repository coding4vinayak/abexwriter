import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { TEMP_USER_ID } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { BookIcon, Wand2, LayoutList, CheckCircle, Send, Sparkles } from "lucide-react";

// Types for chapter outlines
interface ChapterOutline {
  title: string;
  outline: string;
}

export default function BookGenerator() {
  const { toast } = useToast();
  const [bookTitle, setBookTitle] = useState("");
  const [bookDescription, setBookDescription] = useState("");
  const [genre, setGenre] = useState("fantasy");
  const [numberOfChapters, setNumberOfChapters] = useState(5);
  const [chapterOutlines, setChapterOutlines] = useState<ChapterOutline[]>([]);
  const [isGeneratingOutlines, setIsGeneratingOutlines] = useState(false);
  const [isGeneratingBook, setIsGeneratingBook] = useState(false);
  const [generatedBookId, setGeneratedBookId] = useState<number | null>(null);
  
  // Fetch LLM settings
  const { data: llmSettings, isLoading: isLoadingLlmSettings } = useQuery({
    queryKey: ["/api/llm-settings/default"],
    queryFn: async () => {
      try {
        const res = await apiRequest(
          "GET",
          "/api/llm-settings/default",
          undefined
        );
        return res.json();
      } catch (error) {
        toast({
          title: "Error loading LLM settings",
          description: "Please configure your LLM settings in the Settings page.",
          variant: "destructive",
        });
        throw error;
      }
    }
  });
  
  // Create new book mutation
  const createBookMutation = useMutation({
    mutationFn: async (bookData: { 
      title: string;
      description: string;
      userId: number;
      outline: string;
      status: "draft";
      llmSettingsId?: number;
    }) => {
      const res = await apiRequest("POST", "/api/books", bookData);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Book created successfully!",
        description: `"${data.title}" has been created.`,
      });
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      queryClient.invalidateQueries({ queryKey: ["/api/books/recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      
      // Set the created book ID
      setGeneratedBookId(data.id);
      
      // Start generating chapters for this book
      generateChapters(data.id, chapterOutlines);
    },
    onError: (error) => {
      toast({
        title: "Failed to create book",
        description: "An error occurred while creating your book. Please try again.",
        variant: "destructive",
      });
      setIsGeneratingBook(false);
    },
  });
  
  // Create chapter mutation
  const createChapterMutation = useMutation({
    mutationFn: async (chapterData: {
      title: string;
      outline: string;
      content?: string;
      bookId: number;
      status: "outline" | "draft" | "completed";
      orderIndex: number;
    }) => {
      const res = await apiRequest("POST", "/api/chapters", chapterData);
      return res.json();
    }
  });
  
  const generateChapterOutlines = async () => {
    if (!bookTitle || !bookDescription || !genre) {
      toast({
        title: "Missing information",
        description: "Please provide book title, description, and select a genre.",
        variant: "destructive",
      });
      return;
    }
    
    if (!llmSettings) {
      toast({
        title: "LLM settings not configured",
        description: "Please configure your LLM settings in the Settings page.",
        variant: "destructive",
      });
      return;
    }
    
    setIsGeneratingOutlines(true);
    
    try {
      // Call our server-side LLM generation endpoint
      const res = await apiRequest(
        "POST",
        "/api/generate/chapter-outlines",
        {
          title: bookTitle,
          description: bookDescription,
          genre: genre,
          numberOfChapters: numberOfChapters,
          llmSettingsId: llmSettings.id
        }
      );
      
      const data = await res.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setChapterOutlines(data.outlines);
      setIsGeneratingOutlines(false);
      
      toast({
        title: "Chapter outlines generated",
        description: `Generated ${data.outlines.length} chapter outlines for your book.`,
      });
    } catch (error) {
      console.error("Error generating outlines:", error);
      toast({
        title: "Error generating outlines",
        description: error.message || "An error occurred while generating chapter outlines.",
        variant: "destructive",
      });
      setIsGeneratingOutlines(false);
    }
  };
  
  const generateChapters = async (bookId: number, outlines: ChapterOutline[]) => {
    setIsGeneratingBook(true);
    
    // Create chapters sequentially
    for (let i = 0; i < outlines.length; i++) {
      const outline = outlines[i];
      
      try {
        // Create chapter with outline
        const chapter = await createChapterMutation.mutateAsync({
          title: outline.title,
          outline: outline.outline,
          bookId: bookId,
          status: "outline",
          orderIndex: i
        });
        
        // Generate chapter content
        await generateChapterContent(chapter.id, outline);
        
        toast({
          title: `${outline.title} generated`,
          description: `${i+1} of ${outlines.length} chapters created.`,
        });
      } catch (error) {
        toast({
          title: `Error generating ${outline.title}`,
          description: "An error occurred while generating this chapter.",
          variant: "destructive",
        });
      }
    }
    
    setIsGeneratingBook(false);
    
    toast({
      title: "Book generation complete",
      description: `Your book "${bookTitle}" has been generated with ${outlines.length} chapters.`,
    });
    
    // Invalidate queries to refresh data
    queryClient.invalidateQueries({ queryKey: ["/api/books"] });
    queryClient.invalidateQueries({ queryKey: ["/api/books/recent"] });
    queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
  };
  
  const generateChapterContent = async (chapterId: number, outline: ChapterOutline) => {
    try {
      // Get the current book ID
      const chapter = await apiRequest(
        "GET",
        `/api/chapters/${chapterId}`,
        undefined
      ).then(res => res.json());
      
      // Call our server-side LLM generation endpoint
      const generationRes = await apiRequest(
        "POST",
        "/api/generate/chapter-content",
        {
          chapterId: chapterId,
          bookId: chapter.bookId,
          title: outline.title,
          outline: outline.outline,
          llmSettingsId: llmSettings?.id
        }
      );
      
      const data = await generationRes.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      // Update the chapter with the generated content
      const updateRes = await apiRequest(
        "PUT",
        `/api/chapters/${chapterId}`,
        { 
          content: data.content,
          status: "completed" 
        }
      );
      
      return updateRes.json();
    } catch (error) {
      console.error("Error generating chapter content:", error);
      throw error;
    }
  };
  
  const handleGenerateBook = () => {
    if (!bookTitle || !bookDescription || chapterOutlines.length === 0) {
      toast({
        title: "Missing information",
        description: "Please generate chapter outlines first.",
        variant: "destructive",
      });
      return;
    }
    
    const fullOutline = chapterOutlines.map((chapter, index) => 
      `Chapter ${index+1}: ${chapter.title}\n${chapter.outline}`
    ).join('\n\n');
    
    createBookMutation.mutate({
      title: bookTitle,
      description: bookDescription,
      userId: TEMP_USER_ID,
      outline: fullOutline,
      status: "draft",
      llmSettingsId: llmSettings?.id
    });
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Generate a Full Book</CardTitle>
          <Sparkles className="h-5 w-5 text-amber-500" />
        </div>
        <CardDescription>
          Create a complete book with multiple chapters using AI
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoadingLlmSettings ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !llmSettings ? (
          <div className="text-center p-6 bg-gray-50 rounded-md border border-gray-200">
            <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Wand2 className="h-8 w-8 text-gray-400" />
            </div>
            <h4 className="text-lg font-medium text-gray-800 mb-2">LLM settings not configured</h4>
            <p className="text-sm text-gray-500 mb-4">
              Please configure your LLM settings in the Settings page before generating a book.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div>
                <Label htmlFor="book-title">Book Title</Label>
                <Input
                  id="book-title"
                  placeholder="Enter a title for your book"
                  value={bookTitle}
                  onChange={(e) => setBookTitle(e.target.value)}
                  disabled={isGeneratingOutlines || isGeneratingBook}
                />
              </div>
              
              <div>
                <Label htmlFor="book-description">Book Description</Label>
                <Textarea
                  id="book-description"
                  placeholder="Enter a description of your book idea"
                  value={bookDescription}
                  onChange={(e) => setBookDescription(e.target.value)}
                  rows={4}
                  disabled={isGeneratingOutlines || isGeneratingBook}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="genre">Genre</Label>
                  <Select 
                    value={genre} 
                    onValueChange={setGenre}
                    disabled={isGeneratingOutlines || isGeneratingBook}
                  >
                    <SelectTrigger id="genre">
                      <SelectValue placeholder="Select a genre" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fantasy">Fantasy</SelectItem>
                      <SelectItem value="science-fiction">Science Fiction</SelectItem>
                      <SelectItem value="mystery">Mystery</SelectItem>
                      <SelectItem value="romance">Romance</SelectItem>
                      <SelectItem value="thriller">Thriller</SelectItem>
                      <SelectItem value="historical-fiction">Historical Fiction</SelectItem>
                      <SelectItem value="non-fiction">Non-Fiction</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="chapters">Number of Chapters</Label>
                  <Select 
                    value={String(numberOfChapters)} 
                    onValueChange={(value) => setNumberOfChapters(Number(value))}
                    disabled={isGeneratingOutlines || isGeneratingBook}
                  >
                    <SelectTrigger id="chapters">
                      <SelectValue placeholder="Select chapter count" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 Chapters</SelectItem>
                      <SelectItem value="5">5 Chapters</SelectItem>
                      <SelectItem value="7">7 Chapters</SelectItem>
                      <SelectItem value="10">10 Chapters</SelectItem>
                      <SelectItem value="12">12 Chapters</SelectItem>
                      <SelectItem value="15">15 Chapters</SelectItem>
                      <SelectItem value="20">20 Chapters</SelectItem>
                      <SelectItem value="25">25 Chapters</SelectItem>
                      <SelectItem value="30">30 Chapters</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex justify-between pt-2">
                <div className="text-sm text-gray-500">
                  Using <span className="font-medium">{llmSettings.name}</span> LLM settings
                </div>
                <Button
                  onClick={generateChapterOutlines}
                  disabled={!bookTitle || !bookDescription || !genre || isGeneratingOutlines || isGeneratingBook}
                  className="bg-primary hover:bg-primary-600 text-white"
                >
                  {isGeneratingOutlines ? (
                    <>
                      <Wand2 className="h-4 w-4 mr-2 animate-spin" /> Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4 mr-2" /> Generate Outlines
                    </>
                  )}
                </Button>
              </div>
            </div>
            
            {chapterOutlines.length > 0 && (
              <>
                <Separator />
                
                <div>
                  <div className="flex items-center mb-4">
                    <LayoutList className="h-5 w-5 mr-2 text-primary" />
                    <h3 className="text-md font-semibold">Chapter Outlines</h3>
                  </div>
                  
                  <div className="space-y-3 max-h-96 overflow-y-auto p-1 custom-scrollbar">
                    {chapterOutlines.map((chapter, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-md border border-gray-200">
                        <h4 className="font-medium text-gray-800">{chapter.title}</h4>
                        <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{chapter.outline}</p>
                      </div>
                    ))}
                  </div>
                  
                  <Button
                    onClick={handleGenerateBook}
                    disabled={isGeneratingBook}
                    className="mt-4 w-full bg-green-600 hover:bg-green-700 text-white"
                  >
                    {isGeneratingBook ? (
                      <>
                        <BookIcon className="h-4 w-4 mr-2 animate-spin" /> Generating Book...
                      </>
                    ) : (
                      <>
                        <BookIcon className="h-4 w-4 mr-2" /> Generate Complete Book
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
            
            {generatedBookId && !isGeneratingBook && (
              <div className="flex justify-center mt-4">
                <Button
                  variant="outline"
                  className="border-primary text-primary hover:bg-primary-50"
                  onClick={() => window.location.href = `/editor/${generatedBookId}`}
                >
                  <CheckCircle className="h-4 w-4 mr-2 text-green-600" /> View & Edit Generated Book
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}