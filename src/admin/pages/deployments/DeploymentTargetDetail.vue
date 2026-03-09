<!-- src/admin/pages/deployments/DeploymentTargetDetail.vue -->
<template>
  <div class="deployment-detail-page" v-if="mapping">
    
    <!-- PAGE HEADER -->
    <header class="detail-header">
       <div class="breadcrumb">
           <router-link to="/admin/deployments">Live Operations</router-link> 
           <span class="divider">/</span> 
           {{ mapping.siteId.toUpperCase() }} 
           <span class="divider">&raquo;</span> 
           <code>{{ mapping.sceneRole }}</code>
       </div>
       
       <div class="header-status">
           <h2>Live Target Inspection</h2>
           <span class="sync-pill" :class="mapping.syncStatus">
               <span class="dot"></span>
               {{ mapping.syncStatus.toUpperCase() }}
           </span>
       </div>
    </header>

    <div class="dashboard-grid">
       
       <!-- LEFT COLUMN: The Pipeline State (Present, Future, Past) -->
       <div class="column-primary">
          
          <!-- STATE 1: CURRENTLY LIVE -->
          <section class="state-card live-state">
              <div class="state-header">
                  <h3>Currently Live</h3>
                  <span class="timestamp">Published: {{ formatDate(mapping.publishedAt) }} by {{ mapping.publishedBy }}</span>
              </div>
              <div class="asset-lockup">
                  <div class="visual-placeholder">LIVE</div>
                  <div class="meta">
                      <p class="asset-id">Hash: <code>{{ formatId(mapping.currentLiveAssetId) }}</code></p>
                      <p class="family-id">Family: {{ formatId(mapping.currentFamilyId) }}</p>
                      <!-- INTEGRATION: Direct link to Registry Validation -->
                      <router-link :to="`/admin/library/asset/${mapping.currentLiveAssetId}`" class="jump-link">
                          Inspect Registry Record &rarr;
                      </router-link>
                  </div>
              </div>
          </section>

          <!-- STATE 2: PENDING PUBLISH (The Future) -->
          <section class="state-card pending-state" v-if="mapping.latestApprovedAssetId">
              <div class="state-header">
                  <h3>Update Available (Pending Publish)</h3>
                  <span class="badge">Awaiting Sync</span>
              </div>
              <div class="asset-lockup">
                  <div class="visual-placeholder pending-vis">UPCOMING</div>
                  <div class="meta">
                      <p class="asset-id">Hash: <code>{{ formatId(mapping.latestApprovedAssetId) }}</code></p>
                      <!-- INTEGRATION: Link back to the workflow approval that authorized this -->
                      <p class="approval-context">Approved via Ticket: <code>#APP-9988</code></p>
                      <router-link :to="`/admin/library/asset/${mapping.latestApprovedAssetId}`" class="jump-link">
                          Inspect Preview Candidate &rarr;
                      </router-link>
                  </div>
              </div>
              
              <!-- INTEGRATION: Role-Aware Publishing -->
              <div class="action-footer">
                  <button 
                      class="btn-publish" 
                      v-if="permissions.canPublish"
                      @click="triggerPublish"
                      :disabled="mapping.syncStatus === 'syncing'"
                  >
                      &#8593; Publish to Live Edge (CDN Sync)
                  </button>
                  <p v-else class="readonly">You do not have Publisher permissions.</p>
              </div>
          </section>

          <!-- STATE 3: PREVIOUS LIVE (Rollback Node) -->
          <section class="state-card previous-state" v-if="mapping.previousLiveAssetId">
              <div class="state-header">
                  <h3>Previous Known Good (Rollback Target)</h3>
              </div>
              <div class="asset-lockup">
                  <div class="meta">
                      <p class="asset-id">Hash: <code>{{ formatId(mapping.previousLiveAssetId) }}</code></p>
                      <router-link :to="`/admin/library/asset/${mapping.previousLiveAssetId}`" class="jump-link">
                          Review Previous Asset &rarr;
                      </router-link>
                  </div>
              </div>

              <!-- INTEGRATION: Role-Aware Rollback Control -->
              <div class="action-footer rollback-footer">
                  <button 
                      class="btn-rollback" 
                      v-if="permissions.canPublish"
                      @click="triggerRollback"
                      :disabled="mapping.syncStatus === 'syncing'"
                  >
                      &#8617; Rollback to Previous Version
                  </button>
              </div>
          </section>
          
       </div>

       <!-- RIGHT COLUMN: Tools & Audit Trails -->
       <div class="column-sidebar">
          
          <!-- TROUBLESHOOTING PANEL (Failed states) -->
          <section class="widget-card error-card" v-if="mapping.syncStatus === 'failed'">
              <h3>⚠️ Edge Sync Failure</h3>
              <p>The last deployment command failed to invalidate the CDN successfully. The client site may be running a stale cache.</p>
              <div class="log-snippet">
                  <code>[ERROR] CDN_TIMEOUT_REGION_EU - 2026-03-07T14:05:00Z</code>
              </div>
              <button 
                  class="btn-retry" 
                  v-if="permissions.canPublish" 
                  @click="retrySync"
              >
                  &#8635; Retry Edge Invalidation
              </button>
          </section>

          <!-- INTEGRATION: Audit History Pipeline -->
          <section class="widget-card audit-card">
              <h3>Deployment Audit History</h3>
              <div class="audit-timeline">
                  
                  <div class="audit-event" v-for="log in auditLogs" :key="log.id">
                      <div class="event-icon" :class="log.action"></div>
                      <div class="event-body">
                          <p class="event-desc">
                              <strong>{{ log.actorId }}</strong> {{ formatActionText(log.action) }} <code>{{ formatId(log.targetAssetId) }}</code>
                          </p>
                          <span class="event-time">{{ formatDate(log.timestamp) }}</span>
                          <span v-if="log.diagnosticMessage" class="event-diag">{{ log.diagnosticMessage }}</span>
                      </div>
                  </div>

                  <div v-if="auditLogs.length === 0" class="empty-audit">
                      No audited actions available.
                  </div>

              </div>
          </section>

       </div>
    </div>
  </div>
  <div v-else class="loading-state">Syncing deployment boundaries...</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useAdminSession } from '../../store/useAdminSession';
