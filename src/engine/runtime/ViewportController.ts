import { MotionEngine } from './MotionEngine';

/**
 * ViewportController
 * 
 * Pure Producer. Intercepts browser resize events and publishes viewport
 * dimensions + degraded mode into MotionEngine.
 * 
 * CODEX §Rule 8 COMPLIANCE: Does NOT own a persistent RAF loop.
 * Uses a single throttled RAF call for resize debouncing only.
 * 
 * Degraded mode detection (Codex §10):
 *   - Mobile breakpoint (<768px)
 *   - prefers-reduced-motion: reduce
 *   - navigator.deviceMemory < 4
 *   - navigator.hardwareConcurrency < 4
 */
export class ViewportController {
    private boundOnResize: () => void;
    private resizeTimeout: number | null = null;
    private reducedMotionQuery: MediaQueryList | null = null;
    private boundMotionChange: ((e: MediaQueryListEvent) => void) | null = null;

    constructor() {
        this.boundOnResize = this.onThrottledResize.bind(this);
    }

    public initialize() {
        window.addEventListener('resize', this.boundOnResize, { passive: true });

        // Listen for reduced-motion preference changes at runtime
        this.reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        this.boundMotionChange = () => this.evaluateDeviceLimits();
        this.reducedMotionQuery.addEventListener('change', this.boundMotionChange);

        // Measure constraints on first load
        this.evaluateDeviceLimits();
    }

    private onThrottledResize() {
        if (this.resizeTimeout) {
            window.cancelAnimationFrame(this.resizeTimeout);
        }
        this.resizeTimeout = window.requestAnimationFrame(() => this.evaluateDeviceLimits());
    }

    private evaluateDeviceLimits() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        let breakpoint: 'mobile' | 'tablet' | 'desktop' = 'desktop';
        if (width < 768) {
            breakpoint = 'mobile';
        } else if (width < 1024) {
            breakpoint = 'tablet';
        }

        // PERFORMANCE DOCTRINE — intentional degraded mode detection:
        // Combine multiple signals to determine when the engine should
        // simplify rendering for a stable, intentional experience.
        const prefersReduced = this.reducedMotionQuery?.matches ?? false;
        const lowMemory = 'deviceMemory' in navigator && (navigator as any).deviceMemory < 4;
        const lowCores = 'hardwareConcurrency' in navigator && navigator.hardwareConcurrency < 4;

        const degradedMode = breakpoint === 'mobile' || prefersReduced || lowMemory || lowCores;

        // Write the viewport state into MotionEngine — the sole runtime truth.
        MotionEngine.write({
            viewport: {
                width,
                height,
                breakpoint,
                degradedMode
            }
        });
    }

    public dispose() {
        window.removeEventListener('resize', this.boundOnResize);
        if (this.resizeTimeout) {
            window.cancelAnimationFrame(this.resizeTimeout);
            this.resizeTimeout = null;
        }
        if (this.reducedMotionQuery && this.boundMotionChange) {
            this.reducedMotionQuery.removeEventListener('change', this.boundMotionChange);
        }
    }
}
