import { useLayoutEffect, useState, type ReactNode } from 'react';
import { useDialog } from './useDialog';

/** Let an existing dialog finish before announcing a newly arrived result. */
export function ResultOverlay({ title, className, children, onClose }: {
    title: string;
    className: string;
    children: ReactNode;
    onClose: () => void;
}) {
    const [available, setAvailable] = useState(false);
    const panel = useDialog<HTMLDivElement>(available, onClose);
    useLayoutEffect(() => {
        const update = () => setAvailable(![...document.querySelectorAll('[role="dialog"][aria-modal="true"]')]
            .some(element => element !== panel.current && !panel.current?.contains(element)));
        const observer = new MutationObserver(update);
        observer.observe(document.body, { childList: true, subtree: true });
        update();
        return () => observer.disconnect();
    }, [panel]);
    useLayoutEffect(() => () => {
        // A final action's opener may disappear; keep keyboard users on the table.
        queueMicrotask(() => {
            if (document.activeElement === document.body && !document.querySelector('[role="dialog"][aria-modal="true"]'))
                document.querySelector<HTMLButtonElement>('.topbar .brand button')?.focus({ preventScroll: true });
        });
    }, []);
    return available ? <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={className}>{children}</div> : null;
}

export function ResultBanner({ inline, ...props }: Parameters<typeof ResultOverlay>[0] & { inline: boolean }) {
    return inline ? <div className={props.className}>{props.children}</div> : <ResultOverlay {...props}/>;
}
