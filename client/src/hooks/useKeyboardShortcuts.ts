import { useEffect } from "react";

export function useKeyboardShortcuts(handlers: {
  save?: () => void;
  generate?: () => void;
  humanize?: () => void;
  expand?: () => void;
  steer?: () => void;
  versions?: () => void;
  focusMode?: () => void;
  commandPalette?: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      // ⌘+Shift+F for focus mode
      if (e.shiftKey && e.key === "F") {
        e.preventDefault();
        handlers.focusMode?.();
        return;
      }

      // ⌘K for command palette
      if (e.key === "k") {
        e.preventDefault();
        handlers.commandPalette?.();
        return;
      }

      switch (e.key) {
        case "s":
          e.preventDefault();
          handlers.save?.();
          break;
        case "g":
          e.preventDefault();
          handlers.generate?.();
          break;
        case "h":
          e.preventDefault();
          handlers.humanize?.();
          break;
        case "e":
          e.preventDefault();
          handlers.expand?.();
          break;
        case "j":
          e.preventDefault();
          handlers.steer?.();
          break;
        case "l":
          e.preventDefault();
          handlers.versions?.();
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handlers]);
}
