import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useStore } from '@nanostores/react';
import { themeStore } from '../store/theme';
import { ui, defaultLang, type Lang } from '../i18n/ui';

const ThemeToggle = ({ lang = defaultLang }: { lang?: Lang }) => {
    const theme = useStore(themeStore);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        themeStore.set(newTheme);
    };

    if (!mounted) {
        return <div className="p-2 w-9 h-9" />; // Placeholder to avoid hydration mismatch
    }

    return (
        <button
            onClick={toggleTheme}
            className="p-2 rounded-full bg-stone-200/50 dark:bg-stone-800/50 hover:bg-stone-300 dark:hover:bg-stone-700 backdrop-blur-sm transition-colors border border-stone-300 dark:border-stone-600 text-stone-800 dark:text-amber-400 cursor-pointer"
            aria-label={ui[lang].toggleTheme}
            title={ui[lang].toggleTheme}
        >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>
    );
};

export default ThemeToggle;
