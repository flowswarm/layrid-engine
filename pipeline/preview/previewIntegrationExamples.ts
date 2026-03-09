/**
 * 4. FINAL PREVIEW INTEGRATION EXAMPLES
 * ------------------------------------------------------------------
 * Concrete unit-tests verifying that Staging tokens respect the exact 
 * physical limits of the Production architecture while allowing dynamic promotion.
 */

import { ApprovalWorkflowEngine } from '../workflow/ApprovalWorkflowEngine';
import { AssetRegistry } from '../registry/AssetRegistry';
import { SiteDeploymentSync } from '../deployment/SiteDeploymentSync';
import { PreviewSessionManager } from './PreviewSessionManager';
import { normalizeSectionData } from '../../src/engine/core/contentNormalizer';

const registry = new AssetRegistry();
const deploymentSync = new SiteDeploymentSync();
const workflow = new ApprovalWorkflowEngine(registry, deploymentSync);
const previewManager = new PreviewSessionManager(workflow, deploymentSync);

// Simulated headless browser request contexts
const mockCmsPayload = { blocks: [{ _type: 'hero_block', id: '1', title: 'Home' }] };
const currentRoute = '/home';


/* =========================================================
   EXAMPLE A: Previewing a Matte Variant while Chrome Stays Live
   ========================================================= */
export function examplePreviewMatteOverChrome() {
    const clientId = 'site-a';

    // 1. Establish the Live Truth (Chrome)
    const chromeAssetId = registry.draftAsset('fam-1', clientId, { materialPreset: 'chrome' });
    const chromeFlow = workflow.initializeWorkflow(chromeAssetId, 'fam-1', clientId, 'hero-centerpiece');
    workflow.approveAsset(chromeFlow, 'admin');
    workflow.publishAsset(chromeFlow, 'admin', 'production');

    // 2. Draft the New Experimental Variant (Matte)
    const matteAssetId = registry.draftAsset('fam-1', clientId, { materialPreset: 'matte-plastic' });
    const matteFlow = workflow.initializeWorkflow(matteAssetId, 'fam-1', clientId, 'hero-centerpiece');

    // 3. Generate Staging Session
    const session = previewManager.createPreviewSession(
        clientId, 'hero-centerpiece', matteAssetId, 'generated', 'admin-1', 'production', 24, '/home'
    );

    // -> LIVE VISITOR -> Gets Production (Chrome)
    const pubNorm = normalizeSectionData(mockCmsPayload, clientId, 'production', undefined, currentRoute);
    // pubNorm[0].webgl.materialPreset === 'chrome'
    // pubNorm[0].webgl.__previewState.isActive === false

    // -> ADMIN VISITOR -> Gets Token Override (Matte)
    const stgNorm = normalizeSectionData(mockCmsPayload, clientId, 'production', session.previewToken, currentRoute);
    // stgNorm[0].webgl.materialPreset === 'matte-plastic'
    // stgNorm[0].webgl.__previewState.isActive === true
    // stgNorm[0].webgl.__previewState.baseLiveAssetId === chromeAssetId  <-- Lets Vue display a "diff" menu
}


/* =========================================================
   EXAMPLE B: Preview Expiration Falling Back to Live Resolution
   ========================================================= */
export function examplePreviewExpiry() {
    const clientId = 'site-a';

    // Issue a token mapping Matte, but set durationHours to ~0
    const matteAssetId = registry.draftAsset('fam-1', clientId, { materialPreset: 'matte-plastic' });
    const session = previewManager.createPreviewSession(
        clientId, 'hero-centerpiece', matteAssetId, 'generated', 'admin-1', 'production', 0.0001
    );

    // Time passes...

    // Even though the URL perfectly preserves `?preview_token=xyz`, the engine rejects it
    const lateNorm = normalizeSectionData(mockCmsPayload, clientId, 'production', session.previewToken, currentRoute);

    // RESULT: Matte overrides are deleted in-memory by validation failure. 
    // lateNorm defaults instantly to whatever the SiteDeploymentSync says is structurally safe.
}


/* =========================================================
   EXAMPLE C: Promoting Previewed Asset to Published Live
   ========================================================= */
export function examplePromotingPreviewToLive() {
    const clientId = 'site-a';

    const matteAssetId = registry.draftAsset('fam-1', clientId, { materialPreset: 'matte-plastic' });
    const matteFlow = workflow.initializeWorkflow(matteAssetId, 'fam-1', clientId, 'hero-centerpiece');
    workflow.approveAsset(matteFlow, 'admin');

    const session = previewManager.createPreviewSession(
        clientId, 'hero-centerpiece', matteAssetId, 'approved', 'admin', 'production', 24
    );

    // ACTION: Director clicks [Publish This Version] inside the Vue Preview Banner
    previewManager.promoteToLive(session.previewToken, matteFlow, 'admin-1');

    // ACTION RESOLUTION:
    // 1. Token explicitly neutralized (`session.status = 'promoted-to-publish'`)
    // 2. Workflow transitions older live Chrome to `archived`
    // 3. Deployment Sync writes `matteAssetId` persistently to `site-a -> production -> hero-centerpiece` slot.
    // 4. From this millisecond forward, requests LACKING the token serve Matte.
}
