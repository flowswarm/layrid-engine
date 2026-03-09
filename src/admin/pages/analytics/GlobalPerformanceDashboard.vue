<!-- src/admin/pages/analytics/GlobalPerformanceDashboard.vue -->
<template>
  <div class="analytics-dashboard-page">
    
    <!-- PAGE HEADER -->
    <header class="page-header">
       <div class="header-lockup">
           <h2>Global Operations & Performance</h2>
           <p class="subtitle">Cross-domain pipeline health, workflow bottlenecks, and edge sync diagnostics.</p>
       </div>
       
       <!-- GLOBAL OPERATIONAL FILTER -->
       <div class="global-filter-panel">
          <div class="filter-group">
              <label>Timeframe</label>
              <select v-model="filters.timeRange">
                  <option value="24h">Last 24 Hours</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="90d">Last 90 Days</option>
              </select>
          </div>
          <div class="filter-group">
              <label>Client / Site</label>
              <select v-model="filters.siteId">
                  <option value="all">All Sites Globally</option>
                  <option value="site-a">Alpha Client (Site A)</option>
                  <option value="site-b">Beta Brand (Site B)</option>
              </select>
          </div>
          <div class="filter-group">
              <label>Source Type</label>
              <select v-model="filters.sourceType">
                  <option value="all">All Generator Types</option>
                  <option value="imported-logo">SVG Imports Only</option>
                  <option value="text-generated">Procedural Text Only</option>
              </select>
          </div>
       </div>
    </header>

    <!-- PIPELINE FUNNEL VISUALIZATION -->
    <section class="funnel-section">
        <h3>Asset Pipeline Volume Funnel</h3>
        <div class="funnel-viz">
            <div class="funnel-step primary">
                <span class="count">245</span>
                <span class="label">Total Raw Jobs</span>
            </div>
            <div class="funnel-arrow">&rarr;</div>
            <div class="funnel-step success">
                <span class="count">210</span>
                <span class="label">Assets Exported (85%)</span>
            </div>
            <div class="funnel-arrow">&rarr;</div>
            <div class="funnel-step pending">
                <span class="count">142</span>
                <span class="label">Client Approved (67%)</span>
            </div>
            <div class="funnel-arrow">&rarr;</div>
            <div class="funnel-step live">
                <span class="count">138</span>
                <span class="label">Synced Edge (97%)</span>
            </div>
        </div>
    </section>

    <!-- METRICS GRID: Divided logically by Operational Domain -->
    
    <div class="metrics-grid">
        
        <!-- DOMAIN 1: Blender MCP / Generator Health (Admin/Operators) -->
        <div class="domain-group" v-if="permissions.canViewJobs">
            <h3>⚙️ Generation Health (Job Runner)</h3>
            <div class="card-row">
                <MetricSummaryCard :metric="mJobCompletion" />
                <!-- INTEG 4: Concrete Job Failure Drill down -->
                <MetricSummaryCard :metric="mJobFailure" subtitle="Requires attention. SVG meshes often cause spikes." />
                <MetricSummaryCard :metric="mJobDuration" subtitle="Time from queue pick to final .glb Registry hash." />
            </div>
        </div>

        <!-- DOMAIN 2: Revision Queue & Workflow (Reviewers/PMs) -->
        <div class="domain-group" v-if="permissions.canViewQueue">
            <h3>📝 Workflow & Feedback (Revision Queue)</h3>
            <div class="card-row">
                <MetricSummaryCard :metric="mQueueBacklog" />
                <MetricSummaryCard :metric="mAvgRevisions" />
                <!-- INTEG 5: Concrete Approval Delay drill down -->
                <MetricSummaryCard :metric="mApprovalTurnaround" subtitle="Time spent 'Pending Client Signoff'." />
            </div>
        </div>

        <!-- DOMAIN 3: Rollouts & Live Ops (Publishers) -->
        <div class="domain-group" v-if="permissions.canViewDeployments">
            <h3>🚀 Edge Sync & Rollouts (Deployments)</h3>
            <div class="card-row">
                <MetricSummaryCard :metric="mTotalPublishes" />
                <MetricSummaryCard :metric="mSyncFailures" subtitle="Edge cache invalidation timeouts." />
                <!-- INTEG 6: Concrete Rollback drill down -->
                <MetricSummaryCard :metric="mRollbackFreq" subtitle="Emergency restorations of previously active hashes." />
            </div>
        </div>

    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useAdminSession } from '../../store/useAdminSession';
