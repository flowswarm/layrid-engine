import { MotionEngine } from '../runtime/MotionEngine';

/**
 * PART 2: Connect Scroll Controller to Motion Engine
 * A pure Producer. Calculates progress, lerps momentum, and blindly publishes spatial data.
 * Adheres strictly to the rule: NEVER mutate the DOM or 3D meshes directly.
 * 
 * CODEX §Rule 8 COMPLIANCE: Does NOT own its own RAF loop.
 * Exposes a `tick()` method called by the single master RAF loop.
 */
export class ScrollController {
    private maxScrollY = 0;
    private boundCalculateBounds!: () => void;

    public initialize() {
        this.boundCalculateBounds = this.calculateBounds.bind(this);
        // Cache absolute window limits
        window.addEventListener('resize', this.boundCalculateBounds, { passive: true });
        this.calculateBounds();
    }

    private calculateBounds() {
        this.maxScrollY = Math.max(0, document.body.scrollHeight - window.innerHeight);
    }

    /**
     * Called by the master RAF loop — does NOT call requestAnimationFrame itself.
     * Pure mathematical producer: reads scroll position, computes progress/velocity,
     * publishes to MotionEngine.
     */
    public tick() {
        // 1. Fetch raw unoptimized browser scroll pixels
        const scrollY = window.scrollY || document.documentElement.scrollTop;
        const rawRatio = this.maxScrollY > 0 ? scrollY / this.maxScrollY : 0;
        const boundedRawProgress = Math.min(Math.max(rawRatio, 0), 1);

        // 2. Interrogate previously pushed State
        const state = MotionEngine.read();
        const previousSmoothed = state.spatial.smoothedProgress;

        // 3. Calculate Math (Lerping & Velocity)
        // 10% interpolation factor for buttery smooth easing ignoring physical mouse wheel steps
        const smoothedProgress = previousSmoothed + (boundedRawProgress - previousSmoothed) * 0.1;

        const rawVelocity = smoothedProgress - previousSmoothed;
        const velocity = Math.abs(rawVelocity) < 0.00001 ? 0 : rawVelocity; // Kill micro-jitters
        const direction = velocity > 0 ? 'down' : (velocity < 0 ? 'up' : state.spatial.direction);

        // 4. Section Interrogation (dynamic section tracking to be wired via SectionLayoutComposer)
        // For now: maintains hero-primary section mapping as baseline
        const heroProgress = boundedRawProgress < 0.2 ? (boundedRawProgress * 5) : 1;

        // 5. Publish
        // Push the entire structure back into the single Bus. 
        MotionEngine.write({
            spatial: {
                scrollY: scrollY,
                rawProgress: boundedRawProgress,
                smoothedProgress: smoothedProgress,
                velocity: velocity,
                direction: direction
            },
            sections: {
                'hero-primary': {
                    progress: heroProgress,
                    state: boundedRawProgress > 0 ? 'active' : 'before-enter'
                }
            }
        });
    }

    public dispose() {
        window.removeEventListener('resize', this.calculateBounds.bind(this));
    }
}
