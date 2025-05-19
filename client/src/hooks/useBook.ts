import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Book, Chapter } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { TEMP_USER_ID } from "@/lib/utils";

export function useBook(bookId?: string | null) {
  const { toast } = useToast();
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);

  // Fetch book data
  const { 
    data: book, 
    isLoading: isBookLoading,
    error: bookError
  } = useQuery({
    queryKey: ["/api/books", bookId],
    queryFn: async () => {
      if (!bookId) return null;
      const res = await apiRequest("GET", `/api/books/${bookId}`, undefined);
      return res.json() as Promise<Book>;
    },
    enabled: !!bookId
  });

  // Fetch chapters for this book
  const {
    data: chapters,
    isLoading: isChaptersLoading,
    error: chaptersError
  } = useQuery({
    queryKey: ["/api/books", bookId, "chapters"],
    queryFn: async () => {
      if (!bookId) return [];
      const res = await apiRequest("GET", `/api/books/${bookId}/chapters`, undefined);
      return res.json() as Promise<Chapter[]>;
    },
    enabled: !!bookId
  });

  // Update book mutation
  const updateBookMutation = useMutation({
    mutationFn: async (data: Partial<Book>) => {
      if (!bookId) throw new Error("No book ID provided");
      const res = await apiRequest("PUT", `/api/books/${bookId}`, data);
      return res.json() as Promise<Book>;
    },
    onSuccess: (data) => {
      toast({
        title: "Book updated",
        description: "Your book has been updated successfully."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/books", bookId] });
      queryClient.invalidateQueries({ queryKey: ["/api/books/recent"] });
    },
    onError: (error) => {
      toast({
        title: "Update failed",
        description: "Failed to update book. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Create new chapter mutation
  const createChapterMutation = useMutation({
    mutationFn: async (chapterData: { 
      title: string, 
      bookId: number, 
      orderIndex: number,
      status: "outline" | "draft"
    }) => {
      const res = await apiRequest("POST", "/api/chapters", chapterData);
      return res.json() as Promise<Chapter>;
    },
    onSuccess: (data) => {
      toast({
        title: "Chapter created",
        description: `"${data.title}" has been created.`
      });
      queryClient.invalidateQueries({ queryKey: ["/api/books", bookId, "chapters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setActiveChapter(data);
    },
    onError: (error) => {
      toast({
        title: "Creation failed",
        description: "Failed to create chapter. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Update chapter mutation
  const updateChapterMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: Partial<Chapter> }) => {
      const res = await apiRequest("PUT", `/api/chapters/${id}`, data);
      return res.json() as Promise<Chapter>;
    },
    onSuccess: (data) => {
      toast({
        title: "Chapter updated",
        description: "Your chapter has been updated successfully."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/chapters", String(data.id)] });
      queryClient.invalidateQueries({ queryKey: ["/api/books", String(data.bookId), "chapters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error) => {
      toast({
        title: "Update failed",
        description: "Failed to update chapter. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Delete chapter mutation
  const deleteChapterMutation = useMutation({
    mutationFn: async (chapterId: number) => {
      const res = await apiRequest("DELETE", `/api/chapters/${chapterId}`, undefined);
      return chapterId;
    },
    onSuccess: (chapterId) => {
      toast({
        title: "Chapter deleted",
        description: "The chapter has been deleted successfully."
      });
      if (activeChapter?.id === chapterId) {
        setActiveChapter(null);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/books", bookId, "chapters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error) => {
      toast({
        title: "Deletion failed",
        description: "Failed to delete chapter. Please try again.",
        variant: "destructive"
      });
    }
  });

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

  const handleUpdateChapter = (chapterId: number, data: Partial<Chapter>) => {
    updateChapterMutation.mutate({ id: chapterId, data });
  };

  const handleDeleteChapter = (chapterId: number) => {
    deleteChapterMutation.mutate(chapterId);
  };

  const handleUpdateBook = (data: Partial<Book>) => {
    if (!bookId) return;
    updateBookMutation.mutate(data);
  };

  return {
    book,
    chapters,
    activeChapter,
    setActiveChapter,
    isLoading: isBookLoading || isChaptersLoading,
    error: bookError || chaptersError,
    createChapter: handleCreateChapter,
    updateChapter: handleUpdateChapter,
    deleteChapter: handleDeleteChapter,
    updateBook: handleUpdateBook,
    isUpdatingBook: updateBookMutation.isPending,
    isCreatingChapter: createChapterMutation.isPending,
    isUpdatingChapter: updateChapterMutation.isPending,
    isDeletingChapter: deleteChapterMutation.isPending
  };
}
