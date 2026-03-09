<!-- src/admin/pages/jobs/JobOperationsDashboard.vue -->
<template>
  <div class="job-dashboard-page">
    <header class="page-header">
       <h2>Generation Operations Console</h2>
       
       <!-- GLOBAL DASHBOARD WIDGETS -->
       <div class="metrics-row">
           <div class="metric-card active">
               <span class="val">{{ metrics.running }}</span>
               <span class="lbl">Running Jobs</span>
           </div>
           <div class="metric-card queued">
               <span class="val">{{ metrics.queued }}</span>
               <span class="lbl">In Queue</span>
           </div>
           <div class="metric-card failed">
               <span class="val">{{ metrics.failed }}</span>
               <span class="lbl">Failed (Attention Needed)</span>
           </div>
           <div class="metric-card history">
               <span class="val">{{ metrics.completed24h }}</span>
               <span class="lbl">Exported (24h)</span>
           </div>
       </div>

       <!-- THE FILTER CONSOLE -->
       <div class="filter-bar">
         <div class="search-group">
            <input type="text" placeholder="Search Job ID, Family ID, Revision Ticket..." v-model="filters.query" />
         </div>

         <div class="select-group">
            <select v-model="filters.statusCategory">
                <option value="all">All States</option>
                <option value="active">Active (Processing, Exporting)</option>
                <option value="failed">Failed / Retried</option>
                <option value="completed">Registered Success</option>
            </select>

            <select v-model="filters.sourceType">
                <option value="all">All Pipeline Paths</option>
                <option value="imported-logo">SVG Rasterization</option>
                <option value="text-generated">Text Node Generative</option>
            </select>
         </div>
       </div>
    </header>

    <!-- THE OPERATIONS DATA GRID -->
    <!-- Maps physical execution processes linearly against real time constraints -->
    <div class="job-list-container">
        <table class="ops-table">
            <thead>
                <tr>
                    <th>Job ID</th>
                    <th>Status Phase</th>
                    <th>Target Family</th>
                    <th>Source Type</th>
                    <th>Runtime</th>
                    <th>Diagnostic Logs</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="job in filteredJobs" :key="job.jobId" class="job-row">
                    <!-- Navigates deep into the execution payload -->
                    <td class="id-col">
                        <router-link :to="`/admin/jobs/${job.jobId}`">{{ formatId(job.jobId) }}</router-link>
                        <div v-if="job.retryCount > 0" class="retry-badge" title="Job had to be retried">
                           &#8635; x{{ job.retryCount }}
                        </div>
                    </td>
                    
                    <td><JobStatusPill :status="job.status" /></td>
                    
                    <td class="family-col">
                       <!-- Direct linkage back to the Library UI -->
                       <router-link :to="`/admin/library/family/${job.familyId}`">{{ formatId(job.familyId) }}</router-link>
                    </td>
                    
                    <td><span class="source-tag">{{ job.payload.sourceType }}</span></td>
                    
                    <td class="time-col">
                        <span class="duration" v-if="job.events.startedAt">
                            {{ calculateDuration(job.events.startedAt, job.events.exportCompletedAt || job.events.failedAt) }}
                        </span>
                        <span class="started" v-else>Queued</span>
                    </td>

                    <td class="logs-col">
                        <span class="log-indicator" :class="getHighestLogLevel(job)">
                            {{ getLogSummary(job) }}
                        </span>
                    </td>

                    <td class="actions-col">
                        <!-- RBAC Operator action: Quick retry straight from table -->
                        <button 
                           class="btn-icon danger" 
                           v-if="job.status === 'failed' && canManageJobs"
                           @click.stop="retryJob(job.jobId)"
                           title="Force Retry Execution"
                        >&#8635;</button>

                        <button class="btn-icon view" @click="openJob(job.jobId)">&#x2794;</button>
                    </td>
                </tr>
                <tr v-if="filteredJobs.length === 0">
                    <td colspan="7" class="empty-state">No execution jobs matching criteria.</td>
                </tr>
            </tbody>
        </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAdminSession } from '../../store/useAdminSession';