import MetricSummaryCard from '../../components/analytics/MetricSummaryCard.vue';
import { AnalyticsFilterContext, MetricDefinition } from '../../architecture/AnalyticsOperationsRoutes';

const session = useAdminSession();

// INTEGRATION 6: Role Based Analytic Visibility Blocking
const permissions = ref({
    canViewJobs: session.hasCapability('analytics:global') || session.hasCapability('job.execution:manage'),
    canViewQueue: session.hasCapability('analytics:global') || session.hasCapability('queue:review'),
    canViewDeployments: session.hasCapability('analytics:global') || session.hasCapability('deployment:publish')
});

const filters = ref<AnalyticsFilterContext>({
    timeRange: '30d',
    siteId: 'all',
    sourceType: 'all'
});

// INTEG 1: Job Runner Data -> Job Performance Metrics
const mJobCompletion = ref<MetricDefinition>({ id: 'job_comp', label: 'Job Completion Rate', value: 85, format: 'percentage', trendDelta: 5, trendDirection: 'up', trendDesirability: 'good', requiredCapabilities: [] });

// INTEG 4: Drill-down explicitly pushing `statusCategory: 'failed'` to the Job Dashboard
const mJobFailure = ref<MetricDefinition>({ 
    id: 'job_fail', label: 'Job Failure Rate', value: 15, format: 'percentage', trendDelta: 5, trendDirection: 'up', trendDesirability: 'bad',
    drillDownRoute: { name: 'JobOperationsDashboard', path: '/admin/jobs', query: { statusCategory: 'failed', timeRange: '30d' } },
    requiredCapabilities: [] 
});

const mJobDuration = ref<MetricDefinition>({ id: 'job_dur', label: 'Avg Execution Latency', value: 38000, format: 'duration', trendDelta: 4000, trendDirection: 'down', trendDesirability: 'good', requiredCapabilities: [] });

// INTEG 2: Revision Queue Data -> Backlog metrics
// Drill-down specifically isolating the Queue status backlogs.
const mQueueBacklog = ref<MetricDefinition>({ 
    id: 'q_backlog', label: 'Active Queue Backlog', value: 42, format: 'number', trendDelta: 12, trendDirection: 'up', trendDesirability: 'neutral',
    drillDownRoute: { name: 'RevisionQueueDashboard', path: '/admin/queue', query: { queueStatus: 'open,in-progress' } },
    requiredCapabilities: [] 
});

const mAvgRevisions = ref<MetricDefinition>({ id: 'q_avg_rev', label: 'Avg Revisions per Asset', value: 1.8, format: 'number', trendDelta: 0.2, trendDirection: 'down', trendDesirability: 'good', requiredCapabilities: [] });

// INTEG 5: Client Approval Data -> Workflow Review delays
const mApprovalTurnaround = ref<MetricDefinition>({ 
    id: 'aprv_turn', label: 'Avg Approval Turnaround', value: 172800000 /* 48 Hours */, format: 'duration', trendDelta: 36000000 /* 10 hours worse */, trendDirection: 'up', trendDesirability: 'bad',
    drillDownRoute: { name: 'RevisionQueueDashboard', path: '/admin/queue', query: { queueStatus: 'pending_approval' } },
    requiredCapabilities: [] 
});

// INTEG 3: Publishing & Deployment Data -> Rollout operations
const mTotalPublishes = ref<MetricDefinition>({ id: 'dep_pub', label: 'Total Publishing Syncs', value: 88, format: 'number', trendDelta: 20, trendDirection: 'down', trendDesirability: 'neutral', requiredCapabilities: [] });

