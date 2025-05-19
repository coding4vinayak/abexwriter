import { useState } from "react";
import { Book } from "@shared/schema";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { FileDown, FileText, File, FileType } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BookExportMenuProps {
  book: Book;
}

export default function BookExportMenu({ book }: BookExportMenuProps) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  
  const handleExport = async (format: 'docx' | 'pdf' | 'text') => {
    try {
      setIsExporting(true);
      
      // Create direct download link
      const link = document.createElement('a');
      link.href = `/api/books/${book.id}/export/${format}`;
      link.download = `${book.title}.${format === 'text' ? 'txt' : format}`;
      
      // Append to document, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Download started",
        description: `Your book is being exported as ${format.toUpperCase()}`,
      });
    } catch (error) {
      console.error(`Error exporting to ${format}:`, error);
      toast({
        title: `Export failed`,
        description: `Failed to export book as ${format.toUpperCase()}`,
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          disabled={isExporting}
          className="flex items-center gap-1"
        >
          <FileDown className="h-4 w-4 mr-1" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Export Options</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleExport('docx')}>
          <FileText className="h-4 w-4 mr-2" />
          Word Document (.docx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('pdf')}>
          <FilePdf className="h-4 w-4 mr-2" />
          PDF Document (.pdf)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('text')}>
          <FileType className="h-4 w-4 mr-2" />
          Plain Text (.txt)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}