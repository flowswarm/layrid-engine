/**
 * pipeline/preview/comparisonEngineWiring.ts
 * 
 * Demonstrates the EXACT integration answering the 8 Engine Wiring requirements
 * mapping a Multi-Candidate Comparison Session through the CMS normalization runtime
 * down into the physical WebGL Canvas.
 */

import { AssetRegistry } from '../registry/AssetRegistry';
import { SiteDeploymentSync } from '../deployment/SiteDeploymentSync';
import { ApprovalWorkflowEngine } from '../workflow/ApprovalWorkflowEngine';
import { ComparisonSessionManager } from './ComparisonSessionManager';

// --- Mocks for the Engine ---
const registry = new AssetRegistry();
const deploymentSync = new SiteDeploymentSync();
const workflowEngine = new ApprovalWorkflowEngine(registry, deploymentSync);
const comparisonManager = new ComparisonSessionManager(workflowEngine, deploymentSync);

const siteId = 'site-a';
const environment = 'production';


// ==============================================================================
// 1. CREATE COMPARISON SESSION FROM CANDIDATES IN REGISTRY
// ==============================================================================
/**
 * Internal Admin drafts two new variants and securely links them via `candidateAssetIds`.
 */
const candidateA = registry.draftAsset('fam-1', siteId, { materialPreset: 'chrome' });
const candidateB = registry.draftAsset('fam-1', siteId, { materialPreset: 'matte-plastic' });

const sessionData = comparisonManager.createComparisonSession(
    siteId, 'hero-centerpiece', [candidateA, candidateB], 'admin-user'
);
// sessionData.currentViewedAssetId defaults inherently to candidateA


// ==============================================================================
// 2. COMPARISON RESOLUTION DOES NOT TOUCH LIVE SITE MAPPING
// ==============================================================================
/**
 * `deploymentSync.resolveLiveAssetForSite()` STILL returns whatever is originally 
 * in the database (e.g. `legacyChromeId`).
 * The `SiteDeploymentSync` remains completely structurally intact.
 */
const liveAssetId = deploymentSync.resolveLiveAssetForSite(siteId, environment, 'hero-centerpiece');
// liveAssetId !== candidateA && liveAssetId !== candidateB


// ==============================================================================
// 3. CONTENT NORMALIZER RESOLVES COMPARISON CENTERPIECE SOURCE
// ==============================================================================
/**
 * Look at `src/engine/core/contentNormalizer.ts`.
 * If the URL has `?comparison_token=abc-123`, the Normalizer intercepts it:
 * 
 * ```ts
 *   const session = comparisonManager.validateComparisonToken(comparisonToken, siteId, ...);
 *   if (session) {
 *      targetAssetId = session.currentViewedAssetId; // Extracts the active toggle hash!
 *   }
 * ```
 */
const mockContentNormalizer = (queryToken: string) => {
    const session = comparisonManager.validateComparisonToken(queryToken, siteId, 'hero-centerpiece', environment);
    const resolvedAssetId = session ? session.currentViewedAssetId : liveAssetId;
    const assetData = registry.getAssetById(resolvedAssetId);

    return {
        webgl: {
            sceneMode: assetData.compatibleSceneModes[0],
            centerpieceSource: assetData.runtimePath,
            materialPreset: assetData.materialPreset,
            __comparisonState: session ? { isActive: true, status: session.status, currentViewedAssetId: session.currentViewedAssetId } : { isActive: false }
        }
    };
};

const payloadA = mockContentNormalizer(sessionData.comparisonSessionId);
// payloadA.webgl.materialPreset === 'chrome'
// payloadA.webgl.__comparisonState.isActive === true


// ==============================================================================
// 4. TEMPLATE CONFIG CONTROLLER RESOLVES METADATA
// ==============================================================================
/**
 * `src/engine/core/templateConfigController.ts` remains blind to the session logic.
 * It strictly passes `{...webgl}` directly into structured Canvas props.
 * `sceneMode` organically mutates down the tree if it differs between variants.
 */


// ==============================================================================
// 5. WEBGL SCENE MANAGER LOADS THE SELECTED ASSET
// ==============================================================================
/**
 * `GeneratedLogoCenterpiece.ts` executes a standard three.js download of `centerpieceSource`.
 * It renders Variant A identically to how it renders native Live Assets.
 */


// ==============================================================================
// 6. SWITCHING CANDIDATES UPDATES RUNTIME RESOLUTION SAFELY
// ==============================================================================
/**
 * The Client clicks "Toggle to B" in the UI Overlay.
 * The Vue Frontend posts to:
 */
comparisonManager.switchComparisonCandidate(sessionData.comparisonSessionId, candidateB);

/**
 * On next frame/render hook, the Normalizer extracts the NEW token state.
 */
const payloadB = mockContentNormalizer(sessionData.comparisonSessionId);
// payloadB.webgl.materialPreset === 'matte-plastic'
// payloadB.webgl.__comparisonState.currentViewedAssetId === candidateB
// WebGL Scene loads Matte smoothly entirely guided by the Normalizer override.


// ==============================================================================
// 7. PREFERRED/APPROVED SELECTION HANDS OFF TO FORMAL PUBLISHING
// ==============================================================================
/**
 * The Client formally signs off the Matte version as the unequivocal winner.
 */
comparisonManager.approveSelectedCandidate(sessionData.comparisonSessionId, candidateB, 'Love the matte.');
// sessionData.status === 'approved'; sessionData.approvedAssetId === candidateB

// Internal Admin triggers launch
const workflowFlowRootId = 'flow-777'; // Generated by the Admin dev setup
comparisonManager.promoteComparisonToLive(sessionData.comparisonSessionId, workflowFlowRootId, 'admin-1');

// => Physical Consequence:
// `SiteDeploymentSync` writes `candidateB` to the Live array dynamically.
// Global mapping securely updated. Token permanently disabled (`promoted-to-publish`).


// ==============================================================================
// 8. EXPIRATION OR REVOCATION RESTORES LIVE RUNTIME RESOLUTION
// ==============================================================================
/**
 * If an admin explicitly kills the session, or the 7 days pass natively...
 */
comparisonManager.revokeComparisonSession(sessionData.comparisonSessionId, 'admin');

/**
 * ...then `validateComparisonToken(token)` instantly returns `null`.
 * Normalizer inherently bypasses token logic and falls back to:
 * `targetAssetId = deploymentSync.resolveLiveAssetForSite(...)`
 * The Client is safely rendered the Live Production site without error components.
 */
const payloadRevoked = mockContentNormalizer(sessionData.comparisonSessionId);
// payloadRevoked.webgl.__comparisonState.isActive === false
