/**
 * src/engine/core/templateConfigController.ts
 * 
 * LAYER A — Template Config Controller
 * Codex §Rule 6: Config remains centralized.
 * 
 * All global visual and motion personality resolves through here.
 * Supports: defaults, presets, client overrides, section overrides,
 * breakpoint overrides, validation, and fallbacks.
 */

// ==========================================
// CONFIG TYPES
// ==========================================

export interface MotionPersonality {
    scrollEasing: number;
    typographyScale: number;
    parallaxIntensity: number;
    transitionDuration: number;
    anchorFollowSmoothing: number;
}

export interface SceneVisuals {
    ambientLightIntensity: number;
    environmentMap: string;
    mountComponent: string;
    sourceMeshUrl: string | null;
    broadcastAnchors: boolean;
}

export interface TemplateConfig {
    motion: MotionPersonality;
    scene: SceneVisuals;
    previewState: { isActive: boolean };
    approvalState: { isActive: boolean };
    comparisonState: { isActive: boolean; candidates?: string[] };
}

type Breakpoint = 'desktop' | 'tablet' | 'mobile';

// ==========================================
// PRESET LIBRARY
// ==========================================

const MOTION_DEFAULTS: MotionPersonality = {
    scrollEasing: 0.1,
    typographyScale: 1.0,
    parallaxIntensity: 1.0,
    transitionDuration: 800,
    anchorFollowSmoothing: 0.15
};

const MOTION_PRESETS: Record<string, Partial<MotionPersonality>> = {
    cinematic: {
        scrollEasing: 0.06,
        typographyScale: 1.2,
        parallaxIntensity: 1.4,
        transitionDuration: 1200
    },
    minimal: {
        scrollEasing: 0.15,
        typographyScale: 0.9,
        parallaxIntensity: 0.5,
        transitionDuration: 400
    },
    energetic: {
        scrollEasing: 0.12,
        typographyScale: 1.1,
        parallaxIntensity: 1.8,
        transitionDuration: 600
    }
};

const BREAKPOINT_OVERRIDES: Record<Breakpoint, Partial<MotionPersonality>> = {
    desktop: {},
    tablet: {
        parallaxIntensity: 0.7,
        typographyScale: 0.95
    },
    mobile: {
        parallaxIntensity: 0.3,
        typographyScale: 0.85,
        transitionDuration: 500,
        scrollEasing: 0.15
    }
};

const SCENE_DEFAULTS: Omit<SceneVisuals, 'sourceMeshUrl'> = {
    ambientLightIntensity: 1.0,
    environmentMap: '/hdris/soft-box.hdr',
    mountComponent: 'DefaultScene',
    broadcastAnchors: true
};

// ==========================================
// TEMPLATE CONFIG CONTROLLER
// ==========================================

export class TemplateConfigController {

    /**
     * Resolves the full template config from layered sources.
     * Priority (highest wins): section overrides > client overrides > breakpoint > preset > defaults
     */
    public resolve(options: {
        normalizedSectionData: any;
        presetName?: string;
        breakpoint?: Breakpoint;
        clientOverrides?: Partial<MotionPersonality>;
        sectionOverrides?: Partial<MotionPersonality>;
    }): TemplateConfig {

        const webglCtx = options.normalizedSectionData?.webgl;

        // 1. Start from defaults
        let motion = { ...MOTION_DEFAULTS };

        // 2. Apply named preset
        if (options.presetName && MOTION_PRESETS[options.presetName]) {
            motion = { ...motion, ...MOTION_PRESETS[options.presetName] };
        }

        // 3. Apply breakpoint overrides
        if (options.breakpoint && BREAKPOINT_OVERRIDES[options.breakpoint]) {
            motion = { ...motion, ...BREAKPOINT_OVERRIDES[options.breakpoint] };
        }

        // 4. Apply client-level overrides
        if (options.clientOverrides) {
            motion = { ...motion, ...options.clientOverrides };
        }

        // 5. Apply section-level overrides (highest priority)
        if (options.sectionOverrides) {
            motion = { ...motion, ...options.sectionOverrides };
        }

        // 6. Validate bounds (fallback safety)
        motion = this.validate(motion);

        // 7. Resolve scene visuals from the material preset
        const scene = this.resolveSceneVisuals(webglCtx);

        return {
            motion,
            scene,
            previewState: webglCtx?.__previewState ?? { isActive: false },
            approvalState: webglCtx?.__approvalState ?? { isActive: false },
            comparisonState: webglCtx?.__comparisonState ?? { isActive: false }
        };
    }

    /**
     * Resolves WebGL scene configuration from material presets.
     */
    private resolveSceneVisuals(webglCtx: any): SceneVisuals {
        if (!webglCtx) {
            return { ...SCENE_DEFAULTS, sourceMeshUrl: null };
        }

        let ambientLightIntensity = SCENE_DEFAULTS.ambientLightIntensity;
        let environmentMap = SCENE_DEFAULTS.environmentMap;

        switch (webglCtx.materialPreset) {
            case 'chrome':
            case 'glass':
                ambientLightIntensity = 0.2;
                environmentMap = '/hdris/studio-high-contrast.hdr';
                break;
            case 'matte-plastic':
                ambientLightIntensity = 1.2;
                break;
            case 'emissive-neon':
                ambientLightIntensity = 0.05;
                break;
        }

        return {
            mountComponent: webglCtx.sceneMode === 'logo-centerpiece'
                ? 'GeneratedLogoCenterpiece'
                : 'DefaultScene',
            ambientLightIntensity,
            environmentMap,
            sourceMeshUrl: webglCtx.centerpieceSource ?? null,
            broadcastAnchors: webglCtx.enableAnchors ?? true
        };
    }

    /**
     * Validates motion config with safe fallback bounds.
     */
    private validate(motion: MotionPersonality): MotionPersonality {
        return {
            scrollEasing: clamp(motion.scrollEasing, 0.01, 0.5),
            typographyScale: clamp(motion.typographyScale, 0.5, 3.0),
            parallaxIntensity: clamp(motion.parallaxIntensity, 0, 3.0),
            transitionDuration: clamp(motion.transitionDuration, 100, 3000),
            anchorFollowSmoothing: clamp(motion.anchorFollowSmoothing, 0.01, 1.0)
        };
    }
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

// ==========================================
// LEGACY FUNCTION API (backward compatible)
// ==========================================

const controller = new TemplateConfigController();

/**
 * @deprecated Use TemplateConfigController.resolve() directly
 */
export function resolveWebGLSceneConfig(normalizedSectionData: any) {
    const config = controller.resolve({ normalizedSectionData });
    return {
        mountComponent: config.scene.mountComponent,
        ambientLightIntensity: config.scene.ambientLightIntensity,
        environmentMap: config.scene.environmentMap,
        sourceMeshUrl: config.scene.sourceMeshUrl,
        broadcastAnchors: config.scene.broadcastAnchors,
        previewState: config.previewState
    };
}
