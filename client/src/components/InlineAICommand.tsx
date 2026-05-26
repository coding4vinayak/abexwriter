import { useState } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface InlineAICommandProps {
  open: boolean;
  onClose: () => void;
  selectedText: string;
  onResult: (newText: string) => void;
}

const COMMANDS = [
  { id: "shorter", label: "Make shorter" },
  { id: "longer", label: "Make longer" },
  { id: "emotional", label: "More emotional" },
  { id: "descriptive", label: "More descriptive" },
  { id: "grammar", label: "Fix grammar" },
  { id: "simplify", label: "Simplify" },
  { id: "dialogue", label: "Make dialogue" },
  { id: "custom", label: "Custom instruction..." },
];

export default function InlineAICommand({
  open,
  onClose,
  selectedText,
  onResult,
}: InlineAICommandProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [customInstruction, setCustomInstruction] = useState("");

  if (!open) return null;

  const executeCommand = async (instruction: string) => {
    if (!selectedText.trim()) {
      toast({
        title: "No text selected",
        description: "Select some text or place cursor in a paragraph first.",
        variant: "destructive",
      });
      onClose();
      return;
    }

    setIsProcessing(true);
    try {
      // Get stored LLM preference
      let provider = "openai";
      let model = "";
      let mode: "byok" | "platform" = "byok";
      let apiKeyId: number | undefined;

      try {
        const last = localStorage.getItem("abexwriter:lastModel");
        if (last) {
          const v = JSON.parse(last);
          if (v.provider) provider = v.provider;
          if (v.model) model = v.model;
          if (v.mode) mode = v.mode;
        }
      } catch {
        /* ignore */
      }

      // Get API key
      const keysRes = await apiRequest("GET", "/api/api-keys", undefined);
      const keys = (await keysRes.json()) as any[];
      const key = keys.find((k: any) => k.provider === provider && k.isActive);
      if (key) apiKeyId = key.id;

      if (!model) {
        const provRes = await apiRequest("GET", "/api/llm/providers", undefined);
        const provData = (await provRes.json()) as { providers: any[] };
        const prov = provData.providers.find((p: any) => p.id === provider);
        if (prov?.models?.[0]) model = prov.models[0].id;
      }

      if (!model || (!apiKeyId && mode === "byok")) {
        toast({
          title: "Configure API key first",
          description: "Go to Settings > API Keys to add a key.",
          variant: "destructive",
        });
        onClose();
        return;
      }

      const body: any = {
        text: selectedText,
        instruction,
        provider,
        model,
        mode,
      };
      if (apiKeyId) body.apiKeyId = apiKeyId;

      const res = await apiRequest("POST", "/api/generate/rewrite", body);
      const data = await res.json();
      onResult(data.rewritten || data.content || data.text || selectedText);
      onClose();
    } catch (err: any) {
      toast({
        title: "Rewrite failed",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelect = (commandId: string) => {
    if (commandId === "custom") {
      setCustomMode(true);
      return;
    }
    const cmd = COMMANDS.find((c) => c.id === commandId);
    if (cmd) executeCommand(cmd.label);
  };

  const handleCustomSubmit = () => {
    if (customInstruction.trim()) {
      executeCommand(customInstruction.trim());
    }
  };

  if (isProcessing) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
        <div className="bg-card border border-border rounded-lg p-6 shadow-xl flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-foreground">Rewriting with AI...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div
        className="fixed inset-0 bg-black/20"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg mx-4 bg-card border border-border rounded-lg shadow-xl overflow-hidden">
        {customMode ? (
          <div className="p-4">
            <p className="text-sm text-muted-foreground mb-2">
              Custom instruction for selected text:
            </p>
            <input
              autoFocus
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g. Translate to Spanish, rewrite in first person..."
              value={customInstruction}
              onChange={(e) => setCustomInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCustomSubmit();
                if (e.key === "Escape") onClose();
              }}
            />
          </div>
        ) : (
          <Command className="border-0">
            <CommandInput placeholder="AI rewrite command..." />
            <CommandList>
              <CommandEmpty>No commands found.</CommandEmpty>
              <CommandGroup heading="Rewrite options">
                {COMMANDS.map((cmd) => (
                  <CommandItem
                    key={cmd.id}
                    value={cmd.id}
                    onSelect={() => handleSelect(cmd.id)}
                  >
                    {cmd.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </div>
    </div>
  );
}
