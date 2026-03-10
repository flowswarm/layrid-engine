import { MotionEngine, MotionEngineState } from '../runtime/MotionEngine';

/**
 * HeroAnchorFollower
 * 
 * A dedicated DOM subscriber that reads the `headerFollow` anchor from 
 * MotionEngine topology and applies premium translational motion to a 
 * hero text element.
 * 
 * Design:
 * - DOM never queries Three.js directly (Rule 3 compliance)
 * - Reads exclusively from MotionEngine.state.topology.anchors
 * - Uses lerp-based smoothing for premium positional follow
 * - Supports degraded mode with static positioning
 * 
 * Path: WebGL publishes anchor → MotionEngine stores anchor → DOM reads anchor
 */
export class HeroAnchorFollower {
    private element: HTMLElement;
    private unsubscribeFn: (() => void) | null = null;

    // Smoothing state for premium eased follow
    private currentX = 0;
    private currentY = 0;
    private lerpFactor = 0.08; // Lower = smoother/slower follow

    constructor(element: HTMLElement) {
        this.element = element;

        // Ensure the element is positioned for transform-based motion
        this.element.style.position = 'fixed';
        this.element.style.top = '0';
        this.element.style.left = '0';
        this.element.style.pointerEvents = 'none';
        this.element.style.willChange = 'transform';
        this.element.style.zIndex = '10';
    }

    public initialize(): void {
        this.unsubscribeFn = MotionEngine.subscribe(this.onTick.bind(this));
        console.log('[HeroAnchorFollower] ✅ Subscribed to MotionEngine');
    }

    private onTick(state: MotionEngineState): void {
        // Degraded mode: fixed centered positioning — intentional, not disabled.
        // Keeps the element in the fixed overlay layer (no layout shift).
        if (state.viewport.degradedMode) {
            this.element.style.position = 'fixed';
            this.element.style.transform = 'translate3d(50vw, 30vh, 0) translate(-50%, -50%)';
            this.element.style.willChange = 'auto';
            return;
        }

        // Ensure full-mode positioning is set
        this.element.style.position = 'fixed';
        this.element.style.willChange = 'transform';

        // Read the projected 3D anchor from MotionEngine topology
        const anchor = state.topology.anchors.headerFollow;

        if (!anchor) return;

        // Lerp for premium-feel follow (avoids jarring 1:1 tracking)
        // Use a faster factor in degraded mode for snappier, less GPU-dependent follow
        const factor = state.viewport.degradedMode ? 0.15 : this.lerpFactor;
        this.currentX += (anchor.x - this.currentX) * factor;
        this.currentY += (anchor.y - this.currentY) * factor;

        // Apply via transform only (Rule 8: no layout thrashing)
        this.element.style.transform = `translate3d(${this.currentX}px, ${this.currentY}px, 0)`;
    }

    /**
     * Adjust smoothing factor. Lower values = more cinematic lag.
     * Range: 0.01 (very smooth) to 1.0 (instant snap)
     */
    public setSmoothingFactor(factor: number): void {
        this.lerpFactor = Math.min(Math.max(factor, 0.01), 1.0);
    }

    public dispose(): void {
        if (this.unsubscribeFn) {
            this.unsubscribeFn();
            this.unsubscribeFn = null;
        }
        this.element.style.transform = 'none';
        this.element.style.willChange = 'auto';
        console.log('[HeroAnchorFollower] 🛑 Disposed');
    }
}