const mSyncFailures = ref<MetricDefinition>({ 
    id: 'dep_fail', label: 'Edge Sync Failures', value: 2, format: 'number', trendDelta: 0, trendDirection: 'flat', trendDesirability: 'bad',
    drillDownRoute: { name: 'DeploymentDashboard', path: '/admin/deployments', query: { syncStatus: 'failed' } },
    requiredCapabilities: [] 
});

// INTEG 6: Action Rollback Log history -> Rollback Frequency Drilldown
const mRollbackFreq = ref<MetricDefinition>({ 
    id: 'dep_roll', label: 'Action: Rollbacks Invoked', value: 4, format: 'number', trendDelta: 2, trendDirection: 'up', trendDesirability: 'bad',
    drillDownRoute: { name: 'DeploymentDashboard', path: '/admin/deployments', query: { actionType: 'rollback' } },
    requiredCapabilities: [] 
});

const fetchMetrics = () => {
    // In production: `await AnalyticsService.getGlobalMetrics(filters.value)`
    // Applies `siteId` filters aggressively mutating values mathematically.
    console.log("Re-hydrating metrics for bounds: ", filters.value);

    // MOCK: Updating drill-down URLs explicitly to inherit the global context (e.g. timeRange).
    // so clicking the Failure Rate card jumps exactly to Failed jobs *IN THE LAST 7 DAYS*.
    mJobFailure.value.drillDownRoute!.query.timeRange = filters.value.timeRange;
    mApprovalTurnaround.value.drillDownRoute!.query.timeRange = filters.value.timeRange;
    mRollbackFreq.value.drillDownRoute!.query.timeRange = filters.value.timeRange;

    if (filters.value.siteId !== 'all') {
        mRollbackFreq.value.drillDownRoute!.query.siteId = filters.value.siteId;
    } else {
        delete mRollbackFreq.value.drillDownRoute!.query.siteId;
    }
};

watch(filters, fetchMetrics, { deep: true });
onMounted(fetchMetrics);

</script>

<style scoped>
.analytics-dashboard-page { padding: 32px; color: #f8fafc; }
.header-lockup h2 { margin: 0 0 8px 0; }
.subtitle { margin: 0 0 24px 0; color: #94a3b8; font-size: 14px; }

.page-header { margin-bottom: 32px; }

.global-filter-panel {
    background: #0f172a; border: 1px solid #334155; padding: 20px; border-radius: 8px;
    display: flex; gap: 24px; align-items: center;
}
.filter-group { display: flex; flex-direction: column; gap: 6px; }
.filter-group label { font-size: 11px; text-transform: uppercase; font-weight: bold; color: #64748b; }
.filter-group select { background: #1e293b; color: #f8fafc; border: 1px solid #334155; padding: 8px 12px; border-radius: 6px; min-width: 200px;}

.funnel-section { margin-bottom: 48px; }
.funnel-section h3 { font-size: 16px; margin-bottom: 24px; color: #e2e8f0; }
.funnel-viz { display: flex; align-items: center; justify-content: space-between; background: #1e293b; padding: 32px; border-radius: 8px; border: 1px solid #334155;}
.funnel-step { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.funnel-step .count { font-size: 32px; font-weight: bold; font-family: monospace; }
.funnel-step .label { font-size: 12px; font-weight: bold; text-transform: uppercase; }
.funnel-step.primary { color: #3b82f6; }
.funnel-step.success { color: #10b981; }
.funnel-step.pending { color: #f59e0b; }
.funnel-step.live { color: #8b5cf6; }
.funnel-arrow { color: #475569; font-size: 24px; font-weight: bold; }

.metrics-grid { display: flex; flex-direction: column; gap: 40px; }
.domain-group h3 { font-size: 14px; color: #e2e8f0; border-bottom: 1px solid #334155; padding-bottom: 12px; margin-bottom: 20px;}
.card-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
</style>
