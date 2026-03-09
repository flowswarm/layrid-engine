/**
 * 4. REFINED APPROVAL INTEGRATION EXAMPLES
 * ------------------------------------------------------------------
 * Concrete execution flows showcasing how Client Approval tokens completely
 * sandbox untrusted variants from Live users until an authenticated Pipeline Admin
 * definitively executes the live `promoteApprovedLinkToLive` handoff.
 */

import { ApprovalWorkflowEngine } from '../workflow/ApprovalWorkflowEngine';
import { AssetRegistry } from '../registry/AssetRegistry';
import { SiteDeploymentSync } from '../deployment/SiteDeploymentSync';
import { ClientApprovalManager } from './ClientApprovalManager';
import { normalizeSectionData } from '../../src/engine/core/contentNormalizer';

const registry = new AssetRegistry();
const deploymentSync = new SiteDeploymentSync();
const workflow = new ApprovalWorkflowEngine(registry, deploymentSync);
const approvalManager = new ClientApprovalManager(workflow, deploymentSync);

// Simulated Nuxt contexts
const mockCmsPayload = { blocks: [{ _type: 'hero_block', id: '1', title: 'Home' }] };
const currentRoute = '/home';


/* =========================================================
   EXAMPLE A: Sharing a Matte Preview while Chrome Stays Live
   ========================================================= */
export function exampleShareClientApproval() {
    const clientId = 'site-a';

    // 1. Live Production = Chrome
    const chromeLiveId = registry.draftAsset('fam-1', clientId, { materialPreset: 'chrome' });
    const flowId = workflow.initializeWorkflow(chromeLiveId, 'fam-1', clientId, 'hero-centerpiece');
    workflow.approveAsset(flowId, 'admin');
    workflow.publishAsset(flowId, 'admin', 'production');

    // 2. Draft New Experimental Variant (Matte)
    const matteAssetId = registry.draftAsset('fam-1', clientId, { materialPreset: 'matte-plastic' });

    // 3. Generate Secure 7-day Review Link
    const link = approvalManager.generateApprovalLink(
        clientId, 'hero-centerpiece', matteAssetId, 'generated', 'admin-1', 'production', 7, currentRoute
    );

    // -> LIVE ORGANIC VISITOR (No Token)
    const norm1 = normalizeSectionData(mockCmsPayload, clientId, 'production', undefined, undefined, currentRoute);
    // norm1[0].webgl.materialPreset === 'chrome'
    // norm1[0].webgl.__approvalState.isActive === false
    // 100% physically sandboxed from the unapproved Matte hash.

    // -> CLIENT C-SUITE VISITOR (?approval_token=xyz)
    const norm2 = normalizeSectionData(mockCmsPayload, clientId, 'production', undefined, link.approvalToken, currentRoute);
    // norm2[0].webgl.materialPreset === 'matte-plastic'
    // norm2[0].webgl.__approvalState.status === 'pending-review'
    // norm2[0].webgl.__approvalState.baseLiveAssetId === chromeLiveId 
    // Vue can now inject a "Compare to Current Chrome Version" button because of `baseLiveAssetId`.
}


/* =========================================================
   EXAMPLE B: Expiration/Revocation Restoring Safe Live Resolution
   ========================================================= */
export function exampleApprovalRevocation() {
    const clientId = 'site-a';

    const matteAssetId = registry.draftAsset('fam-1', clientId, { materialPreset: 'matte-plastic' });
    const link = approvalManager.generateApprovalLink(
        clientId, 'hero-centerpiece', matteAssetId, 'generated', 'admin-1', 'production', 7, currentRoute
    );

    // ACTION: Internal Design Lead realizes matte has a massive glitch. 
    // Instantly revokes the emailed link before the client sees it.
    approvalManager.revokeLink(link.approvalToken, 'design-lead');

    // EVENT: Client opens their email anyway 3 hours later and clicks the URL:
    const lateNorm = normalizeSectionData(mockCmsPayload, clientId, 'production', undefined, link.approvalToken, currentRoute);

    // RESULT: Matte hijack is neutralized. `validateApprovalToken` returns null due to `status === 'revoked'`.
    // lateNorm falls back to `SiteDeploymentSync`. 
    // The client sees the Live Production site naturally without error crashes.
}


/* =========================================================
   EXAMPLE C: Client Approval Feeding Normal Publishing Workflow
   ========================================================= */
export function examplePromotingApprovedLinkToLive() {
    const clientId = 'site-a';

    const matteAssetId = registry.draftAsset('fam-1', clientId, { materialPreset: 'matte-plastic' });
    const matteFlow = workflow.initializeWorkflow(matteAssetId, 'fam-1', clientId, 'hero-centerpiece');
    workflow.approveAsset(matteFlow, 'internal-art-director'); // Pre-req for Global publishing

    const link = approvalManager.generateApprovalLink(
        clientId, 'hero-centerpiece', matteAssetId, 'approved', 'admin', 'production', 7
    );

    // 1. Client views the link, writes feedback, and clicks [Approve Version]
    approvalManager.submitClientDecision(
        link.approvalToken,
        'approve',
        'Approved. Make this live for the PR drop tomorrow.',
        'client@brand.com'
    );

    // 2. Midnight hits. The internal Account Manager executes the deployment script.
    approvalManager.promoteApprovedLinkToLive(link.approvalToken, matteFlow, 'internal-account-mgr');

    // ACTION RESOLUTIONS:
    // -> Token neutralized permanently (`status = 'promoted-to-publish'`).
    // -> Older Live Masterpiece naturally archived globally by ApprovalWorkflowEngine.
    // -> `SiteDeploymentSync` instantly updates `site-a -> production` to resolve `matteAssetId`.
    // -> Tomorrow morning, completely organic traffic on `mysite.com` receives the Matte mesh natively.
}
