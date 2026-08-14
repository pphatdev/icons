"use client";

import { usePathname } from "next/navigation";

import { BrandLogo } from "@/components/brand-logo";

function slugFromPath(pathname: string): string {
  if (!pathname || pathname === "/") return "browse";
  if (pathname.startsWith("/studio")) return "studio";
  return pathname.replace(/^\/+/, "").split("/")[0] || "browse";
}

export function TopBar() {
  const pathname = usePathname() || "/";
  const slug = slugFromPath(pathname);
  return (
    <header className="h-12 border-b flex items-center justify-between px-3 bg-card z-20 flex-shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2 flex-shrink-0">
          <BrandLogo size={24} className="text-primary" />
          <span className="font-medium text-sm text-foreground">KFe Icons</span>
        </div>
        <span className="text-muted-foreground">/</span>
        <span className="text-muted-foreground text-[11px] font-mono opacity-70">
          {slug}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground text-[10px] font-mono opacity-60">v0.2</span>
      </div>
    </header>
  );
}
