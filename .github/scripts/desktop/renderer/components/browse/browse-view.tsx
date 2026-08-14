"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

import { loadAll, recolor } from "@/lib/kfe";
import type { KfeRegistryIcon } from "@/types/global";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { IconDetailDialog } from "./icon-detail-dialog";

type ViewMode = "grid" | "list";

interface StoredViewPrefs {
  view?: ViewMode;
  cols?: number;
}

const VIEW_STORAGE_KEY = "kfe-browse-view";

function loadViewPrefs(): StoredViewPrefs {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(VIEW_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredViewPrefs) : {};
  } catch {
    return {};
  }
}

function saveViewPrefs(prefs: StoredViewPrefs) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore quota errors — display prefs are non-critical */
  }
}

export function BrowseView() {
  const [icons, setIcons] = useState<KfeRegistryIcon[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [color, setColor] = useState("#e1e1e1");
  const [size, setSize] = useState(48);
  const [cols, setCols] = useState(0);
  const [view, setView] = useState<ViewMode>("grid");
  const [selected, setSelected] = useState<KfeRegistryIcon | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Hydrate view prefs on mount only. Persisted whenever user tweaks them.
  useEffect(() => {
    const prefs = loadViewPrefs();
    if (prefs.view === "grid" || prefs.view === "list") setView(prefs.view);
    if (typeof prefs.cols === "number" && prefs.cols >= 0 && prefs.cols <= 24) {
      setCols(prefs.cols);
    }
  }, []);

  useEffect(() => {
    saveViewPrefs({ view, cols });
  }, [view, cols]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await loadAll();
        if (cancelled) return;
        setIcons(snap.icons);
        setCategories(snap.categories.map((c) => c.name));
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return icons.filter((icon) => {
      if (category !== "all" && icon.category !== category) return false;
      if (q && !icon.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [icons, filter, category]);

  const gridClass =
    view === "list"
      ? "view-list"
      : cols > 0
        ? "view-grid cols-fixed"
        : "view-grid cols-auto";

  const gridStyle = {
    ["--icon-size" as string]: `${size}px`,
    ["--cols" as string]: cols || 8,
  } as React.CSSProperties;

  return (
    <>
      {/* Primary filter row — iOS pill search + rounded chips */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-card flex-wrap">
        <div className="input-field rounded-full px-3.5 py-2 flex items-center gap-2 flex-1 min-w-[220px] max-w-md">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search icons…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1 bg-transparent border-none text-[12px]"
          />
        </div>
        <div className="input-field rounded-full flex items-center gap-2 min-w-[140px]">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-9 rounded-full border-0 bg-transparent shadow-none text-[12px] font-mono focus:ring-0 focus:ring-offset-0 px-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-muted-foreground">
                  folder
                </span>
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">all</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground ml-auto">
          {loading
            ? "loading…"
            : error
              ? `error: ${error}`
              : `${filtered.length} / ${icons.length}`}
        </span>
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => v && setView(v as ViewMode)}
          className="view-toggle"
          aria-label="View mode"
        >
          <ToggleGroupItem value="grid" aria-label="Grid view" className="h-7 px-3">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              grid_view
            </span>
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="List view" className="h-7 px-3">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              view_list
            </span>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Display options row */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-background flex-wrap text-[11px] text-muted-foreground">
        <div
          className="input-field rounded-full px-2.5 py-1 flex items-center gap-2"
          title="Preview color"
        >
          <span className="material-symbols-outlined text-sm">palette</span>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-6 h-6"
          />
        </div>
        <div
          className="input-field rounded-full px-3 py-1 flex items-center gap-3"
          title="Icon size"
        >
          <span className="material-symbols-outlined text-sm">
            photo_size_select_actual
          </span>
          <Slider
            className="w-28"
            min={24}
            max={128}
            step={4}
            value={[size]}
            onValueChange={([v]) => setSize(v ?? size)}
          />
          <span className="font-mono min-w-[24px] text-right">{size}</span>
        </div>
        <div
          className="input-field rounded-full px-3 py-1 flex items-center gap-2"
          title="Columns (0 = auto-fill by size)"
        >
          <span className="material-symbols-outlined text-sm">view_column</span>
          <input
            type="number"
            min={0}
            max={24}
            step={1}
            value={cols}
            onChange={(e) => {
              const n = Number(e.target.value);
              setCols(Number.isFinite(n) ? Math.max(0, Math.min(24, n)) : 0);
            }}
            className="w-10 font-mono text-center bg-transparent"
          />
        </div>
      </div>

      {/* Grid / list */}
      <div id="grid" className={`flex-1 overflow-auto p-4 ${gridClass}`} style={gridStyle}>
        {loading ? (
          <div className="col-span-full text-center text-muted-foreground py-8">
            Loading…
          </div>
        ) : error ? (
          <div className="col-span-full text-center text-destructive py-8 font-mono text-[11px]">
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center text-muted-foreground py-8">
            No icons match.
          </div>
        ) : view === "list" ? (
          filtered.map((icon) => (
            <button
              key={`${icon.category}/${icon.name}`}
              type="button"
              className="row text-left"
              style={{ ["--icon-size" as string]: `${size}px` } as React.CSSProperties}
              onClick={() => setSelected(icon)}
            >
              <span
                style={{ color }}
                dangerouslySetInnerHTML={{ __html: recolor(icon.svg, color) }}
              />
              <span className="name">{icon.name}</span>
              <span className="cat">{icon.category}</span>
            </button>
          ))
        ) : (
          filtered.map((icon) => (
            <button
              key={`${icon.category}/${icon.name}`}
              type="button"
              className="tile"
              style={{ ["--icon-size" as string]: `${size}px` } as React.CSSProperties}
              onClick={() => setSelected(icon)}
              title={`${icon.category}/${icon.name}`}
            >
              <span
                style={{ color }}
                dangerouslySetInnerHTML={{ __html: recolor(icon.svg, color) }}
              />
              <span className="name">{icon.name}</span>
            </button>
          ))
        )}
      </div>

      <IconDetailDialog
        icon={selected}
        color={color}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
