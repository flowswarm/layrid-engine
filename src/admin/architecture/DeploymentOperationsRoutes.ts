/**
 * src/admin/architecture/DeploymentOperationsRoutes.ts
 * 
 * Formalized Vue/Nuxt routing architecture for the Deployment / CDN Sync Console.
 * Directly maps the SiteDeploymentSync layer and physical CDN rollout arrays against the UI.
 */

import { RouteRecordRaw } from 'vue-router';

// ============================================================================
// 1. FINAL ROUTE & PAGE STRUCTURE
// ============================================================================
export const DeploymentOperationsRoutes: RouteRecordRaw[] = [
    {
        // Global Live Ops Dashboard: Surfaces current live mappings, pending publishes, and sync failures.
        path: '/admin/deployments',
        name: 'DeploymentOperationsDashboard',
        component: () => import('../pages/deployments/DeploymentDashboard.vue'),
        meta: {
            title: 'Live Operations',
            requireRole: ['observer', 'reviewer', 'approver', 'publisher', 'project_manager', 'admin'],
            navGroup: 'operations',
            auditContext: 'deployment.dashboard'
        }
    },
    {
        // Specific Mapped Target Inspection: Inspecting the exact rollback paths, CDN invalidation statuses, and diffs.
        path: '/admin/deployments/target/:siteId/:sceneRole',
        name: 'DeploymentTargetDetail',
        component: () => import('../pages/deployments/DeploymentTargetDetail.vue'),
        meta: {
            title: 'Live Mapping Inspection',
            requireRole: ['observer', 'reviewer', 'approver', 'publisher', 'project_manager', 'admin'],
            navGroup: 'operations',
            auditContext: 'deployment.inspect'
        }
    }
];

/**
 * RECOMMENDED FILE STRUCTURE:
 * 
 * src/admin/
 *  ├─ pages/
 *  │   ├─ deployments/
 *  │   │   ├─ DeploymentDashboard.vue         (Aggregate views: Live now, failures, history)
 *  │   │   └─ DeploymentTargetDetail.vue      (Atomic Rollback/Publish interface per Scene Target)
 *  ├─ components/
 *  │   └─ deployments/
 *  │       ├─ LiveMappingCard.vue             (Visualizes current Live hash vs preview hash)
 *  │       ├─ SyncStatusIndicator.vue         (Pulsing indicators: Syncing, Failed, Synced)
 *  │       ├─ PublishingDiffViewer.vue        (Shows exactly what changed between previous->current)
 *  │       └─ DeploymentAuditLog.vue          (Action history: Approvals, Publications, Rollbacks)
 */

// ============================================================================
// 2. LIVE MAPPING & DEPLOYMENT MODEL (Derived from DeploymentSync API)
// ============================================================================

export interface LiveMappingState {
    siteId: string;
    clientId: string;
    sceneRole: string; // e.g., 'hero-centerpiece'

    // Core Resolution
    currentLiveAssetId: string;   // The hash currently executing on the public site
    currentFamilyId: string;

    // Deployment Security / Rollback bounds
    previousLiveAssetId?: string; // What was live 5 minutes ago?
    latestApprovedAssetId?: string; // What is waiting to be pushed?

    // Sync Resolution
    syncStatus: 'synced' | 'syncing' | 'failed' | 'partially-synced';
    lastSuccessfulSync?: string;
    lastFailedSync?: string;

    // Traceability
    publishedBy: string;
    publishedAt: string;
}

export interface DeploymentHistoryLog {
    id: string;
    siteId: string;
    sceneRole: string;
    action: 'publish' | 'rollback' | 'sync-retry' | 'system-invalidation';
    targetAssetId: string;
    previousAssetId?: string;
    actorId: string;
    timestamp: string;
    syncResult: 'success' | 'failed';
    diagnosticMessage?: string;
    linkedApprovalTicketId?: string; // Binds the structural "Why"
}

// ============================================================================
// 3. FILTER / SEARCH MODEL
// ============================================================================

export interface DeploymentFilterState {
    query: string;                // Checks siteId, assetId, clientId

    // Deployment groupings
    syncStatuses: LiveMappingState['syncStatus'][];

    // Temporal bindings
    publishedWithinDays?: number;
    hasRollbackAvailable: boolean;
    hasPendingPublish: boolean;

    siteIds: string[];

    sortBy: 'publishedAt' | 'lastSuccessfulSync' | 'siteId';
    sortOrder: 'asc' | 'desc';
}
