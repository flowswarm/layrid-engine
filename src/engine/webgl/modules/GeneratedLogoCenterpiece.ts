import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

// ─── Shared loader singleton (Rule 8: efficient resource usage) ──────────────
// All GeneratedLogoCenterpiece instances share one GLTFLoader/DRACOLoader pair,
// avoiding duplicate DRACO decoder initialization and memory overhead.
const sharedDracoLoader = new DRACOLoader();
sharedDracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.4.3/');

const sharedGLTFLoader = new GLTFLoader();
sharedGLTFLoader.setDRACOLoader(sharedDracoLoader);

export class GeneratedLogoCenterpiece {
    private meshGroup: THREE.Group = new THREE.Group();
    private anchorSocket: THREE.Object3D | null = null;
    private isLoaded = false;

    // Cached emissive material references — avoids per-frame traverse()
    private emissiveMaterials: THREE.MeshStandardMaterial[] = [];

    constructor() {
        // No per-instance loader allocation needed — uses module-level shared loader
    }

    /**
     * Load a GLB asset and add it to the mesh group.
     * If loading fails (no GLB on disk), creates a procedural demo centerpiece.
     * Always ensures TextAnchorSocket exists for anchor projection.
     */
    public async load(url: string): Promise<void> {
        try {
            const gltf = await sharedGLTFLoader.loadAsync(url);
            this.meshGroup.add(gltf.scene);
            this.isLoaded = true;

            // Discover TextAnchorSocket from the Blender export
            this.anchorSocket = this.findAnchorSocket(gltf.scene);

            if (this.anchorSocket) {
                console.log('[GeneratedLogoCenterpiece] ✅ TextAnchorSocket found in GLB');
            } else {
                // GLB exists but has no anchor — inject one at mesh center
                this.anchorSocket = this.createAnchorSocket();
                this.meshGroup.add(this.anchorSocket);
                console.log('[GeneratedLogoCenterpiece] ⚠️ No TextAnchorSocket in GLB — injected at center');
            }

            // Cache emissive-capable materials for efficient per-frame updates
            this.cacheEmissiveMaterials();

            console.log(`[GeneratedLogoCenterpiece] ✅ Loaded centerpiece from: ${url}`);
        } catch {
            // No GLB available — create procedural demo centerpiece
            this.createProceduralDemo();
            console.log('[GeneratedLogoCenterpiece] ✅ Procedural demo centerpiece created (no GLB)');
        }
    }

