import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MotionEngine, MotionEngineState } from '../runtime/MotionEngine';

/**
 * PART 3: Build WebGL Scene Manager
 * PART 4: Implement Anchor Projection System
 * 
 * Binds the 3D generation hardware to the continuity state.
 * Fully supports side-by-side array loading for 'comparison' contexts.
 */
export class WebGLSceneManager {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private gltfLoader: GLTFLoader;

    // Arrays support comparison context isolation
    private activeCenterpieces: Map<string, THREE.Group> = new Map();
    private previousAssetIds: string[] = [];

    private unsubscribeFn: (() => void) | null = null;
    private boundOnResize: () => void;

    constructor(canvas: HTMLCanvasElement) {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.z = 12;

        this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        this.gltfLoader = new GLTFLoader();
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
        this.scene.add(ambient, dirLight);
    }

    /**
     * Natively handles Live, Preview, and Comparison network payload fetches
     */
    private async syncAssetContext(assetIds: string[]) {
        for (const [id, mesh] of this.activeCenterpieces.entries()) {
            if (!assetIds.includes(id)) {
                this.scene.remove(mesh);
                this.activeCenterpieces.delete(id);
            }
        }

        const loadPromises = assetIds.map(async (id, index) => {
            if (this.activeCenterpieces.has(id)) return;
            try {
                // In a production backend, this resolves via AssetRegistry
                const gltf = await this.gltfLoader.loadAsync(`/cdn/assets/${id}.glb`);
                const mesh = gltf.scene;

                // If Comparison Mode yields 2 assets, stagger them physically
                if (assetIds.length > 1) {
                    mesh.position.x = index === 0 ? -3 : 3;
                }

                this.scene.add(mesh);
                this.activeCenterpieces.set(id, mesh);
            } catch (err) {
                console.error(`Missing GLB Hash Structure: ${id}`, err);
            }
        });

        await Promise.all(loadPromises);
    }

    /**
     * Bounded strictly by requestAnimationFrame natively through the Motion Engine core
     */
    private onEngineTicked(state: MotionEngineState) {
        // PERFORMANCE DOCTRINE: Halt ThreeJS calculations completely on Mobile Degradation boundaries
        if (state.viewport.degradedMode) return;

        // 1. Detect Context Changes 
        const currentIds = state.context.assetIds;
        if (currentIds.join(',') !== this.previousAssetIds.join(',')) {
            this.syncAssetContext(currentIds);
            this.previousAssetIds = [...currentIds];
        }

        const p = state.spatial.smoothedProgress;
        const v = state.spatial.velocity;
        const projectedTopology: Record<string, { x: number, y: number }> = {};

        // 2. Animate and Extract Topologies — CINEMATIC HERO MOTION
        this.activeCenterpieces.forEach((mesh, id) => {
            // A. Rotation: smooth full-range rotation synced to scroll
            mesh.rotation.y = p * Math.PI;

            // B. Parallax depth: subtle Z-axis drift for looming presence
            mesh.position.z = Math.sin(p * Math.PI) * 2;

            // C. Scale breathing: subtle pulsing that adds life
            const breathe = 1.0 + Math.sin(p * Math.PI * 2) * 0.05;
            mesh.scale.setScalar(breathe);

            // D. Velocity-reactive tilt: mesh tilts slightly based on scroll speed
            const tiltX = Math.min(Math.max(v * 8, -0.15), 0.15);
            mesh.rotation.x = tiltX;

            // E. Emphasis emissive glow on active section
            const heroSection = state.sections['hero-primary'];
            if (heroSection && heroSection.state === 'active') {
                mesh.traverse((child) => {
                    if (child instanceof THREE.Mesh && child.material) {
                        const mat = child.material as THREE.MeshStandardMaterial;
                        if (mat.emissiveIntensity !== undefined) {
                            mat.emissiveIntensity = 0.3 + heroSection.progress * 0.4;
                        }
                    }
                });
            }

            // PART 4: Anchor Projection System
            const anchorSocket = mesh.getObjectByName('TextAnchorSocket');

            if (anchorSocket) {
                const vector = new THREE.Vector3();
                anchorSocket.getWorldPosition(vector);

                // Project 3D world position to normalized device coordinates
                vector.project(this.camera);

                // Map normalized [-1, 1] to absolute screen pixel coordinates
                const px = (vector.x * 0.5 + 0.5) * state.viewport.width;
                const py = (vector.y * -0.5 + 0.5) * state.viewport.height;

                const anchorKey = this.activeCenterpieces.size > 1 ? `headerFollow_${id}` : 'headerFollow';
                projectedTopology[anchorKey] = { x: px, y: py };
            }
        });

        // 3. Write Screen Bounding Topologies back to the Common HTML DOM 
        if (Object.keys(projectedTopology).length > 0) {
            MotionEngine.write({
                topology: { anchors: projectedTopology }
            });
        }

        // 4. Force Canvas Paint
        this.renderer.render(this.scene, this.camera);
    }

    private onResize() {
        const state = MotionEngine.read();
        this.camera.aspect = state.viewport.width / (state.viewport.height || 1);
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(state.viewport.width, state.viewport.height);
    }

    public dispose() {
        if (this.unsubscribeFn) this.unsubscribeFn();
        window.removeEventListener('resize', this.boundOnResize);

        // Dispose all loaded meshes
        this.activeCenterpieces.forEach((mesh) => {
            mesh.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    child.geometry?.dispose();
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material?.dispose();
                    }
                }
            });
            this.scene.remove(mesh);
        });
        this.activeCenterpieces.clear();

        this.renderer.dispose();
        console.log('[WebGLSceneManager] 🛑 Disposed');
    }
}
