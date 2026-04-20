import { useLocation } from "react-router-dom";
import { type ReactNode } from "react";

/**
 * Lightweight fade + slide-in wrapper keyed by the current pathname. Re-mounting
 * on route changes forces the enter animation to re-run. No external deps.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div key={pathname} className="animate-page-in">
      {children}
    </div>
  );
}
