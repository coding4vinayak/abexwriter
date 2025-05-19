import { Link } from "wouter";
import ThemeToggle from "@/components/ThemeToggle";
import { Menu } from "lucide-react";

interface MobileNavbarProps {
  toggleMobileMenu: () => void;
}

export default function MobileNavbar({ toggleMobileMenu }: MobileNavbarProps) {
  return (
    <div className="lg:hidden flex items-center justify-between p-4 bg-background border-b border-border w-full">
      <Link href="/" className="flex items-center space-x-2">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
          <i className="fas fa-book-open text-white text-sm"></i>
        </div>
        <h1 className="text-lg font-semibold text-foreground">AI Book Generator</h1>
      </Link>
      <div className="flex items-center space-x-2">
        <ThemeToggle />
        <button 
          className="text-muted-foreground hover:text-foreground p-2" 
          onClick={toggleMobileMenu}
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
