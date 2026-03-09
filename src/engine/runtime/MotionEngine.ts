import { SharedRuntimeState } from './runtime.types';

// Re-export the canonical type for all consumers
export type { SharedRuntimeState };
export type MotionEngineState = SharedRuntimeState;

// Typing for partial deep updates via the write() method
type DeepPartial<T> = T extends object ? {
    [P in keyof T]?: DeepPartial<T[P]>;
} : T;

type SubscriberCallback = (state: SharedRuntimeState) => void;

/**
 * PART 1: Finalize Motion Engine Runtime Store
 * The absolute sole truth authority for unified continuity in the Layrid Engine.
 * 
 * State shape matches the Canonical SharedRuntimeState exactly (codex §5).
 * No competing runtime shape is permitted.
 */
class MotionEngineCore {
    public state: SharedRuntimeState = {
        context: {
            siteId: '',
            environment: 'live',
            mode: 'live',
            assetIds: [],
            sceneRole: 'hero-centerpiece'
        },
        spatial: {
            rawProgress: 0,
            smoothedProgress: 0,
            direction: 'down',
            velocity: 0,
            scrollY: 0
        },
        sections: {},
        transitions: {
            phase: 'idle',
            progress: 0
        },
        viewport: {
            width: 0,
            height: 0,
            breakpoint: 'desktop',
            degradedMode: false
        },
        scene: {
            mode: 'logo-centerpiece',
            activeCenterpieceAssetId: undefined,
            emphasisTarget: undefined
        },
        topology: {
            anchors: {}
        }
    };

    private subscribers: Set<SubscriberCallback> = new Set();
    private isRafting = false; // Prevents recursive stack overflows over RAF

    public read(): SharedRuntimeState {
        return this.state;
    }

    public write(update: DeepPartial<SharedRuntimeState>): void {
        this.mergeDeep(this.state, update);

        // Batch notifications perfectly until the browser is ready to paint
        if (!this.isRafting) {
            this.isRafting = true;
            requestAnimationFrame(() => this.notify());
        }
    }

    public subscribe(callback: SubscriberCallback): () => void {
        this.subscribers.add(callback);
        // Dispatch immediately resolving mount states synchronously
        callback(this.state);
        // Expose explicit clean-up hook
        return () => this.subscribers.delete(callback);
    }

    private notify() {
        this.isRafting = false;
        this.subscribers.forEach(cb => cb(this.state));
    }

    private mergeDeep(target: any, source: any) {
        if (target && source && typeof target === 'object' && typeof source === 'object') {
            for (const key in source) {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    if (!target[key]) Object.assign(target, { [key]: {} });
                    this.mergeDeep(target[key], source[key]);
                } else {
                    Object.assign(target, { [key]: source[key] });
                }
            }
        }
    }
}

// Expose the Singleton immediately enforcing the Canonical Single Source
export const MotionEngine = new MotionEngineCore();
