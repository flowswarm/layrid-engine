/**
 * 4. REFINED INTEGRATION EXAMPLES (COMPARISON MODE)
 * ------------------------------------------------------------------
 * Concrete execution flows showcasing how Multi-Candidate Comparison tokens safely
 * load variants, how clients dynamically toggle between arrays securely, and how
 * one specific designated variant is definitively approved and pipeline-promoted.
 */

import { ApprovalWorkflowEngine } from '../workflow/ApprovalWorkflowEngine';
import { AssetRegistry } from '../registry/AssetRegistry';
import { SiteDeploymentSync } from '../deployment/SiteDeploymentSync';
import { ComparisonSessionManager } from './ComparisonSessionManager';
import { normalizeSectionData } from '../../src/engine/core/contentNormalizer';

const registry = new AssetRegistry();
const deploymentSync = new SiteDeploymentSync();
const workflow = new ApprovalWorkflowEngine(registry, deploymentSync);
const comparisonManager = new ComparisonSessionManager(workflow, deploymentSync);

const mockCmsPayload = { blocks: [{ _type: 'hero_block', id: '1', title: 'Home' }] };
const route = '/home';


/* =========================================================
   EXAMPLE A: Compare Chrome vs Matte (While Chrome stays live)
   ========================================================= */
export function exampleChromeVsMatte() {
    const siteId = 'site-a';

    // 1. Live Production Baseline
    const chromeLiveId = registry.draftAsset('fam-1', siteId, { materialPreset: 'chrome' });
    const flow1 = workflow.initializeWorkflow(chromeLiveId, 'fam-1', siteId, 'hero-centerpiece');
    workflow.approveAsset(flow1, 'admin');
    workflow.publishAsset(flow1, 'admin', 'production');

    // 2. Draft New Experimental Variants 
    const matteVariantId = registry.draftAsset('fam-1', siteId, { materialPreset: 'matte-plastic' });
    const chromeVariantId = registry.draftAsset('fam-2', siteId, { materialPreset: 'chrome' });

    // 3. Create Session 
    const session = comparisonManager.createComparisonSession(
        siteId, 'hero-centerpiece', [matteVariantId, chromeVariantId], 'internal-artist'
    );

    // -> LIVE VISITOR (No Token) -> Gets Production (chromeLiveId)
    const normLive = normalizeSectionData(mockCmsPayload, siteId, 'production', undefined, undefined, undefined, route);
    // normLive[0].webgl.materialPreset === 'chrome'

    // -> CLIENT VISITOR (Token) -> Defaults to the first array candidate (`matteVariantId`)
    const normClient = normalizeSectionData(mockCmsPayload, siteId, 'production', undefined, undefined, session.comparisonSessionId, route);
    // normClient[0].webgl.materialPreset === 'matte-plastic'

    // 4. CLIENT TOGGLES IN UI PANEL -> "Let me see option B"
    comparisonManager.switchComparisonCandidate(session.comparisonSessionId, chromeVariantId);
    const normSwitch = normalizeSectionData(mockCmsPayload, siteId, 'production', undefined, undefined, session.comparisonSessionId, route);
    // normSwitch[0].webgl.materialPreset === 'chrome'
}


/* =========================================================
   EXAMPLE B: Imported Logo vs Text-Generated
   ========================================================= */
export function exampleImportedVsGenerated() {
    const siteId = 'site-a';

    const designerId = registry.draftAsset('designer-glb-123', siteId, { materialPreset: 'default' });
    const generatedId = registry.draftAsset('text-gen-456', siteId, { materialPreset: 'chrome' });

    registry.getAssetById(designerId)!.compatibleSceneModes = ['imported-logo'];
    registry.getAssetById(generatedId)!.compatibleSceneModes = ['text-logo'];

    const session = comparisonManager.createComparisonSession(
        siteId, 'hero-centerpiece', [designerId, generatedId], 'admin'
    );

    // Client renders Designer GLB
    const norm1 = normalizeSectionData(mockCmsPayload, siteId, 'production', undefined, undefined, session.comparisonSessionId, route);
    // norm1[0].webgl.sceneMode === 'imported-logo'
    // norm1[0].webgl.centerpieceSource === 's3://.../designer-glb-123.glb'

    // Client toggles to Generated Version
    comparisonManager.switchComparisonCandidate(session.comparisonSessionId, generatedId);
    const norm2 = normalizeSectionData(mockCmsPayload, siteId, 'production', undefined, undefined, session.comparisonSessionId, route);
    // norm2[0].webgl.sceneMode === 'text-logo'
    // norm2[0].webgl.centerpieceSource === 's3://.../text-gen-456.glb'
}


/* =========================================================
   EXAMPLE C: Approving the Winner -> Pipeline Handoff
   ========================================================= */
export function exampleWinningCandidatePromoted() {
    const siteId = 'site-a';

    const varA = registry.draftAsset('var-A', siteId, { materialPreset: 'chrome' });
    const varB = registry.draftAsset('var-B', siteId, { materialPreset: 'matte' });

    // Developer initialized workflow tables
    const flowB = workflow.initializeWorkflow(varB, 'var-B', siteId, 'hero-centerpiece');
    workflow.approveAsset(flowB, 'internal-lead');

    const session = comparisonManager.createComparisonSession(
        siteId, 'hero-centerpiece', [varA, varB], 'admin'
    );

    // 1. Client views them, clicks the "Heart" on B 
    comparisonManager.setPreferredCandidate(session.comparisonSessionId, varB);
    // (Session.primaryCandidateAssetId === varB)

    // 2. Client formally completes the Flow -> "Approve Selected"
    comparisonManager.approveSelectedCandidate(
        session.comparisonSessionId,
        varB,
        'Version B (Matte) looks radically cleaner.',
        'client@brand.com'
    );
    // session.status === 'approved'
    // session.approvedAssetId === varB

    // 3. Midnight Launch: Internal Dev hits deploy
    comparisonManager.promoteComparisonToLive(session.comparisonSessionId, flowB, 'admin-1');

    // ACTION RESOLUTIONS:
    // -> Token neutralized permanently (`status = 'promoted-to-publish'`).
    // -> `SiteDeploymentSync` instantly updates `site-a -> production` to resolve `varB`.
    // -> All global generic traffic seamlessly receives Version B (`matte`).
}
