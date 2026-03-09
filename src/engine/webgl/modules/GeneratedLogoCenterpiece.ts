/**
 * src/engine/webgl/modules/GeneratedLogoCenterpiece.ts
 * 
 * 5. WEBGL SCENE MANAGER LOADS THE PREVIEW ASSET
 * 
 * WebGL acts as a pure renderer.
 * It is handed a string (`config.sourceMeshUrl`). 
 * It DOES NOT CARE if that string came from Production Deployment or a Staging Token.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
// import { MotionEngine } from '../../motion/SharedStateBus'; // Assuming existence

export class GeneratedLogoCenterpiece {
    private config: any;
    private scene: THREE.Scene;
    private meshGroup: THREE.Group = new THREE.Group();

    constructor(config: {
        sourceMeshUrl: string;
        environmentMap: string;
        ambientLightIntensity: number;
        previewState?: { isActive: boolean; baseLiveAssetId?: string; originState?: string }
    }, scene: THREE.Scene) {
        this.config = config;
        this.scene = scene;

        this.scene.add(this.meshGroup);
        this.scene.environment = new THREE.TextureLoader().load(config.environmentMap);

        const ambient = new THREE.AmbientLight(0xffffff, config.ambientLightIntensity);
        this.scene.add(ambient);

        // Example: Emitting a Vue Event allowing a Staging Panel to boot
        if (this.config.previewState?.isActive) {
            console.warn(`[WebGL] MOUNTING IN STAGING MODE. Unapproved Asset Active!`);
            // document.dispatchEvent(new CustomEvent('enable-preview-panel', { detail: this.config.previewState }));
        }
    }

    public async load() {
        const loader = new GLTFLoader();

        // Shows how WebGL Scene Manager loads the preview asset natively.
        // It is utterly decoupled from the routing logic.
        const gltf = await loader.loadAsync(this.config.sourceMeshUrl);

        this.meshGroup.add(gltf.scene);
        console.log(`[WebGL] Rendering masterpiece loaded from: ${this.config.sourceMeshUrl}`);
    }
}
