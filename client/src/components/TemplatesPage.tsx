import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { TEMP_USER_ID } from '@/lib/utils';
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
import { templateTypes, templates } from '@/lib/templates';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

export default function TemplatesPage() {
  const { toast } = useToast();
  const [currentTab, setCurrentTab] = useState('all');
  const [, setLocation] = useLocation();

  // Fetch all available templates
  const templateCategories = [
    { id: 'all', name: 'All Templates' },
    { id: 'novel', name: 'Fiction' },
    { id: 'business', name: 'Business' },
    { id: 'academic', name: 'Academic' },
    { id: 'screenplay', name: 'Scripts' },
  ];

  // Filter templates based on current tab
  const getFilteredTemplates = () => {
    if (currentTab === 'all') {
      return Object.entries(templates);
    } else if (currentTab === 'novel') {
      return Object.entries(templates).filter(([key]) => 
        ['novel', 'short_story'].includes(key)
      );
    } else if (currentTab === 'business') {
      return Object.entries(templates).filter(([key]) => 
        ['business', 'technical'].includes(key)
      );
    } else if (currentTab === 'academic') {
      return Object.entries(templates).filter(([key]) => 
        ['academic', 'nonfiction'].includes(key)
      );
    } else if (currentTab === 'screenplay') {
      return Object.entries(templates).filter(([key]) => 
        ['screenplay', 'blog'].includes(key)
      );
    }
    return Object.entries(templates);
  };

  const handleUseTemplate = (templateType: string) => {
    // Navigate to the settings page and set the template type
    toast({
      title: "Template Selected",
      description: `${templates[templateType].name} template has been selected.`,
    });
    
    setLocation('/settings');
  };

  return (
    <div className="container max-w-6xl mx-auto px-4 py-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Writing Templates</h1>
          <p className="text-muted-foreground mt-1">
            Choose a template to enhance your writing with specialized prompts and guidance
          </p>
        </div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {getFilteredTemplates().map(([key, template]) => (
              <Card key={key} className="overflow-hidden border border-border group hover:shadow-md transition-all">
                <CardHeader className="bg-muted/30 border-b pb-4">
                  <CardTitle>{template.name}</CardTitle>
                  <CardDescription>{template.description}</CardDescription>
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
                    onClick={() => handleUseTemplate(key)}
                  >
                    Use Template
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}