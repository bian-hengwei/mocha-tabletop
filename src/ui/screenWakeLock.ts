export type WakeLockStatus = 'off' | 'active' | 'denied' | 'paused' | 'released' | 'requesting' | 'unsupported';

export interface WakeLockSentinelLike extends EventTarget {
    released: boolean;
    release(): Promise<void>;
}

export interface WakeLockDocumentLike extends EventTarget {
    visibilityState?: string;
}

export interface WakeLockNavigatorLike {
    wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> };
}

export interface WakeLockState {
    enabled: boolean;
    status: WakeLockStatus;
    supported: boolean;
}

type Listener = (state: WakeLockState) => void;

/** Keeps a screen wake lock scoped to one active table or practice session. */
export class ScreenWakeLockController {
    private session: string | null = null;
    private enabled = false;
    private status: WakeLockStatus = 'off';
    private sentinel: WakeLockSentinelLike | null = null;
    private generation = 0;
    private listeners = new Set<Listener>();
    private listening = false;
    private readonly onVisibilityChange = () => this.handleVisibilityChange();

    constructor(private readonly doc: WakeLockDocumentLike, private readonly nav: WakeLockNavigatorLike) {}

    start() {
        if (this.listening) return;
        this.listening = true;
        this.doc.addEventListener('visibilitychange', this.onVisibilityChange);
    }

    get state(): WakeLockState {
        return { enabled: this.enabled, status: this.status, supported: !!this.nav.wakeLock };
    }

    subscribe(listener: Listener) {
        this.listeners.add(listener);
        listener(this.state);
        return () => { this.listeners.delete(listener); };
    }

    setSession(session: string | null) {
        if (this.session === session) return;
        this.generation++;
        this.releaseCurrent();
        this.session = session;
        this.enabled = false;
        this.status = session && !this.nav.wakeLock ? 'unsupported' : 'off';
        this.emit();
    }

    setEnabled(enabled: boolean) {
        if (!this.session) return;
        this.generation++;
        this.enabled = enabled;
        if (!enabled) {
            this.releaseCurrent();
            this.status = 'off';
            this.emit();
            return;
        }
        this.request();
    }

    retry() {
        if (this.enabled) this.request();
    }

    stop() {
        this.generation++;
        this.enabled = false;
        this.session = null;
        this.releaseCurrent();
        if (this.listening) {
            this.doc.removeEventListener('visibilitychange', this.onVisibilityChange);
            this.listening = false;
        }
        this.status = 'off';
        this.emit();
    }

    private visible() {
        return this.doc.visibilityState !== 'hidden';
    }

    private request() {
        const api = this.nav.wakeLock;
        if (!api) {
            this.status = 'unsupported';
            this.emit();
            return;
        }
        if (!this.enabled || !this.session) return;
        if (!this.visible()) {
            this.status = 'paused';
            this.emit();
            return;
        }
        if (this.sentinel && !this.sentinel.released) {
            this.status = 'active';
            this.emit();
            return;
        }
        const session = this.session;
        const generation = ++this.generation;
        this.status = 'requesting';
        this.emit();
        void api.request('screen').then(sentinel => {
            if (generation !== this.generation || !this.enabled || this.session !== session || !this.visible()) {
                void sentinel.release().catch(() => {});
                return;
            }
            this.sentinel = sentinel;
            const onRelease = () => {
                if (this.sentinel !== sentinel) return;
                this.sentinel = null;
                this.status = this.enabled && this.session === session ? (this.visible() ? 'released' : 'paused') : 'off';
                this.emit();
            };
            sentinel.addEventListener('release', onRelease, { once: true });
            this.status = 'active';
            this.emit();
        }).catch(() => {
            if (generation !== this.generation || !this.enabled || this.session !== session) return;
            this.status = 'denied';
            this.emit();
        });
    }

    private releaseCurrent() {
        const sentinel = this.sentinel;
        this.sentinel = null;
        if (sentinel) void sentinel.release().catch(() => {});
    }

    private handleVisibilityChange() {
        if (!this.visible()) {
            this.generation++;
            this.releaseCurrent();
            if (this.enabled && this.session) {
                this.status = 'paused';
                this.emit();
            }
            return;
        }
        if (this.enabled && this.session) this.request();
    }

    private emit() {
        for (const listener of this.listeners) listener(this.state);
    }
}
