import { useEffect, useMemo, useState } from "react";
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
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PenLine } from "lucide-react";
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
  currentContent: string;
  onExpanded: (newText: string, generationId: number) => void;
}

const LS_KEY = "abexwriter:lastModel";

export default function ExpandContinueDialog({
  open,
  onOpenChange,
  bookId,
  chapterId,
  currentContent,
  onExpanded,
}: Props) {
  const { toast } = useToast();

  const [provider, setProvider] = useState<string>("openai");
  const [model, setModel] = useState<string>("");
  const [mode, setMode] = useState<"byok" | "platform">("byok");
  const [apiKeyId, setApiKeyId] = useState<number | undefined>(undefined);
  const [targetWords, setTargetWords] = useState<number>(500);
  const [instruction, setInstruction] = useState<string>("");

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

  useEffect(() => {
    if (!selectedProvider) return;
    if (model && selectedProvider.models.some((m) => m.id === model)) return;
    setModel(selectedProvider.models[0]?.id ?? "");
  }, [selectedProvider, model]);

  useEffect(() => {
    if (mode === "byok") {
      const k = keysForProvider[0];
      setApiKeyId(k?.id);
    } else {
      setApiKeyId(undefined);
    }
  }, [provider, mode, keysForProvider]);

  const expandMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        text: currentContent,
        bookId,
        chapterId,
        provider,
        model,
        mode,
        targetWords,
      };
      if (instruction.trim()) body.instruction = instruction.trim();
      if (apiKeyId) body.apiKeyId = apiKeyId;
      const r = await apiRequest("POST", "/api/generate/expand", body);
      return (await r.json()) as { text: string; generationId: number; usage: any };
    },
    onSuccess: (data) => {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({ provider, model, mode }));
      } catch {
        /* ignore */
      }
      onExpanded(data.text, data.generationId);
      queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/usage"] });
      onOpenChange(false);
      toast({
        title: "Content expanded",
        description: `~${data.usage?.totalTokens?.toLocaleString() ?? "?"} tokens used. New text appended.`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Expand failed",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    },
  });

  const canGenerate =
    !!provider &&
    !!model &&
    (mode === "platform" ? !!selectedProvider?.platformAvailable : !!apiKeyId);

  // Preview last 200 characters
  const preview = currentContent.slice(-200);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="h-5 w-5" /> Continue Writing
          </DialogTitle>
          <DialogDescription>
            Append AI-generated text to the end of your current chapter content.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
          {/* Preview */}
          <div>
            <Label className="text-xs text-muted-foreground">Continuing from:</Label>
            <div className="mt-1 bg-muted/50 rounded-md p-3 text-sm text-muted-foreground italic max-h-20 overflow-hidden">
              …{preview}
            </div>
          </div>

          {/* Target words slider */}
          <div>
            <Label>Target words: {targetWords}</Label>
            <Slider
              className="mt-2"
              min={200}
              max={2000}
              step={100}
              value={[targetWords]}
              onValueChange={([v]) => setTargetWords(v)}
            />
          </div>

          {/* Instruction override */}
          <div>
            <Label>Custom instruction (optional)</Label>
            <Textarea
              rows={2}
              placeholder="Leave empty for default continuation, or specify: 'Write a dramatic confrontation scene', 'Slow down the pacing', etc."
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
            />
          </div>

          {/* Provider / Model */}
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
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Mode */}
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
                Platform
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
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => expandMutation.mutate()}
            disabled={!canGenerate || expandMutation.isPending}
          >
            {expandMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Continue Writing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
