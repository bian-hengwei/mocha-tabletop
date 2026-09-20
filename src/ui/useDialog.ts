import { useLayoutEffect, useRef } from 'react';

type DialogEntry = { element: HTMLElement; close: () => void };
const dialogs: DialogEntry[] = [];
const inertBefore = new Map<HTMLElement, boolean>();
let lastActivator: HTMLElement | null = null;
// Safari does not focus buttons on pointer clicks. Remember the actual opener
// before React handles the event so restoring focus is consistent across browsers.
if (typeof document !== 'undefined') {
    document.addEventListener('click', event => {
        lastActivator = event.target instanceof Element ? event.target.closest<HTMLElement>('button,a[href],input,select,[role="button"]') : null;
    }, true);
    document.addEventListener('keydown', () => { lastActivator = null; }, true);
}
const focusable = 'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function controls(element: HTMLElement) {
    return [...element.querySelectorAll<HTMLElement>(focusable)].filter(node =>
        node.tabIndex >= 0 && !node.closest('[inert]') && node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden');
}

function focusDialog(element: HTMLElement) {
    (controls(element)[0] || element).focus({ preventScroll: true });
}

// Only the top dialog stays interactive, including when one dialog opens another.
function updateBackground() {
    for (const [element, inert] of inertBefore) element.inert = inert;
    inertBefore.clear();
    let branch: HTMLElement | undefined = dialogs.at(-1)?.element;
    while (branch && branch !== document.body) {
        const parent: HTMLElement | null = branch.parentElement;
        if (!parent) break;
        for (const sibling of parent.children) {
            if (sibling !== branch && sibling instanceof HTMLElement) {
                inertBefore.set(sibling, sibling.inert);
                sibling.inert = true;
            }
        }
        branch = parent;
    }
}

/** Attach the returned ref to a dialog; add role="dialog", aria-modal and tabIndex={-1}. */
export function useDialog<T extends HTMLElement = HTMLElement>(open: boolean, onClose: () => void) {
    const ref = useRef<T>(null);
    const closeRef = useRef(onClose);
    closeRef.current = onClose;
    useLayoutEffect(() => {
        const element = ref.current;
        if (!open || !element) return;
        const opener = lastActivator?.isConnected && !lastActivator.closest('[inert]') ? lastActivator :
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
        lastActivator = null;
        const entry = { element, close: () => closeRef.current() };
        dialogs.push(entry);
        updateBackground();
        if (!element.contains(document.activeElement)) focusDialog(element);
        const onKey = (event: KeyboardEvent) => {
            if (dialogs.at(-1) !== entry) return;
            // Escape/Tab can cancel or navigate IME candidates without leaving the field.
            if (event.isComposing || event.keyCode === 229) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopImmediatePropagation();
                entry.close();
            } else if (event.key === 'Tab') {
                event.preventDefault();
                const items = controls(element);
                if (!items.length) element.focus();
                else {
                    const index = items.indexOf(document.activeElement as HTMLElement);
                    const next = index < 0 ? (event.shiftKey ? items.length - 1 : 0) :
                        (index + (event.shiftKey ? -1 : 1) + items.length) % items.length;
                    items[next].focus();
                }
            }
        };
        const onFocus = (event: FocusEvent) => {
            if (dialogs.at(-1) === entry && event.target instanceof Node && !element.contains(event.target)) focusDialog(element);
        };
        document.addEventListener('keydown', onKey, true);
        document.addEventListener('focusin', onFocus, true);
        return () => {
            document.removeEventListener('keydown', onKey, true);
            document.removeEventListener('focusin', onFocus, true);
            const wasTop = dialogs.at(-1) === entry;
            const index = dialogs.indexOf(entry);
            if (index >= 0) dialogs.splice(index, 1);
            updateBackground();
            if (wasTop) {
                const top = dialogs.at(-1)?.element;
                if (opener?.isConnected && !opener.closest('[inert]') && (!top || top.contains(opener))) opener.focus({ preventScroll: true });
                else if (top) focusDialog(top);
            }
        };
    }, [open]);
    return ref;
}
