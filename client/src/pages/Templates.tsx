import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { 
  Card, 
  CardContent, 
  CardDescription,
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { templates, Template } from '@/lib/templates';
import { useToast } from '@/hooks/use-toast';
import { MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Templates() {
  const { toast } = useToast();
  const [currentTab, setCurrentTab] = useState('all');
  const [, setLocation] = useLocation();
  const [customTemplates, setCustomTemplates] = useState<Record<string, Template>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);

  // Load custom templates from localStorage
  useEffect(() => {
    const savedTemplates = localStorage.getItem('customTemplates');
    if (savedTemplates) {
      try {
        setCustomTemplates(JSON.parse(savedTemplates));
      } catch (error) {
        console.error('Error loading custom templates:', error);
      }
    }
  }, []);

  // Template categories for filtering
  const templateCategories = [
    { id: 'all', name: 'All Templates' },
    { id: 'novel', name: 'Fiction' },
    { id: 'business', name: 'Business' },
    { id: 'academic', name: 'Academic' },
    { id: 'screenplay', name: 'Scripts' },
    { id: 'custom', name: 'My Templates' },
  ];

  // Filter templates based on current tab
  const getFilteredTemplates = () => {
    // For custom templates tab, return only custom templates
    if (currentTab === 'custom') {
      return Object.entries(customTemplates);
    }
    
    // Get built-in templates based on filter
    let filteredBuiltIn = [];
    if (currentTab === 'all') {
      filteredBuiltIn = Object.entries(templates);
    } else if (currentTab === 'novel') {
      filteredBuiltIn = Object.entries(templates).filter(([key]) => 
        ['novel', 'short_story'].includes(key)
      );
    } else if (currentTab === 'business') {
      filteredBuiltIn = Object.entries(templates).filter(([key]) => 
        ['business', 'technical'].includes(key)
      );
    } else if (currentTab === 'academic') {
      filteredBuiltIn = Object.entries(templates).filter(([key]) => 
        ['academic', 'nonfiction'].includes(key)
      );
    } else if (currentTab === 'screenplay') {
      filteredBuiltIn = Object.entries(templates).filter(([key]) => 
        ['screenplay', 'blog'].includes(key)
      );
    }
    
    // If it's the "all" tab, also include custom templates
    if (currentTab === 'all') {
      return [...filteredBuiltIn, ...Object.entries(customTemplates)];
    }
    
    return filteredBuiltIn;
  };

  const handleUseTemplate = (templateType: string, isCustom: boolean = false) => {
    // Store the selected template in localStorage
    localStorage.setItem('selectedTemplate', templateType);
    
    let templateName;
    if (isCustom) {
      templateName = customTemplates[templateType]?.name || 'Custom template';
    } else {
      templateName = templates[templateType as keyof typeof templates]?.name || templateType;
    }
    
    toast({
      title: "Template Selected",
      description: `${templateName} template has been selected.`,
    });
    
    // Navigate to the settings page
    setLocation('/settings');
  };
  
  const handleEditTemplate = (templateId: string) => {
    localStorage.setItem('editingTemplateId', templateId);
    setLocation('/templates/create');
  };
  
  const openDeleteDialog = (templateId: string) => {
    setTemplateToDelete(templateId);
    setDeleteDialogOpen(true);
  };
  
  const confirmDeleteTemplate = () => {
    if (!templateToDelete) return;
    
    const updatedTemplates = {...customTemplates};
    delete updatedTemplates[templateToDelete];
    
    localStorage.setItem('customTemplates', JSON.stringify(updatedTemplates));
    setCustomTemplates(updatedTemplates);
    
    toast({
      title: "Template Deleted",
      description: "Your custom template has been deleted."
    });
    
    setDeleteDialogOpen(false);
    setTemplateToDelete(null);
  };

  return (
    <div className="container max-w-6xl mx-auto px-4 py-6 page-scrollable custom-scrollbar">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Writing Templates</h1>
          <p className="text-muted-foreground mt-1">
            Choose a template to enhance your writing with specialized prompts and guidance
          </p>
        </div>
        <Button 
          className="mt-4 md:mt-0" 
          onClick={() => setLocation('/templates/create')}
        >
          Create Custom Template
        </Button>
      </div>

      <Tabs defaultValue="all" value={currentTab} onValueChange={setCurrentTab} className="w-full">
        <div className="flex justify-between items-center mb-6">
          <TabsList>
            {templateCategories.map((category) => (
              <TabsTrigger key={category.id} value={category.id}>
                {category.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value={currentTab} className="mt-0">
          {getFilteredTemplates().length === 0 && currentTab === 'custom' ? (
            <div className="flex flex-col items-center justify-center p-10 border border-dashed rounded-lg">
              <h3 className="text-xl font-medium mb-2">No Custom Templates Yet</h3>
              <p className="text-center text-muted-foreground mb-4">
                Create your own custom templates to streamline your writing process
              </p>
              <Button onClick={() => setLocation('/templates/create')}>
                Create Your First Template
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {getFilteredTemplates().map(([key, template]) => {
                const isCustomTemplate = key.startsWith('custom_');
                return (
                  <Card key={key} className="overflow-hidden border border-border group hover:shadow-md transition-all">
                    <CardHeader className="bg-muted/30 border-b pb-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle>{template.name}</CardTitle>
                          <CardDescription>{template.description}</CardDescription>
                        </div>
                        {isCustomTemplate && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Template actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditTemplate(key)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => openDeleteDialog(key)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4 px-4 pb-0">
                      <div className="prose prose-sm max-h-32 overflow-hidden relative">
                        <div className="text-xs font-mono whitespace-pre-wrap line-clamp-6 opacity-70">
                          {template.exampleText.substring(0, 300)}...
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent"></div>
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-end p-4">
                      <Button 
                        size="sm" 
                        onClick={() => handleUseTemplate(key, isCustomTemplate)}
                      >
                        Use Template
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your
              custom template.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteTemplate} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}