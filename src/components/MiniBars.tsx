import React from 'react';

interface MiniBarsProps {
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    values: number[];
    labels: string[];
    /** Index of the column to highlight (the player's own result). */
    highlight?: number;
}

/** Compact column chart used for the personal and global mistake distributions. */
const MiniBars: React.FC<MiniBarsProps> = ({ title, subtitle, values, labels, highlight }) => {
    const max = Math.max(1, ...values);
    return (
        <figure className="rounded-xl bg-surface-2 border border-line p-3 flex flex-col gap-2 min-w-0">
            <figcaption className="min-w-0">
                <span className="eyebrow flex items-center gap-1.5">{title}</span>
                {subtitle && <span className="block text-[0.7rem] text-ink-muted mt-0.5 truncate">{subtitle}</span>}
            </figcaption>
            <ol className="flex items-end gap-1 h-14">
                {values.map((count, index) => (
                    <li key={index} className="flex-1 flex flex-col items-center justify-end gap-1 h-full" title={`${labels[index]}: ${count}`}>
                        <span
                            className={`w-full rounded-t transition-[height] duration-700 ${index === highlight ? 'bg-brand' : 'bg-line'}`}
                            style={{ height: `${Math.max(8, (count / max) * 100)}%` }}
                        />
                        <span className="text-[0.65rem] leading-none text-ink-muted tabular-nums">{labels[index]}</span>
                    </li>
                ))}
            </ol>
        </figure>
    );
};

export default MiniBars;
