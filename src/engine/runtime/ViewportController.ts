import { MotionEngine } from './MotionEngine';

/**
 * ViewportController
 * 
 * Pure Producer. Intercepts browser resize events and publishes viewport
 * dimensions + degraded mode into MotionEngine.
 * 
 * CODEX §Rule 8 COMPLIANCE: Does NOT own a persistent RAF loop.
 * Uses a single throttled RAF call for resize debouncing only.
 */
export class ViewportController {
    private boundOnResize: () => void;
    private resizeTimeout: number | null = null;

    constructor() {
        this.boundOnResize = this.onThrottledResize.bind(this);
    }

    public initialize() {
        window.addEventListener('resize', this.boundOnResize, { passive: true });
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

        // PERFORMANCE DOCTRINE:
        // Force rendering subscribers to halt GPU work on low-power devices.
        const degradedMode = breakpoint === 'mobile' || this.isBatterySaverMode();

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

    private isBatterySaverMode(): boolean {
        return false;
    }

    public dispose() {
        window.removeEventListener('resize', this.boundOnResize);
        if (this.resizeTimeout) {
            window.cancelAnimationFrame(this.resizeTimeout);
            this.resizeTimeout = null;
        }
    }
}
