/**
 * 4. CONCRETE PUBLISHING WORKFLOW EXAMPLES
 * ------------------------------------------------------------------
 * Demonstrates the safety validations preventing untrusted assets 
 * from reaching the WebGL frontend, and the exact rollback safety.
 */

import { ApprovalWorkflowEngine } from './ApprovalWorkflowEngine';
import { AssetRegistry } from '../registry/AssetRegistry';

// Dependency Injectors
const registry = new AssetRegistry();
const workflow = new ApprovalWorkflowEngine(registry);


/* =========================================================
   EXAMPLE 1: Chrome Meets Production Standards and Goes Live
   ========================================================= */
export function exampleChromePublishedToProduction() {

    const familyId = 'fam-vortex-99';
    const clientId = 'client-vortex';
    const adminId = 'user-admin-99';
    const directorId = 'user-director-55';

    // 1A. Job Runner registers Chrome variant
    const chromeAssetId = registry.draftAsset(familyId, clientId, { materialPreset: 'chrome' });
    const chromeFlow = workflow.initializeWorkflow(chromeAssetId, familyId, clientId, 'hero-centerpiece');

    // Pipeline exports `.glb` and moves it down the line
    workflow.markGenerated(chromeFlow);
    workflow.submitForReview(chromeFlow, adminId); // Asset is isolated in 'review'

    // 1B. APPROVAL & PUBLISHING
    // The Art Director reviews the Render in the Admin Dashboard. Looks good.
    workflow.approveAsset(chromeFlow, directorId, 'Great reflection values.');

    // The Admin hits `Publish`.
    workflow.publishAsset(chromeFlow, adminId);

    /**
     * THE RESULT:
     * Next time the visitor opens the page, the Content Normalizer executes:
     * `workflowEngine.getLivePublishedAssetId('client-vortex', 'hero-centerpiece')`
     * And it instantly gets exactly `chromeAssetId`.
     */
    return chromeFlow;
}


/* =========================================================
   EXAMPLE 2: Matte is Kept in Review Only
   ========================================================= */
export function exampleMatteHeldInReview(familyId: string, clientId: string) {

    const matteAssetId = registry.draftAsset(familyId, clientId, { materialPreset: 'matte-plastic' });
    const matteFlow = workflow.initializeWorkflow(matteAssetId, familyId, clientId, 'hero-centerpiece');

    workflow.markGenerated(matteFlow);
    workflow.submitForReview(matteFlow, 'user-admin-99'); // Asset hits 'review'

    /**
     * THE RESULT:
     * Everyone looks at it, decides they don't love it, but don't want to delete it yet.
     * `matteFlow` remains in 'review'.
     * The Content Normalizer asks for the 'published' asset—Matte is invisible to it.
     */
    return matteFlow;
}


/* =========================================================
   EXAMPLE 3: Swapping Chrome for Matte with Rollback Safety
   ========================================================= */
export function exampleSafeVariantSwapping(
    chromeFlowId: string,
    matteFlowId: string,
    adminId: string
) {

    // Later that week, Client asks to try Matte on the real site.
    // We don't overwrite any files. We don't change any code.

    // 1. Promote Matte through the final gate
    workflow.approveAsset(matteFlowId, 'user-director-55');

    // 2. Publish Matte
    // **CRITICAL SAFETY BOUNDARY**: The WorkflowEngine natively detects that `chromeFlowId`
    // currently holds the 'published' position for this `clientId` and `targetSceneRole`.
    // It automatically demotes `chromeFlowId` to 'archived', saving who did it.
    workflow.publishAsset(matteFlowId, adminId);

    // Content Normalizer instantly serves Matte.


    // 3. THE ROLLBACK
    // Client Panics. "Turn the Chrome back on immediately!"
    // `chromeFlowId` is perfectly preserved in the 'archived' state.

    // Simply re-publish it. Matte is automatically auto-demoted to 'archived'.
    workflow.publishAsset(chromeFlowId, adminId);

    // WebGL seamlessly boots Chrome on the very next refresh.
}
