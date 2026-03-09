<!-- src/admin/pages/jobs/JobExecutionDetail.vue -->
<template>
  <div class="job-detail-page" v-if="job">
    
    <header class="detail-header">
       <div class="breadcrumb">
           <router-link to="/admin/jobs">Job Operations Dashboard</router-link> 
           <span class="divider">/</span> 
           Execution <code>{{ formatId(job.jobId) }}</code>
       </div>
       
       <div class="header-actions">
           <div class="title-lockup">
               <h2>Orchestrator Execution</h2>
               <JobStatusPill :status="job.status" />
           </div>
           
           <div class="assignment-meta" v-if="job.assignedOperator">
               <strong>Assigned Operator:</strong> {{ job.assignedOperator }}
           </div>
       </div>
    </header>

    <div class="dashboard-grid">
       
       <!-- LEFT COLUMN: Payload & Logs -->
       <div class="column-primary">
          
          <section class="widget-card payload-section">
              <h3>Orchestrator Input Payload</h3>
              <!-- Mapped to the normalized Generation Request Schema -->
              <pre class="json-viewer">{{ JSON.stringify(job.payload, null, 2) }}</pre>
          </section>

          <section class="widget-card logs-section">
              <h3>Diagnostic Console (stdout / stderr)</h3>
              <div class="terminal-window">
                  <div 
                     v-for="(log, idx) in job.diagnosticLogs" 
                     :key="idx" 
                     class="log-line"
                     :class="log.level"
                  >
                      <span class="ts">[{{ formatTime(log.timestamp) }}]</span>
                      <span class="lvl">[{{ log.level.toUpperCase() }}]</span>
                      <span class="msg">{{ log.message }}</span>
                  </div>
                  <div v-if="!job.diagnosticLogs || job.diagnosticLogs.length === 0" class="empty-logs">
                      No logs emitted yet.
                  </div>
              </div>
          </section>
       </div>

       <!-- RIGHT COLUMN: Bindings & Actions -->
       <div class="column-sidebar">
          
          <!-- INTEGRATION: Operational Actions (Role-Gated) -->
          <section class="widget-card action-panel">
              <h3>Execution Controls</h3>
              
              <!-- RBAC: Only operators can force retries -->
              <button 
                v-if="permissions.canManage && job.status === 'failed'" 
                @click="retryJob"
                class="btn-action danger"
              >
                  &#8635; Force Pipeline Retry
              </button>

              <button 
                v-if="permissions.canManage && job.status === 'queued'" 
                @click="cancelJob"
                class="btn-action warning"
              >
                  &times; Cancel Execution
              </button>

              <!-- RBAC: Anyone can re-run a success as a cloned variant if they have generation rights -->
              <button 
                v-if="permissions.canGenerate && job.status === 'completed'" 
                @click="reRunAsVariant"
                class="btn-action primary"
              >
                  &#8862; Re-Run as New Variant
              </button>

              <div v-if="!hasAnyAction" class="readonly-note">
                  No execution controls available for your role.
              </div>
          </section>

          <!-- INTEGRATION: Asset Registry Output -->
          <section class="widget-card binding-card success-binding" v-if="job.linkedOutputAssetId">
              <div class="icon">✅</div>
              <div class="binding-content">
                  <h3>Export Registered Successfully</h3>
                  <p>Hash: <code>{{ formatId(job.linkedOutputAssetId) }}</code></p>
                  <router-link :to="`/admin/library/asset/${job.linkedOutputAssetId}`" class="jump-link">
                      Go to Asset Inspection &rarr;
                  </router-link>
              </div>
          </section>

          <!-- INTEGRATION: Revision Queue Origins -->
          <section class="widget-card binding-card queue-binding" v-if="job.sourceRevisionQueueId">
              <div class="icon">⚠️</div>
              <div class="binding-content">
                  <h3>Spawned by Revision Request</h3>
                  <p>Ticket: <code>{{ formatId(job.sourceRevisionQueueId) }}</code></p>
                  <router-link :to="`/admin/queue/${job.sourceRevisionQueueId}`" class="jump-link">
                      Go to Feedback Context &rarr;
                  </router-link>
              </div>
          </section>

          <!-- INTEGRATION: Timing & Audit Metrics -->
          <section class="widget-card metrics-card">
              <h3>Execution Metrics</h3>
              <ul class="stats-list">
                  <li><label>Created:</label> <span>{{ formatDate(job.events.createdAt) }}</span></li>
                  <li v-if="job.events.startedAt"><label>Started:</label> <span>{{ formatDate(job.events.startedAt) }}</span></li>
                  <li v-if="job.events.exportCompletedAt"><label>Completed:</label> <span class="success">{{ formatDate(job.events.exportCompletedAt) }}</span></li>
                  <li v-if="job.events.failedAt"><label>Failed:</label> <span class="danger">{{ formatDate(job.events.failedAt) }}</span></li>
                  <li v-if="job.retryCount > 0"><label>Retry Count:</label> <span class="warning">{{ job.retryCount }} attempts</span></li>
              </ul>
          </section>

       </div>

    </div>
  </div>
  <div v-else class="loading-state">Syncing Orchestrator Context...</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAdminSession } from '../../store/useAdminSession';
