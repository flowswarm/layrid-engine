/**
 * src/admin/architecture/AnalyticsOperationsRoutes.ts
 * 
 * Formalized Vue/Nuxt routing architecture for the Analytics & Performance Console.
 * Directly maps cross-domain metrics (Jobs, Queue, Deployments) into drill-down UI bindings.
 */

import { RouteRecordRaw } from 'vue-router';

// ============================================================================
// 1. FINAL ROUTE & PAGE STRUCTURE
// ============================================================================
export const AnalyticsOperationsRoutes: RouteRecordRaw[] = [
    {
        // Global Operations Dashboard: Cross-domain observability over all pipelines.
        path: '/admin/analytics',
        name: 'GlobalPerformanceDashboard',
        component: () => import('../pages/analytics/GlobalPerformanceDashboard.vue'),
        meta: {
            title: 'Global Analytics & Performance',
            requireRole: ['observer', 'reviewer', 'approver', 'publisher', 'project_manager', 'admin'],
            navGroup: 'analytics',
            auditContext: 'analytics.global'
        }
    }
    // Future deep-dives (e.g., /admin/analytics/jobs) can be registered here.
];

// ============================================================================
// 2. METRIC & FILTER MODELS
// ============================================================================

export interface AnalyticsFilterContext {
    timeRange: '24h' | '7d' | '30d' | '90d' | 'all-time';
    siteId?: string;           // Isolate an entire client's throughput
    familyId?: string;         // Isolate a specific asset family
    assignedUserId?: string;   // Manager reviewing a specific operator's workload
    sourceType?: 'imported-logo' | 'text-generated';
}

export interface MetricDefinition {
    id: string;
    label: string;
    value: number | string;
    format: 'number' | 'percentage' | 'duration' | 'currency';

    // Trend Context
    trendDelta?: number;       // +5, -12
    trendDirection?: 'up' | 'down' | 'flat';
    trendDesirability?: 'good' | 'bad' | 'neutral'; // determines color: red/green

    // Drill-Down Binding
    // Points exactly to the target UI route with pre-applied Query params bridging the data.
    drillDownRoute?: {
        name: string;          // e.g., 'JobOperationsDashboard'
        path: string;          // e.g., '/admin/jobs'
        query: Record<string, string>; // e.g., { statusCategory: 'failed', timeRange: '7d' }
    };

    // RBAC Security
    requiredCapabilities: string[]; // e.g., ['analytics:global'] or ['deployment:publish']
}

// ============================================================================
// 3. INTERNAL METRIC AGGREGATION MAPPINGS (Reference)
// ============================================================================
/**
 * GENERATOR METRICS (Job Monitor Origin)
 * - total_jobs -> count of jobs mapped in JobRegistry
 * - failure_rate -> (failed / total) * 100
 * - avg_duration -> sum(exportAt - startAt) / completed
 * 
 * QUEUE & APPROVAL METRICS (Revision Queue Origin)
 * - avg_approval_time -> sum(approvedAt - requestedAt) / total_approved
 * - queue_backlog -> count of items where status is 'open' or 'in-progress'
 * 
 * DEPLOYMENT METRICS (Site Deployment Sync Origin)
 * - rollback_frequency -> count of DeploymentHistory logs where action === 'rollback'
 * - sync_failure_rate -> count of failed sync logs / total logs
 */
