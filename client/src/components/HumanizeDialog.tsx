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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Wand2, Check, RotateCw } from "lucide-react";
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
interface PassOption {
  id: string;
  label: string;
  blurb: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Initial text to humanize (chapter content or selection). */
  initialText: string;
  bookId?: number;
  chapterId?: number;
  /** Called with the cleaned, humanized text. The parent decides whether to apply it. */
  onAccept: (text: string, generationId: number) => void;
}

const LS_KEY = "abexwriter:humanizer";

interface SavedPrefs {
  provider?: string;
  model?: string;
  mode?: "byok" | "platform";
  intensity?: number;
  passes?: string[];
}

interface HumanizeResult {
  text: string;
  generationId: number;
  stats: {
    beforeWords: number;
    afterWords: number;
    wordDelta: number;
    overlapPercent: number;
  };
  usage: { totalTokens: number; durationMs: number; costMicroCents: number };
}

function intensityLabel(i: number): { label: string; color: string } {
  if (i <= 30) return { label: "Light touch", color: "text-emerald-500" };
  if (i <= 60) return { label: "Medium pass", color: "text-blue-500" };
  if (i <= 90) return { label: "Heavy rewrite", color: "text-amber-500" };
  return { label: "Full revoicing", color: "text-rose-500" };
}

function moneyFromMicroCents(mc: number): string {
  return mc < 1000 ? `$${(mc / 100_000).toFixed(6)}` : `$${(mc / 100_000).toFixed(4)}`;
}

/**
 * Humanizer dialog: takes AI-generated prose and rewrites it to feel human.
 *
 * The intensity meter (0-100) is the primary control:
 *   - 0-30   light touch (only fix obvious AI tells)
 *   - 30-60  medium pass (rewrite cliches, add sensory specifics)
 *   - 60-90  heavy rewrite (restructure for voice)
 *   - 90-100 full revoicing (top to bottom, preserving plot)
 *
 * Plus a la carte passes: de-cliché, burstiness, sensory, anti-rep, dialogue,
 * show-don't-tell, em-dash diet. The server composes them all into a single
 * LLM call with a strict checklist prompt.
 */
