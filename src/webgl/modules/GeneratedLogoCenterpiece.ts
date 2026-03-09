import * as THREE from 'three';
import { BaseSceneModule } from './BaseSceneModule';

export class GeneratedLogoCenterpiece extends BaseSceneModule {
    private logoMesh!: THREE.Object3D;
    private topRightCorner = new THREE.Vector3();
    private worldTrackingPos = new THREE.Vector3();

    /**
     * WIRING POINT 4: The Module mounts the exact Blender Pipeline GLB output
     */
    public async onActivate(assetUrl: string, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
        super.onActivate(scene, camera);

        // 1. Fetch the GLB the MCP Pipeline generated (Cached)
        // Note: Assuming AssetLoader is imported correctly in real app
        // const gltf = await AssetLoader.loadGLTF(assetUrl);

        // (Mocking the GLTF response for architecture demonstration)
        const gltf = { scene: new THREE.Group() };
        const mockMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 0.5));
        mockMesh.name = 'HeroMesh';
        gltf.scene.add(mockMesh);

        // 2. Extract strictly-named mesh (Pipeline guarantees this name!)
        this.logoMesh = gltf.scene.getObjectByName('HeroMesh')!;

        if (this.logoMesh) {
            // Drop perfectly into the center of the WebGL stage
            this.group.add(this.logoMesh);

            // Find the top right of the generated 3D bounding box for Anchor tracking
            const bbox = new THREE.Box3().setFromObject(this.logoMesh);
            this.topRightCorner.set(bbox.max.x, bbox.max.y, 0);
        }
    }

    /**
     * Standard 60fps Loop
     */
    public update(state: any) {
        if (!this.logoMesh) return;

        // WIRING POINT 4: Read flawlessly smoothed Lerp from the Motion Engine!
        const heroProgress = state.getSectionProgress('hero').value;

        // Cinematic Interaction: The logo rotates smoothly as the user scrolls
        this.logoMesh.rotation.y = heroProgress * (Math.PI * 2);
        this.logoMesh.position.z = heroProgress * -3;

        // WIRING POINT 5: Publish Anchor Coordinates to Shared Bus

        // 1. Find where local corner is in 3D world space *right now* as it rotates
        this.logoMesh.localToWorld(this.worldTrackingPos.copy(this.topRightCorner));

        // 2. Transform 3D world vector into 2D CSS screen (x, y) pixels
        const { x, y } = this.projectToScreen(this.worldTrackingPos);

        // 3. Publish to State Bus so Typography <CinematicText> can lock onto it!
        state.publishAnchor('logo-top-right', x, y, 1.0, true);
    }
}
