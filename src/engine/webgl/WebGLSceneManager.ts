import * as THREE from 'three';
import { MotionEngine, MotionEngineState } from '../runtime/MotionEngine';
import { GeneratedLogoCenterpiece } from './modules/GeneratedLogoCenterpiece';

/**
 * WebGLSceneManager
 * 
 * @frozen — Public API (constructor, dispose) is locked.
 * Do not add new public methods without a full convergence review.
 * 
 * Subscriber/Publisher bound to MotionEngine.
 * Delegates asset loading to GeneratedLogoCenterpiece (GLB with DRACO, or procedural fallback).
 * Natively handles live, preview, and comparison contexts — only assetIds differ.
 * 
 * Responsibilities:
 *   ✅ Initialize scene/camera/renderer/lights
 *   ✅ Load resolved centerpiece asset(s) via syncAssetContext()
 *   ✅ React to MotionEngine spatial/transition/context state
 *   ✅ Publish anchor coordinates into MotionEngine topology.anchors (via writeQuiet)
 *   ✅ Support degraded mode (halts rendering when viewport.degradedMode)
 *   ✅ Expose dispose() for cleanup
 * 
 * Must NOT:
 *   ✅ Own a competing runtime store
 *   ✅ Decide workflow/approval state
 *   ✅ Create special preview/comparison renderer
 */
export class WebGLSceneManager {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;

    // Delegates asset loading/disposal to the canonical centerpiece module
    private activeCenterpieces: Map<string, GeneratedLogoCenterpiece> = new Map();
    private previousAssetIds: string[] = ['__uninitialized__']; // sentinel ensures first tick triggers sync
    private syncInProgress = false; // Guard against overlapping async loads

    private unsubscribeFn: (() => void) | null = null;
    private boundOnResize: () => void;

    constructor(canvas: HTMLCanvasElement) {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.z = 12;

        this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        this.setupLighting();

        // Subscribe to Central Bus Execution (The ONLY update mechanism)
        this.unsubscribeFn = MotionEngine.subscribe(this.onEngineTicked.bind(this));
        this.boundOnResize = this.onResize.bind(this);
        window.addEventListener('resize', this.boundOnResize, { passive: true });
    }

    private setupLighting() {
        const ambient = new THREE.AmbientLight(0xffffff, 0.8);
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
        dirLight.position.set(5, 10, 7);

        // Add a secondary fill light for the procedural demo
        const fillLight = new THREE.DirectionalLight(0x06b6d4, 0.4);
        fillLight.position.set(-3, 2, -5);

        this.scene.add(ambient, dirLight, fillLight);
    }

