/**
 * Asset Engine: Runtime Exclusions, Swapping, & Rollbacks
 * ------------------------------------------------------------------
 * 
 * Demonstrates exactly how the Engine uses the Publishing Workflow 
 * to execute complex variant swaps safely.
 */

/* =========================================================
   1. EXCLUDING FAILED, ARCHIVED, OR REVIEW-ONLY ASSETS
   ========================================================= */
// What happens when an Art Director rejects a Matte variant?
// 
// The Workflow record looks like:
// { assetId: 'ast-matte-1', state: 'rejected', auditTrail: { rejectionReason: 'Too dark' } }

// THE ENGINE BEHAVIOR:
// When the Content Normalizer boots up for the client's homepage:
// `getActivePublishedContext('client-acme', 'hero-centerpiece')`
// 
// Internally:
if (flow.state === 'published') {
    return flow.assetId;
}
//
// RESULT: It gracefully returns `null`.
// Because the Asset is explicitly 'rejected' and NOT 'published', the CMS
// Normalizer issues a fallback 2D header component rather than crashing WebGL.


/* =========================================================
   2. SEAMLESS VARIANT SWAPPING (NO ENGINE REQUIRED REBUILDS)
   ========================================================= */
// An Admin dashboard lists the following approved variants for Acme:
// 1. Chrome (Published)
// 2. Glass (Approved)

// If an Art Director clicks "Publish" on the Glass variant:
// `workflowEngine.publishAsset(glassFlowId, adminId)`

// THE ENGINE BEHAVIOR:
// The very next time the Nuxt frontend hits `contentNormalizer.ts`:
// 1. `getActivePublishedContext()` instantly returns the physical `Glass AssetId`.
// 2. The `TemplateConfigController` reads `materialPreset: 'glass'`, drastically altering
//    the ambient lighting ratios and HDR maps natively parsed for Glass bodies.
// 3. The `WebGLSceneManager` uses `AssetLoader` to fetch the Glass GLB.
//
// No `.vue` template had to change, no WebGL code had to change, and no
// nested JSON in the headless CMS had to be updated. The Workflow engine abstracted
// the entire complexity of 3D asset state.


/* =========================================================
   3. ROLLBACKS (UNDEPLOYING A MISTAKE)
   ========================================================= */
// The Glass variant looks terrible in production on mobile devices.
// The Art Director hits "Rollback" on the Admin Dashboard to restore Chrome.

// 1. `workflowEngine.publishAsset(chromeFlowId, adminId)`
//    -> Chrome is flagged 'published'.
//    -> `demoteCompetingLiveAssets` instantly flags the Glass variant as 'archived'.

// THE ENGINE BEHAVIOR:
// It operates identically to the swap. The Normalizer returns the Chrome asset,
// and the WebGL Config loads the Chrome lighting map. The entire site recovers
// to the previous stable mesh on the next refresh.