import JobStatusPill from '../../components/jobs/JobStatusPill.vue';
import { PipelineExecutionJob } from '../../architecture/JobMonitorRoutes';
// import { LogoJobRunner } from '../../../../pipeline/jobs/LogoJobRunner';

const route = useRoute();
const router = useRouter();
const session = useAdminSession();

const job = ref<PipelineExecutionJob | null>(null);

// INTEGRATION 5: Permission controls mapping exact Actions
const permissions = ref({
    canManage: session.hasCapability('job.execution:manage'), // operators
    canGenerate: session.hasCapability('asset.generation:create') // project managers, reviewers
});

onMounted(async () => {
    // Mathmatical API Integration Mock
    // job.value = await LogoJobRunner.getJobTrackingContext(route.params.jobId);

    // MOCK DATA: Simulating a FAILED job requiring operator attention
    job.value = {
        jobId: String(route.params.jobId),
        siteId: 'site-a',
        familyId: 'fam-logo-xyz',
        status: 'failed',
        retryCount: 0,
        assignedOperator: 'usr-operator-01',
        sourceRevisionQueueId: 'ticket-v2-req', // INTEGRATION 3: Queue Link
        
        // INTEGRATION 1: The exact input schema bound to the engine
        payload: {
            sourceType: 'imported-logo',
            materialPreset: 'matte',
            bevelAmount: 0.05,
            extrusionDepth: 1.2,
            targetFilename: 'output-matte.glb'
        },

        events: {
            createdAt: '2026-03-07T14:00:00Z',
            startedAt: '2026-03-07T14:00:05Z',
            failedAt: '2026-03-07T14:01:10Z'
        },

        // INTEGRATION 7: Diagnostic Logs
        diagnosticLogs: [
            { timestamp: '2026-03-07T14:00:05Z', level: 'info', message: 'Pulling MCP container environment...' },
            { timestamp: '2026-03-07T14:00:10Z', level: 'info', message: 'Executing SVG vector extrusion pass.' },
            { timestamp: '2026-03-07T14:01:10Z', level: 'error', message: 'FATAL: Non-manifold geometry detected in vector path 4. Mesh boolean failed.' }
        ]
    };

    // To test the Success state, uncomment:
    /*
    job.value.status = 'completed';
    job.value.linkedOutputAssetId = 'hash-abc-1234'; // INTEGRATION 2: Registry Link
    job.value.diagnosticLogs.push({ timestamp: '2026-03-07T14:01:10Z', level: 'info', message: 'Export successful.' });
    job.value.events.exportCompletedAt = '2026-03-07T14:01:10Z';
    */
});

const hasAnyAction = computed(() => 
    (permissions.value.canManage && ['failed', 'queued'].includes(job.value?.status || '')) ||
    (permissions.value.canGenerate && job.value?.status === 'completed')
);

