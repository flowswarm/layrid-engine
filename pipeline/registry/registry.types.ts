import { z } from 'zod';

/**
 * 1. ARCHITECTURE SUMMARY
 * 
 * The Asset Registry is the immutable source of truth bridging the backend 
 * generation pipelines to the frontend cinematic engine.
 * 
 * Refinements:
 * - "Variants" vs "Primary" is now strictly enforced at the Family level.
 * - Approval Lifecycle explicitly added for Client review workflows.
 * - Runtime resolution URLs are split to support CDNs and local pathing cleanly.
 */

// ==========================================
// 2. STRICT LIFECYCLES & ENUMS
// ==========================================
export const AssetStatusEnum = z.enum([
    'draft',            // Pre-generation placeholder (UI reservation)
    'generating',       // Pipeline is actively writing the file
    'pending_approval', // File exists, awaiting Art Director or Client review
    'active',           // Approved. Live and resolving on the frontend
    'archived',         // Deprecated variant (kept for rollback)
    'failed'            // Generation pipeline crashed for this asset
]);

export type AssetStatus = z.infer<typeof AssetStatusEnum>;

export const AssetTypeEnum = z.enum([
    'centerpiece_mesh', // The core .glb/gltf 3D object
    'environment_map',  // A generated HDR texture
    'baked_texture'     // Pre-computed lighting maps
]);

export const SourceTypeEnum = z.enum(['svg', 'text', 'png']);

// ==========================================
// 3. EXACT FINAL ASSET RECORD SCHEMA
// ==========================================
// A single, physical artifact derived from the pipeline.
export const AssetRecordSchema = z.object({
    // --- IDENTIFIERS ---
    assetId: z.string().uuid(),
    assetFamilyId: z.string().uuid(), // The relational bond tying variants together
    clientId: z.string().min(1, 'Client/Site ID is required'),

    // --- SCENE BINDING ---
    sceneRole: z.string().default('hero-centerpiece').describe('The runtime scene role this asset fulfills'),

    // --- PROVENANCE ---
    sourceJobId: z.string().uuid().optional(), // Nullable if manually imported
    sourceRequestId: z.string().uuid().optional().describe('Original admin request that triggered generation'),
    sourceType: SourceTypeEnum.describe('How this asset was originally created'),

    // --- RUNTIME RESOLUTION ---
    exportFilename: z.string().min(1),
    runtimePath: z.string().min(1).describe('The absolute or CDN path the WebGL loader fetches'),

    // --- ENGINE META ---
    assetType: AssetTypeEnum.default('centerpiece_mesh'),
    materialPreset: z.string().describe('e.g., chrome, matte-plastic, glass'),

    // --- COMPATIBILITY & INTEGRATION FLAGS ---
    compatibleSceneModes: z.array(z.string()).min(1).default(['logo-centerpiece']),
    isHeroEligible: z.boolean().default(true).describe('Can the Template Config boot this as the main page feature?'),
    supportsMotionAnchors: z.boolean().default(true).describe('Does this mesh project its 2D coordinates to the Motion Engine?'),

    // --- LIFECYCLE ---
    status: AssetStatusEnum.default('draft'),
    createdAt: z.date(),
    updatedAt: z.date(),
    approvedAt: z.date().optional(),

    adminNotes: z.string().max(2000).optional()
});

export type AssetRecord = z.infer<typeof AssetRecordSchema>;

// ==========================================
// 4. EXACT FINAL MANIFEST STRUCTURE
// ==========================================
// The normalized Database layout ensuring O(1) query performance
// for the Content Normalizer checking the active "Hero" per client.
export const AssetManifestSchema = z.object({
    manifestVersion: z.number().default(2),
    lastSynchronizedAt: z.date(),

    // Table 1: Absolute lookup of every physical asset file
    assetsRecords: z.record(z.string(), AssetRecordSchema),

    // Table 2: The relational map defining the "State of the Engine" per Client
    families: z.record(z.string(), z.object({
        clientId: z.string(),
        primaryAssetId: z.string().nullable().describe('The currently LIVE asset for this family'),
        variantAssetIds: z.array(z.string()).describe('All alternate material/geometry versions'),
        familyTags: z.array(z.string()).optional()
    }))
});

export type AssetManifest = z.infer<typeof AssetManifestSchema>;
