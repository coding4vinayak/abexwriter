import { useState } from "react";
import { Book, Chapter } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface BookExportButtonProps {
  book: Book;
}

export default function BookExportButton({ book }: BookExportButtonProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  
  // Fetch all chapters for the book
  const { data: chapters, isLoading } = useQuery({
    queryKey: ["/api/books", book.id, "chapters"],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/books/${book.id}/chapters`,
        undefined
      );
      return res.json() as Promise<Chapter[]>;
    },
  });
  
  // Function to generate book text content
  const generateBookText = () => {
    if (!chapters || chapters.length === 0) {
      return "No chapters found in this book.";
    }
    
    // Sort chapters by order
    const sortedChapters = [...chapters].sort((a, b) => a.orderIndex - b.orderIndex);
    
    // Build text content
    let text = `${book.title}\n\n`;
    if (book.description) {
      text += `${book.description}\n\n`;
    }
    
    text += "=".repeat(80) + "\n\n";
    
    // Add chapters
    sortedChapters.forEach((chapter) => {
      // Cleaned content
      let content = chapter.content || '';
      
      // Include chapter title only if not already in content
      if (!content.includes(chapter.title)) {
        text += `${chapter.title}\n\n`;
      }
      
      text += `${content}\n\n`;
      text += "=".repeat(80) + "\n\n";
    });
    
    return text;
  };
  
  const handleCopyText = () => {
    const text = generateBookText();
    navigator.clipboard.writeText(text)
      .then(() => {
        toast({
          title: "Book copied to clipboard",
          description: "You can now paste the book content into any document editor",
        });
      })
      .catch((err) => {
        console.error("Failed to copy text:", err);
        toast({
          title: "Failed to copy",
          description: "Please try selecting and copying the text manually",
          variant: "destructive",
        });
      });
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className="flex items-center gap-1"
        >
          <FileDown className="h-4 w-4 mr-1" />
          Export Book
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{book.title}</DialogTitle>
          <DialogDescription>
            Copy the complete book content to paste into your preferred document editor
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-4 flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <p>Loading book content...</p>
            </div>
          ) : (
            <pre className="whitespace-pre-wrap bg-muted p-4 rounded-md h-full overflow-auto text-sm">
              {generateBookText()}
            </pre>
          )}
        </div>
        
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setIsOpen(false)}>
            Close
          </Button>
          <Button onClick={handleCopyText}>
            Copy to Clipboard
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}