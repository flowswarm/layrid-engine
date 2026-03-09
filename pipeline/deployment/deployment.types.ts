import { z } from 'zod';

/**
 * 1. REFINED SITE-LEVEL PUBLISHING MAPPING SCHEMA
 * 
 * Separates "Physical Status" (Workflow/Registry) from "Live Routing" (Deployment).
 * This mapping acts as the production DNS layer for 3D assets.
 */

// Environments allow safe testing without impacting the primary user traffic
export const DeploymentEnvironmentEnum = z.enum(['production', 'preview', 'staging']);
export type DeploymentEnvironment = z.infer<typeof DeploymentEnvironmentEnum>;

// Represents a single active route assignment
export const PublishedRouteSlotSchema = z.object({
    deploymentId: z.string().uuid().describe('Unique ID for this specific deployment event for audit tracing'),

    // The Exact Physical Asset ID mapped to this slot
    activeAssetId: z.string().uuid(),

    // O(1) Rollback Support
    previousAssetId: z.string().uuid().nullable().describe('The asset that was demoted to make room for this one'),

    // Audit Trail & Safety
    publishedAt: z.date(),
    publishedBy: z.string().uuid().describe('Admin/System UUID that authorized the route change'),

    // CDN Cache Busting / Webhook Support
    deploymentChecksum: z.string().min(8),

    // Feature flag for Scheduled publish execution
    scheduledFor: z.date().optional()
});

export type PublishedRouteSlot = z.infer<typeof PublishedRouteSlotSchema>;


/**
 * The Global Site Deployment Manifest
 * The single JSON-serializable structure Content Normalizer reads.
 * 
 * Hierarchy: [ClientId] -> [Environment] -> [SceneRole] -> PublishedRouteSlot
 */
export const SiteDeploymentManifestSchema = z.object({
    version: z.number().default(2),
    lastSyncedAt: z.date(),

    sites: z.record(
        z.string().uuid().describe('Client/Site ID'),
        z.object({
            environments: z.record(
                DeploymentEnvironmentEnum,
                z.object({
                    roles: z.record(
                        z.string().describe('Scene Role e.g., hero-centerpiece'),
                        PublishedRouteSlotSchema
                    )
                })
            )
        })
    )
});

export type SiteDeploymentManifest = z.infer<typeof SiteDeploymentManifestSchema>;
