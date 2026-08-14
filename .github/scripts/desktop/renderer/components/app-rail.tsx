"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

// Studio uses the legacy vanilla page (has its own top bar + rail). It's a
// plain <a> because Next.js's client-side router shouldn't intercept — clicking
// Studio does a full page navigation to the static HTML so the Electron preload
// (window.kfe bridge) is available on the top frame (iframes don't inherit it).
const items = [
  { href: "/", icon: "grid_view", label: "Browse", nextLink: true, active: (p: string) => p === "/" || p === "" },
  { href: "/legacy/studio.html", icon: "edit", label: "Studio", nextLink: false, active: () => false },
] as const;

export function AppRail() {
  const pathname = usePathname() || "/";
  return (
    <aside className="w-12 border-r flex flex-col items-center py-3 gap-1 bg-background z-10 flex-shrink-0">
      {items.map((item) => {
        const isActive = item.active(pathname);
        const className = cn("rail-btn", isActive && "active");
        const content = (
          <span
            className="material-symbols-outlined"
            style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
            aria-hidden="true"
          >
            {item.icon}
          </span>
        );
        return item.nextLink ? (
          <Link key={item.href} href={item.href} className={className} aria-label={item.label}>
            {content}
          </Link>
        ) : (
          <a key={item.href} href={item.href} className={className} aria-label={item.label}>
            {content}
          </a>
        );
      })}
    </aside>
  );
}
