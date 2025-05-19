import { Link } from "wouter";
import { Book } from "@shared/schema";
import { formatNumber, formatRelativeDate, formatStatus, getStatusColor, truncateText } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Download } from "lucide-react";

interface ProjectCardProps {
  project: Book;
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const statusColor = getStatusColor(project.status);
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-800 truncate">{project.title}</h4>
          <Badge className={`${statusColor.bg} ${statusColor.text}`}>
            {formatStatus(project.status)}
          </Badge>
        </div>
        <p className="text-sm text-gray-500 mb-4 line-clamp-2">
          {project.description ? truncateText(project.description, 100) : "No description available."}
        </p>
        <div className="flex items-center text-xs text-gray-500 mb-4">
          <span className="flex items-center">
            <i className="fas fa-file-alt mr-1.5"></i>
            <span>{project.chapterCount}</span> Chapters
          </span>
          <span className="mx-2">•</span>
          <span className="flex items-center">
            <i className="fas fa-pencil-alt mr-1.5"></i>
            <span>{formatNumber(project.wordCount)}</span> Words
          </span>
          <span className="mx-2">•</span>
          <span className="flex items-center">
            <i className="fas fa-clock mr-1.5"></i>
            <span>{formatRelativeDate(project.updatedAt)}</span>
          </span>
        </div>
        <div className="flex space-x-2">
          <Button 
            asChild 
            className="flex-1 bg-primary hover:bg-primary-600 text-white text-sm py-1.5 px-3"
          >
            <Link href={`/editor/${project.id}`}>
              <Edit className="h-4 w-4 mr-1.5" /> Edit
            </Link>
          </Button>
          <Button 
            variant="outline" 
            className="flex-1 text-sm py-1.5 px-3"
          >
            <Download className="h-4 w-4 mr-1.5" /> Export
          </Button>
        </div>
      </div>
    </div>
  );
}
