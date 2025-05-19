
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { TEMP_USER_ID } from "@/lib/utils";
import { Book } from "@shared/schema";
import ThemeToggle from "@/components/ThemeToggle";

interface SidebarProps {
  isVisible: boolean;
  closeMobileMenu?: () => void;
}

export default function Sidebar({ isVisible, closeMobileMenu }: SidebarProps) {
  const [location] = useLocation();

  // Fetch recent projects
  const { data: recentProjects } = useQuery({
    queryKey: ["/api/books/recent", { userId: TEMP_USER_ID }],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/books/recent?userId=${TEMP_USER_ID}&limit=5`,
        undefined
      );
      return res.json() as Promise<Book[]>;
    },
  });

  const isActiveRoute = (path: string) => {
    return location === path;
  };

  const NavigationItem = ({ path, icon, label }: { path: string, icon: string, label: string }) => (
    <Link 
      href={path}
      onClick={closeMobileMenu}
      className={`flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
        isActiveRoute(path) 
          ? "text-primary bg-accent" 
          : "text-foreground hover:bg-accent hover:text-primary"
      }`}
    >
      <i className={`${icon} mr-3 ${isActiveRoute(path) ? "text-primary" : "text-muted-foreground group-hover:text-primary"}`}></i>
      <span>{label}</span>
    </Link>
  );

  return (
    <div className={`${isVisible ? "lg:flex" : "hidden"} flex-col w-64 bg-background border-r border-border z-50`}>
      <div className="flex items-center justify-between px-4 py-4 border-b border-border">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <i className="fas fa-book-open text-primary-foreground text-sm"></i>
          </div>
          <h1 className="text-lg font-semibold text-foreground">AI Book Generator</h1>
        </div>
        {closeMobileMenu && (
          <button onClick={closeMobileMenu} className="text-muted-foreground hover:text-foreground lg:hidden">
            <i className="fas fa-times"></i>
          </button>
        )}
      </div>
      
      <div className="overflow-y-auto custom-scrollbar flex-1">
        <div className="px-3 py-4">
          <Link 
            href="/projects"
            onClick={closeMobileMenu}
            className="mb-4 w-full flex items-center justify-center py-2 px-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md transition-colors"
          >
            <i className="fas fa-plus mr-2"></i>
            <span>New Book Project</span>
          </Link>
          
          {recentProjects && recentProjects.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-2">Recent Projects</h2>
              {recentProjects.map(project => (
                <Link 
                  key={project.id}
                  href={`/editor/${project.id}`}
                  onClick={closeMobileMenu}
                  className="flex items-center px-2 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-primary rounded-md transition-colors mb-1"
                >
                  <i className="fas fa-book mr-3 text-muted-foreground group-hover:text-primary"></i>
                  <span>{project.title}</span>
                </Link>
              ))}
            </div>
          )}
          
          <nav className="space-y-1">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-2">Navigation</h2>
            <NavigationItem path="/" icon="fas fa-home" label="Dashboard" />
            <NavigationItem path="/projects" icon="fas fa-folder" label="My Projects" />
            <NavigationItem path="/generate" icon="fas fa-magic" label="AI Book Writer" />
            <NavigationItem path="/templates" icon="fas fa-file-alt" label="Templates" />
            <NavigationItem path="/settings" icon="fas fa-tools" label="Settings" />
            <NavigationItem path="/database" icon="fas fa-database" label="Database" />
            <NavigationItem path="/import" icon="fas fa-upload" label="Import" />
          </nav>
        </div>
      </div>
      
      <div className="border-t border-border p-4 flex items-center justify-between">
        <a 
          href="http://abetworks.in/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center text-sm font-medium text-foreground hover:text-primary transition-colors group"
        >
          <i className="fas fa-question-circle mr-3 text-muted-foreground group-hover:text-primary"></i>
          <span>Help & Documentation</span>
        </a>
        <ThemeToggle />
      </div>
    </div>
  );
}