    /**
     * Natively handles Live, Preview, and Comparison asset loading.
     * Delegates to GeneratedLogoCenterpiece for GLB/DRACO loading + TextAnchorSocket.
     * If GLB doesn't exist, GeneratedLogoCenterpiece creates a procedural fallback.
     */
    private async syncAssetContext(assetIds: string[], assetPaths: Record<string, string> = {}) {
        // Guard against overlapping async calls when context changes rapidly
        if (this.syncInProgress) return;
        this.syncInProgress = true;

        try {
            // Filter out empty asset IDs (can happen when no live hash exists yet)
            const validIds = assetIds.filter(id => id.length > 0);

            // If no valid assets at all, load a single demo centerpiece
            const idsToLoad = validIds.length > 0 ? validIds : ['__demo__'];

            // Remove centerpieces no longer in the resolved set
            for (const [id, centerpiece] of this.activeCenterpieces.entries()) {
                if (!idsToLoad.includes(id)) {
                    this.scene.remove(centerpiece.getRootGroup());
                    centerpiece.dispose();
                    this.activeCenterpieces.delete(id);
                }
            }

            // Load new centerpieces via GeneratedLogoCenterpiece
            const loadPromises = idsToLoad.map(async (id, index) => {
                if (this.activeCenterpieces.has(id)) return;

                const centerpiece = new GeneratedLogoCenterpiece();

                // Resolve GLB URL from assetPaths (populated by AssetPipelineService),
                // falling back to hardcoded pattern for backward compatibility
                let url: string;
                if (id === '__demo__') {
                    url = '/cdn/assets/__nonexistent__.glb'; // Triggers procedural fallback
                } else if (assetPaths[id]) {
                    url = assetPaths[id]; // Real registry runtimePath
                } else {
                    url = `/models/${id}.glb`; // Fallback pattern
                }

                await centerpiece.load(url);

                const group = centerpiece.getRootGroup();

                // If Comparison Mode yields 2+ assets, stagger them physically
                if (idsToLoad.length > 1) {
                    group.position.x = index === 0 ? -3 : 3;
                }

                this.scene.add(group);
                this.activeCenterpieces.set(id, centerpiece);
            });

            await Promise.all(loadPromises);
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * MotionEngine subscriber callback — the ONLY update mechanism.
     * Reads spatial state, animates centerpieces, projects anchors, renders.
     */
    private onEngineTicked(state: MotionEngineState) {
        const isDegraded = state.viewport.degradedMode;

        // 1. Detect Context Changes (or first tick via sentinel)
        const currentIds = state.context.assetIds;
        const currentKey = currentIds.length > 0 ? currentIds.join(',') : '__demo__';
        const prevKey = this.previousAssetIds.join(',');
        if (currentKey !== prevKey) {
            this.syncAssetContext(currentIds, state.context.assetPaths || {});
            this.previousAssetIds = currentIds.length > 0 ? [...currentIds] : ['__demo__'];
        }

        const p = state.spatial.smoothedProgress;
        const v = state.spatial.velocity;
        const projectedTopology: Record<string, { x: number, y: number }> = {};

        // 2. Animate and Extract Topologies
        this.activeCenterpieces.forEach((centerpiece, id) => {
            const group = centerpiece.getRootGroup();

            // A. Rotation: smooth full-range rotation synced to scroll
            group.rotation.y = p * Math.PI;

            if (!isDegraded) {
                // B. Parallax depth: subtle Z-axis drift (skip in degraded)
                group.position.z = Math.sin(p * Math.PI) * 2;

                // C. Scale breathing: subtle pulsing (skip in degraded)
                const breathe = 1.0 + Math.sin(p * Math.PI * 2) * 0.05;
                group.scale.setScalar(breathe);

                // D. Velocity-reactive tilt (skip in degraded)
                const tiltX = Math.min(Math.max(v * 8, -0.15), 0.15);
                group.rotation.x = tiltX;

                // E. Emphasis emissive glow (skip in degraded — saves GPU fill)
                const heroSection = state.sections['hero-primary'];
                if (heroSection && heroSection.state === 'active') {
                    const intensity = 0.3 + heroSection.progress * 0.4;
                    for (const mat of centerpiece.getEmissiveMaterials()) {
                        mat.emissiveIntensity = intensity;
                    }
                }
            } else {
                // Degraded: static transforms — rotation only, no depth/scale/tilt
                group.position.z = 0;
                group.scale.setScalar(1);
                group.rotation.x = 0;
            }

            // Anchor Projection — always runs (DOM follower depends on this)
            const projected = centerpiece.projectAnchorToScreen(
                this.camera, state.viewport.width, state.viewport.height
            );

            if (projected) {
                const anchorKey = this.activeCenterpieces.size > 1 ? `headerFollow_${id}` : 'headerFollow';
                projectedTopology[anchorKey] = projected;
            }
        });

        // 3. Write projected topologies to MotionEngine
        // CRITICAL: Use writeQuiet() — this callback IS a subscriber.
        if (Object.keys(projectedTopology).length > 0) {
            MotionEngine.writeQuiet({
                topology: { anchors: projectedTopology }
            });
        }

        // 4. Render
        this.renderer.render(this.scene, this.camera);
    }

    private onResize() {
        const state = MotionEngine.read();
        const w = state.viewport.width || window.innerWidth;
        const h = state.viewport.height || window.innerHeight;
        this.camera.aspect = w / (h || 1);
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);

        // PERFORMANCE DOCTRINE: cap pixel ratio in degraded mode
        const maxPixelRatio = state.viewport.degradedMode ? 1 : Math.min(window.devicePixelRatio, 2);
        this.renderer.setPixelRatio(maxPixelRatio);
    }

    public dispose() {
        if (this.unsubscribeFn) this.unsubscribeFn();
        window.removeEventListener('resize', this.boundOnResize);

        // Dispose all loaded centerpieces (geometry + materials + textures)
        this.activeCenterpieces.forEach((centerpiece) => {
            this.scene.remove(centerpiece.getRootGroup());
            centerpiece.dispose();
        });
        this.activeCenterpieces.clear();

        // Dispose scene lights and remaining children
        while (this.scene.children.length > 0) {
            const child = this.scene.children[0];
            this.scene.remove(child);
        }

        // Release WebGL context — prevents GPU memory leaks on SPA navigation
        this.renderer.dispose();
        this.renderer.forceContextLoss();

        console.log('[WebGLSceneManager] 🛑 Disposed (context released)');
    }
}
