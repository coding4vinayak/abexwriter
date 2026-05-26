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
  FileText,
  PenLine,
  Search,
  Maximize,
  Circle,
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
  onSummarize?: () => void;
  onExpand?: () => void;
  onResearch?: () => void;
  onFocusMode?: () => void;
  content?: string;
  isDirty?: boolean;
  autoSaveLabel?: string | null;
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
  onSummarize,
  onExpand,
  onResearch,
  onFocusMode,
  content,
  isDirty,
  autoSaveLabel,
}: EditorToolbarProps) {
  const hasEnoughContent = content ? content.length > 100 : false;

  return (
    <div className="border-b border-border bg-card px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
      <div className="flex items-center min-w-0 gap-2">
        <h3 className="text-lg font-medium text-foreground truncate">
          {chapter ? chapter.title : "No Chapter Selected"}
        </h3>
        {/* Unsaved changes indicator */}
        {isDirty && !autoSaveLabel && (
          <Circle className="h-2.5 w-2.5 fill-yellow-500 text-yellow-500" />
        )}
        {autoSaveLabel && (
          <span className="text-xs text-green-600 dark:text-green-400 font-medium">
            {autoSaveLabel}
          </span>
        )}
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
              <Button variant="outline" size="sm" onClick={onOpenSteering} title="Steer the story (⌘J)">
                <Compass className="h-4 w-4 mr-1.5" />
                <span className="hidden md:inline">Steer</span>
              </Button>
            )}
            {chapter && onOpenVersions && (
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenVersions}
                title="Version history (⌘L)"
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

            <Button variant="outline" size="sm" onClick={onGenerateContent} title="AI Generate (⌘G)">
              <Wand2 className="h-4 w-4 mr-1.5" /> AI Generate
            </Button>

            {onExpand && hasEnoughContent && (
              <Button
                variant="outline"
                size="sm"
                onClick={onExpand}
                title="Continue writing (⌘E)"
              >
                <PenLine className="h-4 w-4 mr-1.5" />
                <span className="hidden md:inline">Expand</span>
              </Button>
            )}

            {onSummarize && hasEnoughContent && (
              <Button
                variant="outline"
                size="sm"
                onClick={onSummarize}
                title="Summarize this chapter"
              >
                <FileText className="h-4 w-4 mr-1.5" />
                <span className="hidden md:inline">Summarize</span>
              </Button>
            )}

            {onHumanize && (
              <Button
                variant="outline"
                size="sm"
                onClick={onHumanize}
                title="Humanize (⌘H)"
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
                title="Generate AI image"
              >
                <Image className="h-4 w-4 mr-1.5" />
                <span className="hidden md:inline">Image</span>
              </Button>
            )}

            {onResearch && (
              <Button
                variant="outline"
                size="sm"
                onClick={onResearch}
                title="Research panel"
              >
                <Search className="h-4 w-4 mr-1.5" />
                <span className="hidden md:inline">Research</span>
              </Button>
            )}

            {onFocusMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={onFocusMode}
                title="Focus mode (⌘+Shift+F)"
              >
                <Maximize className="h-4 w-4" />
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
              title="Save (⌘S)"
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
          </>
        )}
      </div>
    </div>
  );
}
