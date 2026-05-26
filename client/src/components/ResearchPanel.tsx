import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, Loader2, Quote } from "lucide-react";

interface ResearchPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert?: (text: string) => void;
}

export default function ResearchPanel({
  open,
  onOpenChange,
  onInsert,
}: ResearchPanelProps) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    setResult("");

    try {
      // Look for a perplexity key
      const keysRes = await apiRequest("GET", "/api/api-keys", undefined);
      const keys = (await keysRes.json()) as any[];
      const perplexityKey = keys.find(
        (k: any) => k.provider === "perplexity" && k.isActive
      );

      if (!perplexityKey) {
        toast({
          title: "Perplexity key required",
          description:
            "Add a Perplexity API key in Settings > API Keys to use Research.",
          variant: "destructive",
        });
        setIsSearching(false);
        return;
      }

      const res = await apiRequest("POST", "/api/llm/generate", {
        provider: "perplexity",
        model: "sonar",
        mode: "byok",
        apiKeyId: perplexityKey.id,
        messages: [{ role: "user", content: query }],
        temperature: 0.3,
        maxTokens: 2000,
        feature: "research",
      });
      const data = await res.json();
      setResult(data.text || "No results found.");
    } catch (err: any) {
      toast({
        title: "Research failed",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleInsert = () => {
    if (result && onInsert) {
      onInsert(`\n\n> ${result.replace(/\n/g, "\n> ")}\n\n`);
      toast({ title: "Inserted into chapter" });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" /> Research Panel
          </SheetTitle>
          <SheetDescription>
            Search the web using Perplexity AI. Requires a Perplexity API key.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search for anything..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
            />
            <Button
              onClick={handleSearch}
              disabled={isSearching || !query.trim()}
              size="sm"
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>

          {result && (
            <div className="space-y-3">
              <div className="bg-muted/50 border border-border rounded-md p-4 text-sm whitespace-pre-wrap max-h-[60vh] overflow-y-auto">
                {result}
              </div>
              {onInsert && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleInsert}
                >
                  <Quote className="h-4 w-4 mr-2" />
                  Insert into chapter
                </Button>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
