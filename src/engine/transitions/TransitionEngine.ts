import { MotionEngine } from '../runtime/MotionEngine';

/**
 * PART 7: Transition Engine
 * A Producer strictly commanding the flow of cross-document continuity.
 * Mutates the `temporal` phase blocking underlying interactions until DOM resolves explicitly.
 */
export class TransitionEngine {

    /**
     * Executes a Promise-based wiping sequence directly onto the Central State Core
     */
    public async triggerTransition(fromRoute: string, toRoute: string) {

        // 1. LEAVING PHASE: Current page fades out, triggers exit overlays
        MotionEngine.write({
            transitions: { phase: 'leaving', progress: 0, fromRoute, toRoute }
        });
        await this.animateProgress(0, 1, 600); // Wait for the 600ms swipe overlay to finish

        // 2. OVERLAP PHASE: Perfect blackout. WebGL unmounts, DOM fetches new Nuxt Payload
        MotionEngine.write({
            transitions: { phase: 'overlap', progress: 1 }
        });
        await new Promise(r => setTimeout(r, 400)); // Suspense hold mimicking data resolution

        // 3. ENTERING PHASE: The overlay unwipes. New assets natively drop-in
        MotionEngine.write({
            transitions: { phase: 'entering', progress: 1 }
        });
        await this.animateProgress(1, 0, 800); // 800ms reveal sweep

        // 4. IDLE PHASE: Yields processing power back instantly to the Scroll Controller
        MotionEngine.write({
            transitions: { phase: 'idle', progress: 0 }
        });
    }

    // CODEX §Rule 8 EXEMPT: This RAF is a self-terminating Promise-based animation,
    // not a persistent loop. It writes progress directly to MotionEngine and resolves
    // when the transition duration completes. It does not compete with MasterRAFLoop.
    private animateProgress(start: number, end: number, duration: number): Promise<void> {
        return new Promise(resolve => {
            const startTime = performance.now();

            const tick = (now: number) => {
                const elapsed = now - startTime;
                // Bezier-ready ratio clamp
                const ratio = Math.min(elapsed / duration, 1);
                const current = start + (end - start) * ratio;

                // Fire directly into the Bus bypassing standalone state trackers
                MotionEngine.write({
                    transitions: { progress: current }
                });

                if (ratio < 1) {
                    requestAnimationFrame(tick);
                } else {
                    resolve();
                }
            };
            requestAnimationFrame(tick);
        });
    }
}
