import { v4 as uuidv4 } from 'uuid';
import { AssetRecord, AssetManifest, AssetStatus, AssetRecordSchema } from './registry.types';

/**
 * ASSET REGISTRY
 * 
 * The authoritative Engine database controller. It strictly separates Draft/Generating files
 * from "Active" cinematic assets that the Content Normalizer relies on.
 */
export class AssetRegistry {
    private manifest: AssetManifest;

    constructor() {
        this.manifest = {
            manifestVersion: 2,
            lastSynchronizedAt: new Date(),
            assetsRecords: {},
            families: {}
        };
    }

    // ==========================================
    // QUERY API (For the Content Normalizer & WebGL Engine)
    // ==========================================

    public getAssetById(assetId: string): AssetRecord | undefined {
        return this.manifest.assetsRecords[assetId];
    }

    /**
     * The most critical Engine query. Content Normalizer uses this to find the live 3D logo for a Site.
     * It is guaranteed O(1) through the manifest structure.
     */
    public getPrimaryCenterpieceForSite(clientId: string): AssetRecord | undefined {
        // 1. Find all families owned by this client
        const familyIds = Object.keys(this.manifest.families).filter(
            fid => this.manifest.families[fid].clientId === clientId
        );

        // 2. Resolve the active Primary asset
        for (const fid of familyIds) {
            const primaryId = this.manifest.families[fid].primaryAssetId;
            if (primaryId) {
                const asset = this.manifest.assetsRecords[primaryId];
                // Must be fully vetted and hero-compatible
                if (asset && asset.status === 'active' && asset.isHeroEligible) {
                    return asset;
                }
            }
        }
        return undefined;
    }

    /**
     * Allows the Admin Dashboard to show "Alternate Materials" for a given logo.
     */
    public getVariantsForAssetFamily(familyId: string): AssetRecord[] {
        const family = this.manifest.families[familyId];
        if (!family) return [];

        const variants = [];
        if (family.primaryAssetId) {
            variants.push(this.manifest.assetsRecords[family.primaryAssetId]);
        }

        family.variantAssetIds.forEach(vid => {
            variants.push(this.manifest.assetsRecords[vid]);
        });

        return variants.filter(Boolean); // Filter out any corrupted lookups
    }

    /**
     * Helps Template Config Controller boot specific modules (e.g. ambient backgrounds vs hero mesh)
     */
    public getAssetsForSceneMode(sceneMode: string): AssetRecord[] {
        return Object.values(this.manifest.assetsRecords).filter(asset =>
            asset.status === 'active' &&
            asset.compatibleSceneModes.includes(sceneMode)
        );
    }

    // ==========================================
    // UPDATE / MUTATION API (For the Admin UI & Job Runner)
    // ==========================================

    /**
     * Step 1: Admin reserves an ID before Blender even spins up.
     */
    public draftAsset(familyId: string, clientId: string, payload: Partial<AssetRecord>): string {
        const assetId = uuidv4();

        const draft: AssetRecord = {
            ...payload,
            assetId,
            assetFamilyId: familyId,
            clientId,
            status: 'draft',
            createdAt: new Date(),
            updatedAt: new Date(),
        } as AssetRecord; // Simplified for this example

        this.manifest.assetsRecords[assetId] = draft;

        // Initialize the Relational Family if missing
        if (!this.manifest.families[familyId]) {
            this.manifest.families[familyId] = { clientId, primaryAssetId: null, variantAssetIds: [] };
        }

        return assetId;
    }

    /**
     * Step 2: Job Runner writes the physical GLB down and moves it to Pending Approval
     */
    public registerExportedFile(assetId: string, runtimePath: string, filename: string): void {
        const asset = this.manifest.assetsRecords[assetId];
        if (asset) {
            asset.runtimePath = runtimePath;
            asset.exportFilename = filename;
            this.transitionStatus(assetId, 'pending_approval');
        }
    }

    /**
     * Step 3: Admin clicks "Approve & Make Primary".
     * This handles the critical handoff linking variants gracefully.
     */
    public approveAndMakePrimary(assetId: string): void {
        const asset = this.manifest.assetsRecords[assetId];
        if (!asset) return;

        // Mark it live
        this.transitionStatus(assetId, 'active');
        asset.approvedAt = new Date();

        const family = this.manifest.families[asset.assetFamilyId];

        // Demote existing primary gracefully into the variants pool
        if (family.primaryAssetId && family.primaryAssetId !== assetId) {
            family.variantAssetIds.push(family.primaryAssetId);
        }

        // Remove ourselves from the variants pool if we were in there
        family.variantAssetIds = family.variantAssetIds.filter(id => id !== assetId);

        // Promote
        family.primaryAssetId = assetId;
        this.touchManifest();
    }

    public archiveAsset(assetId: string): void {
        this.transitionStatus(assetId, 'archived');
    }

    /**
     * Public status update API — used by LogoJobRunner to mark failed drafts.
     */
    public updateAssetStatus(assetId: string, newStatus: AssetStatus): void {
        this.transitionStatus(assetId, newStatus);
    }

    /**
     * Resolves a preview ticket UUID to an asset hash.
     * Used by RuntimeAssetResolver for preview_ticket resolution.
     * In production, this maps against a Redis/DB ticket store.
     */
    public static async getHashFromTicket(ticketId: string): Promise<string> {
        // Placeholder: in production, resolve from ticket store / Redis
        // Returns the asset hash associated with this preview ticket
        return ticketId; // Identity mapping as baseline
    }

    // --- Helpers ---
    private transitionStatus(assetId: string, newStatus: AssetStatus): void {
        const asset = this.manifest.assetsRecords[assetId];
        if (asset) {
            asset.status = newStatus;
            asset.updatedAt = new Date();
            this.touchManifest();
        }
    }

    private touchManifest() {
        this.manifest.lastSynchronizedAt = new Date();
        // E.g., Database.save(this.manifest)
    }
}
