import { MotionEngine } from './MotionEngine';

/**
 * PART 8: Add Viewport / Performance Degradation
 * Intercepts explicit browser resize operations and bounds the entire application
 * ecosystem explicitly away from heavy WebGL loops if mobile thresholds are crossed.
 */
export class ViewportController {

    private resizeTimeout: number | null = null;

    public initialize() {
        // Native window listening event
        window.addEventListener('resize', this.onThrottledResize.bind(this), { passive: true });

        // Measure constraints strictly on first document load
        this.evaluateDeviceLimits();
    }

    private onThrottledResize() {
        // Prevent event flooding locking the main UI thread during window drags
        if (this.resizeTimeout) {
            window.cancelAnimationFrame(this.resizeTimeout);
        }
        this.resizeTimeout = window.requestAnimationFrame(this.evaluateDeviceLimits.bind(this));
    }

    private evaluateDeviceLimits() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        // Classify resolution bounds
        let breakpoint: 'mobile' | 'tablet' | 'desktop' = 'desktop';
        if (width < 768) {
            breakpoint = 'mobile';
        } else if (width < 1024) {
            breakpoint = 'tablet';
        }

        // PERFORMANCE DOCTRINE: 
        // Force the rendering subscribers to implicitly halt GPU matrices to protect batteries.
        const degradedMode = breakpoint === 'mobile' || this.isBatterySaverMode();

        // Write the new bounds natively back into the Runtime Storage 
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
        // Implementation placeholder identifying device power states
        return false;
    }

    public dispose() {
        window.removeEventListener('resize', this.onThrottledResize.bind(this));
    }
}
