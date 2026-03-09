import { AdminAssetRequest } from '../schemas/adminRequest.schema';
import { LogoGenerationRequest } from '../../pipeline/schemas/generation.types';

export function normalizeAdminRequest(request: AdminAssetRequest): LogoGenerationRequest {
    /**
     * The strict translation layer between human-friendly Admin submissions
     * and the highly specific Blender MCP Python execution arguments.
     */

    // 1. Resolve source payload based on input type
    // A 'text' input is raw text, but SVGs/PNGs are resolved to absolute backend storage paths
    let resolvedSource = request.sourcePayload;

    if (request.sourceType === 'svg_upload' || request.sourceType === 'png_upload') {
        // In a real implementation: `await StorageService.getSignedUrl(request.sourcePayload)`
        resolvedSource = `/uploads/secure-bucket/${request.sourcePayload}`;
    }

    // 2. Map aesthetic constraints to Blender's specific node inputs
    // Chrome requires higher bevel resolution for clean reflections than matte
    const requiresHighResBevel = ['chrome', 'glass'].includes(request.aestheticMaterialPreset);

    // 3. Map Geometry Preferences
    // If the admin wants the object bottom-aligned for a floor reflection scene, we handle that here.
    // The MCP Python script reads this and sets Origin to Bottom instead of Center Bounds.
    const originMode = request.geometryPivotMode;

    // 4. Construct the strict, automated payload
    const pipelinePayload: LogoGenerationRequest = {
        inputType: request.sourceType === 'text_generated' ? 'text' :
            request.sourceType === 'svg_upload' ? 'svg' : 'png',

        sourcePayload: resolvedSource,

        extrusionDepth: request.geometryExtrusionDepth,
        bevelDepth: request.geometryBevelDepth,
        bevelResolution: requiresHighResBevel ? 8 : 4,

        materialPreset: request.aestheticMaterialPreset,
        brandColorHex: request.aestheticPrimaryColorHex || undefined,

        // Future: fontPath mapping if requested

        targetFilename: request.exportFilename,
    };

    return pipelinePayload;
}
