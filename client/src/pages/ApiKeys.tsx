import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  KeyRound,
  Sparkles,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Types mirroring the server's catalog and stored keys (subset).
// ─────────────────────────────────────────────────────────────────────────────
interface ModelInfo {
  id: string;
  label: string;
  contextWindow: number;
  inputCostPer1M: number;
  outputCostPer1M: number;
  capabilities?: string[];
}
interface ProviderInfo {
  id: string;
  label: string;
  protocol: "openai-compatible" | "anthropic" | "gemini";
  baseUrl: string | null;
  requiresApiKey: boolean;
  signupUrl: string;
  platformAvailable: boolean;
  models: ModelInfo[];
}
interface ApiKeyRow {
  id: number;
  userId: number;
  provider: string;
  label: string;
  keyPreview: string;
  baseUrl: string | null;
  defaultModel: string | null;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
interface UsageSummary {
  monthMicroCents: number;
  totalTokens: number;
  callCount: number;
  byProvider: { provider: string; tokens: number; costMicroCents: number; calls: number }[];
}

const moneyFromMicroCents = (mc: number) =>
  `$${(mc / 100_000).toFixed(mc < 1000 ? 6 : 4)}`;

// ─────────────────────────────────────────────────────────────────────────────
export default function ApiKeysPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);

  // Form state for new key.
  const [providerId, setProviderId] = useState<string>("openai");
  const [label, setLabel] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [defaultModel, setDefaultModel] = useState("");

  // Queries
  const providersQuery = useQuery({
    queryKey: ["/api/llm/providers"],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/llm/providers", undefined);
      const data = (await r.json()) as { providers: ProviderInfo[] };
      return data.providers;
    },
  });

  const keysQuery = useQuery({
    queryKey: ["/api/api-keys"],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/api-keys", undefined);
      return (await r.json()) as ApiKeyRow[];
    },
  });

  const usageQuery = useQuery({
    queryKey: ["/api/usage"],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/usage", undefined);
      return (await r.json()) as UsageSummary;
    },
  });

  const selectedProvider = useMemo(
    () => providersQuery.data?.find((p) => p.id === providerId),
    [providersQuery.data, providerId],
  );

  // Mutations
  const createMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        provider: providerId,
        apiKey: apiKeyInput,
        label: label || selectedProvider?.label || "Default",
      };
      if (baseUrl.trim()) body.baseUrl = baseUrl.trim();
      if (defaultModel.trim()) body.defaultModel = defaultModel.trim();
      const r = await apiRequest("POST", "/api/api-keys", body);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "API key saved", description: "Encrypted and stored securely." });
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      setDialogOpen(false);
      setApiKeyInput("");
      setLabel("");
      setBaseUrl("");
      setDefaultModel("");
    },
    onError: (err: any) => {
      toast({
        title: "Failed to save key",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/api-keys/${id}`, undefined);
    },
    onSuccess: () => {
      toast({ title: "Key deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const r = await apiRequest("PUT", `/api/api-keys/${id}`, { isActive });
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] }),
  });

  async function testKey(row: ApiKeyRow) {
    setTestingId(row.id);
    try {
      const r = await apiRequest("POST", "/api/llm/test", {
        provider: row.provider,
        apiKeyId: row.id,
        model: row.defaultModel ?? undefined,
      });
      const data = await r.json();
      if (data.ok) {
        toast({
          title: "Connection OK",
          description: `${row.provider} replied: "${(data.reply || "").slice(0, 80)}"`,
        });
      } else {
        toast({ title: "Test failed", description: data.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Test failed", description: err?.message, variant: "destructive" });
    } finally {
      setTestingId(null);
    }
  }

  const providers = providersQuery.data ?? [];
  const keys = keysQuery.data ?? [];
  const usage = usageQuery.data;

  // Group existing keys by provider for the cards layout.
  const keysByProvider = useMemo(() => {
    const map = new Map<string, ApiKeyRow[]>();
    for (const k of keys) {
      const arr = map.get(k.provider) ?? [];
      arr.push(k);
      map.set(k.provider, arr);
    }
    return map;
  }, [keys]);

  return (
    <div className="container mx-auto max-w-6xl py-8 px-4">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <KeyRound className="h-6 w-6" />
            API Keys & Providers
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Bring your own keys (BYOK) for any OpenAI-compatible provider, or use
            platform-managed keys (subject to a monthly quota). Keys are encrypted
            at rest with AES-256-GCM and never returned in plaintext.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add API Key
          </Button>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add a new API key</DialogTitle>
              <DialogDescription>
                Stored encrypted (AES-256-GCM). The plaintext key never leaves
                this server.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label>Provider</Label>
                <Select value={providerId} onValueChange={setProviderId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label}
                        {p.protocol === "openai-compatible" && p.id !== "openai" ? (
                          <span className="text-muted-foreground"> · OpenAI-compatible</span>
                        ) : null}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedProvider?.signupUrl ? (
                  <a
                    href={selectedProvider.signupUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary inline-flex items-center mt-1 hover:underline"
                  >
                    Get a key from {selectedProvider.label}
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                ) : null}
              </div>
              <div>
                <Label>Label</Label>
                <Input
                  value={label}
                  placeholder={selectedProvider?.label ?? "Default"}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>
              <div>
                <Label>API key</Label>
                <Input
                  type="password"
                  autoComplete="off"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="sk-…"
                />
              </div>
              {selectedProvider?.id === "custom" || selectedProvider?.protocol === "openai-compatible" ? (
                <div>
                  <Label>
                    Base URL{" "}
                    {selectedProvider?.id !== "custom" && (
                      <span className="text-muted-foreground text-xs">
                        (optional — defaults to {selectedProvider?.baseUrl})
                      </span>
                    )}
                  </Label>
                  <Input
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder={selectedProvider?.baseUrl ?? "https://your-endpoint/v1"}
                  />
                </div>
              ) : null}
              <div>
                <Label>
                  Default model <span className="text-muted-foreground text-xs">(optional)</span>
                </Label>
                <Input
                  value={defaultModel}
                  onChange={(e) => setDefaultModel(e.target.value)}
                  placeholder={selectedProvider?.models?.[0]?.id ?? "gpt-4o-mini"}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!apiKeyInput || createMutation.isPending}
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save key
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Usage summary ──────────────────────────────────────────────── */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" /> This month's usage
          </CardTitle>
          <CardDescription>
            BYOK calls are billed by the provider directly. Platform-mode calls
            count toward your monthly quota.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usageQuery.isLoading ? (
            <Skeleton className="h-16" />
          ) : (
            <div className="grid grid-cols-3 gap-4">
              <Stat label="Total cost" value={moneyFromMicroCents(usage?.monthMicroCents ?? 0)} />
              <Stat label="Total tokens" value={(usage?.totalTokens ?? 0).toLocaleString()} />
              <Stat label="Calls" value={(usage?.callCount ?? 0).toLocaleString()} />
            </div>
          )}
          {usage?.byProvider && usage.byProvider.length > 0 && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {usage.byProvider.map((p) => (
                <div
                  key={p.provider}
                  className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm flex items-center justify-between"
                >
                  <span className="font-medium capitalize">{p.provider}</span>
                  <span className="text-muted-foreground">
                    {p.tokens.toLocaleString()} tok · {moneyFromMicroCents(p.costMicroCents)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Provider grid ──────────────────────────────────────────────── */}
      {providersQuery.isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {providers.map((provider) => {
            const providerKeys = keysByProvider.get(provider.id) ?? [];
            return (
              <Card key={provider.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      {provider.label}
                      {provider.platformAvailable ? (
                        <Badge variant="secondary" className="text-xs">
                          Platform key configured
                        </Badge>
                      ) : null}
                    </span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {provider.protocol}
                    </span>
                  </CardTitle>
                  <CardDescription className="text-xs break-all">
                    {provider.baseUrl ?? "User-provided baseUrl required"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {providerKeys.length === 0 ? (
                    <div className="text-sm text-muted-foreground italic">
                      No BYOK key saved.
                      {provider.platformAvailable
                        ? " Platform mode is available."
                        : " Add a key to enable this provider."}
                    </div>
                  ) : (
                    providerKeys.map((row) => (
                      <div
                        key={row.id}
                        className="flex items-center justify-between gap-3 border border-border rounded-md p-3"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate flex items-center gap-2">
                            {row.label}
                            {row.isActive ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {row.keyPreview}
                          </div>
                          {row.defaultModel && (
                            <div className="text-xs text-muted-foreground">
                              default model: {row.defaultModel}
                            </div>
                          )}
                          {row.lastUsedAt && (
                            <div className="text-[11px] text-muted-foreground mt-1">
                              last used {new Date(row.lastUsedAt).toLocaleString()}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Switch
                            checked={row.isActive}
                            onCheckedChange={(v) =>
                              toggleActiveMutation.mutate({ id: row.id, isActive: v })
                            }
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => testKey(row)}
                            disabled={testingId === row.id}
                          >
                            {testingId === row.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "Test"
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm(`Delete key "${row.label}"?`)) {
                                deleteMutation.mutate(row.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                  {provider.models.length > 0 && (
                    <details className="text-xs text-muted-foreground">
                      <summary className="cursor-pointer hover:text-foreground">
                        Available models ({provider.models.length})
                      </summary>
                      <ul className="mt-2 space-y-1 font-mono">
                        {provider.models.map((m) => (
                          <li key={m.id} className="flex items-center justify-between">
                            <span className="truncate">{m.id}</span>
                            <span className="ml-2 shrink-0 text-[11px]">
                              ${(m.inputCostPer1M / 100_000).toFixed(2)}/M in · $
                              {(m.outputCostPer1M / 100_000).toFixed(2)}/M out
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}
