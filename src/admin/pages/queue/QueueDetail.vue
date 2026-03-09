<!-- src/admin/pages/queue/QueueDetail.vue -->
<template>
  <div class="queue-detail-page" v-if="ticket">
    
    <!-- PAGE HEADER -->
    <header class="detail-header">
      <div class="breadcrumb">Queue / {{ ticket.revisionQueueItemId }}</div>
      <div class="header-actions">
          
        <!-- RBAC CONDITIONAL: Only Project Managers can arbitrarily convert notes into Compute Jobs -->
        <button 
          v-if="permissions.canConvertFeedbackToRevision" 
          @click="openConvertModal"
          class="btn-primary"
        >
          Convert to Rerun Job
        </button>

        <span class="status-badge" :class="ticket.status">
          {{ ticket.status.toUpperCase() }}
        </span>
      </div>
    </header>

    <!-- MAIN TWO-COLUMN DASHBOARD GRID -->
    <div class="dashboard-grid">
      
      <!-- LEFT COLUMN: The Source & The Feedback -->
      <div class="column-primary">
          
        <section class="widget-card">
          <h3>Source Reference</h3>
          <p><strong>Site:</strong> {{ ticket.siteId }}</p>
          <p><strong>Candidate Hash:</strong> {{ ticket.currentCandidateAssetId }}</p>
          <!-- Deep link natively into the Registry Viewer -->
          <router-link :to="`/admin/library/${ticket.assetFamilyId}`" class="link">
            View Asset Family History &rarr;
          </router-link>
        </section>

        <section class="widget-card" v-if="feedbackData">
          <h3>Client Feedback</h3>
          <div class="feedback-box">
             <p class="quote">"{{ feedbackData.rawNotes }}"</p>
             <div class="meta">
               From: {{ feedbackData.authorEmail }} via {{ feedbackData.sourceType }}
             </div>
          </div>
        </section>

      </div>

      <!-- RIGHT COLUMN: Assignments & Pipeline Tracking -->
      <div class="column-sidebar">
        
        <section class="widget-card">
          <h3>Team Assignment</h3>
          <!-- RBAC CONDITIONAL: Only PMs can reassign active tickets -->
          <div class="assignment-block">
            <p>Assigned to: <strong>{{ ticket.assignedAdminId || 'Unassigned' }}</strong></p>
            <button v-if="permissions.canAssignWork" class="btn-text">
               Reassign &rarr;
            </button>
          </div>
        </section>

        <!-- The Generated Variant Result (Appears post-blender run) -->
        <section class="widget-card" v-if="ticket.generatedVariantAssetId">
           <h3>Resolution</h3>
           <div class="success-box">
             <p>New Variant Hash:</p>
             <code>{{ ticket.generatedVariantAssetId }}</code>
             <!-- Reviewers jump into Comparison Mode securely -->
             <button @click="launchComparisonSession" class="btn-secondary mt-2">
               Compare vs Original
             </button>
           </div>
        </section>

      </div>
    </div>

    <!-- Convert Feedback to Job Modal -->
    <ConvertFeedbackModal 
       v-if="showConvertModal" 
       :ticketId="ticket.revisionQueueItemId"
       @converted="handleJobDispatched"
       @close="showConvertModal = false"
    />

  </div>
  <div v-else class="loading-state">Loading Ticket...</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useAdminSession } from '../../store/useAdminSession';
import ConvertFeedbackModal from '../../components/domain/ConvertFeedbackModal.vue';

// Mock API imports
import { fetchQueueItemDetail } from '../../api/queueApi';
import { fetchFeedbackDetail } from '../../api/feedbackApi';

const route = useRoute();
const session = useAdminSession();

const ticket = ref<any>(null);
const feedbackData = ref<any>(null);
const showConvertModal = ref(false);

/**
 * 1. NATIVE RBAC EVALUATION:
 * The UI layer interrogates the Pinia Auth Store directly.
 * If true, the DOM conditionally mounts the <button>.
 * Under the hood, the API route STILL enforces this exact check to prevent POST hacks!
 */
const permissions = ref({
    canConvertFeedbackToRevision: session.hasCapability('queue.revision:convert'),
    canAssignWork: session.hasCapability('queue.revision:assign')
});

onMounted(async () => {
    const ticketId = route.params.ticketId as string;
    ticket.value = await fetchQueueItemDetail(ticketId);
    if (ticket.value.clientFeedbackId) {
        feedbackData.value = await fetchFeedbackDetail(ticket.value.clientFeedbackId);
    }
});

const openConvertModal = () => showConvertModal.value = true;
const handleJobDispatched = () => {
    showConvertModal.value = false;
    // Reload ticket to see `jobId` and `status: evaluating`
};

const launchComparisonSession = () => {
    window.location.href = `/admin/previews/compare?base=${ticket.value.currentCandidateAssetId}&test=${ticket.value.generatedVariantAssetId}`;
};
</script>

<style scoped>
/* Mock Layout */
.queue-detail-page { padding: 24px; color: #f8fafc; }
.detail-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; }
.breadcrumb { color: #94a3b8; font-size: 14px; }
.header-actions { display: flex; gap: 12px; align-items: center; }
.dashboard-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; }
.widget-card { background: #1e293b; padding: 20px; border-radius: 8px; margin-bottom: 24px; border: 1px solid #334155; }
.widget-card h3 { margin-top: 0; font-size: 14px; color: #cbd5e1; border-bottom: 1px solid #334155; padding-bottom: 8px; margin-bottom: 16px; }
.feedback-box { background: #0f172a; padding: 16px; border-left: 3px solid #3b82f6; }
.quote { font-style: italic; margin-bottom: 12px; }
.meta { font-size: 12px; color: #94a3b8; }
.success-box { background: #064e3b; padding: 16px; border-radius: 4px; color: #34d399; }
.mt-2 { margin-top: 12px; }
.btn-primary { background: #3b82f6; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; }
.btn-secondary { background: #475569; color: white; padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; }
.btn-text { background: none; color: #3b82f6; border: none; cursor: pointer; padding: 0; text-decoration: underline; }
.status-badge { padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; }
.status-badge.new { background: #fef08a; color: #854d0e; }
.status-badge.published { background: #86efac; color: #14532d; }
</style>
