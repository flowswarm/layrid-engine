/**
 * src/engine/webgl/modules/GeneratedLogoCenterpiece.ts
 * 
 * The canonical centerpiece scene module for the Layrid flagship slice.
 * Loads a GLB asset when available, or creates a procedural demo mesh.
 * Always exposes TextAnchorSocket for 3D→2D projection.
 * Provides proper GPU resource cleanup.
 * 
 * WebGL acts as a pure renderer — it receives an asset URL and renders it.
 * It does NOT know whether the URL came from live, preview, or comparison.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

export class GeneratedLogoCenterpiece {
    private meshGroup: THREE.Group = new THREE.Group();
    private anchorSocket: THREE.Object3D | null = null;
    private loader: GLTFLoader;
    private isLoaded = false;

    constructor() {
        this.loader = new GLTFLoader();

        // Set up DRACO decoder for compressed GLBs
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.4.3/');
        this.loader.setDRACOLoader(dracoLoader);
    }

    /**
     * Load a GLB asset and add it to the mesh group.
     * If loading fails (no GLB on disk), creates a procedural demo centerpiece.
     * Always ensures TextAnchorSocket exists for anchor projection.
     */
    public async load(url: string): Promise<void> {
        try {
            const gltf = await this.loader.loadAsync(url);
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
        console.log('[GeneratedLogoCenterpiece] 🛑 Disposed');
    }

    private disposeMaterial(mat: THREE.Material): void {
        if ('map' in mat && (mat as any).map) (mat as any).map.dispose();
        if ('normalMap' in mat && (mat as any).normalMap) (mat as any).normalMap.dispose();
        if ('roughnessMap' in mat && (mat as any).roughnessMap) (mat as any).roughnessMap.dispose();
        if ('metalnessMap' in mat && (mat as any).metalnessMap) (mat as any).metalnessMap.dispose();
        if ('emissiveMap' in mat && (mat as any).emissiveMap) (mat as any).emissiveMap.dispose();
        mat.dispose();
    }
}
