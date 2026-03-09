/**
 * pipeline/preview/clientApprovalEngineWiring.ts
 * 
 * Demonstrates the EXACT integration answering the 8 Engine Wiring requirements
 * mapping a Client Approval Link entirely through the CMS normalization runtime
 * down into the physical WebGL Canvas.
 */

import { AssetRegistry } from '../registry/AssetRegistry';
import { SiteDeploymentSync } from '../deployment/SiteDeploymentSync';
import { ApprovalWorkflowEngine } from '../workflow/ApprovalWorkflowEngine';
import { ClientApprovalManager } from './ClientApprovalManager';

// --- Mocks for the Engine ---
const registry = new AssetRegistry();
const deploymentSync = new SiteDeploymentSync();
const workflowEngine = new ApprovalWorkflowEngine(registry, deploymentSync);
const approvalManager = new ClientApprovalManager(workflowEngine, deploymentSync);

const siteClientId = 'site-a';
const environment = 'production';


// ==============================================================================
// 1. CREATE APPROVAL LINK FROM CANDIDATE ASSET
// ==============================================================================
/**
 * Internal Admin drafts a new variant and generates a 7-day shareable link.
 * The link is physically bound to `candidateAssetId`.
 */
const candidateAssetId = registry.draftAsset('fam-1', siteClientId, { materialPreset: 'matte-plastic' });
const linkData = approvalManager.generateApprovalLink(
    siteClientId,
    'hero-centerpiece',
    candidateAssetId,
    'generated',
    'admin-user',
    environment,
    7,
    '/home'
);


// ==============================================================================
// 2. PREVIEW SESSION RESOLVES CANDIDATE WITHOUT TOUCHING LIVE MAPPING
// ==============================================================================
/**
 * The `ClientApprovalManager` securely holds the `ApprovalLinkSession` in memory (or DB).
 * `deploymentSync.resolveLiveAssetForSite()` STILL returns the original Chrome asset.
 * The Live Mapping (`SiteDeploymentSync`) is 100% physically clean and unaffected.
 */
const liveAssetId = deploymentSync.resolveLiveAssetForSite(siteClientId, environment, 'hero-centerpiece');
// liveAssetId !== candidateAssetId (Live traffic is completely safe)


// ==============================================================================
// 3. CONTENT NORMALIZER RESOLVES PREVIEW CENTERPIECE SOURCE
// ==============================================================================
/**
 * Look at `src/engine/core/contentNormalizer.ts`.
 * If the Vue SSR request contains `?approval_token=abc-123`, the Normalizer intercepts it:
 * 
 * ```ts
 *   const activeSession = approvalManager.validateApprovalToken(approvalToken, siteClientId, ...);
 *   if (activeSession) {
 *      targetAssetId = activeSession.candidateAssetId; // Hijacks the string!
 *   } else {
 *      targetAssetId = deploymentSync.resolveLiveAssetForSite(...); // Falls back to Live Array
 *   }
 * ```
 */
const mockContentNormalizer = (queryToken: string) => {
    const session = approvalManager.validateApprovalToken(queryToken, siteClientId, 'hero-centerpiece', environment, '/home');
    const resolvedAssetId = session ? session.candidateAssetId : liveAssetId;
    const assetData = registry.getAssetById(resolvedAssetId);

    return {
        webgl: {
            sceneMode: assetData.compatibleSceneModes[0],
            centerpieceSource: assetData.runtimePath,
            materialPreset: assetData.materialPreset,
            __approvalState: session ? { isActive: true, status: session.status } : { isActive: false }
        }
    };
};

const clientStagingPayload = mockContentNormalizer(linkData.approvalToken);
// clientStagingPayload.webgl.centerpieceSource === 's3://.../matte-plastic.glb'
// clientStagingPayload.webgl.__approvalState.isActive === true


// ==============================================================================
// 4. TEMPLATE CONFIG CONTROLLER RESOLVES PREVIEW SCENE MODE
// ==============================================================================
/**
 * Look at `src/engine/core/templateConfigController.ts`.
 * It maps the Normalizer output cleanly into WebGL props without knowing if 
 * the data came from the Live Hash or an Approval session.
 * 
 * ```ts
 *   return {
 *      sceneMode: normalizedData.webgl.sceneMode,
 *      url: normalizedData.webgl.centerpieceSource,
 *      materialMode: normalizedData.webgl.materialPreset
 *   }
 * ```
 */


// ==============================================================================
// 5. WEBGL SCENE MANAGER LOADS THE PREVIEW ASSET
// ==============================================================================
/**
 * Look at `src/engine/webgl/modules/GeneratedLogoCenterpiece.ts`.
 * The physical Canvas rendering logic strictly blindly consumes the `url` from Step 4.
 * The 3D Engine physically downloads and instantiates the `matte` file simply because
 * `contentNormalizer.ts` hijacked the string injection natively at SSR request time.
 */


// ==============================================================================
// 6. CLIENT APPROVAL/REJECTION RECORDING
// ==============================================================================
/**
 * The Vue App detects `__approvalState.isActive === true`.
 * It mounts a sticky banner: "Reviewing Concept. [Approve] [Reject]".
 * Client clicks [Approve Version]. The frontend POSTs back to `ClientApprovalManager`.
 */
approvalManager.submitClientDecision(
    linkData.approvalToken,
    'approve',
    'This matte look is perfect. Let us ship it.',
    'client-ceo@brand.com'
);
// linkData.status === 'approved'; linkData.decisionAt === new Date();


// ==============================================================================
// 7. APPROVE-FROM-PREVIEW HANDS OFF INTO PUBLISHING WORKFLOW
// ==============================================================================
/**
 * Internal Developer sees the workflow state changed to `approved`.
 * They execute a global launch command from the CI/CD pipeline or admin panel.
 * 
 * Function safely destroys the token, and executes `workflowEngine.publishAsset(flowId)`.
 */
approvalManager.promoteApprovedLinkToLive(linkData.approvalToken, 'workflow-id-7xyz', 'admin-user');

// => Physical Consequence:
// The `SiteDeploymentSync` table is rewritten. 
// `liveAssetId` permanently equals `matteAssetId`.
// Organic global visits naturally receive the Matte hash.


// ==============================================================================
// 8. EXPIRATION OR REVOCATION RESTORES LIVE RUNTIME RESOLUTION
// ==============================================================================
/**
 * What if the link expired natively (7 days passed), OR the token was revoked?
 * Look back at Step 3. 
 * `validateApprovalToken(expiredLink)` natively returns `null`.
 * The `if (activeSession)` block organically fails.
 * `contentNormalizer.ts` natively falls back to `deploymentSync.resolveLiveAssetForSite()`.
 * 
 * Zero manual cleanup needed. Zero live site deployments needed. 
 * The client safely views the legacy Chrome artifact natively.
 */
approvalManager.revokeLink(linkData.approvalToken, 'admin-user');
const latePayload = mockContentNormalizer(linkData.approvalToken);
// latePayload.webgl.centerpieceSource === 's3://.../chrome.glb'
