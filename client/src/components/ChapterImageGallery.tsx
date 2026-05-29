import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Trash2, X, ZoomIn } from "lucide-react";

interface ChapterImage {
  id: number;
  chapterId: number;
  bookId: number;
  imageUrl: string;
  prompt: string;
  revisedPrompt: string | null;
  provider: string;
  model: string;
  size: string;
  style: string | null;
  durationMs: number;
  caption: string | null;
  orderIndex: number;
  createdAt: string;
}

interface Props {
  chapterId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Gallery of AI-generated images for a chapter.
 * Displays a grid with lightbox view and delete functionality.
 */
export default function ChapterImageGallery({ chapterId, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [lightboxImage, setLightboxImage] = useState<ChapterImage | null>(null);

  const imagesQuery = useQuery({
    queryKey: [`/api/chapters/${chapterId}/images`],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/chapters/${chapterId}/images`, undefined);
      return (await r.json()) as ChapterImage[];
    },
    enabled: open && !!chapterId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (imageId: number) => {
      await apiRequest("DELETE", `/api/images/${imageId}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/chapters/${chapterId}/images`] });
      toast({ title: "Image deleted" });
      setLightboxImage(null);
    },
    onError: (err: any) => {
      toast({
        title: "Failed to delete image",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    },
  });

  const images = imagesQuery.data ?? [];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chapter Image Gallery</DialogTitle>
          </DialogHeader>

          {imagesQuery.isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-lg" />
              ))}
            </div>
          ) : images.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg mb-2">No images yet</p>
              <p className="text-sm">
                Use the Image button in the toolbar to generate illustrations for this chapter.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {images.map((img) => (
                <div
                  key={img.id}
                  className="group relative rounded-lg overflow-hidden border border-border cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                  onClick={() => setLightboxImage(img)}
                >
                  <img
                    src={img.imageUrl}
                    alt={img.caption || img.prompt}
                    className="w-full aspect-square object-cover bg-muted"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
                    <Badge variant="secondary" className="text-[10px]">
                      {img.provider}
                    </Badge>
                    {img.caption && (
                      <p className="text-xs text-white mt-1 line-clamp-1">{img.caption}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      <Dialog open={!!lightboxImage} onOpenChange={() => setLightboxImage(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {lightboxImage && (
            <div className="space-y-4">
              <div className="rounded-lg overflow-hidden border border-border bg-muted">
                <img
                  src={lightboxImage.imageUrl}
                  alt={lightboxImage.caption || lightboxImage.prompt}
                  className="w-full h-auto max-h-[60vh] object-contain"
                />
              </div>

              <div className="space-y-2">
                {lightboxImage.caption && (
                  <p className="text-sm font-medium">{lightboxImage.caption}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  <strong>Prompt:</strong> {lightboxImage.prompt}
                </p>
                {lightboxImage.revisedPrompt && (
                  <p className="text-sm text-muted-foreground">
                    <strong>Revised:</strong> {lightboxImage.revisedPrompt}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{lightboxImage.provider}</Badge>
                  <Badge variant="outline">{lightboxImage.model}</Badge>
                  <Badge variant="outline">{lightboxImage.size}</Badge>
                  {lightboxImage.style && (
                    <Badge variant="outline">{lightboxImage.style}</Badge>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteMutation.mutate(lightboxImage.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Delete
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLightboxImage(null)}
                >
                  <X className="h-4 w-4 mr-1.5" />
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
