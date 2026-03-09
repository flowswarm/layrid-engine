/**
 * Admin Request Payload Flow & Integration Architecture
 * ------------------------------------------------------------------
 * This document defines the exact contract between the Admin UI, 
 * the Blender MCP Pipeline, and the cinematic runtime engine.
 */

import { AdminAssetRequest } from '../schemas/adminRequest.schema';
import { LogoGenerationRequest } from '../../pipeline/schemas/generation.types';

/* =========================================================
   Concrete Example 1: SVG Upload -> Chrome Centerpiece
   ========================================================= */

// 1. The Admin Submits this form payload:
export const exampleSVGRequest: AdminAssetRequest = {
    brandName: 'Acme Studio',
    exportFilename: 'acme-hero',

    sourceType: 'svg_upload',
    sourcePayload: 'db-uuid-8f921a-acme.svg', // ID of the file uploaded to the CMS

    geometryExtrusionDepth: 0.15,
    geometryBevelDepth: 0.02,
    geometryPivotMode: 'center_bounds',
    geometryNormalizeScale: true,

    aestheticMaterialPreset: 'chrome',

    runtimeSceneMode: 'logo-centerpiece',
    runtimeIsHeroUsage: true,
    runtimeEnableAnchors: true,

    pipelineExportShaderReady: false,
    pipelineGenerateVariants: false
};

// 2. The Normalizer maps it to the exact Blender MCP execution payload:
export const exampleSVGNormalizedPayload: LogoGenerationRequest = {
    inputType: 'svg',
    sourcePayload: '/uploads/secure-bucket/db-uuid-8f921a-acme.svg', // Resolved to absolute path

    extrusionDepth: 0.15,
    bevelDepth: 0.02,
    bevelResolution: 8, // Strictly mapped from 'chrome' requirements

    materialPreset: 'chrome',
    targetFilename: 'acme-hero'
};

// 3. The WebGL Scene Manager & Content Normalizer receive this DB output:
export const exampleSVGDatabaseResult = {
    id: 'hero-01',
    type: 'hero',
    webgl: {
        sceneMode: 'logo-centerpiece',    // from `runtimeSceneMode`
        centerpieceSource: '/models/acme-hero.glb', // from MCP output filename
        enableAnchors: true               // from `runtimeEnableAnchors`
    }
};


/* =========================================================
   Concrete Example 2: Text Generated -> Matte Plastic Centerpiece
   ========================================================= */

// 1. The Admin Submits this form payload (No file upload needed!):
export const exampleTextRequest: AdminAssetRequest = {
    brandName: 'VORTEX',
    exportFilename: 'vortex-wordmark',

    sourceType: 'text_generated',
    sourcePayload: 'VORTEX', // The actual word to physically generate
    fontPayload: 'Inter-Black.ttf', // Optional custom typography

    geometryExtrusionDepth: 0.25, // Chunky physical depth
    geometryBevelDepth: 0.05,     // Soft rounded edges
    geometryPivotMode: 'bottom_center', // Useful if placing the text on a 3D glass floor
    geometryNormalizeScale: true,

    aestheticMaterialPreset: 'matte-plastic',
    aestheticPrimaryColorHex: '#FF3366', // Deep neon pink

    runtimeSceneMode: 'logo-centerpiece',
    runtimeIsHeroUsage: true,
    runtimeEnableAnchors: true,

    pipelineExportShaderReady: false,
    pipelineGenerateVariants: true // Triggers a second 'wireframe' export
};

// 2. The Normalizer maps it:
export const exampleTextNormalizedPayload: LogoGenerationRequest = {
    inputType: 'text',
    sourcePayload: 'VORTEX',

    extrusionDepth: 0.25,
    bevelDepth: 0.05,
    bevelResolution: 4,

    materialPreset: 'matte-plastic',
    brandColorHex: '#FF3366',

    targetFilename: 'vortex-wordmark'
};

// 3. The Backend DB output consumed by the Frontend Engine:
export const exampleTextDatabaseResult = {
    id: 'hero-01',
    type: 'hero',
    webgl: {
        sceneMode: 'logo-centerpiece',
        centerpieceSource: '/models/vortex-wordmark.glb',
        ambientIntensity: 1.2, // Config controller boosts this slightly for matte materials
        enableAnchors: true
    }
};

/**
 * FUTURE EXTENSION: BATCHING & PRESETS
 * -------------------
 * Because the Schema is decoupled from the Vue UI, you can write an automation 
 * script to ingest 50 client logos at once:
 * 
 * const clients = fetchClients();
 * clients.forEach(c => {
 *   const req = AdminAssetRequestSchema.parse({
 *     brandName: c.name,
 *     exportFilename: `${c.slug}-3d`,
 *     sourceType: 'svg_upload', ...
 *     materialPreset: 'chrome' // Apply default preset to all batch items
 *   });
 *   await MCPOchestrator.queue(normalizeAdminRequest(req));
 * });
 */
