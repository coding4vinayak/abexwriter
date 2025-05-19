import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { TEMP_USER_ID } from "@/lib/utils";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { LlmSettings, AutoEditSettings } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { PlusCircle, Loader2, Save, Check } from "lucide-react";
import { templates } from "@/lib/templates";

export default function Settings() {
  const { toast } = useToast();
  // LLM settings state
  const [name, setName] = useState("Default Settings");
  const [model, setModel] = useState("deepseek");
  const [customModelUrl, setCustomModelUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [temperature, setTemperature] = useState(700); // Store as integer (x1000)
  const [maxTokens, setMaxTokens] = useState(4096);
  const [topP, setTopP] = useState(950); // Store as integer (x1000)
  const [presencePenalty, setPresencePenalty] = useState(200); // Store as integer (x1000)
  
  // New model dialog
  const [isNewModelDialogOpen, setIsNewModelDialogOpen] = useState(false);
  const [newModelName, setNewModelName] = useState("");
  const [newModelType, setNewModelType] = useState("deepseek");
  const [newModelUrl, setNewModelUrl] = useState("");
  const [newModelApiKey, setNewModelApiKey] = useState("");
  
  // Model testing
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  
  // Auto-edit settings state
  const [grammarCheck, setGrammarCheck] = useState(true);
  const [styleConsistency, setStyleConsistency] = useState(true);
  const [contentImprovement, setContentImprovement] = useState(true);
  const [plagiarismCheck, setPlagiarismCheck] = useState(false);
  const [templateType, setTemplateType] = useState("none");
  const [customTemplate, setCustomTemplate] = useState("");
  
  // LLM settings ID for updates
  const [llmSettingsId, setLlmSettingsId] = useState<number | null>(null);
  // Auto-edit settings ID for updates
  const [autoEditSettingsId, setAutoEditSettingsId] = useState<number | null>(null);
  
  // All LLM settings for listing and selection
  const [availableModels, setAvailableModels] = useState<LlmSettings[]>([]);

  // Fetch LLM settings
  const { data: llmSettingsData, isLoading: isLlmSettingsLoading } = useQuery({
    queryKey: ["/api/llm-settings/default"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/llm-settings/default", undefined);
        return res.json() as Promise<LlmSettings>;
      } catch (error) {
        // Return null if no default settings exist yet
        return null;
      }
    },
  });

  // Fetch auto-edit settings
  const { data: autoEditSettingsData, isLoading: isAutoEditSettingsLoading } = useQuery({
    queryKey: ["/api/auto-edit-settings", { userId: TEMP_USER_ID }],
    queryFn: async () => {
      try {
        const res = await apiRequest(
          "GET", 
          `/api/auto-edit-settings?userId=${TEMP_USER_ID}`, 
          undefined
        );
        return res.json() as Promise<AutoEditSettings>;
      } catch (error) {
        // Return null if no settings exist yet
        return null;
      }
    },
  });

  // Fetch all LLM settings
  const { data: allModelsData, isLoading: isAllModelsLoading } = useQuery({
    queryKey: ["/api/llm-settings/all"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/llm-settings", undefined);
        return res.json() as Promise<LlmSettings[]>;
      } catch (error) {
        // Return empty array if no settings exist yet
        return [];
      }
    },
  });

  // Update form when data is loaded
  useEffect(() => {
    if (llmSettingsData) {
      setLlmSettingsId(llmSettingsData.id);
      setName(llmSettingsData.name);
      setModel(llmSettingsData.model);
      setCustomModelUrl(llmSettingsData.customModelUrl || "");
      setApiKey(llmSettingsData.apiKey || "");
      setTemperature(llmSettingsData.temperature);
      setMaxTokens(llmSettingsData.maxTokens);
      setTopP(llmSettingsData.topP);
      setPresencePenalty(llmSettingsData.presencePenalty);
    }
  }, [llmSettingsData]);
  
  // Update available models when allModelsData changes
  useEffect(() => {
    if (allModelsData) {
      setAvailableModels(allModelsData);
    }
  }, [allModelsData]);

  // Update auto-edit settings and check for selected template from templates page
  useEffect(() => {
    // First set the values from server data
    if (autoEditSettingsData) {
      setAutoEditSettingsId(autoEditSettingsData.id);
      setGrammarCheck(autoEditSettingsData.grammarCheck);
      setStyleConsistency(autoEditSettingsData.styleConsistency);
      setContentImprovement(autoEditSettingsData.contentImprovement);
      setPlagiarismCheck(autoEditSettingsData.plagiarismCheck);
      if (autoEditSettingsData.templateType) {
        setTemplateType(autoEditSettingsData.templateType);
      }
      if (autoEditSettingsData.customTemplate) {
        setCustomTemplate(autoEditSettingsData.customTemplate);
      }
    }
    
    // Then check if we have a selected template from the templates page
    const selectedTemplate = localStorage.getItem('selectedTemplate');
    if (selectedTemplate && selectedTemplate !== 'none') {
      setTemplateType(selectedTemplate);
      // Only set the custom template if it's empty or if the user explicitly chose this template
      const currentTemplate = localStorage.getItem('currentlyViewingTemplate');
      if (currentTemplate === selectedTemplate || !customTemplate) {
        try {
          const templateObj = templates[selectedTemplate as keyof typeof templates];
          if (templateObj) {
            setCustomTemplate(templateObj.promptTemplate);
          }
        } catch (error) {
          console.error("Error loading template:", error);
        }
      }
      // Clear the selected template so it doesn't keep overriding
      localStorage.removeItem('selectedTemplate');
      localStorage.setItem('currentlyViewingTemplate', selectedTemplate);
    }
  }, [autoEditSettingsData]);

  // Save LLM settings mutation
  const saveLlmSettingsMutation = useMutation({
    mutationFn: async (settings: any) => {
      if (llmSettingsId) {
        // Update existing settings
        const res = await apiRequest(
          "PUT",
          `/api/llm-settings/${llmSettingsId}`,
          settings
        );
        return res.json();
      } else {
        // Create new settings
        const res = await apiRequest(
          "POST",
          "/api/llm-settings",
          settings
        );
        return res.json();
      }
    },
    onSuccess: (data) => {
      setLlmSettingsId(data.id);
      toast({
        title: "Settings saved",
        description: "LLM configuration has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/llm-settings/default"] });
    },
    onError: (error) => {
      toast({
        title: "Error saving settings",
        description: "There was a problem saving your LLM settings.",
        variant: "destructive",
      });
    },
  });

  // Save auto-edit settings mutation
  const saveAutoEditSettingsMutation = useMutation({
    mutationFn: async (settings: any) => {
      if (autoEditSettingsId) {
        // Update existing settings
        const res = await apiRequest(
          "PUT",
          `/api/auto-edit-settings/${autoEditSettingsId}`,
          settings
        );
        return res.json();
      } else {
        // Create new settings
        const res = await apiRequest(
          "POST",
          "/api/auto-edit-settings",
          settings
        );
        return res.json();
      }
    },
    onSuccess: (data) => {
      setAutoEditSettingsId(data.id);
      toast({
        title: "Settings saved",
        description: "Auto-editing configuration has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auto-edit-settings"] });
    },
    onError: (error) => {
      toast({
        title: "Error saving settings",
        description: "There was a problem saving your auto-editing settings.",
        variant: "destructive",
      });
    },
  });

  // Create new model settings mutation
  const createModelSettingsMutation = useMutation({
    mutationFn: async (settings: any) => {
      const res = await apiRequest("POST", "/api/llm-settings", settings);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Model added",
        description: `"${data.name}" has been added successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/llm-settings/all"] });
      setIsNewModelDialogOpen(false);
      // Reset form
      setNewModelName("");
      setNewModelType("deepseek");
      setNewModelUrl("");
      setNewModelApiKey("");
    },
    onError: (error) => {
      toast({
        title: "Error adding model",
        description: "There was a problem adding the new model.",
        variant: "destructive",
      });
    },
  });
  
  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: async (settings: any) => {
      setIsTestingConnection(true);
      // In a real implementation, this would call the API to test the connection
      // For now, we'll simulate a successful connection after a delay
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ success: true });
        }, 1500);
      });
    },
    onSuccess: () => {
      setIsTestingConnection(false);
      toast({
        title: "Connection successful",
        description: "Successfully connected to the LLM API.",
      });
    },
    onError: () => {
      setIsTestingConnection(false);
      toast({
        title: "Connection failed",
        description: "Failed to connect to the LLM API. Check your API key and URL.",
        variant: "destructive",
      });
    },
  });

  const handleSaveLlmSettings = () => {
    saveLlmSettingsMutation.mutate({
      name,
      model,
      customModelUrl: customModelUrl || null,
      apiKey: apiKey || null,
      temperature,
      maxTokens,
      topP,
      presencePenalty,
      isDefault: true, // Make this the default settings
    });
  };
  
  const handleCreateNewModel = () => {
    if (!newModelName.trim()) {
      toast({
        title: "Name is required",
        description: "Please enter a name for your model configuration.",
        variant: "destructive",
      });
      return;
    }
    
    if (newModelType === "custom" && !newModelUrl.trim()) {
      toast({
        title: "URL is required",
        description: "Please enter a URL for your custom OpenAI-compatible model.",
        variant: "destructive",
      });
      return;
    }
    
    if ((newModelType === "custom" || newModelType === "openai" || 
         newModelType === "anthropic" || newModelType === "perplexity") && 
         !newModelApiKey.trim()) {
      toast({
        title: "API Key required",
        description: `Please enter an API key for ${newModelType === "custom" ? "your custom model" : newModelType} access.`,
        variant: "destructive",
      });
      return;
    }
    
    createModelSettingsMutation.mutate({
      name: newModelName,
      model: newModelType,
      customModelUrl: (newModelType === "custom" || newModelType === "openai" || 
                      newModelType === "anthropic" || newModelType === "perplexity") ? 
                      (newModelUrl.trim() || null) : null,
      apiKey: newModelApiKey || null,
      temperature: 700,
      maxTokens: 4096,
      topP: 950,
      presencePenalty: 200,
      isDefault: false,
    });
  };
  
  const handleTestConnection = () => {
    testConnectionMutation.mutate({
      model,
      apiKey,
      customModelUrl
    });
  };

  const handleSaveAutoEditSettings = () => {
    saveAutoEditSettingsMutation.mutate({
      grammarCheck,
      styleConsistency,
      contentImprovement,
      plagiarismCheck,
      templateType,
      customTemplate: customTemplate || null,
      userId: TEMP_USER_ID,
    });
  };

  return (
    <div className="container page-scrollable custom-scrollbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="border-b border-border pb-5 mb-6">
          <h2 className="text-2xl font-bold text-foreground">Settings</h2>
          <p className="mt-2 text-sm text-muted-foreground">Configure application settings and LLM models</p>
        </div>

        {/* LLM Configuration Card */}
        <Card className="mb-8">
          <CardHeader className="bg-muted/50 border-b">
            <CardTitle>LLM Configuration</CardTitle>
            <CardDescription>Configure your preferred language model settings</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {isLlmSettingsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-12 w-40 ml-auto" />
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); handleSaveLlmSettings(); }}>
                {/* Model Selection */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <Label htmlFor="model-name" className="block text-sm font-medium text-foreground">
                      Model Configuration
                    </Label>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setIsNewModelDialogOpen(true)}
                      className="text-xs"
                    >
                      <PlusCircle className="h-3.5 w-3.5 mr-1" />
                      Add New Model
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <Label htmlFor="model-name" className="block text-sm font-medium text-foreground mb-1">
                        Configuration Name
                      </Label>
                      <Input
                        id="model-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="My Model Configuration"
                        className="w-full"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="llm-model" className="block text-sm font-medium text-foreground mb-1">
                        Model Type
                      </Label>
                      <Select 
                        value={model} 
                        onValueChange={setModel}
                      >
                        <SelectTrigger id="llm-model" className="w-full">
                          <SelectValue placeholder="Select Model" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="deepseek">DeepSeek (Novita)</SelectItem>
                          <SelectItem value="llama">Llama 2</SelectItem>
                          <SelectItem value="mistral">Mistral</SelectItem>
                          <SelectItem value="phi">Phi-3</SelectItem>
                          <SelectItem value="openai">OpenAI (GPT-4o, etc.)</SelectItem>
                          <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                          <SelectItem value="perplexity">Perplexity</SelectItem>
                          <SelectItem value="custom">Custom OpenAI-compatible</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {(model === "custom" || model === "openai" || model === "anthropic" || model === "perplexity") && (
                      <div>
                        <Label htmlFor="custom-model-url" className="block text-sm font-medium text-foreground mb-1">
                          {model === "custom" ? "Base URL" : "API Endpoint URL (Optional)"}
                        </Label>
                        <Input
                          id="custom-model-url"
                          value={customModelUrl}
                          onChange={(e) => setCustomModelUrl(e.target.value)}
                          placeholder={model === "custom" 
                            ? "http://localhost:8000/v1" 
                            : model === "openai" 
                              ? "https://api.openai.com/v1" 
                              : model === "anthropic" 
                                ? "https://api.anthropic.com/v1" 
                                : "https://api.perplexity.ai"}
                          className="w-full"
                        />
                        <div className="text-xs text-muted-foreground mt-1">
                          {model === "custom" 
                            ? "Required for custom OpenAI-compatible APIs" 
                            : "Leave empty to use the default official endpoint"}
                        </div>
                      </div>
                    )}
                    
                    <div>
                      <Label htmlFor="api-key" className="block text-sm font-medium text-foreground mb-1">
                        API Key {(model === "openai" || model === "anthropic" || model === "perplexity" || model === "custom") && ""}
                      </Label>
                      <Input
                        id="api-key"
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={model === "openai" 
                          ? "sk-..." 
                          : model === "anthropic" 
                            ? "sk-ant-..." 
                            : model === "perplexity" 
                              ? "pplx-..." 
                              : "your-api-key"}
                        className="w-full"
                      />
                      {(model === "openai" || model === "anthropic" || model === "perplexity") && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Required for {model === "openai" ? "OpenAI" : model === "anthropic" ? "Anthropic" : "Perplexity"} API access
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTestConnection}
                    disabled={isTestingConnection}
                    className="mb-4"
                  >
                    {isTestingConnection ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        Testing Connection...
                      </>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5 mr-1.5" />
                        Test Connection
                      </>
                    )}
                  </Button>
                  
                  {availableModels && availableModels.length > 0 && (
                    <div>
                      <Label className="block text-sm font-medium text-gray-700 mb-1">
                        Available Model Configurations
                      </Label>
                      <div className="bg-gray-50 rounded border border-gray-200 p-3 max-h-40 overflow-auto">
                        <ul className="space-y-1">
                          {availableModels.map((model) => (
                            <li 
                              key={model.id} 
                              className="flex items-center justify-between text-sm p-2 hover:bg-gray-100 rounded cursor-pointer"
                              onClick={() => {
                                setLlmSettingsId(model.id);
                                setName(model.name);
                                setModel(model.model);
                                setCustomModelUrl(model.customModelUrl || "");
                                setApiKey(model.apiKey || "");
                                setTemperature(model.temperature);
                                setMaxTokens(model.maxTokens);
                                setTopP(model.topP);
                                setPresencePenalty(model.presencePenalty);
                              }}
                            >
                              <div className="flex items-center">
                                <div className={`w-2 h-2 rounded-full mr-2 ${model.isDefault ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                                <span className="font-medium">{model.name}</span>
                              </div>
                              <span className="text-xs text-gray-500">
                                {model.model === 'custom' ? 'Custom' : 
                                 model.model === 'deepseek' ? 'DeepSeek' :
                                 model.model === 'llama' ? 'Llama 2' :
                                 model.model === 'mistral' ? 'Mistral' : 'Phi-3'}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>

                {/* Generation Parameters */}
                <div className="border-t border-gray-200 pt-6 mb-6">
                  <h4 className="text-md font-medium text-gray-800 mb-4">Generation Parameters</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <Label htmlFor="temperature" className="block text-sm font-medium text-gray-700 mb-1">
                        Temperature: {(temperature / 1000).toFixed(2)}
                      </Label>
                      <Slider
                        id="temperature"
                        defaultValue={[temperature]}
                        min={0}
                        max={1000}
                        step={50}
                        onValueChange={(value) => setTemperature(value[0])}
                        className="w-full"
                      />
                      <div className="flex justify-between mt-2">
                        <span className="text-xs text-gray-500">Conservative (0)</span>
                        <span className="text-xs text-gray-500">Creative (1)</span>
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="max-tokens" className="block text-sm font-medium text-gray-700 mb-1">
                        Max Output Tokens
                      </Label>
                      <Input
                        id="max-tokens"
                        type="number"
                        value={maxTokens}
                        onChange={(e) => setMaxTokens(Number(e.target.value))}
                        min={256}
                        max={32768}
                        className="w-full"
                      />
                      <p className="mt-1 text-xs text-gray-500">Higher values allow for longer text generation</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="top-p" className="block text-sm font-medium text-gray-700 mb-1">
                        Top P: {(topP / 1000).toFixed(2)}
                      </Label>
                      <Input
                        id="top-p"
                        type="number"
                        value={(topP / 1000).toFixed(2)}
                        onChange={(e) => setTopP(Math.round(Number(e.target.value) * 1000))}
                        min={0}
                        max={1}
                        step={0.01}
                        className="w-full"
                      />
                      <p className="mt-1 text-xs text-gray-500">Controls diversity via nucleus sampling</p>
                    </div>
                    
                    <div>
                      <Label htmlFor="presence-penalty" className="block text-sm font-medium text-gray-700 mb-1">
                        Presence Penalty: {(presencePenalty / 1000).toFixed(1)}
                      </Label>
                      <Input
                        id="presence-penalty"
                        type="number"
                        value={(presencePenalty / 1000).toFixed(1)}
                        onChange={(e) => setPresencePenalty(Math.round(Number(e.target.value) * 1000))}
                        min={-2}
                        max={2}
                        step={0.1}
                        className="w-full"
                      />
                      <p className="mt-1 text-xs text-gray-500">Reduces repetition of topics</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-6 flex justify-end space-x-3">
                  <Button 
                    type="submit" 
                    disabled={saveLlmSettingsMutation.isPending}
                    className="bg-primary hover:bg-primary-600 text-white"
                  >
                    {saveLlmSettingsMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Settings
                      </>
                    )}
                  </Button>
                </div>
                
                {/* New Model Dialog */}
                <Dialog open={isNewModelDialogOpen} onOpenChange={setIsNewModelDialogOpen}>
                  <DialogContent className="sm:max-w-[650px] p-6">
                    <DialogHeader className="mb-6">
                      <DialogTitle className="text-xl">Add New Model Configuration</DialogTitle>
                      <DialogDescription className="mt-2">
                        Configure a new LLM model for use in your book projects.
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-6">
                      {/* Model Name */}
                      <div className="space-y-2">
                        <Label htmlFor="new-model-name" className="text-sm font-medium">
                          Model Name <span className="text-sm text-red-500">*</span>
                        </Label>
                        <Input
                          id="new-model-name"
                          value={newModelName}
                          onChange={(e) => setNewModelName(e.target.value)}
                          placeholder="DeepSeek Turbo, GPT-4o, Claude 3, etc."
                          className="w-full"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Give your model a descriptive name (e.g., "DeepSeek Turbo", "GPT-4o Opus")
                        </p>
                      </div>
                      
                      {/* Provider */}
                      <div className="space-y-2">
                        <Label htmlFor="new-model-type" className="text-sm font-medium">
                          Provider <span className="text-sm text-red-500">*</span>
                        </Label>
                        <Select 
                          value={newModelType} 
                          onValueChange={setNewModelType}
                        >
                          <SelectTrigger id="new-model-type" className="w-full">
                            <SelectValue placeholder="Select Provider" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="deepseek">Novita AI</SelectItem>
                            <SelectItem value="llama">Meta AI</SelectItem>
                            <SelectItem value="mistral">Mistral AI</SelectItem>
                            <SelectItem value="phi">Microsoft</SelectItem>
                            <SelectItem value="openai">OpenAI</SelectItem>
                            <SelectItem value="anthropic">Anthropic</SelectItem>
                            <SelectItem value="perplexity">Perplexity</SelectItem>
                            <SelectItem value="custom">Custom OpenAI-compatible</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {/* Base URL - Only shown for specific model types */}
                      {(newModelType === "custom" || newModelType === "openai" || newModelType === "anthropic" || newModelType === "perplexity") && (
                        <div className="space-y-2">
                          <Label htmlFor="new-model-url" className="text-sm font-medium">
                            {newModelType === "custom" ? "Base URL" : "API Endpoint URL"} {newModelType === "custom" && <span className="text-sm text-red-500">*</span>}
                          </Label>
                          <Input
                            id="new-model-url"
                            value={newModelUrl}
                            onChange={(e) => setNewModelUrl(e.target.value)}
                            placeholder={newModelType === "custom" 
                              ? "http://localhost:8000/v1" 
                              : newModelType === "openai"
                                ? "https://api.openai.com/v1"
                                : newModelType === "anthropic"
                                  ? "https://api.anthropic.com/v1"
                                  : "https://api.perplexity.ai"}
                            className="w-full"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            {newModelType === "custom" 
                              ? "Required for custom OpenAI-compatible APIs" 
                              : "Optional: Leave empty to use the provider's default endpoint"}
                          </p>
                        </div>
                      )}
                      
                      {/* API Key */}
                      <div className="space-y-2">
                        <Label htmlFor="new-model-api-key" className="text-sm font-medium">
                          API Key <span className="text-sm text-red-500">*</span>
                        </Label>
                        <Input
                          id="new-model-api-key"
                          type="password"
                          value={newModelApiKey}
                          onChange={(e) => setNewModelApiKey(e.target.value)}
                          placeholder={newModelType === "openai" 
                            ? "sk-..." 
                            : newModelType === "anthropic" 
                              ? "sk-ant-..." 
                              : newModelType === "perplexity" 
                                ? "pplx-..." 
                                : newModelType === "custom"
                                  ? "your-api-key"
                                  : "sk-xxxxxxxxxxxx"}
                          className="w-full"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Your API key for the selected provider. This is required to access the model.
                        </p>
                      </div>
                    </div>
                    
                    <DialogFooter className="mt-6 gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => setIsNewModelDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleCreateNewModel}
                        disabled={createModelSettingsMutation.isPending}
                        className="bg-primary hover:bg-primary-600 text-white min-w-[120px]"
                      >
                        {createModelSettingsMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Adding...
                          </>
                        ) : (
                          <>
                            <PlusCircle className="h-4 w-4 mr-2" />
                            Add Model
                          </>
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Auto-editing Options Card */}
        <Card className="mb-8">
          <CardHeader className="bg-gray-50 border-b">
            <CardTitle>Auto-Editing Configuration</CardTitle>
            <CardDescription>Configure automated editing features for your content</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {isAutoEditSettingsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-12 w-40 ml-auto" />
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); handleSaveAutoEditSettings(); }}>
                <div className="space-y-4 mb-6">
                  <div className="flex items-center">
                    <Checkbox 
                      id="grammar-check" 
                      checked={grammarCheck}
                      onCheckedChange={(checked) => setGrammarCheck(checked === true)}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="grammar-check" className="ml-3 block text-sm font-medium text-gray-700">
                      Grammar and Spelling Check
                    </Label>
                  </div>
                  
                  <div className="flex items-center">
                    <Checkbox 
                      id="style-consistency" 
                      checked={styleConsistency}
                      onCheckedChange={(checked) => setStyleConsistency(checked === true)}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="style-consistency" className="ml-3 block text-sm font-medium text-gray-700">
                      Style Consistency Checks
                    </Label>
                  </div>
                  
                  <div className="flex items-center">
                    <Checkbox 
                      id="content-improvement" 
                      checked={contentImprovement}
                      onCheckedChange={(checked) => setContentImprovement(checked === true)}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="content-improvement" className="ml-3 block text-sm font-medium text-gray-700">
                      Content Improvement Suggestions
                    </Label>
                  </div>
                  
                  <div className="flex items-center">
                    <Checkbox 
                      id="plagiarism-check" 
                      checked={plagiarismCheck}
                      onCheckedChange={(checked) => setPlagiarismCheck(checked === true)}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="plagiarism-check" className="ml-3 block text-sm font-medium text-gray-700">
                      Plagiarism Detection
                    </Label>
                  </div>

                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="template-type" className="block text-sm font-medium text-gray-700">
                        Writing Template
                      </Label>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={() => window.location.href = '/templates'}
                        className="text-xs"
                      >
                        Browse Templates
                      </Button>
                    </div>
                    <Select 
                      value={templateType} 
                      onValueChange={(value) => {
                        setTemplateType(value);
                        
                        // Apply template content when a template is selected
                        if (value !== "none") {
                          try {
                            // Use TypeScript to ensure type safety when accessing templates
                            const selectedTemplate = templates[value as keyof typeof templates];
                            if (selectedTemplate) {
                              setCustomTemplate(selectedTemplate.promptTemplate);
                              localStorage.setItem('currentlyViewingTemplate', value);
                            }
                          } catch (error) {
                            console.error("Error loading template:", error);
                          }
                        } else {
                          // Clear custom template when no template is selected
                          setCustomTemplate("");
                          localStorage.removeItem('currentlyViewingTemplate');
                        }
                      }}
                    >
                      <SelectTrigger id="template-type" className="w-full">
                        <SelectValue placeholder="Select Template" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Template</SelectItem>
                        <SelectItem value="novel">Novel</SelectItem>
                        <SelectItem value="academic">Academic Writing</SelectItem>
                        <SelectItem value="technical">Technical Documentation</SelectItem>
                        <SelectItem value="business">Business Document</SelectItem>
                        <SelectItem value="screenplay">Screenplay</SelectItem>
                        <SelectItem value="short_story">Short Story</SelectItem>
                        <SelectItem value="nonfiction">Non-Fiction</SelectItem>
                        <SelectItem value="blog">Blog Post</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="mt-1 text-xs text-gray-500">
                      Select a template to apply specific formatting and style guidance for your writing project.
                    </p>
                  </div>
                  
                  {templateType !== "none" && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <Label htmlFor="custom-template" className="block text-sm font-medium text-gray-700">
                          Template Instructions
                        </Label>
                        {templateType !== "none" && (
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              const selectedTemplate = templates[templateType as keyof typeof templates];
                              if (selectedTemplate) {
                                setCustomTemplate(selectedTemplate.promptTemplate);
                              }
                            }}
                            className="text-xs"
                          >
                            Reset to Default
                          </Button>
                        )}
                      </div>
                      <Textarea
                        id="custom-template"
                        value={customTemplate}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCustomTemplate(e.target.value)}
                        placeholder="Add specific instructions or guidelines for your template..."
                        className="h-40 font-mono text-sm"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Customize these instructions to create your own writing guide template. 
                        Changes are saved automatically when you click "Save Settings".
                      </p>
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-200 pt-6 flex justify-end space-x-3">
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={saveAutoEditSettingsMutation.isPending}
                    className="bg-primary hover:bg-primary-600 text-white"
                  >
                    {saveAutoEditSettingsMutation.isPending ? "Saving..." : "Save Settings"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
