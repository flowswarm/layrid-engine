/**
 * 4. REFINED CONCRETE INTEGRATION EXAMPLES
 * ------------------------------------------------------------------
 * Demonstrates the Refined SiteDeploymentSync API natively supporting 
 * Environment targets (preview vs production) and strict rollbacks.
 */

import { ApprovalWorkflowEngine } from '../workflow/ApprovalWorkflowEngine';
import { AssetRegistry } from '../registry/AssetRegistry';
import { SiteDeploymentSync } from './SiteDeploymentSync';
import { DeploymentEnvironment } from './deployment.types';

const registry = new AssetRegistry();
const workflow = new ApprovalWorkflowEngine(registry);
const deploymentSync = new SiteDeploymentSync();

/* =========================================================
   EXAMPLE 1: Chrome Hero Centerpiece Published to Site A (Production)
   ========================================================= */
export function examplePublishChromeToSiteA() {
    const clientId = 'site-a-portal';
    const role = 'hero-centerpiece';
    const environment: DeploymentEnvironment = 'production';

    // Job Runner finishes -> Workflow hits "Approved"
    const chromeAssetId = registry.draftAsset('fam-1', clientId, { materialPreset: 'chrome' });
    const chromeFlow = workflow.initializeWorkflow(chromeAssetId, 'fam-1', clientId, role);
    workflow.approveAsset(chromeFlow, 'admin-1');

    // THE ACT OF PUBLISHING
    // The Admin hits `Deploy to Production` on the Dashboard
    workflow.publishAsset(chromeFlow, 'admin-1');

    // The underlying workflow hooks call `SiteDeploymentSync` to write the routing table
    deploymentSync.pushLiveUpdate(clientId, environment, role, chromeAssetId, 'admin-1');

    /**
     * OUTCOME:
     * 1. Nuxt (on `www.site-a.com`) calls `resolveLiveAssetForSite('site-a-portal', 'production', 'hero-centerpiece')`
     * 2. It successfully retrieves `chromeAssetId`. WebGL natively boots Chrome.
     */
}

/* =========================================================
   EXAMPLE 2: Matte Variant Remains Approved but Unpublished
   ========================================================= */
export function exampleMatteApprovedForPreviewOnly() {
    const clientId = 'site-a-portal';
    const role = 'hero-centerpiece';

    // We have a Matte variant waiting in the wings
    const matteAssetId = registry.draftAsset('fam-1', clientId, { materialPreset: 'matte-plastic' });
    const matteFlow = workflow.initializeWorkflow(matteAssetId, 'fam-1', clientId, role);

    // The Art Director approves the asset structure
    workflow.approveAsset(matteFlow, 'director-99');

    // They want to see it running on the staging site BEFORE risking production.
    // They deploy it ONLY to the 'preview' environment.
    deploymentSync.pushLiveUpdate(clientId, 'preview', role, matteAssetId, 'director-99');

    /**
     * OUTCOME:
     * 1. The Production Site `www.site-a.com` continues reading the 'production' slot. 
     *    (Chrome remains live).
     * 2. The Internal Site `preview.site-a.com` reads the 'preview' slot.
     *    (Matte is instantly loaded for stakeholder review).
     * 3. The Runtime is never confused because environments are explicitly siloed.
     */
}

/* =========================================================
   EXAMPLE 3: Rollback Restores Previous Live Asset
   ========================================================= */
export function exampleRollbackProduction(clientId: string) {
    const role = 'hero-centerpiece';
    const environment: DeploymentEnvironment = 'production';

    // Disaster strikes. We published Matte to Production, but the lighting is broken.
    // The Admin hits `Rollback` on the Deployment Console.

    deploymentSync.performRollback(clientId, environment, role, 'admin-1');

    /**
     * INSTANT OUTCOME:
     * 1. `activeAssetId` instantly reverts to whatever `previousAssetId` held (e.g. Chrome).
     * 2. The `deploymentChecksum` recalculates, busting the edge CDN cache.
     * 3. The very next Nuxt page load resolves the previous asset flawlessly.
     * 4. No SQL backups had to be restored, and no code was recommitted. 
     */
}
