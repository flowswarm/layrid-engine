/**
 * 1. ASSET REGISTRY & WORKFLOW ENGINE INTEGRATION
 * ------------------------------------------------------------------
 * The Asset Registry stores the physical files and metadata.
 * The Approval Workflow Engine stores the distinct STATUS of those files
 * (review, approved, published) and explicitly assigns the 'Live' tags.
 */

import { AssetRegistry } from './AssetRegistry';
import { ApprovalWorkflowEngine } from '../workflow/ApprovalWorkflowEngine';

// Global singletons
export const assetRegistry = new AssetRegistry();
export const workflowEngine = new ApprovalWorkflowEngine(assetRegistry);


/**
 * Helper specifically for the CMS to query the "Live Array of Engine Assets"
 * This guarantees the engine ONLY sees assets that have passed the strict 
 * Art Director / Client "Published" gate.
 */
export function getActivePublishedContext(clientId: string, sceneRole: string = 'hero-centerpiece') {
    // 1. Ask Workflow Engine: "Who is legally allowed to be on screen right now?"
    const liveAssetId = workflowEngine.getLivePublishedAssetId(clientId, sceneRole);

    if (!liveAssetId) return null;

    // 2. Ask Asset Registry: "Give me the physical file data for this approved ID."
    const physicalAsset = assetRegistry.getAssetById(liveAssetId);

    return physicalAsset || null;
}
