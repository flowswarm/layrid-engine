/**
 * src/admin/architecture/JobMonitorRoutes.ts
 * 
 * Formalized Vue/Nuxt routing architecture for the Logo Asset Job Runner Console.
 * Directly maps against physical Orchestrator bounds preserving execution transparency.
 */

import { RouteRecordRaw } from 'vue-router';

// ============================================================================
// 1. FINAL ROUTE & PAGE STRUCTURE
// ============================================================================
export const JobMonitorRoutes: RouteRecordRaw[] = [
    {
        // Global Dashboard: Combines Queues, Active Runners, and Failure States
        path: '/admin/jobs',
        name: 'JobOperationsDashboard',
        component: () => import('../pages/jobs/JobOperationsDashboard.vue'),
        meta: {
            title: 'Job Monitor',
            requireRole: ['observer', 'reviewer', 'approver', 'publisher', 'project_manager', 'asset_operator'],
            navGroup: 'operations',
            auditContext: 'job_monitor.dashboard'
        }
    },
    {
        // Specific Job Execution Detail: Inspecting the exact Payload, Error Logs, and Registry Binding
        path: '/admin/jobs/:jobId',
        name: 'JobExecutionDetail',
        component: () => import('../pages/jobs/JobExecutionDetail.vue'),
        meta: {
            title: 'Job Inspection',
            requireRole: ['observer', 'reviewer', 'approver', 'publisher', 'project_manager', 'asset_operator'],
            navGroup: 'operations',
            auditContext: 'job_monitor.inspect'
        }
    }
];

/**
 * RECOMMENDED FILE STRUCTURE:
 * 
 * src/admin/
 *  ├─ pages/
 *  │   ├─ jobs/
 *  │   │   ├─ JobOperationsDashboard.vue    (Top level aggregate view + Tables)
 *  │   │   └─ JobExecutionDetail.vue        (Atomic Payload/Log Inspection)
 *  ├─ components/
 *  │   └─ jobs/
 *  │       ├─ JobFilterPanel.vue            (Queue states, Source type)
 *  │       ├─ JobStatusPill.vue             (Uniform indicator: Rendering, Failed, etc)
 *  │       ├─ LogViewer.vue                 (Raw Blender stdout/stderr console)
 *  │       └─ JobMetricsWidget.vue          (Time/Duration/Retry Counters)
 */

// ============================================================================
// 2. FINAL JOB FILTER / SEARCH MODEL
// ============================================================================

export interface JobFilterState {
    query: string;                // Checks jobId, assetFamilyId, siteId

    // Core Execution Status Groupings
    statuses: (
        'queued' | 'validating' | 'preparing' | 'processing' |
        'exporting' | 'registering' | 'completed' | 'failed' |
        'retried' | 'cancelled' | 'archived'
    )[];

    // Specific Pipeline Intersections
    sourceTypes: ('imported-logo' | 'text-generated' | 'procedural')[];
    materialPresets: string[];

    // Human Mapping
    assignedOperatorIds: string[];

    siteIds: string[];

    // Sorting parameters explicitly tracking performance
    sortBy: 'createdAt' | 'startedAt' | 'completedAt' | 'duration' | 'retryCount';
    sortOrder: 'asc' | 'desc';
}

// ============================================================================
// 3. JOB EXECUTION MODEL (Derived from pipeline orchestration)
// ============================================================================

export interface PipelineExecutionJob {
    jobId: string;
    siteId: string;
    familyId: string;

    // The exact configuration parameters injected into the MCP/Blender
    payload: {
        sourceType: string;
        materialPreset: string;
        extrusionDepth?: number;
        bevelAmount?: number;
        targetFilename: string;
    };

    status: JobFilterState['statuses'][number];

    // Progression & Diagnostics
    retryCount: number;
    assignedOperator?: string;

    // Time boundaries
    events: {
        createdAt: string;
        startedAt?: string;
        exportCompletedAt?: string;
        failedAt?: string;
        registeredAt?: string;
    };

    // Output Connectors
    linkedOutputAssetId?: string;    // Binds directly to the AssetRegistry
    sourceRevisionQueueId?: string;  // Bound to the Request layer

    // Raw logging context
    diagnosticLogs?: Array<{ timestamp: string; level: 'info' | 'warn' | 'error'; message: string }>;
}
