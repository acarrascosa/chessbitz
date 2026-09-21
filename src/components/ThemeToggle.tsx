import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useStore } from '@nanostores/react';
import { themeStore } from '../store/theme';
import { ui, defaultLang, type Lang } from '../i18n/ui';

const ThemeToggle = ({ lang = defaultLang }: { lang?: Lang }) => {
    const theme = useStore(themeStore);
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    // Placeholder with the same size to avoid layout shift before hydration.
    if (!mounted) return <span className="icon-btn" aria-hidden="true" />;

    return (
        <button
            onClick={() => themeStore.set(theme === 'light' ? 'dark' : 'light')}
            className="icon-btn"
            aria-label={ui[lang].toggleTheme}
            title={ui[lang].toggleTheme}
        >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
    );
};

export default ThemeToggle;
