import type { KfeApi } from '../preload';

declare global {
    interface Window {
        kfe: KfeApi;
    }
}

export {};
