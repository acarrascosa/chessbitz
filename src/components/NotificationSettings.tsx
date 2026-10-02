import { Bell } from 'lucide-react';
import { usePush } from './usePush';
import { PUSH_TOPICS } from '../lib/push';
import { ui, type Lang } from '../i18n/ui';

/** Opt-in notifications, one switch per topic (in the settings panel). */
export default function NotificationSettings({ lang }: { lang: Lang }) {
    const t = ui[lang];
    const { topics, busy, problem, blocked, toggle } = usePush(lang);
    const shown = problem ?? blocked;
    return (
        <div className="space-y-2" data-testid="notification-settings">
            {PUSH_TOPICS.map(topic => {
                const on = topics.includes(topic);
                return (
                    <label key={topic} className="flex items-center justify-between gap-4 rounded-xl border border-line p-3 cursor-pointer">
                        <span className="flex items-center gap-2 text-sm font-semibold">
                            <Bell size={14} className="text-accent shrink-0" aria-hidden="true" /> {t.notify[topic]}
                        </span>
                        <button
                            role="switch"
                            aria-checked={on}
                            aria-label={t.notify[topic]}
                            disabled={busy}
                            onClick={() => toggle(topic)}
                            className={`relative shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-60 ${on ? 'bg-brand' : 'bg-line'}`}
                        >
                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-surface shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
                        </button>
                    </label>
                );
            })}
            {shown && <p role="alert" className="text-xs text-ink-muted">{t.notifyProblem[shown]}</p>}
        </div>
    );
}
