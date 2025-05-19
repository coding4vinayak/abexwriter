import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { TEMP_USER_ID } from "@/lib/utils";
import ProjectCard from "@/components/ProjectCard";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Book } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { PlusIcon, BookOpenIcon, FileTextIcon } from "lucide-react";

export default function Projects() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const [isNewBookDialogOpen, setIsNewBookDialogOpen] = useState(false);
  const [isNewChapterDialogOpen, setIsNewChapterDialogOpen] = useState(false);
  const [newBookTitle, setNewBookTitle] = useState("");
  const [newBookDescription, setNewBookDescription] = useState("");
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [newChapterOutline, setNewChapterOutline] = useState("");
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);

  // Fetch all projects
  const { data: projects, isLoading } = useQuery({
    queryKey: ["/api/books", { userId: TEMP_USER_ID }],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/books?userId=${TEMP_USER_ID}`,
        undefined
      );
      return res.json() as Promise<Book[]>;
    },
  });

  // Create new book mutation
  const createBookMutation = useMutation({
    mutationFn: async (newBook: { 
      title: string; 
      description: string; 
      userId: number;
      status: "draft";
    }) => {
      const res = await apiRequest("POST", "/api/books", newBook);
      return res.json() as Promise<Book>;
    },
    onSuccess: (data) => {
      // Invalidate books query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      queryClient.invalidateQueries({ queryKey: ["/api/books/recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      
      toast({
        title: "Book created successfully!",
        description: `"${data.title}" has been created.`,
      });
      
      // Close dialog and reset form
      setIsNewBookDialogOpen(false);
      setNewBookTitle("");
      setNewBookDescription("");
      
      // Navigate to the editor for the new book
      navigate(`/editor/${data.id}`);
    },
    onError: (error) => {
      toast({
        title: "Failed to create book",
        description: "An error occurred while creating your book. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  // Create new chapter mutation
  const createChapterMutation = useMutation({
    mutationFn: async (newChapter: {
      title: string;
      outline: string | null;
      bookId: number;
      status: "outline";
      orderIndex: number;
    }) => {
      const res = await apiRequest("POST", "/api/chapters", newChapter);
      return res.json() as Promise<any>;
    },
    onSuccess: (data) => {
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      queryClient.invalidateQueries({ queryKey: ["/api/books/recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      
      toast({
        title: "Chapter created successfully!",
        description: `"${data.title}" has been added to your book.`,
      });
      
      // Close dialog and reset form
      setIsNewChapterDialogOpen(false);
      setNewChapterTitle("");
      setNewChapterOutline("");
      setSelectedBookId(null);
      
      // Navigate to the editor for the new chapter
      navigate(`/editor/${data.id}`);
    },
    onError: (error) => {
      toast({
        title: "Failed to create chapter",
        description: "An error occurred while creating your chapter. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCreateBook = () => {
    if (!newBookTitle.trim()) {
      toast({
        title: "Title is required",
        description: "Please enter a title for your book.",
        variant: "destructive",
      });
      return;
    }

    createBookMutation.mutate({
      title: newBookTitle,
      description: newBookDescription,
      userId: TEMP_USER_ID,
      status: "draft",
    });
  };
  
  const handleCreateChapter = () => {
    if (!newChapterTitle.trim()) {
      toast({
        title: "Title is required",
        description: "Please enter a title for your chapter.",
        variant: "destructive",
      });
      return;
    }
    
    if (!selectedBookId) {
      toast({
        title: "Book selection required",
        description: "Please select a book for this chapter.",
        variant: "destructive",
      });
      return;
    }

    createChapterMutation.mutate({
      title: newChapterTitle,
      outline: newChapterOutline || null,
      bookId: selectedBookId,
      status: "outline",
      orderIndex: 0, // Server will update this to the next available index
    });
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between border-b border-gray-200 pb-5 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">My Projects</h2>
            <p className="mt-2 text-sm text-gray-500">Manage all your book projects</p>
          </div>
          <div className="flex space-x-3">
            <Button 
              onClick={() => setIsNewChapterDialogOpen(true)}
              variant="outline"
              className="border-primary text-primary hover:bg-primary-50"
              disabled={!projects || projects.length === 0}
            >
              <FileTextIcon className="h-4 w-4 mr-2" />
              New Chapter
            </Button>
            <Button 
              onClick={() => setIsNewBookDialogOpen(true)}
              className="bg-primary hover:bg-primary-600 text-white"
            >
              <BookOpenIcon className="h-4 w-4 mr-2" />
              New Book
            </Button>
          </div>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            // Loading skeletons
            Array(6).fill(0).map((_, idx) => (
              <div key={idx} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow p-6">
                <Skeleton className="h-6 w-3/4 mb-3" />
                <Skeleton className="h-4 w-full mb-4" />
                <Skeleton className="h-4 w-full mb-4" />
                <div className="flex space-x-2">
                  <Skeleton className="h-10 w-1/2" />
                  <Skeleton className="h-10 w-1/2" />
                </div>
              </div>
            ))
          ) : projects && projects.length > 0 ? (
            // Actual projects
            projects.map(project => (
              <ProjectCard key={project.id} project={project} />
            ))
          ) : (
            // Empty state
            <div className="col-span-full flex flex-col items-center justify-center p-10 bg-gray-50 rounded-lg border border-gray-200 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <i className="fas fa-book text-gray-400 text-xl"></i>
              </div>
              <h4 className="text-lg font-medium text-gray-800 mb-2">No book projects yet</h4>
              <p className="text-sm text-gray-500 mb-4">Get started by creating your first book project</p>
              <Button 
                onClick={() => setIsNewBookDialogOpen(true)}
                className="bg-primary hover:bg-primary-600 text-white"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Create Book
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* New Book Dialog */}
      <Dialog open={isNewBookDialogOpen} onOpenChange={setIsNewBookDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Create New Book Project</DialogTitle>
            <DialogDescription>
              Enter the details for your new book project.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title" className="text-right">
                Title
              </Label>
              <Input
                id="title"
                className="col-span-3"
                value={newBookTitle}
                onChange={(e) => setNewBookTitle(e.target.value)}
                placeholder="Enter book title"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                Description
              </Label>
              <Textarea
                id="description"
                className="col-span-3"
                value={newBookDescription}
                onChange={(e) => setNewBookDescription(e.target.value)}
                placeholder="Enter a brief description (optional)"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewBookDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateBook} 
              disabled={createBookMutation.isPending}
              className="bg-primary hover:bg-primary-600 text-white"
            >
              {createBookMutation.isPending ? "Creating..." : "Create Book"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Chapter Dialog */}
      <Dialog open={isNewChapterDialogOpen} onOpenChange={setIsNewChapterDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Create New Chapter</DialogTitle>
            <DialogDescription>
              Add a new chapter to one of your books.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="book" className="text-right">
                Book
              </Label>
              <Select 
                value={selectedBookId?.toString() || ''} 
                onValueChange={(value) => setSelectedBookId(Number(value))}
              >
                <SelectTrigger id="book" className="col-span-3">
                  <SelectValue placeholder="Select a book" />
                </SelectTrigger>
                <SelectContent>
                  {projects && projects.map(book => (
                    <SelectItem key={book.id} value={book.id.toString()}>
                      {book.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="chapter-title" className="text-right">
                Title
              </Label>
              <Input
                id="chapter-title"
                className="col-span-3"
                value={newChapterTitle}
                onChange={(e) => setNewChapterTitle(e.target.value)}
                placeholder="Enter chapter title"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="chapter-outline" className="text-right">
                Outline
              </Label>
              <Textarea
                id="chapter-outline"
                className="col-span-3"
                value={newChapterOutline}
                onChange={(e) => setNewChapterOutline(e.target.value)}
                placeholder="Enter chapter outline or notes (optional)"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewChapterDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateChapter} 
              disabled={createChapterMutation.isPending || !selectedBookId}
              className="bg-primary hover:bg-primary-600 text-white"
            >
              {createChapterMutation.isPending ? "Creating..." : "Create Chapter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
