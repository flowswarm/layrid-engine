import { useMotionEngine } from '../composables/useMotionEngine';
import { GeneratedLogoCenterpiece } from './modules/GeneratedLogoCenterpiece';

export class WebGLSceneManager {
    private activeModule: any = null;
    private canvas: HTMLCanvasElement;
    private registry = new Map<string, any>();

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        // ... setup Threejs renderer, camera, scene ...

        // Register our Blender MCP Pipeline viewer
        this.registry.set('logo-centerpiece', GeneratedLogoCenterpiece);

        // Other generic scenes
        // this.registry.set('ambient-particles', AmbientParticlesModule);
    }

    /**
     * The Template Config Controller tells us what scene to run.
     * If it passes down a 'logo-centerpiece' and an assetUrl, we fetch the Pipeline GLB.
     */
    public async setSceneMode(modeIdentifier: string, glbAssetUrl: string | null) {
        if (this.activeModule) {
            this.activeModule.dispose();
        }

        const ModuleClass = this.registry.get(modeIdentifier);
        if (ModuleClass) {
            this.activeModule = new ModuleClass();

            // Pass down the MCP generated url (e.g. `/models/acme-centerpiece.glb`)
            await this.activeModule.onActivate(glbAssetUrl /*, this.scene, this.camera */);
        }
    }

    /**
     * Connect to the Global Bus
     */
    public bindToMotionEngine() {
        const motionEngine = useMotionEngine();

        const tick = () => {
            // 1. Let the active WebGL scene read the shared bus
            // 2. The scene will update camera, rotate the GLB, and optionally publish Anchors
            if (this.activeModule) {
                this.activeModule.update(motionEngine);
            }

            // ... render frame ...
            requestAnimationFrame(tick);
        };

        tick();
    }
}
