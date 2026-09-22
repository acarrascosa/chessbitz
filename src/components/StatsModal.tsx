import React, { useMemo } from 'react';
import Modal from './Modal';
import MiniBars from './MiniBars';
import { useProgressVersion } from './hooks';
import { MAX_MISTAKES } from '../lib/challenge';
import { LAUNCH_DAY_UTC, getDayNumber } from '../lib/daily';
import { computeStats, loadArchive, loadHistory, loadTactics } from '../lib/progress';
import { formatDecimal, ui, type Lang } from '../i18n/ui';

interface StatsModalProps {
    open: boolean;
    onClose: () => void;
    lang: Lang;
}

const LABELS = [...Array.from({ length: MAX_MISTAKES }, (_, i) => String(i)), '✕'];
const CALENDAR_DAYS = 28;

const StatsModal: React.FC<StatsModalProps> = ({ open, onClose, lang }) => {
    const t = ui[lang];
    const version = useProgressVersion();

    const data = useMemo(() => {
        if (!open) return null;
        const today = getDayNumber();
        const history = loadHistory();
        const archive = loadArchive();
        const tactics = loadTactics();
        const stats = computeStats(history, today);
        const todayRecord = history[today];
        const todayBucket = todayRecord && todayRecord.state.status !== 'playing'
            ? (todayRecord.state.status === 'lost' ? MAX_MISTAKES : todayRecord.state.mistakes)
            : undefined;
        const calendar = Array.from({ length: CALENDAR_DAYS }, (_, i) => today - (CALENDAR_DAYS - 1 - i))
            .filter(day => day >= 0)
            .map(day => ({ day, status: history[day]?.state.status }));
        const archivePlayed = Object.values(archive).filter(r =>
            (r.normal && r.normal.state.status !== 'playing') || (r.expert && r.expert.state.status !== 'playing')).length;
        const tacticsSolved = Object.values(tactics).filter(r => r.state.status === 'won').length;
        return { today, stats, todayBucket, calendar, archivePlayed, tacticsSolved };
        // `version` re-reads storage when progress changes while the panel is open.
    }, [open, version]);

    if (!data) return null;
    const { today, stats, todayBucket, calendar, archivePlayed, tacticsSolved } = data;
    const winRate = stats.played ? Math.round((stats.won / stats.played) * 100) : 0;
    const dateFormat = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', timeZone: 'UTC' });
    const statusLabel = (status?: string) => (status === 'won' ? t.dayWon : status === 'lost' ? t.dayLost : t.dayMissed);

    return (
        <Modal open={open} onClose={onClose} title={t.statsTitle} closeLabel={t.close}>
            <div className="space-y-5">
                <p className="text-sm text-ink-muted">{t.statsDailyOnly}</p>
                <dl className="grid grid-cols-4 gap-2 text-center">
                    {[
                        [t.played, String(stats.played)],
                        [t.winRate, `${winRate}%`],
                        [t.streak, String(stats.currentStreak)],
                        [t.maxStreak, String(stats.maxStreak)],
                    ].map(([label, value]) => (
                        <div key={label} className="flex flex-col-reverse gap-0.5 rounded-xl border border-line py-3">
                            <dt className="text-[0.65rem] leading-tight text-ink-muted px-1">{label}</dt>
                            <dd className="font-display text-3xl font-semibold tabular-nums">{value}</dd>
                        </div>
                    ))}
                </dl>

                {stats.played === 0 ? (
                    <p className="text-center text-ink-muted py-4">{t.noStats}</p>
                ) : (
                    <>
                        <MiniBars
                            title={t.mistakesPerChallenge}
                            subtitle={stats.averageHints !== null ? `${t.hintsPerChallenge}: ${formatDecimal(lang, stats.averageHints)}` : undefined}
                            values={[...stats.distribution, stats.lost]}
                            labels={LABELS}
                            names={LABELS.map((label, i) => (i === MAX_MISTAKES ? t.lostBucket : `${label} ${t.statMistakes.toLowerCase()}`))}
                            highlight={todayBucket}
                            showCounts
                        />
                    </>
                )}

                <section>
                    <h3 className="eyebrow mb-2">{t.lastDays}</h3>
                    <ol className="grid grid-cols-14 gap-1">
                        {calendar.map(({ day, status }) => {
                            const label = `${dateFormat.format(new Date(LAUNCH_DAY_UTC + day * 86_400_000))}: ${statusLabel(status)}`;
                            return (
                                <li
                                    key={day}
                                    title={label}
                                    aria-label={label}
                                    className={`aspect-square rounded ${status === 'won' ? 'bg-good' : status === 'lost' ? 'bg-bad' : 'bg-surface-2 border border-line'} ${day === today ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : ''}`}
                                />
                            );
                        })}
                    </ol>
                </section>

                <dl className="grid grid-cols-2 gap-2">
                    {[[t.archivePlayed, archivePlayed], [t.tacticsSolved, tacticsSolved]].map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between rounded-xl bg-surface-2 border border-line px-4 py-3">
                            <dt className="text-sm text-ink-muted">{label}</dt>
                            <dd className="font-display text-xl font-semibold tabular-nums">{value}</dd>
                        </div>
                    ))}
                </dl>
            </div>
        </Modal>
    );
};

export default StatsModal;
