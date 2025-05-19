import { Card } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, FileText, PenTool } from "lucide-react";

interface QuickStatsProps {
  totalBooks: number;
  totalChapters: number;
  totalWords: number;
  isLoading: boolean;
}

export default function QuickStats({ totalBooks, totalChapters, totalWords, isLoading }: QuickStatsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-6">
            <div className="flex items-center">
              <Skeleton className="h-12 w-12 rounded-md" />
              <div className="ml-5 w-0 flex-1">
                <Skeleton className="h-5 w-24 mb-2" />
                <Skeleton className="h-7 w-16" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <Card className="p-6 border border-gray-200">
        <div className="flex items-center">
          <div className="flex-shrink-0 bg-primary-50 rounded-md p-3">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">Total Books</dt>
              <dd>
                <div className="text-lg font-medium text-gray-900">{formatNumber(totalBooks)}</div>
              </dd>
            </dl>
          </div>
        </div>
      </Card>
      
      <Card className="p-6 border border-gray-200">
        <div className="flex items-center">
          <div className="flex-shrink-0 bg-green-50 rounded-md p-3">
            <FileText className="h-5 w-5 text-green-600" />
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">Total Chapters</dt>
              <dd>
                <div className="text-lg font-medium text-gray-900">{formatNumber(totalChapters)}</div>
              </dd>
            </dl>
          </div>
        </div>
      </Card>
      
      <Card className="p-6 border border-gray-200">
        <div className="flex items-center">
          <div className="flex-shrink-0 bg-amber-50 rounded-md p-3">
            <PenTool className="h-5 w-5 text-amber-600" />
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">Words Generated</dt>
              <dd>
                <div className="text-lg font-medium text-gray-900">{formatNumber(totalWords)}</div>
              </dd>
            </dl>
          </div>
        </div>
      </Card>
    </div>
  );
}
