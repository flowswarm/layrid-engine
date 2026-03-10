/**
 * 1. ASSET REGISTRY & WORKFLOW ENGINE INTEGRATION
 * ------------------------------------------------------------------
 * The Asset Registry stores the physical files and metadata.
 * The Approval Workflow Engine stores the distinct STATUS of those files
 * (review, approved, published) and explicitly assigns the 'Live' tags.
 */

import { AssetRegistry } from '../registry/AssetRegistry';
import { ApprovalWorkflowEngine } from '../workflow/ApprovalWorkflowEngine';
import { SiteDeploymentSync } from '../deployment/SiteDeploymentSync';

// Global singletons
export const assetRegistry = new AssetRegistry();
const deploymentSync = new SiteDeploymentSync();
export const workflowEngine = new ApprovalWorkflowEngine(assetRegistry, deploymentSync);


/**
 * Helper specifically for the CMS to query the "Live Array of Engine Assets"
 * This guarantees the engine ONLY sees assets that have passed the strict 
 * Art Director / Client "Published" gate.
 */
export function getActivePublishedContext(clientId: string, sceneRole: string = 'hero-centerpiece') {
    // 1. Ask Deployment Sync: "Who is legally allowed to be on screen right now?"
    const liveAssetId = deploymentSync.resolveLiveAssetForSite(clientId, 'production', sceneRole);

    if (!liveAssetId) return null;

    // 2. Ask Asset Registry: "Give me the physical file data for this approved ID."
    const physicalAsset = assetRegistry.getAssetById(liveAssetId);

    return physicalAsset || null;
}