import { LiveMappingState, DeploymentHistoryLog } from '../../architecture/DeploymentOperationsRoutes';

const route = useRoute();
const session = useAdminSession();

const mapping = ref<LiveMappingState | null>(null);
const auditLogs = ref<DeploymentHistoryLog[]>([]);

// INTEGRATION 6: Permissions gating exact Publish / Rollback executions
const permissions = ref({
    canPublish: session.hasCapability('deployment:publish'), // Only publishers/admins
    isObserver: session.hasRole('observer') // Read-only views
});

onMounted(() => {
    const site = String(route.params.siteId);
    const role = String(route.params.sceneRole);

    // MOCK API: Simulated fetched live mapping
    mapping.value = {
        siteId: site, clientId: 'cli-demo', sceneRole: role,
        
        currentLiveAssetId: 'hash-chrome-1234',
        currentFamilyId: 'fam-abc-00',
        publishedBy: 'usr-publisher-01',
        publishedAt: '2026-03-05T10:00:00Z',
        syncStatus: 'failed', // Simulating an edge failure 
        
        latestApprovedAssetId: 'hash-matte-pending-999', // A new approval is awaiting rollout
        previousLiveAssetId: 'hash-glass-old-000'        // Exposes rollback capability
    };

    // MOCK API: Fetching the explicitly tracked structural Deploy operations isolated to this Site/Role slot
    auditLogs.value = [
        {
            id: 'log-1', siteId: site, sceneRole: role, action: 'system-invalidation',
            targetAssetId: 'hash-chrome-1234', actorId: 'SYS_CDN', timestamp: '2026-03-07T14:40:00Z',
            syncResult: 'failed', diagnosticMessage: 'CDN_TIMEOUT_REGION_EU'
        },
        {
            id: 'log-2', siteId: site, sceneRole: role, action: 'publish',
            targetAssetId: 'hash-chrome-1234', actorId: 'usr-publisher-01', timestamp: '2026-03-05T10:00:00Z',
            syncResult: 'success', linkedApprovalTicketId: '#APP-5555'
        },
        {
            id: 'log-3', siteId: site, sceneRole: role, action: 'rollback',
            targetAssetId: 'hash-glass-old-000', previousAssetId: 'hash-broken-888', actorId: 'usr-admin-ops', timestamp: '2026-02-28T16:00:00Z',
            syncResult: 'success'
        }
    ];
});

