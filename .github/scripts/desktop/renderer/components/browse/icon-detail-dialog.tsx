"use client";

import { useEffect, useState } from "react";
import { Copy, Edit, Image as ImageIcon } from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { KfeRegistryIcon } from "@/types/global";
import { recolor } from "@/lib/kfe";

export interface IconDetailDialogProps {
  icon: KfeRegistryIcon | null;
  color: string;
  onClose: () => void;
}

export function IconDetailDialog({ icon, color, onClose }: IconDetailDialogProps) {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 1400);
    return () => window.clearTimeout(id);
  }, [toast]);

  const open = !!icon;
  const svg = icon?.svg ?? "";
  const previewSvg = svg ? recolor(svg, color) : "";
  const title = icon ? `${icon.category} / ${icon.name}` : "";
  // Full-page navigation to the legacy studio (see AppRail for why).
  const editHref = icon
    ? `/legacy/studio.html?icon=${encodeURIComponent(`${icon.category}/${icon.name}`)}`
    : "/legacy/studio.html";

  async function copy() {
    if (!icon) return;
    try {
      await navigator.clipboard.writeText(icon.svg);
      setToast("Copied SVG to clipboard");
    } catch {
      setToast("Copy failed");
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
          {/* Header — pr-12 leaves room for the DialogContent's built-in Close X at right-4 */}
          <div className="flex items-center gap-2 px-4 py-3 border-b pr-12">
            <ImageIcon className="h-4 w-4 text-primary flex-shrink-0" aria-hidden="true" />
            <DialogTitle className="text-sm font-mono truncate">
              {title || "icon"}
            </DialogTitle>
          </div>

          <div className="p-4 space-y-4">
            <div
              className="dialog-preview"
              dangerouslySetInnerHTML={{ __html: previewSvg }}
            />

            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider font-semibold">
                SVG Markup
              </span>
              <div className="flex gap-2">
                <a
                  href={editHref}
                  className="btn btn-ghost btn-sm"
                  onClick={(e) => {
                    // Full-page navigation to the legacy studio (Electron
                    // preload isn't inherited by iframes, so we leave Next.js).
                    // preventDefault + explicit assign avoids a race where
                    // Radix Dialog's onOpenChange unmounts the anchor before
                    // the browser processes the default click action.
                    e.preventDefault();
                    window.location.assign(editHref);
                  }}
                >
                  <Edit className="h-3.5 w-3.5" />
                  Open in Studio
                </a>
                <button type="button" className="btn btn-primary btn-sm" onClick={copy}>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </button>
              </div>
            </div>

            <textarea className="code" readOnly value={svg} />
          </div>
        </DialogContent>
      </Dialog>
      <div className={`toast ${toast ? "show" : ""}`} role="status" aria-live="polite">
        {toast ?? ""}
      </div>
    </>
  );
}