import JobStatusPill from '../../components/jobs/JobStatusPill.vue';
import { PipelineExecutionJob } from '../../architecture/JobMonitorRoutes';

const router = useRouter();
const session = useAdminSession();

const canManageJobs = computed(() => session.hasCapability('job.execution:manage'));

const metrics = ref({ running: 0, queued: 0, failed: 0, completed24h: 0 });
const jobs = ref<PipelineExecutionJob[]>([]);

const filters = ref({
    query: '',
    statusCategory: 'all',
    sourceType: 'all'
});

onMounted(() => {
    // Mathmatically resolves to Orchestrator API endpoint `/jobs/status`
    jobs.value = [
        {
            jobId: 'job-svg-chrome-1', siteId: 'site-a', familyId: 'fam-1234',
            payload: { sourceType: 'imported-logo', materialPreset: 'chrome', targetFilename: 'output.glb' },
            status: 'processing', retryCount: 0,
            events: { createdAt: new Date().toISOString(), startedAt: new Date(Date.now() - 30000).toISOString() },
            diagnosticLogs: [{ timestamp: '', level: 'info', message: 'Blender initialized context...' }]
        },
        {
            jobId: 'job-fail-matte-2', siteId: 'site-a', familyId: 'fam-1234',
            payload: { sourceType: 'imported-logo', materialPreset: 'matte', targetFilename: 'output-matte.glb' },
            status: 'failed', retryCount: 1,
            events: { createdAt: new Date(Date.now() - 3600000).toISOString(), startedAt: new Date(Date.now() - 3500000).toISOString(), failedAt: new Date(Date.now() - 3400000).toISOString() },
            diagnosticLogs: [{ timestamp: '', level: 'error', message: 'ERROR 0x99: WebGL Context Lost during MCP extrusion.' }]
        },
        {
            jobId: 'job-text-glass-3', siteId: 'site-b', familyId: 'fam-9876',
            payload: { sourceType: 'text-generated', materialPreset: 'glass', targetFilename: 'output-glass.glb' },
            status: 'completed', retryCount: 0,
            linkedOutputAssetId: 'hash-abc-live',
            events: { createdAt: new Date(Date.now() - 7200000).toISOString(), startedAt: new Date(Date.now() - 7000000).toISOString(), exportCompletedAt: new Date(Date.now() - 6500000).toISOString() },
        }
    ];

    // Hydrate top widgets
    metrics.value = {
        running: jobs.value.filter(j => j.status === 'processing' || j.status === 'exporting').length,
        queued: jobs.value.filter(j => j.status === 'queued').length,
        failed: jobs.value.filter(j => j.status === 'failed').length,
        completed24h: jobs.value.filter(j => j.status === 'completed').length
    };
});

const filteredJobs = computed(() => {
    return jobs.value.filter(job => {
        if (filters.value.statusCategory === 'active' && !['processing','exporting','registering'].includes(job.status)) return false;
        if (filters.value.statusCategory === 'failed' && !['failed','retried'].includes(job.status)) return false;
        if (filters.value.statusCategory === 'completed' && job.status !== 'completed') return false;
        if (filters.value.sourceType !== 'all' && job.payload.sourceType !== filters.value.sourceType) return false;
        if (filters.value.query && !job.jobId.includes(filters.value.query) && !job.familyId.includes(filters.value.query)) return false;
        return true;
    });
});

const formatId = (id: string) => id.length > 10 ? `...${id.slice(-6)}` : id;

