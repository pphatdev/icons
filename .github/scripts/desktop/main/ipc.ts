import { ipcMain } from 'electron';
import { loadRegistry, saveIcon, type SaveIconInput } from './registry';

export function registerIpc(repoRoot: string): void {
    ipcMain.handle('kfe:repo-root', () => repoRoot);
    ipcMain.handle('kfe:load-registry', () => loadRegistry(repoRoot));
    ipcMain.handle('kfe:save-icon', (_e, input: SaveIconInput) => saveIcon(repoRoot, input));
}
