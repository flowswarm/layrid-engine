import { ScrollController } from '../scroll/ScrollController';
import { ScrollTimelineController } from '../scroll/ScrollTimelineController';

/**
 * MasterRAFLoop
 * 
 * The SINGLE requestAnimationFrame loop for the entire Layrid engine.
 * Codex §Rule 8: "one master RAF loop" — all producers tick through here.
 * 
 * Subscribers receive updates via MotionEngine.subscribe() and are NOT
 * part of this loop. They react passively to state changes.
 */
export class MasterRAFLoop {
    private scrollController: ScrollController;
    private scrollTimeline: ScrollTimelineController;
    private rafId: number | null = null;
    private isRunning = false;

    constructor(
        scrollController: ScrollController,
        scrollTimeline: ScrollTimelineController
    ) {
        this.scrollController = scrollController;
        this.scrollTimeline = scrollTimeline;
    }

    public start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.loop();
    }

    public stop() {
        this.isRunning = false;
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }

    private loop = () => {
        if (!this.isRunning) return;

        // Tick all producers in deterministic order
        this.scrollController.tick();
        this.scrollTimeline.onTick();

        // TransitionEngine is Promise-based and writes to MotionEngine directly
        // during async transitions — it does not need a tick here.

        this.rafId = requestAnimationFrame(this.loop);
    };

    public dispose() {
        this.stop();
    }
}
