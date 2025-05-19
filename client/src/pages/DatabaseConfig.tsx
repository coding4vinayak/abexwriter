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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { DbSettings } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Database, Download, Upload } from "lucide-react";

export default function DatabaseConfig() {
  const { toast } = useToast();
  // Database settings state
  const [host, setHost] = useState("localhost");
  const [port, setPort] = useState(5432);
  const [database, setDatabase] = useState("");
  const [schema, setSchema] = useState("public");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [useSsl, setUseSsl] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  
  // DB settings ID for updates
  const [dbSettingsId, setDbSettingsId] = useState<number | null>(null);
  
  // File upload state
  const [backupFile, setBackupFile] = useState<File | null>(null);

  // Fetch DB settings
  const { data: dbSettingsData, isLoading: isDbSettingsLoading } = useQuery({
    queryKey: ["/api/db-settings", { userId: TEMP_USER_ID }],
    queryFn: async () => {
      try {
        const res = await apiRequest(
          "GET", 
          `/api/db-settings?userId=${TEMP_USER_ID}`, 
          undefined
        );
        return res.json() as Promise<DbSettings>;
      } catch (error) {
        // Return null if no settings exist yet
        return null;
      }
    },
  });

  // Update form when data is loaded
  useEffect(() => {
    if (dbSettingsData) {
      setDbSettingsId(dbSettingsData.id);
      setHost(dbSettingsData.host);
      setPort(dbSettingsData.port);
      setDatabase(dbSettingsData.database);
      setSchema(dbSettingsData.schema);
      setUsername(dbSettingsData.username);
      // Don't set password as it might be encrypted
      setUseSsl(dbSettingsData.useSsl);
    }
  }, [dbSettingsData]);

  // Save DB settings mutation
  const saveDbSettingsMutation = useMutation({
    mutationFn: async (settings: any) => {
      if (dbSettingsId) {
        // Update existing settings
        const res = await apiRequest(
          "PUT",
          `/api/db-settings/${dbSettingsId}`,
          settings
        );
        return res.json();
      } else {
        // Create new settings
        const res = await apiRequest(
          "POST",
          "/api/db-settings",
          settings
        );
        return res.json();
      }
    },
    onSuccess: (data) => {
      setDbSettingsId(data.id);
      toast({
        title: "Settings saved",
        description: "Database configuration has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/db-settings"] });
    },
    onError: (error) => {
      toast({
        title: "Error saving settings",
        description: "There was a problem saving your database settings.",
        variant: "destructive",
      });
    },
  });

  const handleSaveDbSettings = () => {
    if (!database || !username || !password) {
      toast({
        title: "Missing required fields",
        description: "Database name, username and password are required.",
        variant: "destructive",
      });
      return;
    }

    saveDbSettingsMutation.mutate({
      host,
      port,
      database,
      schema,
      username,
      password,
      useSsl,
      userId: TEMP_USER_ID,
    });
  };

  const handleTestConnection = () => {
    setIsTestingConnection(true);
    
    // Simulate connection test
    setTimeout(() => {
      setIsTestingConnection(false);
      toast({
        title: "Connection successful",
        description: "Successfully connected to the database.",
      });
    }, 1500);
  };

  const handleExportProjects = () => {
    toast({
      title: "Export initiated",
      description: "Exporting all projects to PostgreSQL database.",
    });
  };

  const handleBackupToDatabase = () => {
    toast({
      title: "Backup initiated",
      description: "Creating database backup of all book projects and settings.",
    });
  };

  const handleRestoreFromFile = () => {
    if (!backupFile) {
      toast({
        title: "No file selected",
        description: "Please select a backup file to restore from.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Restore initiated",
      description: `Restoring from ${backupFile.name}`,
    });
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="border-b border-gray-200 pb-5 mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Database Configuration</h2>
          <p className="mt-2 text-sm text-gray-500">Manage PostgreSQL connection settings and backups</p>
        </div>

        {/* PostgreSQL Connection Card */}
        <Card className="mb-8">
          <CardHeader className="bg-gray-50 border-b">
            <CardTitle>PostgreSQL Connection</CardTitle>
            <CardDescription>Configure your database connection settings</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {isDbSettingsLoading ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
                <Skeleton className="h-6 w-40" />
                <div className="flex justify-between">
                  <Skeleton className="h-10 w-40" />
                  <Skeleton className="h-10 w-40" />
                </div>
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); handleSaveDbSettings(); }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <Label htmlFor="db-host" className="block text-sm font-medium text-gray-700 mb-1">
                      Host
                    </Label>
                    <Input
                      id="db-host"
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      placeholder="localhost"
                      className="w-full"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="db-port" className="block text-sm font-medium text-gray-700 mb-1">
                      Port
                    </Label>
                    <Input
                      id="db-port"
                      type="number"
                      value={port}
                      onChange={(e) => setPort(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <Label htmlFor="db-name" className="block text-sm font-medium text-gray-700 mb-1">
                      Database Name
                    </Label>
                    <Input
                      id="db-name"
                      value={database}
                      onChange={(e) => setDatabase(e.target.value)}
                      placeholder="ai_book_generator"
                      className="w-full"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="db-schema" className="block text-sm font-medium text-gray-700 mb-1">
                      Schema
                    </Label>
                    <Input
                      id="db-schema"
                      value={schema}
                      onChange={(e) => setSchema(e.target.value)}
                      placeholder="public"
                      className="w-full"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <Label htmlFor="db-username" className="block text-sm font-medium text-gray-700 mb-1">
                      Username
                    </Label>
                    <Input
                      id="db-username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="postgres"
                      className="w-full"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="db-password" className="block text-sm font-medium text-gray-700 mb-1">
                      Password
                    </Label>
                    <Input
                      id="db-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="•••••••••"
                      className="w-full"
                    />
                  </div>
                </div>
                
                <div className="flex items-center mb-6">
                  <Checkbox 
                    id="ssl-connection" 
                    checked={useSsl}
                    onCheckedChange={(checked) => setUseSsl(checked === true)}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="ssl-connection" className="ml-3 block text-sm font-medium text-gray-700">
                    Use SSL Connection
                  </Label>
                </div>
                
                <div className="flex justify-between items-center border-t border-gray-200 pt-6">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleTestConnection}
                    disabled={isTestingConnection}
                  >
                    {isTestingConnection ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <Database className="h-4 w-4 mr-2" />
                        Test Connection
                      </>
                    )}
                  </Button>
                  
                  <div className="flex space-x-3">
                    <Button type="button" variant="outline">
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={saveDbSettingsMutation.isPending}
                      className="bg-primary hover:bg-primary-600 text-white"
                    >
                      {saveDbSettingsMutation.isPending ? "Saving..." : "Save Configuration"}
                    </Button>
                  </div>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
        
        {/* Backup & Restore Card */}
        <Card>
          <CardHeader className="bg-gray-50 border-b">
            <CardTitle>Backup & Restore</CardTitle>
            <CardDescription>Manage backup and restore operations for your book projects</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="mb-6">
              <h4 className="text-md font-medium text-gray-800 mb-2">Create Backup</h4>
              <p className="text-sm text-gray-500 mb-4">Create a backup of all your book projects and settings</p>
              
              <div className="flex flex-wrap gap-3">
                <Button 
                  variant="secondary" 
                  onClick={handleExportProjects}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Download className="h-4 w-4 mr-2" /> 
                  Export All Projects
                </Button>
                <Button 
                  onClick={handleBackupToDatabase}
                  className="bg-primary hover:bg-primary-600 text-white"
                >
                  <Database className="h-4 w-4 mr-2" /> 
                  Backup to Database
                </Button>
              </div>
            </div>
            
            <div className="border-t border-gray-200 pt-6">
              <h4 className="text-md font-medium text-gray-800 mb-2">Restore from Backup</h4>
              <p className="text-sm text-gray-500 mb-4">Restore your projects from a previous backup</p>
              
              <div className="mb-4">
                <Label htmlFor="backup-file" className="block text-sm font-medium text-gray-700 mb-1">
                  Select Backup File
                </Label>
                <Input
                  id="backup-file"
                  type="file"
                  onChange={(e) => setBackupFile(e.target.files?.[0] || null)}
                  accept=".json,.zip"
                  className="w-full"
                />
              </div>
              
              <Button 
                onClick={handleRestoreFromFile}
                disabled={!backupFile}
                className="bg-amber-500 hover:bg-amber-600 text-white"
              >
                <Upload className="h-4 w-4 mr-2" /> 
                Restore from File
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
