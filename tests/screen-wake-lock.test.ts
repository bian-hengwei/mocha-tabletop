import { describe, expect, it, vi } from 'vitest';
import { ScreenWakeLockController, type WakeLockSentinelLike } from '../src/ui/screenWakeLock';

class FakeDocument extends EventTarget {
    visibilityState = 'visible';
    added = 0;
    removed = 0;
    addEventListener(...args: Parameters<EventTarget['addEventListener']>) { this.added++; return super.addEventListener(...args); }
    removeEventListener(...args: Parameters<EventTarget['removeEventListener']>) { this.removed++; return super.removeEventListener(...args); }
    setVisibility(state: 'visible' | 'hidden') {
        this.visibilityState = state;
        this.dispatchEvent(new Event('visibilitychange'));
    }
}

class FakeSentinel extends EventTarget implements WakeLockSentinelLike {
    released = false;
    release = vi.fn(async () => {
        if (this.released) return;
        this.released = true;
        this.dispatchEvent(new Event('release'));
    });
    systemRelease() {
        this.released = true;
        this.dispatchEvent(new Event('release'));
    }
}

const flush = () => new Promise(resolve => setTimeout(resolve));

describe('ScreenWakeLockController', () => {
    it('is opt-in, releases while hidden, and restores only the same enabled session', async () => {
        const doc = new FakeDocument(), first = new FakeSentinel(), second = new FakeSentinel();
        const request = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
        const controller = new ScreenWakeLockController(doc, { wakeLock: { request } });
        expect(doc.added).toBe(0);
        controller.start();
        controller.setSession('table-a');
        expect(controller.state).toMatchObject({ enabled: false, status: 'off' });
        expect(request).not.toHaveBeenCalled();

        controller.setEnabled(true);
        await flush();
        expect(controller.state).toMatchObject({ enabled: true, status: 'active' });
        doc.setVisibility('hidden');
        expect(first.release).toHaveBeenCalledOnce();
        expect(controller.state.status).toBe('paused');
        doc.setVisibility('visible');
        await flush();
        expect(request).toHaveBeenCalledTimes(2);
        expect(controller.state.status).toBe('active');

        controller.setSession('table-b');
        expect(second.release).toHaveBeenCalledOnce();
        expect(controller.state).toMatchObject({ enabled: false, status: 'off' });
        controller.stop();
        expect(doc.removed).toBe(1);
        controller.start();
        expect(doc.added).toBe(2);
        controller.stop();
    });

    it('releases a late sentinel after disable and reports denial, unsupported, and system-release states', async () => {
        const doc = new FakeDocument();
        let resolveRequest!: (sentinel: FakeSentinel) => void;
        const request = vi.fn(() => new Promise<WakeLockSentinelLike>(resolve => { resolveRequest = resolve as (sentinel: FakeSentinel) => void; }));
        const controller = new ScreenWakeLockController(doc, { wakeLock: { request } });
        controller.setSession('practice-a');
        controller.setEnabled(true);
        controller.setEnabled(false);
        const stale = new FakeSentinel();
        resolveRequest(stale);
        await flush();
        expect(stale.release).toHaveBeenCalledOnce();
        expect(controller.state).toMatchObject({ enabled: false, status: 'off' });

        let resolveLeave!: (sentinel: FakeSentinel) => void;
        const leaving = new ScreenWakeLockController(doc, { wakeLock: { request: vi.fn(() => new Promise<WakeLockSentinelLike>(resolve => { resolveLeave = resolve as (sentinel: FakeSentinel) => void; })) } });
        leaving.setSession('practice-leaving');
        leaving.setEnabled(true);
        leaving.setSession(null);
        const afterLeave = new FakeSentinel();
        resolveLeave(afterLeave);
        await flush();
        expect(afterLeave.release).toHaveBeenCalledOnce();

        const denied = new ScreenWakeLockController(doc, { wakeLock: { request: vi.fn().mockRejectedValue(new Error('denied')) } });
        denied.setSession('practice-b');
        denied.setEnabled(true);
        await flush();
        expect(denied.state).toMatchObject({ enabled: true, status: 'denied' });

        const unsupported = new ScreenWakeLockController(doc, {});
        unsupported.setSession('practice-c');
        unsupported.setEnabled(true);
        expect(unsupported.state).toMatchObject({ enabled: true, status: 'unsupported', supported: false });

        const active = new FakeSentinel();
        const released = new ScreenWakeLockController(doc, { wakeLock: { request: vi.fn().mockResolvedValue(active) } });
        released.setSession('practice-d');
        released.setEnabled(true);
        await flush();
        active.systemRelease();
        expect(released.state).toMatchObject({ enabled: true, status: 'released' });
        released.setEnabled(false);
        expect(active.release).not.toHaveBeenCalled();
        controller.stop();
        leaving.stop();
        denied.stop();
        unsupported.stop();
        released.stop();
    });
});
