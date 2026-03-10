import { MotionEngine, MotionEngineState } from '../runtime/MotionEngine';

/**
 * Canonical DOM animation presets.
 * 'anchorFollow' was removed — HeroAnchorFollower is the sole anchor-follow subscriber.
 */
export type DOMAnimationPreset = 'heroIntro' | 'slideLeft' | 'slideRight' | 'fadeIn' | 'staggerReveal';

/**
 * PART 5: Typography Motion Library
 * A strict Subscriber. Translates numerical bus state into CSS Transform Matrices.
 * 
 * @frozen — Preset set is locked. For anchor-follow behavior, use HeroAnchorFollower.
 */
export class TypographyMotion {
    // Maps physical HTML nodes to their assigned algorithmic preset
    private registeredElements: Map<HTMLElement, DOMAnimationPreset> = new Map();
    private unsubscribeFn: (() => void) | null = null;

    public initialize() {
        // Binds strictly to the Central Bus. Never runs its own RAF loop.
        this.unsubscribeFn = MotionEngine.subscribe(this.onEngineTicked.bind(this));
    }

    public register(element: HTMLElement, preset: DOMAnimationPreset) {
        this.registeredElements.set(element, preset);
        // Force initial tick for immediate mounting application
        this.onEngineTicked(MotionEngine.read());
    }

    public unregister(element: HTMLElement) {
        this.registeredElements.delete(element);
    }

    private onEngineTicked(state: MotionEngineState) {
        // 1. Fetch relevant scalar domains
        const p = state.spatial.smoothedProgress;
        const velocity = state.spatial.velocity;

        // 2. Performance Degradation override — release compositor layers
        if (state.viewport.degradedMode) {
            this.registeredElements.forEach((_, el) => {
                el.style.transform = 'none';
                el.style.opacity = '1';
                el.style.willChange = 'auto';
            });
            return;
        }

        // 3. Mathematical mapping execution
        this.registeredElements.forEach((preset, el) => {
            switch (preset) {
                case 'heroIntro':
                    const shrink = 2.5 - (1.5 * p); // Starts 250% scaled -> shrinks to 100%
                    const fade = Math.min(p * 2.5, 1);
                    el.style.transform = `scale(${shrink}) translateZ(0)`; // Force HW acceleration
                    el.style.opacity = `${fade}`;
                    break;
                case 'slideLeft':
                    el.style.transform = `translate3d(${-100 * p}px, 0, 0)`;
                    break;
                case 'slideRight':
                    el.style.transform = `translate3d(${100 * p}px, 0, 0)`;
                    break;
                case 'fadeIn':
                    el.style.opacity = `${p}`;
                    break;
                case 'staggerReveal':
                    // Integrates momentum/velocity for physically reactive text skewing
                    const skew = -velocity * 100; // Multiplier amplifies visual bend
                    const rise = 100 * (1 - p);
                    el.style.transform = `translate3d(0, ${rise}px, 0) skewY(${Math.min(Math.max(skew, -15), 15)}deg)`;
                    el.style.opacity = `${p}`;
                    break;
            }
        });
    }

    public dispose() {
        if (this.unsubscribeFn) this.unsubscribeFn();
        this.registeredElements.clear();
    }
}