const calculateDuration = (start: string, end?: string) => {
    const s = new Date(start).getTime();
    const e = end ? new Date(end).getTime() : Date.now();
    const diff = e - s;
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${mins}m ${secs}s`;
};

const getHighestLogLevel = (job: PipelineExecutionJob) => {
    if (!job.diagnosticLogs || job.diagnosticLogs.length === 0) return 'clean';
    if (job.diagnosticLogs.some(l => l.level === 'error')) return 'error';
    if (job.diagnosticLogs.some(l => l.level === 'warn')) return 'warn';
    return 'info';
};

const getLogSummary = (job: PipelineExecutionJob) => {
    const level = getHighestLogLevel(job);
    if (level === 'clean') return '-';
    if (level === 'error') return 'Errors Found';
    if (level === 'warn') return 'Warnings';
    return 'Normal';
};

const openJob = (id: string) => router.push(`/admin/jobs/${id}`);
const retryJob = async (id: string) => { /* POST /jobs/id/retry */ };
</script>

<style scoped>
.job-dashboard-page { padding: 32px; color: #f8fafc; }
.page-header h2 { margin-bottom: 24px; }

/* Dashboard Widgets */
.metrics-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
.metric-card { background: #1e293b; border: 1px solid #334155; padding: 20px; border-radius: 8px; display: flex; flex-direction: column; align-items: flex-start; }
.metric-card .val { font-size: 32px; font-weight: bold; font-family: monospace; color: #f8fafc; }
.metric-card .lbl { font-size: 12px; color: #94a3b8; text-transform: uppercase; margin-top: 8px; font-weight: bold;}
.metric-card.active { border-top: 4px solid #3b82f6; }
.metric-card.queued { border-top: 4px solid #eab308; }
.metric-card.failed { border-top: 4px solid #ef4444; }
.metric-card.history { border-top: 4px solid #10b981; }

.filter-bar { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 24px; background: #0f172a; padding: 16px; border-radius: 8px; border: 1px solid #334155;}
.filter-bar input, .filter-bar select { background: #1e293b; color: #e2e8f0; border: 1px solid #334155; padding: 8px 12px; border-radius: 4px; outline: none; }
.search-group { flex: 1; }
.search-group input { width: 100%; max-width: 400px; }
.select-group { display: flex; gap: 12px; }

/* Grid Table */
.ops-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.ops-table th { text-align: left; padding: 12px 16px; background: #1e293b; color: #94a3b8; border-bottom: 1px solid #334155; font-weight: normal; }
.ops-table td { padding: 16px; border-bottom: 1px solid #1e293b; vertical-align: middle; }
.job-row:hover { background: rgba(30, 41, 59, 0.5); }

.id-col a { color: #f8fafc; font-weight: bold; font-family: monospace; text-decoration: none; }
.id-col a:hover { text-decoration: underline; color: #3b82f6; }
.retry-badge { display: inline-block; margin-left: 8px; font-size: 10px; color: #ef4444; font-family: sans-serif; }

.family-col a { color: #cbd5e1; text-decoration: none; font-family: monospace;}
.family-col a:hover { color: #3b82f6; }

.source-tag { background: #334155; padding: 2px 6px; border-radius: 4px; font-size: 11px; }

.duration { font-family: monospace; color: #e2e8f0; }
.started { color: #94a3b8; font-style: italic; }

.log-indicator { font-size: 11px; padding: 2px 6px; border-radius: 4px; }
.log-indicator.error { color: #ef4444; background: rgba(239, 68, 68, 0.1); }
.log-indicator.warn { color: #f59e0b; background: rgba(245, 158, 11, 0.1); }
.log-indicator.info { color: #94a3b8; }
.log-indicator.clean { color: #64748b; }

.actions-col { display: flex; gap: 8px; }
.btn-icon { background: #1e293b; border: 1px solid #334155; color: #cbd5e1; width: 28px; height: 28px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; }
.btn-icon:hover { border-color: #3b82f6; color: white; }
.btn-icon.danger:hover { border-color: #ef4444; color: #ef4444; }

.empty-state { text-align: center; color: #64748b; padding: 48px !important; }
</style>
