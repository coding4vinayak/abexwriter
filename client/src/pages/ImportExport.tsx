import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { FileUp, Download, BookOpen, FileText, AlignLeft } from "lucide-react";

export default function ImportExport() {
  const { toast } = useToast();
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importType, setImportType] = useState("text");
  const [exportFormat, setExportFormat] = useState("json");

  const handleImport = () => {
    if (!importFile) {
      toast({
        title: "No file selected",
        description: "Please select a file to import.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Import initiated",
      description: `Importing ${importFile.name}`,
    });
  };

  const handleExportAll = () => {
    toast({
      title: "Export initiated",
      description: `Exporting all projects as ${exportFormat.toUpperCase()}`,
    });
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="border-b border-gray-200 pb-5 mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Import & Export</h2>
          <p className="mt-2 text-sm text-gray-500">Import existing files or export your book projects</p>
        </div>

        {/* Import Card */}
        <Card className="mb-8">
          <CardHeader className="bg-gray-50 border-b">
            <CardTitle>Import Files</CardTitle>
            <CardDescription>Import existing text files or projects</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="mb-6">
              <Label htmlFor="import-type" className="block text-sm font-medium text-gray-700 mb-1">
                Import Type
              </Label>
              <Select value={importType} onValueChange={setImportType}>
                <SelectTrigger id="import-type" className="w-full">
                  <SelectValue placeholder="Select import type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text File (TXT)</SelectItem>
                  <SelectItem value="markdown">Markdown (MD)</SelectItem>
                  <SelectItem value="json">Project Export (JSON)</SelectItem>
                  <SelectItem value="docx">Word Document (DOCX)</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-sm text-gray-500">Select the type of file you want to import</p>
            </div>

            <div className="mb-6">
              <Label htmlFor="import-file" className="block text-sm font-medium text-gray-700 mb-1">
                Select File
              </Label>
              <Input
                id="import-file"
                type="file"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                accept={
                  importType === "text" ? ".txt" :
                  importType === "markdown" ? ".md" :
                  importType === "json" ? ".json" :
                  importType === "docx" ? ".docx" :
                  undefined
                }
                className="w-full"
              />
            </div>

            <div className="flex flex-col space-y-4">
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <AlignLeft className="h-4 w-4" />
                <span>
                  Importing text files will create a new book project with a single chapter.
                </span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <BookOpen className="h-4 w-4" />
                <span>
                  Word documents will be parsed to maintain formatting when possible.
                </span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <FileText className="h-4 w-4" />
                <span>
                  JSON imports will restore complete projects with all chapters and settings.
                </span>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6 mt-6">
              <Button 
                onClick={handleImport}
                disabled={!importFile}
                className="bg-primary hover:bg-primary-600 text-white"
              >
                <FileUp className="h-4 w-4 mr-2" />
                Import File
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Export Card */}
        <Card>
          <CardHeader className="bg-gray-50 border-b">
            <CardTitle>Export Projects</CardTitle>
            <CardDescription>Export your book projects in different formats</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="mb-6">
              <Label htmlFor="export-format" className="block text-sm font-medium text-gray-700 mb-1">
                Export Format
              </Label>
              <Select value={exportFormat} onValueChange={setExportFormat}>
                <SelectTrigger id="export-format" className="w-full">
                  <SelectValue placeholder="Select export format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">Project Export (JSON)</SelectItem>
                  <SelectItem value="txt">Plain Text (TXT)</SelectItem>
                  <SelectItem value="md">Markdown (MD)</SelectItem>
                  <SelectItem value="pdf">PDF Document</SelectItem>
                  <SelectItem value="docx">Word Document (DOCX)</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-sm text-gray-500">Select the format for exporting your book projects</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <Card className="flex flex-col items-center p-6 hover:border-primary-300 hover:shadow-md transition-all cursor-pointer">
                <div className="w-12 h-12 bg-primary-50 rounded-full flex items-center justify-center mb-4">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <h4 className="font-medium text-gray-800 mb-1">Single Book</h4>
                <p className="text-sm text-gray-500 text-center mb-4">Export a specific book project</p>
                <Button variant="outline" className="w-full">Select Book</Button>
              </Card>
              
              <Card className="flex flex-col items-center p-6 hover:border-primary-300 hover:shadow-md transition-all cursor-pointer">
                <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mb-4">
                  <AlignLeft className="h-6 w-6 text-green-600" />
                </div>
                <h4 className="font-medium text-gray-800 mb-1">Single Chapter</h4>
                <p className="text-sm text-gray-500 text-center mb-4">Export a specific chapter</p>
                <Button variant="outline" className="w-full">Select Chapter</Button>
              </Card>
              
              <Card className="flex flex-col items-center p-6 hover:border-primary-300 hover:shadow-md transition-all cursor-pointer">
                <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mb-4">
                  <Download className="h-6 w-6 text-amber-600" />
                </div>
                <h4 className="font-medium text-gray-800 mb-1">All Projects</h4>
                <p className="text-sm text-gray-500 text-center mb-4">Export all your book projects</p>
                <Button 
                  onClick={handleExportAll}
                  className="w-full bg-primary hover:bg-primary-600 text-white"
                >
                  Export All
                </Button>
              </Card>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h4 className="text-md font-medium text-gray-800 mb-2">Export Options</h4>
              <p className="text-sm text-gray-500 mb-4">Additional settings for exports</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="include-metadata" className="block text-sm font-medium text-gray-700 mb-1">
                    Include Metadata
                  </Label>
                  <Select defaultValue="yes">
                    <SelectTrigger id="include-metadata">
                      <SelectValue placeholder="Include metadata" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="include-outline" className="block text-sm font-medium text-gray-700 mb-1">
                    Include Outline
                  </Label>
                  <Select defaultValue="yes">
                    <SelectTrigger id="include-outline">
                      <SelectValue placeholder="Include outline" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