// INTEGRATION 3: Bound API Executions
const triggerPublish = async () => {
    if (!permissions.value.canPublish) return;
    if (!mapping.value) return;
    
    // Safety Optimistic UI
    mapping.value.syncStatus = 'syncing';
    // await DeploymentService.publishUpdate(mapping.value.siteId, mapping.value.sceneRole, mapping.value.latestApprovedAssetId);
    setTimeout(() => {
        mapping.value!.syncStatus = 'synced';
        mapping.value!.previousLiveAssetId = mapping.value!.currentLiveAssetId;
        mapping.value!.currentLiveAssetId = mapping.value!.latestApprovedAssetId!;
        mapping.value!.latestApprovedAssetId = undefined; // Cleared from pending
        mapping.value!.publishedAt = new Date().toISOString();
        mapping.value!.publishedBy = session.userId || 'usr-active';
    }, 1500);
};

const triggerRollback = async () => {
    if (!permissions.value.canPublish) return;
    if (!mapping.value || !mapping.value.previousLiveAssetId) return;
    
    const confirmMsg = `WARNING: Rolling back to ${formatId(mapping.value.previousLiveAssetId)}. The live site will revert. Proceed?`;
    if (!confirm(confirmMsg)) return;

    mapping.value.syncStatus = 'syncing';
    // await DeploymentService.executeRollback(mapping.value.siteId, mapping.value.sceneRole, mapping.value.previousLiveAssetId);
    setTimeout(() => {
        mapping.value!.syncStatus = 'synced';
        // Current becomes previous, previous becomes current backflip
        const oldCurrent = mapping.value!.currentLiveAssetId;
        mapping.value!.currentLiveAssetId = mapping.value!.previousLiveAssetId!;
        mapping.value!.previousLiveAssetId = oldCurrent; 
        mapping.value!.publishedAt = new Date().toISOString();
    }, 1500);
};

const retrySync = async () => {
    if (!mapping.value) return;
    mapping.value.syncStatus = 'syncing';
    // await DeploymentService.retryInvalidation(...)
    setTimeout(() => { mapping.value!.syncStatus = 'synced'; }, 1000);
};

// Utils
const formatId = (id: string) => id.length > 10 ? `...${id.slice(-6)}` : id;
const formatDate = (iso: string) => new Date(iso).toLocaleString();

const formatActionText = (action: string) => {
    switch (action) {
        case 'publish': return 'published asset update';
        case 'rollback': return 'executed rollback to';
        case 'sync-retry': return 'retried edge sync for';
        case 'system-invalidation': return 'CDN sync cascade for';
        default: return 'operated on';
    }
};
</script>