    /**
     * Creates a procedural demo centerpiece with a TextAnchorSocket.
     * Used when no GLB file exists on disk (e.g., before Blender MCP export).
     * Produces a visible, animatable 3D geometry for the full proof path.
     */
    private createProceduralDemo(): void {
        // Main body — an icosahedron with emissive material
        const bodyGeo = new THREE.IcosahedronGeometry(1.8, 1);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0x8b5cf6,
            emissive: 0x8b5cf6,
            emissiveIntensity: 0.3,
            metalness: 0.7,
            roughness: 0.25,
            flatShading: true
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        this.meshGroup.add(body);

        // Ring accent
        const ringGeo = new THREE.TorusGeometry(2.8, 0.06, 16, 64);
        const ringMat = new THREE.MeshStandardMaterial({
            color: 0x06b6d4,
            emissive: 0x06b6d4,
            emissiveIntensity: 0.5,
            metalness: 0.9,
            roughness: 0.1
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI * 0.5;
        this.meshGroup.add(ring);

        // Second ring at angle
        const ring2 = new THREE.Mesh(ringGeo.clone(), ringMat.clone());
        ring2.rotation.x = Math.PI * 0.35;
        ring2.rotation.z = Math.PI * 0.25;
        this.meshGroup.add(ring2);

        // TextAnchorSocket — positioned above the centerpiece (where header text should follow)
        this.anchorSocket = this.createAnchorSocket();
        this.meshGroup.add(this.anchorSocket);

        this.isLoaded = true;

        // Cache emissive-capable materials for efficient per-frame updates
        this.cacheEmissiveMaterials();
    }

    /**
     * Create a TextAnchorSocket empty object at the canonical offset.
     * Position matches the Blender export specification: (0, 0.8, 0.3).
     */
    private createAnchorSocket(): THREE.Object3D {
        const socket = new THREE.Object3D();
        socket.name = 'TextAnchorSocket';
        socket.position.set(0, 0.8, 0.3);
        return socket;
    }

    /**
     * Get the root group for scene attachment.
     */
    public getRootGroup(): THREE.Group {
        return this.meshGroup;
    }

    /**
     * Get the anchor socket position in world space.
     * Returns the socket position if found, otherwise returns mesh group center.
     */
    public getAnchorWorldPosition(): THREE.Vector3 {
        if (this.anchorSocket) {
            const pos = new THREE.Vector3();
            this.anchorSocket.getWorldPosition(pos);
            return pos;
        }
        return this.meshGroup.position.clone();
    }

    /**
     * Project the anchor socket to 2D screen coordinates.
     */
    public projectAnchorToScreen(camera: THREE.Camera, width: number, height: number): { x: number; y: number } | null {
        if (!this.isLoaded || width === 0 || height === 0) return null;

        const worldPos = this.getAnchorWorldPosition();
        const projected = worldPos.project(camera);

        return {
            x: (projected.x * 0.5 + 0.5) * width,
            y: (-projected.y * 0.5 + 0.5) * height
        };
    }

    /**
     * Whether the asset has been loaded (GLB or procedural).
     */
    public get loaded(): boolean {
        return this.isLoaded;
    }

    /**
     * Returns cached emissive materials for efficient per-frame intensity updates.
     * Avoids costly traverse() calls in WebGLSceneManager.
     */
    public getEmissiveMaterials(): THREE.MeshStandardMaterial[] {
        return this.emissiveMaterials;
    }

    /**
     * Walks the scene graph once to cache all MeshStandardMaterial refs
     * that have emissive capability. Called after load/creation.
     */
    private cacheEmissiveMaterials(): void {
        this.emissiveMaterials = [];
        this.meshGroup.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
                const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                for (const mat of mats) {
                    if (mat instanceof THREE.MeshStandardMaterial && mat.emissiveIntensity !== undefined) {
                        this.emissiveMaterials.push(mat);
                    }
                }
            }
        });
    }

    /**
     * Recursively find the TextAnchorSocket in the scene graph.
     */
    private findAnchorSocket(root: THREE.Object3D): THREE.Object3D | null {
        if (root.name === 'TextAnchorSocket') return root;
        for (const child of root.children) {
            const found = this.findAnchorSocket(child);
            if (found) return found;
        }
        return null;
    }

    /**
     * Dispose all GPU resources — geometries, materials, textures.
     */
    public dispose(): void {
        this.meshGroup.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
                obj.geometry?.dispose();
                if (Array.isArray(obj.material)) {
                    obj.material.forEach((mat) => {
                        this.disposeMaterial(mat);
                    });
                } else if (obj.material) {
                    this.disposeMaterial(obj.material);
                }
            }
        });

        while (this.meshGroup.children.length > 0) {
            this.meshGroup.remove(this.meshGroup.children[0]);
        }

        this.anchorSocket = null;
        this.isLoaded = false;
        this.emissiveMaterials = [];
        console.log('[GeneratedLogoCenterpiece] 🛑 Disposed');
    }

    private disposeMaterial(mat: THREE.Material): void {
        // Dispose all possible texture maps to release GPU memory
        const textureMaps = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'lightMap'] as const;
        for (const key of textureMaps) {
            if (key in mat && (mat as any)[key]) {
                (mat as any)[key].dispose();
            }
        }
        mat.dispose();
    }
}
