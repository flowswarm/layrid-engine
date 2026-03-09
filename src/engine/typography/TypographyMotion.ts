import { MotionEngine, MotionEngineState } from '../runtime/MotionEngine';

export type DOMAnimationPreset = 'heroIntro' | 'slideLeft' | 'slideRight' | 'fadeIn' | 'staggerReveal' | 'anchorFollow';

/**
 * PART 5: Typography Motion Library
 * A strict Subscriber. Translates numerical bus state into CSS Transform Matrices.
 */
export class TypographyMotion {
    // Maps physical HTML nodes to their assigned algorithmic preset
    private registeredElements: Map<HTMLElement, DOMAnimationPreset> = new Map();
    private unsubscribeFn: (() => void) | null = null;

    // Lerp smoothing state for anchorFollow preset
    private anchorSmoothState: Map<HTMLElement, { x: number, y: number }> = new Map();
    private readonly anchorLerpFactor = 0.1;

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

        // 2. Performance Degradation override
        if (state.viewport.degradedMode) {
            this.registeredElements.forEach((_, el) => {
                el.style.transform = 'none';
                el.style.opacity = '1';
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
                case 'anchorFollow':
                    // PHYSICAL BINDING: Lerp-smoothed anchor follow for premium cinematic feel.
                    // Reads projected 2D coordinates published by WebGLSceneManager.
                    const dynamicAnchor = state.topology.anchors.headerFollow;
                    if (dynamicAnchor) {
                        // Initialize smoothing state if needed
                        if (!this.anchorSmoothState.has(el)) {
                            this.anchorSmoothState.set(el, { x: dynamicAnchor.x, y: dynamicAnchor.y });
                        }
                        const smooth = this.anchorSmoothState.get(el)!;
                        smooth.x += (dynamicAnchor.x - smooth.x) * this.anchorLerpFactor;
                        smooth.y += (dynamicAnchor.y - smooth.y) * this.anchorLerpFactor;
                        el.style.transform = `translate3d(${smooth.x}px, ${smooth.y}px, 0)`;
                    }
                    break;
            }
        });
    }

    public dispose() {
        if (this.unsubscribeFn) this.unsubscribeFn();
        this.registeredElements.clear();
        this.anchorSmoothState.clear();
    }
}
