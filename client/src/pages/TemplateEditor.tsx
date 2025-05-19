import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { 
  Card, 
  CardContent, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { templates, Template } from '@/lib/templates';

export default function TemplateEditor() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  // Form state
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [promptTemplate, setPromptTemplate] = useState('');
  const [exampleText, setExampleText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  
  // Load custom templates from localStorage on initial load
  useEffect(() => {
    // Load custom templates from localStorage
    const customTemplatesJson = localStorage.getItem('customTemplates');
    if (customTemplatesJson) {
      const customTemplates = JSON.parse(customTemplatesJson);
      
      // Check if we're editing an existing template
      const editTemplateId = localStorage.getItem('editingTemplateId');
      if (editTemplateId && customTemplates[editTemplateId]) {
        const template = customTemplates[editTemplateId];
        setTemplateName(template.name);
        setTemplateDescription(template.description);
        setPromptTemplate(template.promptTemplate);
        setExampleText(template.exampleText);
        setIsEditing(true);
      }
    }
  }, []);
  
  // Handle save template
  const handleSaveTemplate = () => {
    // Validate form
    if (!templateName.trim()) {
      toast({
        title: "Template name required",
        description: "Please provide a name for your template",
        variant: "destructive",
      });
      return;
    }
    
    if (!promptTemplate.trim()) {
      toast({
        title: "Prompt template required",
        description: "Please provide the template instructions",
        variant: "destructive",
      });
      return;
    }
    
    // Create template object
    const newTemplate: Template = {
      name: templateName,
      description: templateDescription || "Custom template",
      promptTemplate,
      exampleText: exampleText || "Example text will appear here"
    };
    
    // Get existing custom templates or initialize empty object
    const customTemplatesJson = localStorage.getItem('customTemplates');
    const customTemplates = customTemplatesJson ? JSON.parse(customTemplatesJson) : {};
    
    // Generate template ID from name (lowercase, spaces to underscores)
    const templateId = isEditing 
      ? localStorage.getItem('editingTemplateId') 
      : `custom_${templateName.toLowerCase().replace(/\s+/g, '_')}`;
      
    if (!templateId) {
      toast({
        title: "Error saving template",
        description: "Could not generate template ID",
        variant: "destructive",
      });
      return;
    }
    
    // Add new template to custom templates
    customTemplates[templateId] = newTemplate;
    
    // Save to localStorage
    localStorage.setItem('customTemplates', JSON.stringify(customTemplates));
    
    // Clear editing state
    localStorage.removeItem('editingTemplateId');
    
    toast({
      title: isEditing ? "Template updated" : "Template created",
      description: `Your template "${templateName}" has been ${isEditing ? 'updated' : 'created'}.`,
    });
    
    // Navigate back to templates page
    setLocation('/templates');
  };
  
  // Handle cancel 
  const handleCancel = () => {
    localStorage.removeItem('editingTemplateId');
    setLocation('/templates');
  };
  
  return (
    <div className="container max-w-4xl mx-auto px-4 py-6 page-scrollable custom-scrollbar">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{isEditing ? 'Edit Template' : 'Create New Template'}</h1>
        <p className="text-muted-foreground mt-1">
          {isEditing 
            ? 'Update your custom writing template' 
            : 'Create a custom template with your own writing instructions'}
        </p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Template Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="template-name" className="text-base mb-2 block">Template Name</Label>
            <Input 
              id="template-name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g., Technical Blog Post"
              className="w-full"
            />
          </div>
          
          <div>
            <Label htmlFor="template-description" className="text-base mb-2 block">Template Description</Label>
            <Input 
              id="template-description"
              value={templateDescription}
              onChange={(e) => setTemplateDescription(e.target.value)}
              placeholder="e.g., Template for writing technical blog posts with code examples"
              className="w-full"
            />
          </div>
          
          <div>
            <Label htmlFor="prompt-template" className="text-base mb-2 block">Template Instructions</Label>
            <Textarea 
              id="prompt-template"
              value={promptTemplate}
              onChange={(e) => setPromptTemplate(e.target.value)}
              placeholder="Instructions for the AI to follow when generating or editing content..."
              className="min-h-[200px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Write detailed instructions for how the content should be written, 
              including style, structure, tone, and any specific elements that should be included.
            </p>
          </div>
          
          <div>
            <Label htmlFor="example-text" className="text-base mb-2 block">Example Text (Optional)</Label>
            <Textarea 
              id="example-text"
              value={exampleText}
              onChange={(e) => setExampleText(e.target.value)}
              placeholder="An example of content that follows this template..."
              className="min-h-[150px]"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Provide an example of what content following this template should look like.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end space-x-2">
          <Button variant="outline" onClick={handleCancel}>Cancel</Button>
          <Button onClick={handleSaveTemplate}>{isEditing ? 'Update Template' : 'Save Template'}</Button>
        </CardFooter>
      </Card>
    </div>
  );
}