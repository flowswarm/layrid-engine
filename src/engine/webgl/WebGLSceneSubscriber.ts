import * as THREE from 'three';
import { MotionEngine } from '../runtime/MotionEngine';
import type { SharedRuntimeState } from '../runtime/runtime.types';

/**
 * WebGLSceneSubscriber
 * 
 * Lightweight subscriber module for individual mesh tick behavior.
 * Uses the canonical SharedRuntimeState type (unified with MotionEngineState).
 * 
 * This module provides an isolated per-mesh tick executor that can be composed
 * within the WebGLSceneManager for each loaded centerpiece, without duplicating
 * the full scene management logic.
 */
export class WebGLSceneSubscriber {
    private activeMesh: THREE.Object3D | null = null;
    private camera: THREE.PerspectiveCamera;

    constructor(camera: THREE.PerspectiveCamera) {
        this.camera = camera;
    }

    /**
     * Replaces the currently mounted mesh based purely on the Asset DB Hash.
     * Note: This function doesn't care if the hash is from Production or Preview.
     */
    public mountAssetContext(mesh: THREE.Object3D) {
        this.activeMesh = mesh;
    }

    /**
     * Expected to be called bound inside the master RAF loop through WebGLSceneManager.
     * 1. Reacts exclusively to state.spatial
     * 2. Writes exclusively to state.topology
     */
    public executeTick(currentState: SharedRuntimeState, updateTopology: (anchors: Record<string, { x: number, y: number }>) => void) {
        if (!this.activeMesh) return;

        // 1. MATHEMATICAL CONSUMER: Reads Scroll Scalar to rotate mesh natively
        const progress = currentState.spatial.smoothedProgress;
        this.activeMesh.rotation.y = Math.PI * progress; // Spans 0 to 180 degrees

        // 2. Locate Explicit Generation Socket nested by MCP
        const socket = this.activeMesh.getObjectByName('TextAnchorSocket');

        if (socket) {
            // 3. Project 3D vector to Absolute Screen Coordinates
            const vector = new THREE.Vector3();
            socket.getWorldPosition(vector);
            vector.project(this.camera);

            // Map normalized [-1, 1] device coordinates to active Viewport bounds
            const px = (vector.x * 0.5 + 0.5) * currentState.viewport.width;
            const py = (vector.y * -0.5 + 0.5) * currentState.viewport.height;

            // 4. MATHEMATICAL PRODUCER: 
            // Send Screen coordinates back to Engine Bus for HTML DOM processing
            updateTopology({
                headerFollow: { x: px, y: py }
            });
        }
    }
}
