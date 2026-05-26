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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ImageIcon } from "lucide-react";
import { Link } from "wouter";

interface ImageModel {
  id: string;
  label: string;
  sizes: string[];
}

interface ImageProviderInfo {
  id: string;
  label: string;
  signupUrl: string;
  platformAvailable: boolean;
  models: ImageModel[];
}

interface ApiKeyRow {
  id: number;
  provider: string;
  label: string;
  defaultModel: string | null;
  isActive: boolean;
}

interface ChapterImage {
  id: number;
  chapterId: number;
  bookId: number;
  imageUrl: string;
  prompt: string;
  revisedPrompt: string | null;
  provider: string;
  model: string;
  size: string;
  style: string | null;
  durationMs: number;
  caption: string | null;
  orderIndex: number;
  createdAt: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookId: number;
  chapterId: number;
}

const LS_IMG_KEY = "abexwriter:lastImageModel";

/**
 * Dialog for generating AI images for a chapter.
 * Supports OpenAI DALL-E, Stability AI, Replicate, and custom endpoints.
 */
export default function ImageGenerateDialog({
  open,
  onOpenChange,
  bookId,
  chapterId,
}: Props) {
  const { toast } = useToast();

  const [provider, setProvider] = useState<string>("openai");
  const [model, setModel] = useState<string>("");
  const [prompt, setPrompt] = useState<string>("");
  const [negativePrompt, setNegativePrompt] = useState<string>("");
  const [size, setSize] = useState<string>("1024x1024");
  const [style, setStyle] = useState<"vivid" | "natural">("vivid");
  const [quality, setQuality] = useState<"standard" | "hd">("standard");
  const [apiKeyId, setApiKeyId] = useState<number | undefined>(undefined);
  const [caption, setCaption] = useState<string>("");
  const [generatedImage, setGeneratedImage] = useState<ChapterImage | null>(null);

  // Fetch image providers
  const providersQuery = useQuery({
    queryKey: ["/api/images/providers"],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/images/providers", undefined);
      const data = (await r.json()) as { providers: ImageProviderInfo[] };
      return data.providers;
    },
    enabled: open,
  });

  // Fetch BYOK keys (same pattern as GenerateChapterDialog)
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

  const selectedModel = useMemo(
    () => selectedProvider?.models.find((m) => m.id === model),
    [selectedProvider, model],
  );

  const availableSizes = selectedModel?.sizes ?? ["1024x1024"];

  const isDallE = provider === "openai";

  // Restore last-used selection
  useEffect(() => {
    if (!open) return;
    setGeneratedImage(null);
    try {
      const last = localStorage.getItem(LS_IMG_KEY);
      if (last) {
        const v = JSON.parse(last) as { provider?: string; model?: string };
        if (v.provider) setProvider(v.provider);
        if (v.model) setModel(v.model);
      }
    } catch {
      /* ignore */
    }
  }, [open]);

  // When provider changes, pick a sensible default model
  useEffect(() => {
    if (!selectedProvider) return;
    if (model && selectedProvider.models.some((m) => m.id === model)) return;
    setModel(selectedProvider.models[0]?.id ?? "");
  }, [selectedProvider, model]);

  // Auto-select first BYOK key
  useEffect(() => {
    const k = keysForProvider[0];
    setApiKeyId(k?.id);
  }, [provider, keysForProvider]);

  // When model changes, pick first available size
  useEffect(() => {
    if (availableSizes.length > 0 && !availableSizes.includes(size)) {
      setSize(availableSizes[0]);
    }
  }, [availableSizes, size]);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        provider,
        model,
        prompt,
        bookId,
        chapterId,
      };
      if (negativePrompt) body.negativePrompt = negativePrompt;
      if (size) body.size = size;
      if (isDallE) {
        body.style = style;
        body.quality = quality;
      }
      if (apiKeyId) body.apiKeyId = apiKeyId;
      if (caption) body.caption = caption;

      const r = await apiRequest("POST", "/api/images/generate", body);
      const data = await r.json();
      return data as { image: ChapterImage; durationMs: number };
    },
    onSuccess: (data) => {
      try {
        localStorage.setItem(LS_IMG_KEY, JSON.stringify({ provider, model }));
      } catch {
        /* ignore */
      }
      setGeneratedImage(data.image);
      queryClient.invalidateQueries({ queryKey: [`/api/chapters/${chapterId}/images`] });
      toast({
        title: "Image generated",
        description: `Generated in ${(data.durationMs / 1000).toFixed(1)}s`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Image generation failed",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    },
  });

  const canGenerate = !!provider && !!model && !!prompt.trim() && !!apiKeyId;

  const handleClose = () => {
    setGeneratedImage(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" /> Generate Image
          </DialogTitle>
          <DialogDescription>
            Create AI-generated illustrations for your chapter — scene depictions,
            character portraits, concept art, and more.
          </DialogDescription>
        </DialogHeader>

        {generatedImage ? (
          <div className="space-y-4 py-2">
            <div className="rounded-lg overflow-hidden border border-border">
              <img
                src={generatedImage.imageUrl}
                alt={generatedImage.caption || generatedImage.prompt}
                className="w-full h-auto max-h-[400px] object-contain bg-muted"
              />
            </div>
            {generatedImage.revisedPrompt && (
              <p className="text-sm text-muted-foreground">
                <strong>Revised prompt:</strong> {generatedImage.revisedPrompt}
              </p>
            )}
            <div>
              <Label>Caption (optional)</Label>
              <Input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Add a caption for this image"
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={handleClose}>
                Done
              </Button>
              <Button
                onClick={() => {
                  setGeneratedImage(null);
                  setPrompt("");
                  setCaption("");
                }}
                variant="outline"
              >
                Generate another
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
              {/* Provider & Model */}
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
                            <span className="ml-2 text-xs text-muted-foreground">
                              · platform OK
                            </span>
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
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* BYOK Key selection */}
              <div>
                <Label>API Key</Label>
                {keysForProvider.length === 0 ? (
                  <p className="text-sm text-destructive mt-1">
                    No API key for {selectedProvider?.label ?? provider}.{" "}
                    <Link className="underline" href="/api-keys">
                      Add one
                    </Link>
                    .
                  </p>
                ) : keysForProvider.length === 1 ? (
                  <p className="text-sm text-muted-foreground mt-1">
                    Using: <Badge variant="secondary">{keysForProvider[0].label}</Badge>
                  </p>
                ) : (
                  <Select
                    value={apiKeyId ? String(apiKeyId) : ""}
                    onValueChange={(v) => setApiKeyId(Number(v))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {keysForProvider.map((k) => (
                        <SelectItem key={k.id} value={String(k.id)}>
                          {k.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Prompt */}
              <div>
                <Label>Prompt</Label>
                <Textarea
                  rows={3}
                  placeholder="Describe the image you want to generate (e.g., 'A dark gothic castle on a stormy cliff at night, digital painting style')"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </div>

              {/* Negative Prompt */}
              <div>
                <Label>Negative Prompt (optional)</Label>
                <Input
                  placeholder="Things to avoid in the image"
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                />
              </div>

              {/* Size, Style, Quality */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Size</Label>
                  <Select value={size} onValueChange={setSize}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSizes.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {isDallE && (
                  <>
                    <div>
                      <Label>Style</Label>
                      <Select value={style} onValueChange={(v) => setStyle(v as "vivid" | "natural")}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vivid">Vivid</SelectItem>
                          <SelectItem value="natural">Natural</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Quality</Label>
                      <Select value={quality} onValueChange={(v) => setQuality(v as "standard" | "hd")}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">Standard</SelectItem>
                          <SelectItem value="hd">HD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>

              {/* Caption */}
              <div>
                <Label>Caption (optional)</Label>
                <Input
                  placeholder="Caption / alt text for the image"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={!canGenerate || generateMutation.isPending}
              >
                {generateMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                )}
                Generate Image
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
