import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles } from "lucide-react";
import { Link } from "wouter";

interface ProviderInfo {
  id: string;
  label: string;
  protocol: string;
  baseUrl: string | null;
  requiresApiKey: boolean;
  signupUrl: string;
  platformAvailable: boolean;
  models: { id: string; label: string; contextWindow: number }[];
}

interface ApiKeyRow {
  id: number;
  provider: string;
  label: string;
  defaultModel: string | null;
  isActive: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookId: number;
  chapterId: number;
  chapterTitle: string;
  chapterOutline: string;
  /** Called with the freshly-generated chapter text. The parent decides whether to apply it. */
  onGenerated: (text: string, generationId: number) => void;
}

const LS_KEY = "abexwriter:lastModel";

/**
 * Modal that asks the user which provider/model + BYOK-or-platform mode to use,
 * then calls /api/generate/chapter-content. The endpoint hydrates the full
 * story context (premise, characters, plot threads, steering notes, previous
 * chapter ending) on the server, so we just send a small payload here.
 */
export default function GenerateChapterDialog({
  open,
  onOpenChange,
  bookId,
  chapterId,
  chapterTitle,
  chapterOutline,
  onGenerated,
}: Props) {
  const { toast } = useToast();

  const [provider, setProvider] = useState<string>("openai");
  const [model, setModel] = useState<string>("");
  const [mode, setMode] = useState<"byok" | "platform">("byok");
  const [apiKeyId, setApiKeyId] = useState<number | undefined>(undefined);
  const [language, setLanguage] = useState<string>("English");
  const [targetWords, setTargetWords] = useState<number>(2500);
  const [extraNote, setExtraNote] = useState<string>("");
  const [useStreaming, setUseStreaming] = useState<boolean>(true);
  const [streamingText, setStreamingText] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const abortRef = useRef<AbortController | null>(null);

  const providersQuery = useQuery({
    queryKey: ["/api/llm/providers"],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/llm/providers", undefined);
      const data = (await r.json()) as { providers: ProviderInfo[] };
      return data.providers;
    },
    enabled: open,
  });

  const keysQuery = useQuery({
    queryKey: ["/api/api-keys"],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/api-keys", undefined);
      return (await r.json()) as ApiKeyRow[];
    },
    enabled: open,
  });

  const providers = providersQuery.data ?? [];
  const keys = keysQuery.data ?? [];

  const selectedProvider = useMemo(
    () => providers.find((p) => p.id === provider),
    [providers, provider],
  );
  const keysForProvider = useMemo(
    () => keys.filter((k) => k.provider === provider && k.isActive),
    [keys, provider],
  );

  // Restore last-used selection.
  useEffect(() => {
    if (!open) return;
    try {
      const last = localStorage.getItem(LS_KEY);
      if (last) {
        const v = JSON.parse(last) as {
          provider?: string;
          model?: string;
          mode?: "byok" | "platform";
        };
        if (v.provider) setProvider(v.provider);
        if (v.model) setModel(v.model);
        if (v.mode) setMode(v.mode);
      }
    } catch {
      /* ignore */
    }
  }, [open]);

  // When provider changes, pick a sensible default model.
  useEffect(() => {
    if (!selectedProvider) return;
    if (model && selectedProvider.models.some((m) => m.id === model)) return;
    setModel(selectedProvider.models[0]?.id ?? "");
  }, [selectedProvider, model]);

  // When provider changes, auto-select the first BYOK key if any.
  useEffect(() => {
    if (mode === "byok") {
      const k = keysForProvider[0];
      setApiKeyId(k?.id);
    } else {
      setApiKeyId(undefined);
    }
  }, [provider, mode, keysForProvider]);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        bookId,
        chapterId,
        title: chapterTitle,
        outline: chapterOutline + (extraNote ? `\n\nExtra direction: ${extraNote}` : ""),
        provider,
        model,
        mode,
        language,
        targetWordCount: targetWords,
      };
      if (apiKeyId) body.apiKeyId = apiKeyId;
      const r = await apiRequest("POST", "/api/generate/chapter-content", body);
      const data = await r.json();
      return data as { content: string; generationId: number; usage: any };
    },
    onSuccess: (data) => {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({ provider, model, mode }));
      } catch {
        /* ignore */
      }
      onGenerated(data.content, data.generationId);
      queryClient.invalidateQueries({ queryKey: ["/api/generations", { chapterId }] });
      queryClient.invalidateQueries({ queryKey: ["/api/usage"] });
      onOpenChange(false);
      toast({
        title: "Chapter generated",
        description: `${data.usage?.totalTokens?.toLocaleString() ?? "?"} tokens · saved to version history.`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Generation failed",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    },
  });

  const handleStreamGenerate = useCallback(async () => {
    setStreamingText("");
    setIsStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const body: Record<string, unknown> = {
        bookId,
        chapterId,
        title: chapterTitle,
        outline: chapterOutline + (extraNote ? `\n\nExtra direction: ${extraNote}` : ""),
        provider,
        model,
        mode,
        language,
        targetWordCount: targetWords,
      };
      if (apiKeyId) body.apiKeyId = apiKeyId;

      const response = await fetch("/api/generate/chapter-content/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(err || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";
      let generationId: number | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith("event: done")) {
            // Next data line contains the final payload
            continue;
          }
          if (trimmed.startsWith("event: error")) {
            continue;
          }
          if (trimmed.startsWith("data: ")) {
            const jsonStr = trimmed.slice(6);
            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.text) {
                fullText += parsed.text;
                setStreamingText(fullText);
              }
              if (parsed.content && parsed.generationId) {
                // Final done event
                fullText = parsed.content;
                generationId = parsed.generationId;
              }
              if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (e: any) {
              if (e.message && !e.message.includes("JSON")) throw e;
            }
          }
        }
      }

      // Save last selection
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({ provider, model, mode }));
      } catch { /* ignore */ }

      if (fullText) {
        onGenerated(fullText, generationId ?? 0);
        queryClient.invalidateQueries({ queryKey: ["/api/generations", { chapterId }] });
        queryClient.invalidateQueries({ queryKey: ["/api/usage"] });
        onOpenChange(false);
        toast({
          title: "Chapter generated (streamed)",
          description: "Content saved to version history.",
        });
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        toast({
          title: "Streaming failed",
          description: err?.message ?? "Unknown error",
          variant: "destructive",
        });
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [bookId, chapterId, chapterTitle, chapterOutline, extraNote, provider, model, mode, language, targetWords, apiKeyId, onGenerated, onOpenChange, toast]);

  const canGenerate =
    !!provider &&
    !!model &&
    (mode === "platform"
      ? !!selectedProvider?.platformAvailable
      : !!apiKeyId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" /> Generate chapter content
          </DialogTitle>
          <DialogDescription>
            The full story bible, active steering directives, and the previous chapter's
            ending are automatically composed into the prompt — you only need to pick a
            model.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Provider</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                      {p.platformAvailable && (
                        <span className="ml-2 text-xs text-muted-foreground">· platform OK</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a model" />
                </SelectTrigger>
                <SelectContent>
                  {selectedProvider?.models.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({(m.contextWindow / 1000).toFixed(0)}k ctx)
                      </span>
                    </SelectItem>
                  ))}
                  {selectedProvider && selectedProvider.models.length === 0 && (
                    <SelectItem value={model || "custom"}>
                      Custom (type below)
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {selectedProvider && selectedProvider.models.length === 0 && (
                <Input
                  className="mt-2"
                  placeholder="Model id"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                />
              )}
            </div>
          </div>

          <div>
            <Label>Mode</Label>
            <div className="flex items-center gap-2 mt-1">
              <Button
                size="sm"
                variant={mode === "byok" ? "default" : "outline"}
                onClick={() => setMode("byok")}
              >
                BYOK
              </Button>
              <Button
                size="sm"
                variant={mode === "platform" ? "default" : "outline"}
                onClick={() => setMode("platform")}
                disabled={!selectedProvider?.platformAvailable}
              >
                Platform key
                {!selectedProvider?.platformAvailable && (
                  <span className="ml-1 text-xs">(not configured)</span>
                )}
              </Button>
            </div>
            {mode === "byok" && keysForProvider.length === 0 && (
              <p className="text-sm text-destructive mt-2">
                No BYOK key for {selectedProvider?.label}.{" "}
                <Link className="underline" href="/api-keys">
                  Add one
                </Link>
                .
              </p>
            )}
            {mode === "byok" && keysForProvider.length > 1 && (
              <Select
                value={apiKeyId ? String(apiKeyId) : ""}
                onValueChange={(v) => setApiKeyId(Number(v))}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {keysForProvider.map((k) => (
                    <SelectItem key={k.id} value={String(k.id)}>
                      {k.label}
                      {k.defaultModel && (
                        <Badge variant="secondary" className="ml-2 text-[10px]">
                          {k.defaultModel}
                        </Badge>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Target word count</Label>
              <Input
                type="number"
                min={500}
                max={20_000}
                step={500}
                value={targetWords}
                onChange={(e) => setTargetWords(Number(e.target.value) || 2500)}
              />
            </div>
            <div>
              <Label>Language</Label>
              <Input
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="English, Español, हिन्दी, …"
              />
            </div>
          </div>

          <div>
            <Label>One-off direction (optional)</Label>
            <Textarea
              rows={2}
              placeholder="Anything specific for THIS chapter? (Permanent directives belong in Steer the Story.)"
              value={extraNote}
              onChange={(e) => setExtraNote(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={useStreaming}
              onCheckedChange={setUseStreaming}
              id="stream-toggle"
            />
            <Label htmlFor="stream-toggle" className="text-sm cursor-pointer">
              Stream tokens (live preview)
            </Label>
          </div>

          {isStreaming && streamingText && (
            <div className="border rounded-md p-3 bg-muted/30 max-h-40 overflow-y-auto">
              <p className="text-xs text-muted-foreground mb-1">Live preview:</p>
              <p className="text-sm whitespace-pre-wrap">{streamingText.slice(-500)}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => {
            if (isStreaming && abortRef.current) {
              abortRef.current.abort();
            }
            onOpenChange(false);
          }}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (useStreaming) {
                handleStreamGenerate();
              } else {
                generateMutation.mutate();
              }
            }}
            disabled={!canGenerate || generateMutation.isPending || isStreaming}
          >
            {(generateMutation.isPending || isStreaming) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isStreaming ? "Streaming..." : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
