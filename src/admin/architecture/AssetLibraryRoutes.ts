/**
 * src/admin/architecture/AssetLibraryRoutes.ts
 * 
 * Production-ready routing architecture and type schemas for the Asset Library & Variant Browser.
 * Maps the exact navigation pathways required to browse, inspect, and operate on generated assets.
 */

import { RouteRecordRaw } from 'vue-router';

// ============================================================================
// 1. FINAL ROUTE STRUCTURE CLARITY
// ============================================================================
export const AssetLibraryRoutes: RouteRecordRaw[] = [
    {
        // The Root Browser: Aggregates Asset Families globally based on complex filters.
        path: '/admin/library',
        name: 'AssetBrowserList',
        component: () => import('../pages/library/AssetBrowserList.vue'),
        meta: {
            title: 'Asset Library',
            requireRole: ['observer', 'reviewer', 'approver', 'publisher', 'project_manager'],
            navGroup: 'library',
            auditContext: 'asset_library.browse'
        }
    },
    {
        // The Structural Overview: Maps the base mesh against its contextual variations (Chrome/Matte, Live/Archived).
        path: '/admin/library/family/:familyId',
        name: 'AssetFamilyDetail',
        component: () => import('../pages/library/FamilyDetailView.vue'),
        meta: {
            title: 'Family Details',
            requireRole: ['observer', 'reviewer', 'approver', 'publisher', 'project_manager'],
            navGroup: 'library',
            auditContext: 'asset_family.view'
        }
    },
    {
        // The Atomic Hash Execution Context: Deep dive into a single generated asset and trigger pipeline actions.
        path: '/admin/library/asset/:assetId',
        name: 'AssetVariantDetail',
        component: () => import('../pages/library/AssetVariantDetail.vue'),
        meta: {
            title: 'Variant Inspection',
            requireRole: ['observer', 'reviewer', 'approver', 'publisher', 'project_manager'],
            navGroup: 'library',
            auditContext: 'asset_variant.inspect'
        }
    }
];

// ============================================================================
// 2. FINAL FAMILY VS VARIANT MODELING
// ============================================================================

/** The structural grouping of an original request and all its generated outputs */
export interface AssetFamilyModel {
    familyId: string;           // e.g., "fam-logo-xyz"
    siteId: string;             // Multi-tenant boundary
    clientId: string;
    sceneRole: string;          // e.g., "hero-centerpiece"
    primaryHash: string | null; // The currently 'live' or preferred variant
    variants: AssetVariantModel[];
    activeThumbnailUrl?: string;
    createdAt: string;
    updatedAt: string;
}

/** The atomic generated output (e.g., a specific .glb file run through Blender) */
export interface AssetVariantModel {
    assetId: string;            // The exact hash
    familyId: string;
    status: 'generating' | 'reviewing' | 'approved' | 'published' | 'archived' | 'rejected' | 'failed';

    // Physical Characteristics
    materialPreset: 'chrome' | 'matte' | 'glass' | 'custom';
    sourceType: 'imported-logo' | 'text-generated' | 'procedural';

    // Integration linkages
    queueItemId?: string;       // Did a revision ticket spawn this?
    sourceJobId?: string;       // Which Blender orchestrator job made this?

    // Runtime outputs
    runtimePath?: string;       // CDN bucket path
    thumbnailUrl?: string;      // Still render

    // Audit Metadata
    createdBy: string;
    approvedBy?: string;
    publishedBy?: string;
    createdAt: string;
    updatedAt: string;
}

// ============================================================================
// 3. FINAL FILTER / SEARCH MODEL
// ============================================================================

/** 
 * Unified filter state managed by Pinia. Keeps navigation stateful so users don't 
 * lose their complex query when clicking 'back' from a detail page.
 */
export interface AssetFilterState {
    query: string;               // Deep searches assetId, familyId, queueItemId

    // Top-Level Categorization
    siteIds: string[];           // Array allows multi-select (e.g., comparing 2 sites)
    sceneRoles: string[];

    // Status Aggregations
    statuses: AssetVariantModel['status'][];
    isLive: boolean | null;      // True = must be published. Null = don't care.
    hasActionRequired: boolean;  // True = filter to assets waiting on me (approval/review)

    // Generation Characteristics
    materialPresets: string[];
    sourceTypes: string[];

    // Sorting preferences
    sortBy: 'updatedAt' | 'createdAt' | 'status' | 'siteId';
    sortOrder: 'asc' | 'desc';
}
