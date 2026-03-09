import { z } from 'zod';

/**
 * Shared aesthetic constants for tight coupling with Template Config Controller
 */
const MATERIAL_PRESETS = ['brushed-metal', 'chrome', 'matte-plastic', 'glass', 'emissive-neon', 'flat-monochrome'] as const;
const SCENE_MODES = ['logo-centerpiece', 'ambient-particles', 'product-focus', 'gallery-planes'] as const;
const PIVOT_MODES = ['center_bounds', 'bottom_center', 'custom'] as const;
const SOURCE_TYPES = ['svg_upload', 'png_upload', 'text_generated'] as const;

export const AdminAssetRequestSchema = z.object({
    // ==========================================
    // 1. BRAND & IDENTIFICATION
    // ==========================================
    brandName: z.string().min(1, 'Brand name is required'),

    exportFilename: z.string()
        .regex(/^[a-z0-9-]+$/, 'Filename must be lowercase, alphanumeric, and hyphenated')
        .min(1, 'Export filename is required'),

    // ==========================================
    // 2. SOURCE MATERIAL
    // ==========================================
    sourceType: z.enum(SOURCE_TYPES),

    // Either an uploaded file ID/URL (for SVG/PNG) or the text string itself
    sourcePayload: z.string().min(1, 'Source payload is required'),

    // Optional font file ID/URL if sourceType === 'text_generated'
    fontPayload: z.string().optional(),

    // ==========================================
    // 3. GEOMETRY EXTRUSION & TOPOLOGY
    // ==========================================
    geometryExtrusionDepth: z.number().min(0.01).max(2.0).default(0.12),
    geometryBevelDepth: z.number().min(0).max(0.5).default(0.02),

    // Controls how the WebGL mesh origin is calculated before export
    geometryPivotMode: z.enum(PIVOT_MODES).default('center_bounds'),

    // Ensures the exported GLB is never larger than 2.0 WebGL units wide
    geometryNormalizeScale: z.boolean().default(true),

    // ==========================================
    // 4. CINEMATIC AESTHETICS (PBR Materials)
    // ==========================================
    aestheticMaterialPreset: z.enum(MATERIAL_PRESETS).default('chrome'),

    // Linear color space Hex codes (Three.js / Blender compatible)
    aestheticPrimaryColorHex: z.string().regex(/^#[0-9A-F]{6}$/i, 'Must be a valid Hex code').optional(),
    aestheticAccentColorHex: z.string().regex(/^#[0-9A-F]{6}$/i, 'Must be a valid Hex code').optional(),

    // ==========================================
    // 5. ENGINE INTEGRATION & RUNTIME BEHAVIOR
    // ==========================================
    runtimeSceneMode: z.enum(SCENE_MODES).default('logo-centerpiece'),

    // If true, registers this output as the primary centerpiece for the Content Normalizer Hero block
    runtimeIsHeroUsage: z.boolean().default(true),

    // If true, instructs WebGLManager to project the mesh's bounding box to 2D screen coordinates
    runtimeEnableAnchors: z.boolean().default(true),

    // ==========================================
    // 6. PIPELINE BATCH & VARIANT OPTIONS
    // ==========================================
    pipelineExportShaderReady: z.boolean().default(false), // Tells Blender to export Vertex Colors or custom UVs
    pipelineGenerateVariants: z.boolean().default(false),  // Triggers secondary exports (e.g. wireframe version)
    pipelineAdminNotes: z.string().max(1000).optional(),

}).superRefine((data, ctx) => {
    // Validate PNG usage (PNG requires pre-processing in the pipeline)
    if (data.sourceType === 'png_upload' && !data.pipelineExportShaderReady) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'PNG uploads are not recommended without Shader-Ready preparation due to alpha tracing complexity.',
            path: ['sourceType']
        });
    }
});

export type AdminAssetRequest = z.infer<typeof AdminAssetRequestSchema>;