<style scoped>
.deployment-detail-page { padding: 32px; color: #f8fafc; }
.breadcrumb { font-size: 13px; color: #94a3b8; margin-bottom: 24px; font-family: monospace; }
.breadcrumb a { color: #3b82f6; text-decoration: none; }
.breadcrumb .divider { margin: 0 8px; color: #475569; }

.header-status { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; border-bottom: 1px solid #334155; padding-bottom: 16px; }
.header-status h2 { margin: 0; }

.sync-pill { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: bold; padding: 6px 16px; border-radius: 20px; background: #334155; color: #cbd5e1; }
.sync-pill .dot { width: 10px; height: 10px; border-radius: 50%; background: #94a3b8; }
.sync-pill.synced { background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid #10b981;}
.sync-pill.synced .dot { background: #10b981; }
.sync-pill.syncing { background: rgba(245, 158, 11, 0.1); color: #f59e0b; border: 1px solid #f59e0b;}
.sync-pill.syncing .dot { background: #f59e0b; animation: pulse 1s infinite alternate; }
.sync-pill.failed { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid #ef4444;}
.sync-pill.failed .dot { background: #ef4444; }

.dashboard-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; }

/* Left Column Cards */
.state-card { background: #1e293b; padding: 24px; border-radius: 8px; margin-bottom: 24px; border: 1px solid #334155; }
.live-state { border-left: 4px solid #10b981; }
.pending-state { border-left: 4px solid #f59e0b; background: rgba(245, 158, 11, 0.03); }
.previous-state { border-left: 4px solid #64748b; opacity: 0.9; }

.state-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;}
.state-header h3 { margin: 0; font-size: 16px; color: #f8fafc; }
.state-header .timestamp { font-size: 12px; color: #94a3b8; }
.state-header .badge { font-size: 11px; background: rgba(245, 158, 11, 0.2); color: #f59e0b; padding: 4px 8px; border-radius: 4px; font-weight: bold; }

.asset-lockup { display: flex; gap: 24px; align-items: center; }
.visual-placeholder { width: 120px; height: 120px; background: #0f172a; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #10b981; border: 1px dashed #10b981;}
.visual-placeholder.pending-vis { color: #f59e0b; border-color: #f59e0b;}

.meta p { margin: 0 0 8px 0; font-size: 13px; color: #cbd5e1; }
.meta .asset-id code { color: #3b82f6; font-size: 14px;}
.jump-link { display: inline-block; margin-top: 8px; font-size: 12px; color: #3b82f6; text-decoration: none; font-weight: bold; }
.jump-link:hover { text-decoration: underline; }

.action-footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #334155; display: flex; justify-content: flex-end; }
.action-footer.rollback-footer { justify-content: flex-start; }

.btn-publish { background: #3b82f6; color: white; padding: 12px 24px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s;}
.btn-publish:hover { background: #2563eb; }
.btn-publish:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-rollback { background: transparent; color: #f8fafc; border: 1px solid #64748b; padding: 8px 16px; border-radius: 4px; font-weight: bold; cursor: pointer; }
.btn-rollback:hover { background: rgba(100,116,139,0.2); border-color: #f8fafc; }
.readonly { font-size: 12px; color: #64748b; font-style: italic; }

/* Right Column Widgets */
.widget-card { background: #1e293b; padding: 20px; border-radius: 8px; margin-bottom: 24px; border: 1px solid #334155; }
.widget-card h3 { margin-top: 0; font-size: 14px; margin-bottom: 16px; }

.error-card { border: 1px solid #ef4444; background: rgba(239, 68, 68, 0.05); }
.error-card h3 { color: #ef4444; }
.error-card p { font-size: 12px; color: #cbd5e1; line-height: 1.4; }
.log-snippet { background: #000; padding: 12px; border-radius: 4px; font-family: monospace; font-size: 11px; color: #ef4444; margin: 12px 0; }
.btn-retry { background: transparent; border: 2px solid #ef4444; color: #ef4444; padding: 8px 16px; border-radius: 4px; width: 100%; cursor: pointer; font-weight: bold;}
.btn-retry:hover { background: rgba(239,68,68,0.1); }

/* Audit Timeline */
.audit-timeline { display: flex; flex-direction: column; gap: 16px; }
.audit-event { display: flex; gap: 12px; align-items: flex-start; }
.event-icon { width: 12px; height: 12px; border-radius: 50%; margin-top: 4px; background: #64748b; }
.event-icon.publish { background: #10b981; }
.event-icon.rollback { background: #3b82f6; }
.event-icon.system-invalidation { background: #ef4444; }
.event-body { flex: 1; }
.event-desc { margin: 0 0 4px 0; font-size: 12px; color: #cbd5e1; line-height: 1.4; }
.event-time { font-size: 10px; color: #64748b; display: block; }
.event-diag { font-size: 10px; color: #ef4444; font-family: monospace; display: block; margin-top: 4px; }

@keyframes pulse {
    0% { opacity: 0.5; }
    100% { opacity: 1; }
}
</style>
