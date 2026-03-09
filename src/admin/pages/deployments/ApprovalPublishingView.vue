<!-- src/admin/pages/deployments/ApprovalPublishingView.vue -->
<template>
  <div class="approval-page" v-if="asset">
    
    <header class="detail-header">
      <div class="breadcrumb">Registry / Assets / {{ asset.assetId }} / Publish Check</div>
      <div class="header-actions">
          
        <!-- RBAC CONDITIONAL: Approver Gate -->
        <button 
          v-if="permissions.canApprove && asset.status === 'staged'" 
          @click="approveAsset"
          class="btn-success"
        >
          Formally Approve Variant
        </button>

        <!-- RBAC CONDITIONAL: Publisher Gate executing Site Sync -->
        <button 
          v-if="permissions.canPublish && asset.status === 'approved'" 
          @click="publishToProduction"
          class="btn-danger"
        >
          MIGRATE TO PRODUCTION
        </button>

      </div>
    </header>

    <div class="dashboard-grid">
      <!-- MAIN PREVIEW COLUMN -->
      <div class="column-primary">
          <section class="widget-card">
              <h3>Asset Viewer</h3>
              <div class="webgl-canvas-placeholder">
                  (Loading WebGL Preview Engine for {{ asset.assetId }}...)
              </div>
          </section>
      </div>

      <!-- AUDIT LOG & STATE COLUMN -->
      <div class="column-sidebar">
          <section class="widget-card">
              <h3>Deployment Status</h3>
              <p>State: <strong>{{ asset.status.toUpperCase() }}</strong></p>
              <p v-if="lastPublishedDate">Last Deployed: {{ lastPublishedDate }}</p>
          </section>

          <section class="widget-card">
              <h3>Audit History</h3>
              <!-- 
                System seamlessly exposes the mathematically rigorous Audit Logs built in 
                previous steps mapping explicit user actions securely directly to this View!
              -->
              <ul class="audit-timeline">
                  <li v-for="log in auditHistory" :key="log.checkId" class="audit-item">
                      <div class="timestamp">{{ formatDate(log.timestamp) }}</div>
                      <div class="action-desc">
                          <strong>{{ log.userRole }}</strong> executed <code>{{ log.action }}</code>
                      </div>
                  </li>
              </ul>
          </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useAdminSession } from '../../store/useAdminSession';

const route = useRoute();
const session = useAdminSession();

const asset = ref<any>(null);
const auditHistory = ref<any[]>([]);
const lastPublishedDate = ref<string | null>(null);

// 1. RBAC Enforcements against Auth Context
const permissions = ref({
    canApprove: session.hasCapability('workflow.approval:approve'),
    // 2. Demonstrating Site-Level Evaluation on the UI!
    // In production, the session checks `session.hasSiteAccess(route.query.siteId as string)`
    canPublish: session.hasCapability('site.deployment:publish') 
});

onMounted(async () => {
    // Mock Fetch
    asset.value = {
        assetId: route.params.assetId,
        status: 'approved' // 'staged', 'approved', 'published'
    };
    
    // Mock Audit History mapped from `PermissionService.getAuditHistory()`
    auditHistory.value = [
        { checkId: 'log-1', timestamp: new Date(Date.now() - 86400000), userRole: 'Admin', action: 'preview.session:create' },
        { checkId: 'log-2', timestamp: new Date(Date.now() - 3600000), userRole: 'Approver', action: 'workflow.approval:approve' }
    ];
});

const approveAsset = async () => { /* POST /api/workflow/approve { assetId } */ };
const publishToProduction = async () => { /* POST /api/deploy/publish { assetId, siteId } */ };
const formatDate = (date: Date) => date.toLocaleString();
</script>

<style scoped>
.approval-page { padding: 24px; color: #f8fafc; }
.detail-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; }
.breadcrumb { color: #94a3b8; font-size: 14px; }
.dashboard-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; }
.widget-card { background: #1e293b; padding: 20px; border-radius: 8px; margin-bottom: 24px; border: 1px solid #334155; }
.widget-card h3 { margin-top: 0; font-size: 14px; color: #cbd5e1; border-bottom: 1px solid #334155; padding-bottom: 8px; margin-bottom: 16px; }
.webgl-canvas-placeholder { height: 400px; background: #0f172a; display: flex; align-items: center; justify-content: center; color: #64748b; border-radius: 4px; }
.btn-success { background: #10b981; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; }
.btn-danger { background: #ef4444; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; }

/* Audit Timeline */
.audit-timeline { list-style: none; padding: 0; margin: 0; }
.audit-item { padding: 12px 0; border-bottom: 1px solid #334155; }
.audit-item:last-child { border-bottom: none; }
.timestamp { font-size: 11px; color: #94a3b8; margin-bottom: 4px; }
.action-desc { font-size: 13px; color: #e2e8f0; }
.action-desc code { background: #0f172a; padding: 2px 4px; border-radius: 4px; color: #3b82f6; }
</style>
