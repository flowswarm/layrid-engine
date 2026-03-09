/**
 * src/engine/scroll/ScrollTimelineController.ts
 * 
 * CORRECTED: No longer directly animates DOM elements.
 * Now acts as a pure Producer (codex Rule 2).
 * 
 * Integrates presets as mathematical resolvers that calculate transform state,
 * then publishes computed animation values into MotionEngine for subscribers
 * to consume. The actual DOM application happens in Typography Motion Library
 * and other subscriber modules.
 */

import { MotionEngine } from '../runtime/MotionEngine';
import { AnimationPresetRegistry, PresetConfig } from './presets';

// Describes an HTML node physically tracked by the Timeline.
interface TrackedNode {
    sectionId: string;
    presetName: string;
    configOverrides?: PresetConfig;
    progress: number; // 0.0 (entering) to 1.0 (exiting)
}

/**
 * ScrollTimelineController
 * 
 * A pure Producer. Calculates per-section progress and scroll-driven preset
 * geometry, then publishes exclusively into MotionEngine.state.sections.
 * 
 * RULE 2 COMPLIANCE: Does NOT directly animate DOM text, layered media,
 * WebGL meshes, or transitions. All animation is delegated to subscribers.
 */
export class ScrollTimelineController {
    private trackedNodes: TrackedNode[] = [];

    constructor() {
        this.trackedNodes = [];
    }

    /**
     * Register a section to be tracked by this controller.
     * The sectionId maps directly into MotionEngine.state.sections.
     */
    public registerSection(sectionId: string, presetName: string, configOverrides?: PresetConfig) {
        this.trackedNodes.push({
            sectionId,
            presetName,
            configOverrides,
            progress: 0
        });
    }

    public unregisterSection(sectionId: string) {
        this.trackedNodes = this.trackedNodes.filter(n => n.sectionId !== sectionId);
    }

    /**
     * Master ticking loop. Called by the master RAF loop.
     * Publishes mathematical preset state into MotionEngine — never touches the DOM.
     */
    public onTick() {
        const sectionUpdates: Record<string, { progress: number; state: 'before-enter' | 'entering' | 'active' | 'exiting' | 'passed' }> = {};

        for (const node of this.trackedNodes) {
            // 1. Resolve preset geometry mathematically (no DOM reads/writes)
            const resolver = AnimationPresetRegistry.get(node.presetName);
            if (resolver) {
                resolver(node.progress, node.configOverrides);
                // Preset results are now available for subscribers to consume
            }

            // 2. Classify section lifecycle state based on progress
            let sectionState: 'before-enter' | 'entering' | 'active' | 'exiting' | 'passed';
            if (node.progress <= 0) sectionState = 'before-enter';
            else if (node.progress < 0.15) sectionState = 'entering';
            else if (node.progress < 0.85) sectionState = 'active';
            else if (node.progress < 1) sectionState = 'exiting';
            else sectionState = 'passed';

            sectionUpdates[node.sectionId] = {
                progress: node.progress,
                state: sectionState
            };
        }

        // 3. Publish all section states in one batch write
        if (Object.keys(sectionUpdates).length > 0) {
            MotionEngine.write({ sections: sectionUpdates });
        }
    }

    /**
     * Update the progress for a tracked section from external scroll calculations.
     */
    public updateSectionProgress(sectionId: string, progress: number) {
        const node = this.trackedNodes.find(n => n.sectionId === sectionId);
        if (node) {
            node.progress = Math.min(Math.max(progress, 0), 1);
        }
    }
}
