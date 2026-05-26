import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  AlignLeft,
  Heading,
  Quote,
  Wand2,
  SpellCheck,
  Save,
  Loader2,
  BookOpen,
  Compass,
  History,
  Sparkles,
  Image,
} from "lucide-react";
import type { Chapter } from "@shared/schema";

interface EditorToolbarProps {
  chapter: Chapter | null;
  bookId?: number;
  isSaving: boolean;
  onSave: () => void;
  onAutoEdit: () => void;
  onGenerateContent: () => void;
  onHumanize?: () => void;
  onOpenSteering?: () => void;
  onOpenVersions?: () => void;
  onGenerateImage?: () => void;
}

export default function EditorToolbar({
  chapter,
  bookId,
  isSaving,
  onSave,
  onAutoEdit,
  onGenerateContent,
  onHumanize,
  onOpenSteering,
  onOpenVersions,
  onGenerateImage,
}: EditorToolbarProps) {
  return (
    <div className="border-b border-border bg-card px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
      <div className="flex items-center min-w-0">
        <h3 className="text-lg font-medium text-foreground truncate">
          {chapter ? chapter.title : "No Chapter Selected"}
        </h3>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {/* Story-bible / steering / versions — always available when there's a book */}
        {bookId && (
          <div className="flex items-center gap-1">
            <Link href={`/books/${bookId}/bible`}>
              <Button variant="outline" size="sm" title="Story bible">
                <BookOpen className="h-4 w-4 mr-1.5" />
                <span className="hidden md:inline">Bible</span>
              </Button>
            </Link>
            {onOpenSteering && (
              <Button variant="outline" size="sm" onClick={onOpenSteering} title="Steer the story">
                <Compass className="h-4 w-4 mr-1.5" />
                <span className="hidden md:inline">Steer</span>
              </Button>
            )}
            {chapter && onOpenVersions && (
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenVersions}
                title="Version history"
              >
                <History className="h-4 w-4 mr-1.5" />
                <span className="hidden md:inline">Versions</span>
              </Button>
            )}
          </div>
        )}

        {chapter && (
          <>
            <div className="hidden lg:flex">
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

            <Button variant="outline" size="sm" onClick={onGenerateContent}>
              <Wand2 className="h-4 w-4 mr-1.5" /> AI Generate
            </Button>

            {onHumanize && (
              <Button
                variant="outline"
                size="sm"
                onClick={onHumanize}
                title="Strip AI-slop and add human voice"
              >
                <Sparkles className="h-4 w-4 mr-1.5" />
                <span className="hidden md:inline">Humanize</span>
              </Button>
            )}

            {onGenerateImage && (
              <Button
                variant="outline"
                size="sm"
                onClick={onGenerateImage}
                title="Generate AI image for this chapter"
              >
                <Image className="h-4 w-4 mr-1.5" />
                <span className="hidden md:inline">Image</span>
              </Button>
            )}

            <Button
              variant="default"
              size="sm"
              onClick={onAutoEdit}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <SpellCheck className="h-4 w-4 mr-1.5" />
              <span className="hidden md:inline">Auto-Edit</span>
            </Button>

            <Button
              onClick={onSave}
              disabled={isSaving}
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1.5" /> Save
                </>
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
