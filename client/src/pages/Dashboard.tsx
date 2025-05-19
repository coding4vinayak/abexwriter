import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { TEMP_USER_ID } from "@/lib/utils";
import QuickStats from "@/components/QuickStats";
import ProjectCard from "@/components/ProjectCard";
import QuickActions from "@/components/QuickActions";
import WritingProgressHeatmap from "@/components/WritingProgressHeatmap";
import AchievementBadges from "@/components/AchievementBadges";
import { apiRequest } from "@/lib/queryClient";
import { Book } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  // Fetch book stats
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["/api/stats", { userId: TEMP_USER_ID }],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/stats?userId=${TEMP_USER_ID}`,
        undefined
      );
      return res.json();
    },
  });

  // Fetch recent projects
  const { data: recentProjects, isLoading: isLoadingProjects } = useQuery({
    queryKey: ["/api/books/recent", { userId: TEMP_USER_ID }],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/books/recent?userId=${TEMP_USER_ID}&limit=3`,
        undefined
      );
      return res.json() as Promise<Book[]>;
    },
  });

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="border-b border-gray-200 pb-5 mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>
          <p className="mt-2 text-sm text-gray-500">Manage and create your book projects</p>
        </div>

        {/* Quick Stats */}
        <QuickStats 
          totalBooks={stats?.totalBooks || 0} 
          totalChapters={stats?.totalChapters || 0} 
          totalWords={stats?.totalWords || 0} 
          isLoading={isLoadingStats}
        />
        
        {/* Progress Tracking Section - Two columns layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Writing Progress Heatmap */}
          <WritingProgressHeatmap />
          
          {/* Achievement Badges */}
          <AchievementBadges />
        </div>

        {/* Recent Projects */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-800">Recent Projects</h3>
            <Link href="/projects" className="text-sm font-medium text-primary hover:text-primary-600">
              View all
              <i className="fas fa-arrow-right ml-1 text-xs"></i>
            </Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoadingProjects ? (
              // Loading skeletons
              Array(3).fill(0).map((_, idx) => (
                <div key={idx} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow p-6">
                  <Skeleton className="h-6 w-3/4 mb-3" />
                  <Skeleton className="h-4 w-full mb-4" />
                  <Skeleton className="h-4 w-full mb-4" />
                  <div className="flex space-x-2">
                    <Skeleton className="h-10 w-1/2" />
                    <Skeleton className="h-10 w-1/2" />
                  </div>
                </div>
              ))
            ) : recentProjects && recentProjects.length > 0 ? (
              // Actual projects
              recentProjects.map(project => (
                <ProjectCard key={project.id} project={project} />
              ))
            ) : (
              // Empty state
              <div className="col-span-full flex flex-col items-center justify-center p-6 bg-gray-50 rounded-lg border border-gray-200 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <i className="fas fa-book text-gray-400 text-xl"></i>
                </div>
                <h4 className="text-lg font-medium text-gray-800 mb-2">No projects yet</h4>
                <p className="text-sm text-gray-500 mb-4">Create your first book project to get started</p>
                <Link href="/projects" className="px-4 py-2 bg-primary hover:bg-primary-600 text-white rounded-md transition-colors">
                  Create a Book
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <QuickActions />
      </div>
    </div>
  );
}
