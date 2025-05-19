import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Plus, Upload, Settings, Database } from "lucide-react";

export default function QuickActions() {
  return (
    <div>
      <h3 className="text-lg font-medium text-gray-800 mb-4">Quick Actions</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link href="/projects">
          <Card className="flex flex-col items-center p-6 bg-white border border-gray-200 hover:border-primary-300 hover:shadow-md transition-all cursor-pointer">
            <div className="w-12 h-12 bg-primary-50 rounded-full flex items-center justify-center mb-4">
              <Plus className="h-5 w-5 text-primary" />
            </div>
            <h4 className="font-medium text-gray-800 mb-1">New Book</h4>
            <p className="text-sm text-gray-500 text-center">Start a new book project</p>
          </Card>
        </Link>
        
        <Link href="/import">
          <Card className="flex flex-col items-center p-6 bg-white border border-gray-200 hover:border-green-300 hover:shadow-md transition-all cursor-pointer">
            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mb-4">
              <Upload className="h-5 w-5 text-green-600" />
            </div>
            <h4 className="font-medium text-gray-800 mb-1">Import</h4>
            <p className="text-sm text-gray-500 text-center">Import existing files</p>
          </Card>
        </Link>
        
        <Link href="/settings">
          <Card className="flex flex-col items-center p-6 bg-white border border-gray-200 hover:border-amber-300 hover:shadow-md transition-all cursor-pointer">
            <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mb-4">
              <Settings className="h-5 w-5 text-amber-600" />
            </div>
            <h4 className="font-medium text-gray-800 mb-1">Settings</h4>
            <p className="text-sm text-gray-500 text-center">Configure LLM options</p>
          </Card>
        </Link>
        
        <Link href="/database">
          <Card className="flex flex-col items-center p-6 bg-white border border-gray-200 hover:border-gray-400 hover:shadow-md transition-all cursor-pointer">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Database className="h-5 w-5 text-gray-600" />
            </div>
            <h4 className="font-medium text-gray-800 mb-1">Database</h4>
            <p className="text-sm text-gray-500 text-center">Manage PostgreSQL connection</p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
