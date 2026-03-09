import { NormalizedSection } from '../types/content.types';

export function useTemplateConfig() {
    /**
     * The Template Config Controller dictates the "mood" and "physics" 
     * of the 3D scene that the MCP Pipeline created.
     * 
     * While the Normalizer just holds the URL (`/models/acme-centerpiece.glb`), 
     * the Config Controller defines *how* it should look and act in the WebGL scene.
     */
    const resolveWebGLConfig = (globalTheme: any, sectionData: NormalizedSection) => {
        // 1. Fallbacks if CMS omitted data
        const isHero = sectionData.type === 'hero';
        const defaultMode = isHero ? 'ambient-particles' : 'none';

        // 2. WIRING POINT 2: Select the sceneMode and apply physical/lighting overrides
        return {
            sceneMode: sectionData.webgl?.sceneMode || defaultMode,

            // Pass the fully baked MCP Pipeline asset URL down the chain
            assetUrl: sectionData.webgl?.centerpieceSource || null,

            // Aesthetic overrides (e.g. increase exposure if global theme is "neon")
            bloomIntensity: globalTheme.aesthetic === 'neon' ? 1.5 : 0.0,
            lightIntensity: sectionData.webgl?.ambientIntensity || 1.0,

            // Let the WebGL know if it needs to override the Blender materials
            materialOverride: sectionData.webgl?.materialOverride || null,
        };
    };

    return { resolveWebGLConfig };
}
