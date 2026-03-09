/**
 * 5. ARCHITECTURE EXTENSION NOTES
 * ------------------------------------------------------------------
 * Because `SiteDeploymentSync` entirely abstracts Nuxt resolution from
 * the messy workflow state history, adding complex future logic
 * acts purely upon the `SiteDeploymentManifest` table.
 */

// EXTENSION 1: SCHEDULED PUBLISHING
//
// When an Admin clicks "Publish on Friday at 5 PM", the WorkflowEngine assigns
// `flow.scheduledPublishAt = '2026-03-08T17:00:00Z'`.
//
// The actual deployment is delayed. A CRON job sweeps every 60 seconds looking
// for ripe records. When Found:
// `deploymentSync.pushLiveUpdate(clientId, 'hero-centerpiece', assetId)`
//
// Because the Content Normalizer natively queries `SiteDeploymentSync`, it
// seamlessly sees the update Friday at 5 PM without any Nuxt involvement.

// EXTENSION 2: PREVIEW ENVIRONMENTS (STAGED DEPLOYMENTS)
//
// Instead of storing just `{ activeAssetId, previousAssetId }`, the Deployment Slot
// can be expanded:
/*
  export const PublishedSlotSchema = z.object({
    activeAssetId: z.string().uuid(),
    stagedAssetId: z.string().uuid().nullable()
  });
*/
// The preview environment URL (e.g., `preview.client.com?draft=true`) hooks into the
// normalizer. Normalizer asks:
// `resolveStagedAssetForSite(clientId, role) || resolveLiveAssetForSite(clientId, role)`
// Allowing clients to see exactly how the Glass asset looks in production before
// officially publishing it.

// EXTENSION 3: MULTI-SITE SYNC / GLOBAL ASSETS
//
// If an Asset is a generic brand module usable across hundreds of franchisees,
// the `SiteDeploymentManifest` can resolve a wildcard.
// `sites['global-template'].roles['supporting-centerpiece']`
//
// Update the 'global-template' role, and `ContentNormalizer.ts` natively
// cascades the asset ID down to all child sites automatically hitting the
// exact same O(1) resolution table.
