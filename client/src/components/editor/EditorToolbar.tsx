import { Button } from "@/components/ui/button";
import { 
  AlignLeft, 
  Heading, 
  Quote, 
  Wand2, 
  SpellCheck, 
  Save, 
  Loader2 
} from "lucide-react";
import { Chapter } from "@shared/schema";

interface EditorToolbarProps {
  chapter: Chapter | null;
  isSaving: boolean;
  onSave: () => void;
  onAutoEdit: () => void;
  onGenerateContent: () => void;
}

export default function EditorToolbar({ 
  chapter, 
  isSaving, 
  onSave, 
  onAutoEdit, 
  onGenerateContent 
}: EditorToolbarProps) {
  return (
    <div className="border-b border-border bg-card px-4 py-3 flex items-center justify-between">
      <div className="flex items-center">
        <h3 className="text-lg font-medium text-foreground truncate">
          {chapter ? chapter.title : "No Chapter Selected"}
        </h3>
      </div>
      
      {chapter && (
        <div className="flex items-center space-x-3">
          <div className="flex text-sm">
            <Button variant="outline" size="sm" className="rounded-r-none border-r-0">
              <AlignLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="rounded-none border-x-0">
              <Heading className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="rounded-l-none border-l-0">
              <Quote className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex text-sm">
            <Button 
              variant="outline" 
              size="sm"
              onClick={onGenerateContent}
            >
              <Wand2 className="h-4 w-4 mr-1.5" /> AI Assist
            </Button>
          </div>
          
          <div className="flex text-sm">
            <Button 
              variant="default" 
              size="sm"
              onClick={onAutoEdit}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <SpellCheck className="h-4 w-4 mr-1.5" /> Auto-Edit
            </Button>
          </div>
          
          <div className="flex text-sm">
            <Button 
              onClick={onSave}
              disabled={isSaving}
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1.5" /> Save
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
