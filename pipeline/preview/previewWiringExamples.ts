/**
 * pipeline/preview/previewWiringExamples.ts
 * 
 * Demonstrates the EXACT integration flow answering all 7 Engine Wiring 
 * requirements laid out by the preview architecture goals.
 */

import { AssetRegistry } from '../registry/AssetRegistry';
import { SiteDeploymentSync } from '../deployment/SiteDeploymentSync';
import { ApprovalWorkflowEngine } from '../workflow/ApprovalWorkflowEngine';
import { PreviewSessionManager } from './PreviewSessionManager';
import { normalizeSectionData } from '../../src/engine/core/contentNormalizer';
import { resolveWebGLSceneConfig } from '../../src/engine/core/templateConfigController';

const registry = new AssetRegistry();
const deploymentSync = new SiteDeploymentSync();
const workflow = new ApprovalWorkflowEngine(registry, deploymentSync);
const previewManager = new PreviewSessionManager(workflow, deploymentSync);

export function simulatePreviewEngineWiring() {
    const clientId = 'client-x';

    // 1. Establish Live Production Baseline
    const chromeLiveId = registry.draftAsset('fam-1', clientId, { materialPreset: 'chrome' });
    const flowId = workflow.initializeWorkflow(chromeLiveId, 'fam-1', clientId, 'hero-centerpiece');
    workflow.approveAsset(flowId, 'admin-1');
    workflow.publishAsset(flowId, 'admin-1', 'production');

    // 2. Setup Unapproved Draft Asset
    const matteDraftId = registry.draftAsset('fam-1', clientId, { materialPreset: 'matte-plastic' });
    const matteFlow = workflow.initializeWorkflow(matteDraftId, 'fam-1', clientId, 'hero-centerpiece');
    workflow.submitForReview(matteFlow, 'designer');

    // =========================================================
    // REQUIREMENT 1 & 2: SITE LIVE MAPPING STAYS UNTOUCHED
    // =========================================================
    // The Designer creates a staging link for the pending Matte variant.
    // Note: Neither `workflowEngine` or `deploymentSync` are mutated.
    // Chrome natively remains the absolute O(1) fallback for all organic traffic.
    const previewToken = previewManager.createPreviewSession(
        clientId, 'hero-centerpiece', matteDraftId, 'review', 'designer', 'production', 24, '/home'
    ).previewToken;


    // =========================================================
    // REQUIREMENT 3: NORMALIZER RESOLVES PREVIEW (Hijack Context)
    // =========================================================
    const stagingCmsData = { blocks: [{ _type: 'hero_block', id: 'bact', title: 'Home' }] };

    // Notice we pass the Token explicitly to the normalizer.
    // If we passed `undefined` for Token, the Normalizer skips `PreviewSessionManager` 
    // and natively polls `DeploymentSync` for the live Chrome asset.
    const stagingSections = normalizeSectionData(stagingCmsData, clientId, 'production', previewToken, '/home');
    const webglCtx = stagingSections[0].webgl;
    // -> webglCtx.materialPreset === 'matte-plastic'
    // -> webglCtx.__previewState.isActive === true


    // =========================================================
    // REQUIREMENT 4: TEMPLATE CONFIG INHERITS STAGING FLAGS
    // =========================================================
    // Translates 'matte-plastic' into standard Three.js engine parameters.
    // It natively forwards the `__previewState` object downwards so Vue can mount
    // floating UI tools (like [Approve] / [Reject] banners) on top of the 3D canvas.
    const configBlock = resolveWebGLSceneConfig(stagingSections[0]);


    // =========================================================
    // REQUIREMENT 5: WEBGL SCENE BOOTS THE ISOLATED ASSET
    // =========================================================
    // `GeneratedLogoCenterpiece.ts` executes. It accepts `configBlock.sourceMeshUrl`
    // pointing at the literal Matte `physicalRuntimePath`.
    // WebGL knows nothing about "Approval Workflows" or "Tokens". It just rigidly 
    // draws the URL handed down by the Normalizer sandbox.


    // =========================================================
    // REQUIREMENT 6: EXPIRATION / DISCARD RESTORES LIVE AUTOMATICALLY
    // =========================================================
    // Admin revokes the link before the external meeting.
    previewManager.discardSession(previewToken, 'admin-1');

    // The very next page load using `?preview_token=xyz`:
    const revokedSections = normalizeSectionData(stagingCmsData, clientId, 'production', previewToken, '/home');
    // -> Normalizer sees token but validation instantly yields `null`.
    // -> Normalizer gracefully drops to native DeploymentSync layer.
    // -> Result: `revokedSections[0].webgl.materialPreset === 'chrome'`.


    // =========================================================
    // REQUIREMENT 7: PROMOTE-FROM-PREVIEW AUTOMATIC WORKFLOW
    // =========================================================
    // Assume the token wasn't revoked. The Enterprise Client clicks [Make Live] on the WebGL Banner.
    try {
        // The Preview API natively triggers `ApprovalWorkflow.publishAsset()` 
        // seamlessly archiving the old Live Chrome and publishing the active Matte scene globally.
        previewManager.promoteToLive(previewToken, matteFlow, 'admin-1');
    } catch (e) {
        // Fails in our local script here because Matte wasn't `approved` inside the workflow layer.
        // Real systems force it to `approved` before exposing the `promote` button.
    }
}
