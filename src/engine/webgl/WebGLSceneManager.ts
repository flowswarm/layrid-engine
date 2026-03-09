import * as THREE from 'three';
import { MotionEngine, MotionEngineState } from '../runtime/MotionEngine';
import { GeneratedLogoCenterpiece } from './modules/GeneratedLogoCenterpiece';

/**
 * WebGLSceneManager
 * 
 * Subscriber/Publisher bound to MotionEngine.
 * Delegates asset loading to GeneratedLogoCenterpiece (GLB with DRACO, or procedural fallback).
 * Natively handles live, preview, and comparison contexts — only assetIds differ.
 * 
 * Responsibilities:
 *   ✅ Initialize scene/camera/renderer/lights
 *   ✅ Load resolved centerpiece asset(s) via syncAssetContext()
 *   ✅ React to MotionEngine spatial/transition/context state
 *   ✅ Publish anchor coordinates into MotionEngine topology.anchors
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
    private async syncAssetContext(assetIds: string[]) {
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

            // GeneratedLogoCenterpiece.load() will try the GLB first,
            // and fall back to a procedural mesh if it doesn't exist.
            const url = id === '__demo__' ? '/cdn/assets/__nonexistent__.glb' : `/cdn/assets/${id}.glb`;
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
    }

    /**
     * MotionEngine subscriber callback — the ONLY update mechanism.
     * Reads spatial state, animates centerpieces, projects anchors, renders.
     */
    private onEngineTicked(state: MotionEngineState) {
        // PERFORMANCE DOCTRINE: Halt ThreeJS on mobile degradation
        if (state.viewport.degradedMode) return;

        // 1. Detect Context Changes (or first tick via sentinel)
        const currentIds = state.context.assetIds;
        const currentKey = currentIds.length > 0 ? currentIds.join(',') : '__demo__';
        const prevKey = this.previousAssetIds.join(',');
        if (currentKey !== prevKey) {
            this.syncAssetContext(currentIds);
            this.previousAssetIds = currentIds.length > 0 ? [...currentIds] : ['__demo__'];
        }

        const p = state.spatial.smoothedProgress;
        const v = state.spatial.velocity;
        const projectedTopology: Record<string, { x: number, y: number }> = {};

        // 2. Animate and Extract Topologies — CINEMATIC HERO MOTION
        this.activeCenterpieces.forEach((centerpiece, id) => {
            const group = centerpiece.getRootGroup();

            // A. Rotation: smooth full-range rotation synced to scroll
            group.rotation.y = p * Math.PI;

            // B. Parallax depth: subtle Z-axis drift for looming presence
            group.position.z = Math.sin(p * Math.PI) * 2;

            // C. Scale breathing: subtle pulsing that adds life
            const breathe = 1.0 + Math.sin(p * Math.PI * 2) * 0.05;
            group.scale.setScalar(breathe);

            // D. Velocity-reactive tilt: mesh tilts slightly based on scroll speed
            const tiltX = Math.min(Math.max(v * 8, -0.15), 0.15);
            group.rotation.x = tiltX;

            // E. Emphasis emissive glow on active section
            const heroSection = state.sections['hero-primary'];
            if (heroSection && heroSection.state === 'active') {
                group.traverse((child) => {
                    if (child instanceof THREE.Mesh && child.material) {
                        const mat = child.material as THREE.MeshStandardMaterial;
                        if (mat.emissiveIntensity !== undefined) {
                            mat.emissiveIntensity = 0.3 + heroSection.progress * 0.4;
                        }
                    }
                });
            }

            // Anchor Projection — delegated to GeneratedLogoCenterpiece
            const projected = centerpiece.projectAnchorToScreen(
                this.camera, state.viewport.width, state.viewport.height
            );

            if (projected) {
                const anchorKey = this.activeCenterpieces.size > 1 ? `headerFollow_${id}` : 'headerFollow';
                projectedTopology[anchorKey] = projected;
            }
        });

        // 3. Write projected topologies to MotionEngine
        if (Object.keys(projectedTopology).length > 0) {
            MotionEngine.write({
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
    }

    public dispose() {
        if (this.unsubscribeFn) this.unsubscribeFn();
        window.removeEventListener('resize', this.boundOnResize);

        this.activeCenterpieces.forEach((centerpiece) => {
            this.scene.remove(centerpiece.getRootGroup());
            centerpiece.dispose();
        });
        this.activeCenterpieces.clear();

        this.renderer.dispose();
        console.log('[WebGLSceneManager] 🛑 Disposed');
    }
}
