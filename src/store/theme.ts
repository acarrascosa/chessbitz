import { atom } from 'nanostores';

export type Theme = 'light' | 'dark';

// Initialize with a safe default, will be synced on client
export const themeStore = atom<Theme>('dark');

if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('theme') as Theme;
    const preferred = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

    if (stored) {
        themeStore.set(stored);
    } else {
        themeStore.set(preferred);
    }

    // Subscribe to changes to update localStorage and DOM
    themeStore.subscribe(theme => {
        localStorage.setItem('theme', theme);
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    });
}
