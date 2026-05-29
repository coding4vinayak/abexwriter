import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ImageIcon } from "lucide-react";
import type { Book } from "@shared/schema";

interface BookCoverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  book: Book;
}

export default function BookCoverDialog({
  open,
  onOpenChange,
  book,
}: BookCoverDialogProps) {
  const { toast } = useToast();
  const defaultPrompt = `Book cover for "${book.title}"${book.description ? `. ${book.description}` : ""}. Professional book cover design, typography, cinematic.`;
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setImageUrl(null);

    try {
      const res = await apiRequest("POST", "/api/images/generate", {
        prompt,
        bookId: book.id,
        type: "cover",
      });
      const data = await res.json();
      if (data.url || data.imageUrl) {
        setImageUrl(data.url || data.imageUrl);
        toast({ title: "Cover generated!" });
      } else {
        toast({
          title: "Generation failed",
          description: "No image was returned.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Cover generation failed",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Generate Book Cover
          </DialogTitle>
          <DialogDescription>
            Create an AI-generated cover for &ldquo;{book.title}&rdquo;
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Textarea
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the book cover you want..."
          />

          {imageUrl && (
            <div className="flex justify-center">
              <img
                src={imageUrl}
                alt="Generated book cover"
                className="max-h-80 rounded-lg border border-border shadow-md"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleGenerate} disabled={isGenerating || !prompt.trim()}>
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <ImageIcon className="h-4 w-4 mr-2" />
                Generate Cover
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
