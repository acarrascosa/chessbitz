import { atom } from 'nanostores';

export type Theme = 'light' | 'dark';

// The inline script in Layout.astro already applied the right class before paint.
const initial: Theme = typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light';

export const themeStore = atom<Theme>(initial);

if (typeof window !== 'undefined') {
    themeStore.listen(theme => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        try {
            localStorage.setItem('theme', theme);
        } catch {
            // Theme still applies for this visit.
        }
    });
}
