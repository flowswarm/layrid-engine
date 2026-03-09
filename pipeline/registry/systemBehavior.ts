/**
 * Asset Registry Runtime Exclusions & Variant Swapping Logic
 * ------------------------------------------------------------------
 * 
 * Because the Content Normalizer exclusively relies on `AssetRegistry`, 
 * the CMS layout structures NEVER need to be manually updated when assets fail,
 * are rejected by clients, or when variants are swapped.
 */

/* =========================================================
   1. EXCLUDING FAILED & ARCHIVED ASSETS
   ========================================================= */
// Imagine a batch job processing 10 client SVG logos overnight.
// 9 succeed and write `.glb` files. 1 fails because the SVG was corrupt.

// The Asset Record for the failure is flagged:
/*
  {
    assetId: "ast-010-failed",
    status: "failed", // Handled by JobRunner try/catch
    ...
  }
*/

// THE ENGINE BEHAVIOR:
// When the site spins up the next morning, `contentNormalizer.ts` calls:
// `globalAssetRegistry.getPrimaryCenterpieceForSite('client-10-corrupt')`
// 
// Internally:
if (asset && asset.status === 'active' && asset.isHeroEligible) {
    return asset;
}
// 
// RESULT: It gracefully returns `undefined`. The ContentNormalizer issues
// a fallback 2D header component rather than crashing WebGL with an empty mesh.


/* =========================================================
   2. SEAMLESS VARIANT SWAPPING (NO ENGINE REQUIRED REBUILDS)
   ========================================================= */
// The UX/UI Admin Dashboard has a dropdown listing all Variants for an Asset Family.
// It lists:
// 1. "Chrome (Approved)" -> Currently primary
// 2. "Glass (Approved)"  -> Alternate Variant
// 3. "Wireframe (Approved)" -> Alternate Variant

// If a Client clicks "Make Active" on the Glass variant:

export function adminSwapsVariant(familyId: string, newPrimaryId: string) {
    // We hit the Asset Registry API
    registry.approveAndMakePrimary(newPrimaryId);

    // That's it.

    // THE ENGINE BEHAVIOR:
    // The very next time the Nuxt frontend hits `contentNormalizer.ts`:
    // 1. `getPrimaryCenterpieceForSite()` instantly returns the Glass AssetId.
    // 2. The `TemplateConfigController` reads `materialPreset: 'glass'`, drastically altering
    //    the ambient lighting ratios and HDR maps natively parsed for Glass bodies.
    // 3. The `WebGLSceneManager` uses `AssetLoader` to fetch the Glass GLB.
    // 4. The `GeneratedLogoCenterpiece` uses the newly compiled reflection arrays.

    // No `.vue` template had to change, no WebGL code had to change, and no 
    // nested JSON in a headless CMS had to be updated. The Registry abstracted 
    // the entire complexity of 3D asset handling.
}
