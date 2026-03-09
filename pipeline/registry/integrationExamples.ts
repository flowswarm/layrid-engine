/**
 * Refined Asset Registry Integration & Handoff Examples
 * ------------------------------------------------------------------
 * This demonstrates how the AssetRegistry perfectly manages variant 
 * lifecycles and provides bulletproof resolution to the runtime engine.
 */

import { AssetRegistry } from './AssetRegistry';

// App Singleton
const registry = new AssetRegistry();


/* =========================================================
   Example 1: Initial SVG Creation Workflow
   ========================================================= */
export function exampleInitialSVGBatch() {

    // 1. Admin UI Reserves the slot instantly before Blender boots (Draft State)
    const familyId = 'fam-acme-001';
    const draftAssetId = registry.draftAsset(familyId, 'client-acme', {
        sourceType: 'svg',
        materialPreset: 'chrome',
        compatibleSceneModes: ['logo-centerpiece'],
        isHeroEligible: true,
        supportsMotionAnchors: true
    });

    // 2. JobRunner picks it up, runs Blender, exports the GLB locally.
    // We attach the physical file to the Draft slot.
    registry.registerExportedFile(draftAssetId, '/models/clients/acme-chrome-v1.glb', 'acme-chrome-v1.glb');

    // Status is now artificially held at 'pending_approval'.
    // 3. The Art Director reviews it in the Admin Dashboard, clicks "Looks Good".
    registry.approveAndMakePrimary(draftAssetId);

    // Asset is now 'active' and officially the Primary Centerpiece for Acme.
    return draftAssetId;
}


/* =========================================================
   Example 2: Rerunning for a Matte Variant 
   ========================================================= */
export function exampleAlternateMaterialVariant(familyId: string, oldPrimaryId: string) {

    // The client decides Chrome is too shiny. They want Matte Plastic.
    // We draft a NEW asset, explicitly telling the registry it belongs to `fam-acme-001`.
    const newAssetId = registry.draftAsset(familyId, 'client-acme', {
        sourceType: 'svg',
        materialPreset: 'matte-plastic',
        compatibleSceneModes: ['logo-centerpiece'],
        isHeroEligible: true,
        supportsMotionAnchors: true
    });

    // Blender exports it
    registry.registerExportedFile(newAssetId, '/models/clients/acme-matte-v2.glb', 'acme-matte-v2.glb');

    // The Art Director approves this Matte version.
    // **Crucial Step**: Because we call `approveAndMakePrimary` on the SAME family:
    // 1. `/models/clients/acme-matte-v2.glb` is promoted to Primary.
    // 2. `/models/clients/acme-chrome-v1.glb` is automatically demoted to a Variant fallback.
    registry.approveAndMakePrimary(newAssetId);
}


/* =========================================================
   Example 3: WebGL Runtime Engine Resolving the Hero
   ========================================================= */
export function exampleEngineResolvesCenterpiece() {

    // 1. The Nuxt Content Normalizer asks the Registry for Acme's official 3D Logo.
    // It takes exactly O(1) time. It does not scan the file system.
    const heroAsset = registry.getPrimaryCenterpieceForSite('client-acme');

    if (heroAsset) {
        // 2. Because of Example 2, this instantly points to the Matte V2 version.
        // The CMS JSON never had to be updated to change the file path.
        console.log(heroAsset.runtimePath); // outputs: "/models/clients/acme-matte-v2.glb"

        // 3. We bundle the exact metadata the WebGL Module needs:
        return {
            sceneMode: heroAsset.compatibleSceneModes[0], // 'logo-centerpiece'
            centerpieceSource: heroAsset.runtimePath,
            enableAnchors: heroAsset.supportsMotionAnchors,
            materialLighting: heroAsset.materialPreset // The TemplateConfig knows to light "matte-plastic" softly
        };
    }
}
