export interface KfeSaveIconArgs { category: string; name: string; content: string; }
export interface KfeRegistryIcon { name: string; category: string; svg: string; }
export interface KfeCategoryItem { name: string; target: string; type?: string; }
export interface KfeRegistrySnapshot {
  categories: Array<{ name: string; items: KfeCategoryItem[] }>;
  icons: KfeRegistryIcon[];
}
export interface KfeApi {
  getRepoRoot: () => Promise<string>;
  loadRegistry: () => Promise<KfeRegistrySnapshot>;
  saveIcon: (args: KfeSaveIconArgs) => Promise<string>;
}
declare global {
  interface Window { kfe?: KfeApi; }
}
export {};
