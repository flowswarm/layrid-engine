import { MotionEngine } from '../runtime/MotionEngine';

/**
 * ViewportDetector
 * 
 * Pure Producer (codex §6). Publishes viewport dimensions, breakpoint classification,
 * and degraded mode flag into MotionEngine. 
 * 
 * Degraded mode is activated for:
 * - Mobile devices (width < 768)
 * - Low-power preference (prefers-reduced-motion)
 * - Low device memory (navigator.deviceMemory < 4)
 */
export class ViewportDetector {
    private resizeHandler: () => void;
    private reducedMotionQuery: MediaQueryList;

    constructor() {
        this.resizeHandler = this.onResize.bind(this);
        this.reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    }

    public initialize(): void {
        // Publish initial state immediately
        this.publish();

        // Listen for resize events (passive for performance)
        window.addEventListener('resize', this.resizeHandler, { passive: true });

        // Listen for reduced-motion preference changes
        this.reducedMotionQuery.addEventListener('change', this.resizeHandler);
    }

    private onResize(): void {
        this.publish();
    }

    private publish(): void {
        const width = window.innerWidth;
        const height = window.innerHeight;

        // Breakpoint classification
        let breakpoint: 'desktop' | 'tablet' | 'mobile';
        if (width < 768) {
            breakpoint = 'mobile';
        } else if (width < 1024) {
            breakpoint = 'tablet';
        } else {
            breakpoint = 'desktop';
        }

        // Degraded mode detection
        const prefersReduced = this.reducedMotionQuery.matches;
        const lowMemory = 'deviceMemory' in navigator && (navigator as any).deviceMemory < 4;
        const degradedMode = breakpoint === 'mobile' || prefersReduced || lowMemory;

        MotionEngine.write({
            viewport: {
                width,
                height,
                breakpoint,
                degradedMode
            }
        });
    }

    public dispose(): void {
        window.removeEventListener('resize', this.resizeHandler);
        this.reducedMotionQuery.removeEventListener('change', this.resizeHandler);
    }
}
