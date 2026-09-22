import React, { useEffect, useState } from 'react';
import { BarChart3, HelpCircle, Settings } from 'lucide-react';
import HowToModal from './HowToModal';
import SettingsModal from './SettingsModal';
import StatsModal from './StatsModal';
import { usePanelRequests, type Panel } from './hooks';
import { ui, type Lang } from '../i18n/ui';

interface HeaderActionsProps {
    lang: Lang;
    /** The current page in the other language, for the settings panel. */
    alternateHref: string;
}

/** Kept from the first version so returning players don't see the guide again. */
const ONBOARDED_KEY = 'chessbitz-onboarded';

/** Statistics, how-to-play and settings buttons with their panels. */
const HeaderActions: React.FC<HeaderActionsProps> = ({ lang, alternateHref }) => {
    const t = ui[lang];
    const [panel, setPanel] = useState<Panel | null>(null);
    usePanelRequests(setPanel);

    // First visit: open the guide once the page has settled.
    useEffect(() => {
        let seen = true;
        try {
            seen = localStorage.getItem(ONBOARDED_KEY) !== null;
        } catch {
            // Storage unavailable: skip the guide rather than showing it every visit.
        }
        if (seen) return;
        const timer = setTimeout(() => setPanel(current => current ?? 'help'), 900);
        return () => clearTimeout(timer);
    }, []);

    const close = () => {
        if (panel === 'help') {
            try {
                localStorage.setItem(ONBOARDED_KEY, 'true');
            } catch {
                // Nothing to persist.
            }
        }
        setPanel(null);
    };

    const button = (id: Panel, label: string, icon: React.ReactNode) => (
        <button onClick={() => setPanel(id)} className="icon-btn" aria-label={label} title={label} aria-haspopup="dialog">
            {icon}
        </button>
    );

    return (
        <>
            {button('stats', t.navStats, <BarChart3 size={18} aria-hidden="true" />)}
            {button('help', t.navHelp, <HelpCircle size={18} aria-hidden="true" />)}
            {button('settings', t.navSettings, <Settings size={18} aria-hidden="true" />)}
            <StatsModal open={panel === 'stats'} onClose={close} lang={lang} />
            <HowToModal open={panel === 'help'} onClose={close} lang={lang} />
            <SettingsModal open={panel === 'settings'} onClose={close} lang={lang} alternateHref={alternateHref} />
        </>
    );
};

export default HeaderActions;
