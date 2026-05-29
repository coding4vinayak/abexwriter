import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import NotFound from "@/pages/not-found";
import { useState, useEffect } from "react";
import Dashboard from "@/pages/Dashboard";
import Projects from "@/pages/Projects";
import Settings from "@/pages/Settings";
import ApiKeys from "@/pages/ApiKeys";
import BookBible from "@/pages/BookBible";
import DatabaseConfig from "@/pages/DatabaseConfig";
import ImportExport from "@/pages/ImportExport";
import Editor from "@/pages/Editor";
import BookGeneration from "@/pages/BookGeneration";
import Templates from "@/pages/Templates";
import TemplateEditor from "@/pages/TemplateEditor";
import Login from "@/pages/Login";
import McpStatus from "@/pages/McpStatus";
import WritingStats from "@/pages/WritingStats";
import Sidebar from "@/components/Sidebar";
import MobileNavbar from "@/components/MobileNavbar";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/projects" component={Projects} />
      <Route path="/settings" component={Settings} />
      <Route path="/api-keys" component={ApiKeys} />
      <Route path="/database" component={DatabaseConfig} />
      <Route path="/import" component={ImportExport} />
      <Route path="/mcp" component={McpStatus} />
      <Route path="/generate" component={BookGeneration} />
      <Route path="/templates" component={Templates} />
      <Route path="/templates/create" component={TemplateEditor} />
      <Route path="/templates/edit/:templateId" component={TemplateEditor} />
      <Route path="/stats" component={WritingStats} />
      <Route path="/editor/:bookId" component={Editor} />
      <Route path="/editor/:bookId/chapter/:chapterId" component={Editor} />
      <Route path="/books/:bookId/bible" component={BookBible} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // Close mobile menu on route change or if screen size increases
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024 && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isMobileMenuOpen]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <TooltipProvider>
          <AuthenticatedApp
            isMobileMenuOpen={isMobileMenuOpen}
            toggleMobileMenu={toggleMobileMenu}
          />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function AuthenticatedApp({
  isMobileMenuOpen,
  toggleMobileMenu,
}: {
  isMobileMenuOpen: boolean;
  toggleMobileMenu: () => void;
}) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar (desktop) */}
      <Sidebar isVisible={true} />

      {/* Mobile Menu (when active) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-gray-600 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-80 transition-opacity" 
            onClick={toggleMobileMenu}
          />
          <Sidebar isVisible={isMobileMenuOpen} closeMobileMenu={toggleMobileMenu} />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-background">
        {/* Mobile Navbar */}
        <MobileNavbar toggleMobileMenu={toggleMobileMenu} />
        
        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <Router />
        </main>
      </div>
    </div>
  );
}

export default App;
