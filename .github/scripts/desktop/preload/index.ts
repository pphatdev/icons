import { contextBridge, ipcRenderer } from 'electron';

export interface SaveIconArgs {
    category: string;
    name: string;
    content: string;
}

const api = {
    getRepoRoot: (): Promise<string> => ipcRenderer.invoke('kfe:repo-root'),
    loadRegistry: () => ipcRenderer.invoke('kfe:load-registry'),
    saveIcon: (args: SaveIconArgs) => ipcRenderer.invoke('kfe:save-icon', args),
};

contextBridge.exposeInMainWorld('kfe', api);

export type KfeApi = typeof api;
