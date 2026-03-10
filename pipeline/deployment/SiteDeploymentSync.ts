import { v4 as uuidv4 } from 'uuid';
import {
    SiteDeploymentManifest,
    PublishedRouteSlot,
    DeploymentEnvironment
} from './deployment.types';

/**
 * 2. REFINED PUBLISH / ROLLBACK OPERATIONS API
 * 
 * Supports safe deployment targeting environments (Preview vs Production).
 * Enforces atomic swaps and instant rollback safety.
 */
type PersistFn = (data: unknown) => void;

export class SiteDeploymentSync {

    private manifest: SiteDeploymentManifest = {
        version: 2,
        lastSyncedAt: new Date(),
        sites: {}
    };
    private persistFn: PersistFn | null = null;

    /** Attach a persistence callback. */
    public setPersist(fn: PersistFn): void { this.persistFn = fn; }

    public toJSON(): object { return JSON.parse(JSON.stringify(this.manifest)); }

    public static fromJSON(data: any): SiteDeploymentSync {
        const sync = new SiteDeploymentSync();
        if (data && data.sites) {
            // Revive dates in route slots
            for (const siteId of Object.keys(data.sites)) {
                const site = data.sites[siteId];
                for (const env of Object.keys(site.environments || {})) {
                    for (const role of Object.keys(site.environments[env]?.roles || {})) {
                        const slot = site.environments[env].roles[role];
                        if (slot.publishedAt) slot.publishedAt = new Date(slot.publishedAt);
                        if (slot.scheduledFor) slot.scheduledFor = new Date(slot.scheduledFor);
                    }
                }
            }
            sync.manifest = {
                version: data.version ?? 2,
                lastSyncedAt: new Date(data.lastSyncedAt),
                sites: data.sites
            };
        }
        return sync;
    }

    private persist(): void {
        if (this.persistFn) this.persistFn(this.toJSON());
    }

    /**
     * ATOMIC PUBLISH: Updates the specific site -> environment -> role pointer.
     */
    public pushLiveUpdate(
        clientId: string,
        environment: DeploymentEnvironment,
        targetSceneRole: string, // e.g. 'hero-centerpiece'
        newAssetId: string,
        publisherId: string
    ): void {

        // 1. Ensure Client & Environment tree exists
        if (!this.manifest.sites[clientId]) {
            this.manifest.sites[clientId] = { environments: { preview: { roles: {} }, production: { roles: {} }, staging: { roles: {} } } };
        }
        const site = this.manifest.sites[clientId];
        if (!site.environments[environment]) {
            site.environments[environment] = { roles: {} };
        }

        const currentSlot = site.environments[environment].roles[targetSceneRole];

        // Safety 1: Don't publish if this identical physical asset is already live here
        if (currentSlot && currentSlot.activeAssetId === newAssetId) {
            console.warn(`[Deployment Warning] Asset ${newAssetId} already live on ${environment} for ${targetSceneRole}. Skipping.`);
            return;
        }

        // 2. Map the new atomic Route Slot
        const newSlot: PublishedRouteSlot = {
            deploymentId: uuidv4(),
            activeAssetId: newAssetId,
            // Safety 2: Instantly preserve the old asset specifically for this environment
            previousAssetId: currentSlot ? currentSlot.activeAssetId : null,
            publishedAt: new Date(),
            publishedBy: publisherId,
            deploymentChecksum: this.generateChecksum(newAssetId, environment)
        };

        // 3. Commit Atomic Swap
        site.environments[environment].roles[targetSceneRole] = newSlot;
        this.manifest.lastSyncedAt = new Date();
        this.persist();

        console.log(`[Deployment Sync] ⚡ LIVE PUSH -> Site: ${clientId} | Env: ${environment} | Role: ${targetSceneRole} | Asset: ${newAssetId}`);
    }

    /**
     * INSTANT ROLLBACK: Swaps the active pointer to the previous record safely.
     */
    public performRollback(
        clientId: string,
        environment: DeploymentEnvironment,
        targetSceneRole: string,
        operatorId: string
    ): void {
        const roleSlot = this.manifest.sites[clientId]?.environments[environment]?.roles[targetSceneRole];

        if (!roleSlot || !roleSlot.previousAssetId) {
            throw new Error(`[Rollback Failed] No previous asset track recorded for ${clientId}:${environment}:${targetSceneRole}`);
        }

        const rollbackedSlot: PublishedRouteSlot = {
            deploymentId: uuidv4(),
            activeAssetId: roleSlot.previousAssetId,
            // The "bad" asset becomes the previous one, in case they want to roll-forward
            previousAssetId: roleSlot.activeAssetId,
            publishedAt: new Date(),
            publishedBy: operatorId,
            deploymentChecksum: this.generateChecksum(roleSlot.previousAssetId, environment)
        };

        // Commit atomic rollback
        this.manifest.sites[clientId].environments[environment].roles[targetSceneRole] = rollbackedSlot;
        this.manifest.lastSyncedAt = new Date();
        this.persist();

        console.log(`[Deployment Sync] ⏪ ROLLBACK -> Site: ${clientId} | Env: ${environment} | Prev Asset Restored: ${roleSlot.previousAssetId}`);
    }

    // --- RUNTIME QUERY EXPOSURE ---

    /**
     * O(1) The single source of truth for the Content Normalizer.
     */
    public resolveLiveAssetForSite(
        clientId: string,
        environment: DeploymentEnvironment,
        sceneRole: string
    ): string | null {
        // Navigate safely down the tree. Returns undefined if the route doesn't exist.
        const activeRoute = this.manifest.sites[clientId]?.environments[environment]?.roles[sceneRole];
        return activeRoute ? activeRoute.activeAssetId : null;
    }

    private generateChecksum(assetId: string, env: string) {
        // Generates a mock eTag that CDN hooks use to clear web cache
        return btoa(`${assetId}-${env}-${Date.now()}`).substring(0, 8);
    }
}