export default function HumanizeDialog({
  open,
  onOpenChange,
  initialText,
  bookId,
  chapterId,
  onAccept,
}: Props) {
  const { toast } = useToast();

  // Form state.
  const [provider, setProvider] = useState<string>("openai");
  const [model, setModel] = useState<string>("");
  const [mode, setMode] = useState<"byok" | "platform">("byok");
  const [apiKeyId, setApiKeyId] = useState<number | undefined>();
  const [intensity, setIntensity] = useState<number>(50);
  const [enabledPasses, setEnabledPasses] = useState<Record<string, boolean>>({});
  const [customNote, setCustomNote] = useState<string>("");

  // Result state.
  const [result, setResult] = useState<HumanizeResult | null>(null);

  // Queries.
  const optionsQuery = useQuery({
    queryKey: ["/api/humanize/options"],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/humanize/options", undefined);
      return (await r.json()) as { passes: PassOption[] };
    },
    enabled: open,
  });

  const providersQuery = useQuery({
    queryKey: ["/api/llm/providers"],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/llm/providers", undefined);
      const d = (await r.json()) as { providers: ProviderInfo[] };
      return d.providers;
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

  const passes = optionsQuery.data?.passes ?? [];
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

  // Restore prefs on open. Default all passes ON.
  useEffect(() => {
    if (!open) return;
    setResult(null);
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const prefs = JSON.parse(raw) as SavedPrefs;
        if (prefs.provider) setProvider(prefs.provider);
        if (prefs.model) setModel(prefs.model);
        if (prefs.mode) setMode(prefs.mode);
        if (typeof prefs.intensity === "number") setIntensity(prefs.intensity);
        if (Array.isArray(prefs.passes)) {
          const map: Record<string, boolean> = {};
          for (const p of prefs.passes) map[p] = true;
          setEnabledPasses(map);
        }
      }
    } catch {
      /* ignore */
    }
  }, [open]);

  // When passes load, default all-on if user has no saved prefs yet.
  useEffect(() => {
    if (!passes.length) return;
    setEnabledPasses((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const next: Record<string, boolean> = {};
      passes.forEach((p) => (next[p.id] = true));
      return next;
    });
  }, [passes]);

  // Auto-pick first model when provider changes.
  useEffect(() => {
    if (!selectedProvider) return;
    if (model && selectedProvider.models.some((m) => m.id === model)) return;
    setModel(selectedProvider.models[0]?.id ?? "");
  }, [selectedProvider, model]);

  // Auto-select first BYOK key for provider.
  useEffect(() => {
    if (mode === "byok") setApiKeyId(keysForProvider[0]?.id);
    else setApiKeyId(undefined);
  }, [provider, mode, keysForProvider]);

  const enabledPassIds = useMemo(
    () => Object.entries(enabledPasses).filter(([, on]) => on).map(([id]) => id),
    [enabledPasses],
  );

  const intensityMeta = intensityLabel(intensity);

  const humanizeMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        text: initialText,
        intensity,
        passes: enabledPassIds,
        provider,
        model,
        mode,
        bookId,
        chapterId,
      };
      if (apiKeyId) body.apiKeyId = apiKeyId;
      if (customNote.trim()) body.customNote = customNote.trim();
      const r = await apiRequest("POST", "/api/humanize", body);
      return (await r.json()) as HumanizeResult;
    },
    onSuccess: (data) => {
      setResult(data);
      try {
        localStorage.setItem(
          LS_KEY,
          JSON.stringify({ provider, model, mode, intensity, passes: enabledPassIds }),
        );
      } catch {
        /* ignore */
      }
      queryClient.invalidateQueries({ queryKey: ["/api/usage"] });
      if (chapterId) {
        queryClient.invalidateQueries({ queryKey: ["/api/generations", { chapterId }] });
      }
    },
    onError: (err: any) => {
      toast({
        title: "Humanize failed",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    },
  });

  const canSubmit =
    !!provider &&
    !!model &&
    enabledPassIds.length > 0 &&
    initialText.trim().length >= 20 &&
    (mode === "platform" ? !!selectedProvider?.platformAvailable : !!apiKeyId);

  const inputWordCount = useMemo(
    () => initialText.trim().split(/\s+/).filter(Boolean).length,
    [initialText],
  );

  // Reset form when the user clicks "Run again" so we can re-tune.
  function reset() {
    setResult(null);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setResult(null); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Humanize this passage
          </DialogTitle>
          <DialogDescription>
            Strip AI-slop tells and add human voice. Use the meter to choose how
            aggressively to rewrite.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 -mx-6 px-6">
          {!result ? (
            <div className="space-y-5 py-2">
              {/* Input preview */}
              <Card className="bg-muted/30">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>Input passage</span>
                    <span>{inputWordCount.toLocaleString()} words</span>
                  </div>
                  <div className="text-sm whitespace-pre-wrap line-clamp-4 leading-relaxed">
                    {initialText.slice(0, 600)}
                    {initialText.length > 600 && "…"}
                  </div>
                </CardContent>
              </Card>

              {/* INTENSITY METER */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-base">Modification intensity</Label>
                  <span className={`text-sm font-medium ${intensityMeta.color}`}>
                    {intensityMeta.label} · {intensity}/100
                  </span>
                </div>
                <Slider
                  value={[intensity]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={(v) => setIntensity(v[0] ?? 50)}
                />
                <div className="grid grid-cols-4 gap-2 mt-2 text-[11px] text-muted-foreground">
                  <button
                    onClick={() => setIntensity(15)}
                    className="text-left hover:text-foreground"
                    type="button"
                  >
                    <span className="block font-medium text-emerald-500">Light</span>
                    Only fix obvious AI tells (~15-30% modified)
                  </button>
                  <button
                    onClick={() => setIntensity(45)}
                    className="text-left hover:text-foreground"
                    type="button"
                  >
                    <span className="block font-medium text-blue-500">Medium</span>
                    Rewrite clichés, add sensory beats (~30-55%)
                  </button>
                  <button
                    onClick={() => setIntensity(75)}
                    className="text-left hover:text-foreground"
                    type="button"
                  >
                    <span className="block font-medium text-amber-500">Heavy</span>
                    Restructure for voice and burstiness (~55-85%)
                  </button>
                  <button
                    onClick={() => setIntensity(95)}
                    className="text-left hover:text-foreground"
                    type="button"
                  >
                    <span className="block font-medium text-rose-500">Revoice</span>
                    Top to bottom, plot intact (~85-95%)
                  </button>
                </div>
              </div>

              {/* PASSES */}
              <div>
                <Label className="text-base">Apply these passes</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  {passes.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-start gap-2 border border-border rounded-md p-2 hover:bg-accent cursor-pointer"
                    >
                      <Checkbox
                        checked={!!enabledPasses[p.id]}
                        onCheckedChange={(v) =>
                          setEnabledPasses((prev) => ({ ...prev, [p.id]: !!v }))
                        }
                      />
                      <div className="text-sm">
                        <div className="font-medium">{p.label}</div>
                        <div className="text-xs text-muted-foreground">{p.blurb}</div>
                      </div>
                    </label>
                  ))}
                </div>
                {enabledPassIds.length === 0 && (
                  <p className="text-xs text-destructive mt-1">Select at least one pass.</p>
                )}
              </div>

              {/* MODEL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                            <span className="ml-2 text-xs text-muted-foreground">· platform</span>
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
                        </SelectItem>
                      ))}
                      {selectedProvider && selectedProvider.models.length === 0 && (
                        <SelectItem value={model || "custom"}>Custom (type below)</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {selectedProvider && selectedProvider.models.length === 0 && (
                    <Input
                      className="mt-2"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="model id"
                    />
                  )}
                </div>
              </div>

              {/* MODE */}
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
                    <Link className="underline" href="/api-keys">Add one</Link>.
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
                        <SelectItem key={k.id} value={String(k.id)}>{k.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* CUSTOM NOTE */}
              <div>
                <Label>Extra direction (optional)</Label>
                <Textarea
                  rows={2}
                  placeholder="e.g. 'Make Mira's voice more guarded.', 'Cut the metaphors about birds.'"
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                />
              </div>
            </div>
          ) : (
            // RESULT VIEW — side-by-side
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="default" className="gap-1">
                  <Sparkles className="h-3 w-3" />
                  {intensityMeta.label} · {intensity}/100
                </Badge>
                <Badge variant="secondary">
                  {result.stats.overlapPercent}% words preserved
                </Badge>
                <Badge variant="secondary">
                  {result.stats.beforeWords} → {result.stats.afterWords} words
                  {result.stats.wordDelta >= 0 ? " (+" : " ("}
                  {result.stats.wordDelta})
                </Badge>
                <Badge variant="outline">
                  {result.usage.totalTokens.toLocaleString()} tokens ·{" "}
                  {moneyFromMicroCents(result.usage.costMicroCents)} ·{" "}
                  {(result.usage.durationMs / 1000).toFixed(1)}s
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Card className="bg-muted/30">
                  <CardContent className="pt-4">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                      Before
                    </div>
                    <div className="text-sm whitespace-pre-wrap leading-relaxed max-h-[40vh] overflow-y-auto">
                      {initialText}
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-primary">
                  <CardContent className="pt-4">
                    <div className="text-xs uppercase tracking-wider text-primary mb-1">
                      After (humanized)
                    </div>
                    <div className="text-sm whitespace-pre-wrap leading-relaxed max-h-[40vh] overflow-y-auto">
                      {result.text}
                    </div>
                  </CardContent>
                </Card>
              </div>
              <p className="text-xs text-muted-foreground italic">
                Saved to version history — you can re-apply or roll back any time.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          {!result ? (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => humanizeMutation.mutate()}
                disabled={!canSubmit || humanizeMutation.isPending}
              >
                {humanizeMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                )}
                Humanize
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={reset}>
                <RotateCw className="h-4 w-4 mr-1.5" />
                Tune & run again
              </Button>
              <Button
                onClick={() => {
                  onAccept(result.text, result.generationId);
                  onOpenChange(false);
                }}
              >
                <Check className="h-4 w-4 mr-1.5" />
                Apply to chapter
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
