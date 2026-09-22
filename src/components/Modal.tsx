import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
    open: boolean;
    onClose: () => void;
    title: React.ReactNode;
    /** Small label above the title. */
    eyebrow?: React.ReactNode;
    closeLabel: string;
    children: React.ReactNode;
    /** Pinned below the scrolling body. */
    footer?: React.ReactNode;
    size?: 'md' | 'lg';
}

const FOCUSABLE = 'a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])';

/** Accessible dialog: portal, Escape and backdrop to close, focus kept inside and restored. */
export default function Modal({ open, onClose, title, eyebrow, closeLabel, children, footer, size = 'md' }: ModalProps) {
    const titleId = useId();
    const dialog = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const previous = document.activeElement as HTMLElement | null;
        dialog.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key !== 'Tab' || !dialog.current) return;
            const items = [...dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
            const first = items[0];
            const last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first?.focus();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = '';
            previous?.focus();
        };
    }, [open, onClose]);

    if (!open) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-[fade-in_200ms_ease-out]" onClick={onClose} />
            <div
                ref={dialog}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className={`card relative z-10 w-full ${size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg'} max-h-[92svh] flex flex-col rounded-b-none sm:rounded-b-2xl bg-surface animate-rise`}
            >
                <div className="flex items-start justify-between gap-4 px-5 sm:px-6 pt-5 pb-3">
                    <div className="min-w-0">
                        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
                        <h2 id={titleId} className="font-display text-2xl font-semibold leading-tight">{title}</h2>
                    </div>
                    <button onClick={onClose} aria-label={closeLabel} className="icon-btn w-9 h-9 shrink-0">
                        <X size={18} aria-hidden="true" />
                    </button>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 pb-5">{children}</div>
                {footer && <div className="shrink-0 px-5 sm:px-6 py-4 border-t border-line bg-surface-2 rounded-b-none sm:rounded-b-2xl">{footer}</div>}
            </div>
        </div>,
        document.body,
    );
}