// INTEGRATION 6: Actions bounding back to Orchestration engine
const retryJob = async () => { 
    /* await LogoJobRunner.retryJob(job.value.jobId) */ 
    alert("Triggering backend retry..."); 
};
const cancelJob = async () => { 
    /* await LogoJobRunner.cancelJob(job.value.jobId) */ 
};
const reRunAsVariant = async () => {
    // Duplicates payload and redirects to a new generation form implicitly
    router.push(`/admin/generator?clone=${job.value?.jobId}`);
};

const formatId = (id: string) => id.length > 10 ? `...${id.slice(-6)}` : id;
const formatDate = (iso: string) => new Date(iso).toLocaleString();
const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' });

</script>

<style scoped>
.job-detail-page { padding: 32px; color: #f8fafc; }
.breadcrumb { font-size: 13px; color: #94a3b8; margin-bottom: 24px; font-family: monospace; }
.breadcrumb a { color: #3b82f6; text-decoration: none; }
.breadcrumb .divider { margin: 0 8px; color: #475569; }

.header-actions { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; border-bottom: 1px solid #334155; padding-bottom: 16px; }
.title-lockup { display: flex; align-items: center; gap: 16px; }
.title-lockup h2 { margin: 0; font-family: monospace; }
.assignment-meta { font-size: 12px; color: #cbd5e1; background: #1e293b; padding: 6px 12px; border-radius: 4px; border: 1px solid #334155;}

.dashboard-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; }
.widget-card { background: #1e293b; padding: 24px; border-radius: 8px; margin-bottom: 24px; border: 1px solid #334155; }
.widget-card h3 { margin-top: 0; font-size: 14px; color: #f8fafc; margin-bottom: 16px; }

/* Payload Viewer */
.json-viewer { background: #0f172a; padding: 16px; border-radius: 6px; font-size: 12px; color: #a5b4fc; overflow-x: auto; margin: 0; }

/* Terminal Console */
.terminal-window { background: #000; padding: 16px; border-radius: 6px; font-family: monospace; font-size: 12px; height: 300px; overflow-y: auto; border: 1px solid #334155; }
.log-line { margin-bottom: 6px; line-height: 1.4; }
.log-line .ts { color: #64748b; margin-right: 8px; }
.log-line .lvl { margin-right: 8px; font-weight: bold; }
.log-line.info .lvl { color: #3b82f6; }
.log-line.warn .lvl, .log-line.warn .msg { color: #f59e0b; }
.log-line.error .lvl, .log-line.error .msg { color: #ef4444; }
.log-line.info .msg { color: #e2e8f0; }
.empty-logs { color: #64748b; font-style: italic; }

/* Control Actions */
.action-panel { display: flex; flex-direction: column; gap: 12px; }
.btn-action { padding: 12px 16px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; text-align: center; transition: opacity 0.2s; }
.btn-action:hover { opacity: 0.9; }
.btn-action.primary { background: #3b82f6; color: white; }
.btn-action.warning { background: #f59e0b; color: black; }
.btn-action.danger { background: transparent; border: 2px solid #ef4444; color: #ef4444; }
.readonly-note { font-size: 12px; color: #94a3b8; text-align: center; font-style: italic; padding: 12px; }

/* Binding Cards (Links to other domains) */
.binding-card { display: flex; gap: 16px; align-items: flex-start; }
.binding-card .icon { font-size: 24px; margin-top: -4px; }
.binding-content h3 { margin: 0 0 4px 0; font-size: 14px; }
.binding-content p { margin: 0 0 12px 0; font-size: 12px; color: #cbd5e1; font-family: monospace;}
.jump-link { font-size: 12px; color: #3b82f6; text-decoration: none; font-weight: bold; }
.jump-link:hover { text-decoration: underline; }

.success-binding .icon { color: #10b981; }
.success-binding h3 { color: #10b981; }
.queue-binding .icon { color: #eab308; }
.queue-binding h3 { color: #eab308; }

/* Metrics */
.stats-list { list-style: none; padding: 0; margin: 0; font-size: 13px; }
.stats-list li { display: flex; justify-content: space-between; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #334155; }
.stats-list label { color: #94a3b8; }
.stats-list span.success { color: #10b981; font-weight: bold; }
.stats-list span.danger { color: #ef4444; font-weight: bold; }
.stats-list span.warning { color: #f59e0b; font-weight: bold; }
</style>
