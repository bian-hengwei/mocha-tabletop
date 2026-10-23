import { useEffect, useRef, useState } from 'react';
import { ScreenWakeLockController, type WakeLockState } from './screenWakeLock';

const unavailableDocument = new EventTarget();

export function useScreenWakeLock(session: string | null) {
    const controllerRef = useRef<ScreenWakeLockController | null>(null);
    if (!controllerRef.current) {
        const doc = typeof document === 'undefined' ? unavailableDocument : document;
        const nav = typeof navigator === 'undefined' ? {} : navigator;
        controllerRef.current = new ScreenWakeLockController(doc, nav);
    }
    const controller = controllerRef.current;
    const [state, setState] = useState<WakeLockState>(controller.state);
    useEffect(() => controller.subscribe(setState), [controller]);
    useEffect(() => { controller.setSession(session); }, [controller, session]);
    useEffect(() => () => controller.dispose(), [controller]);
    return { ...state, setEnabled: (enabled: boolean) => controller.setEnabled(enabled), retry: () => controller.retry(), endSession: () => controller.setSession(null) };
}
