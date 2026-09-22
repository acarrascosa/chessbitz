import { atom } from 'nanostores';

export type Theme = 'light' | 'dark' | 'system';

// The inline script in Layout.astro already applied the right classes before paint.
function stored(key: string): string | null {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function persist(key: string, value: string | null) {
    try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
    } catch {
        // Preferences still apply for this visit.
    }
}

const isBrowser = typeof window !== 'undefined';
const storedTheme = isBrowser ? stored('theme') : null;

export const themeStore = atom<Theme>(storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : 'system');
/** Colour-blind friendly palette: blue/orange instead of green/yellow/red. */
export const contrastStore = atom<boolean>(isBrowser && stored('contrast') === 'high');

if (isBrowser) {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
        const theme = themeStore.get();
        document.documentElement.classList.toggle('dark', theme === 'system' ? media.matches : theme === 'dark');
    };
    media.addEventListener('change', apply);
    themeStore.listen(theme => {
        persist('theme', theme === 'system' ? null : theme);
        // Apply after the store has updated.
        queueMicrotask(apply);
    });
    contrastStore.listen(high => {
        persist('contrast', high ? 'high' : null);
        document.documentElement.classList.toggle('contrast', high);
    });
}

export const isHighContrast = () => isBrowser && document.documentElement.classList.contains('contrast');
