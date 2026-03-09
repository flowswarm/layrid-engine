import { ScrollController } from '../scroll/ScrollController';
import { ScrollTimelineController } from '../scroll/ScrollTimelineController';

/**
 * MasterRAFLoop
 * 
 * Rule 8 Compliance: One single requestAnimationFrame loop for the entire engine.
 * No other module is permitted to call requestAnimationFrame directly.
 * 
 * Tick order:
 *   1. ScrollController.tick()          → publishes spatial state
 *   2. ScrollTimelineController.onTick() → publishes section states
 *   3. (WebGLSceneManager and TypographyMotion tick via MotionEngine.subscribe,
 *       which batches notifications into the next RAF frame automatically)
 */
export class MasterRAFLoop {
    private scrollController: ScrollController;
    private scrollTimelineController: ScrollTimelineController;
    private rafId: number | null = null;
    private isRunning = false;

    constructor(
        scrollController: ScrollController,
        scrollTimelineController: ScrollTimelineController
    ) {
        this.scrollController = scrollController;
        this.scrollTimelineController = scrollTimelineController;
    }

    /**
     * Start the single RAF loop. Idempotent — calling start() twice does nothing.
     */
    public start(): void {
        if (this.isRunning) return;
        this.isRunning = true;
        this.tick();
        console.log('[MasterRAFLoop] ✅ Started');
    }

    /**
     * Stop the RAF loop and release the animation frame.
     */
    public stop(): void {
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        this.isRunning = false;
        console.log('[MasterRAFLoop] ⏹ Stopped');
    }

    /**
     * Single tick — called once per frame by the browser.
     * Producers execute in a deterministic order.
     */
    private tick = (): void => {
        // 1. Scroll spatial producer — publishes rawProgress, smoothedProgress, velocity, direction
        this.scrollController.tick();

        // 2. Section timeline producer — publishes per-section progress and lifecycle states
        this.scrollTimelineController.onTick();

        // 3. Schedule next frame
        this.rafId = requestAnimationFrame(this.tick);
    };

    public dispose(): void {
        this.stop();
    }
}
