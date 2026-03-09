import { MotionEngine, MotionEngineState } from '../runtime/MotionEngine';

interface MediaPlane {
    element: HTMLElement;
    depthOffset: number; // Modifies movement scalars. e.g. 0.1 backend layer vs 0.8 fast foreground.
}

/**
 * PART 6: Layered Media Scene System
 * Handles physical HTML Image planes explicitly, isolating DOM Parallax computations
 * natively decoupled from 3D rendering instances.
 */
export class LayeredMediaScene {
    private activePlanes: MediaPlane[] = [];
    private unsubscribeFn: (() => void) | null = null;

    public initialize() {
        this.unsubscribeFn = MotionEngine.subscribe(this.onEngineTicked.bind(this));
    }

    /**
     * Binds a physical DOM Element to the Central Mathematical Tracker
     */
    public registerPlane(element: HTMLElement, depthOffset: number) {
        this.activePlanes.push({ element, depthOffset });
        // Force sync positioning immediately to prevent flicker
        this.onEngineTicked(MotionEngine.read());
    }

    public unregisterPlane(element: HTMLElement) {
        this.activePlanes = this.activePlanes.filter(p => p.element !== element);
    }

    private onEngineTicked(state: MotionEngineState) {
        // 1. PERFORMANCE DOCTRINE: Check global environment capabilities FIRST
        // Deep stacking depth composition destroys inferior hardware GPUs.
        if (state.viewport.degradedMode) {
            this.activePlanes.forEach(plane => {
                plane.element.style.transform = 'translate3d(0,0,0)';
                plane.element.style.filter = 'none'; // Clear arbitrary depth-of-field overhead
            });
            return;
        }

        // 2. Fetch standard scalars
        const p = state.spatial.smoothedProgress;
        const v = state.spatial.velocity;

        // 3. Execution Binding
        this.activePlanes.forEach(plane => {
            // Translate the unified scalar onto a strict Y-Axis Depth track
            const shiftY = (p * -120) * plane.depthOffset;
            plane.element.style.transform = `translate3d(0, ${shiftY}px, 0)`;

            // Velocity-driven Crossfade / Overlap Simulation
            // Simulates physical "Depth of Field" organically by intensely blurring backing planes
            // natively when throwing the scroll wheel hard.
            const simulatedDoF = Math.abs(v * 35 * plane.depthOffset);
            plane.element.style.filter = `blur(${Math.min(simulatedDoF, 10)}px)`;
        });
    }

    public dispose() {
        if (this.unsubscribeFn) this.unsubscribeFn();
        this.activePlanes = [];
    }
}
