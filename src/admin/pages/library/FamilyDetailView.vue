<!-- src/admin/pages/library/FamilyDetailView.vue -->
<template>
  <div class="family-detail-page" v-if="family">
    
    <header class="page-header">
       <div class="breadcrumb">
           <router-link to="/admin/library">Library</router-link> / Family {{ formatId(family.familyId) }}
       </div>
       <div class="header-actions">
           <div class="title-lockup">
               <h2>Asset Family Context</h2>
               <span class="site-badge">{{ family.siteId.toUpperCase() }}</span>
           </div>
           
           <!-- RBAC ACTION: Only project managers or publishers might archive entire families -->
           <button 
               v-if="permissions.canArchiveFamily" 
               class="btn-outline danger"
           >
               Archive Entire Family
           </button>
       </div>
    </header>

    <!-- ASSIGNMENT TOP-BAR (Who owns this asset?) -->
    <div class="assignment-bar" v-if="family.assignedTeam">
       <span class="label">Assigned Studio:</span> <strong>{{ family.assignedTeam.name }}</strong>
       <span class="label divider">|</span>
       <span class="label">Lead Reviewer:</span> {{ family.assignedTeam.leadReviewerId || 'Unassigned' }}
    </div>

    <!-- THE VARIANT GRID (Separated by Pipeline Constraints) -->
    <div class="variants-container">
       
       <!-- 1. LIVE / PUBLISHED LAYER (Resolved via SiteDeploymentSync) -->
       <section class="variant-group live-group" v-if="liveVariant">
           <div class="section-title">
               <h3>Active Production Variant</h3>
               <p>This mesh is currently returning via the global CDN for live players.</p>
           </div>
           <!-- INTEGRATION: AssetRegistry Data -->
           <AssetVariantCard 
             :variant="liveVariant" 
             :isPrimary="true"
             @select="openVariantDetail(liveVariant.assetId)"
           />
       </section>
       
       <!-- 2. STAGED / REVIEWING LAYER -->
       <section class="variant-group reviewing-group" v-if="inProgressVariants.length > 0">
           <div class="section-title">
               <h3>Pipeline Variants</h3>
               <p>These variants are staged for review, approval, or comparison against the live asset.</p>
           </div>
           <div class="variants-grid">
               <!-- INTEGRATION: AssetRegistry Data -->
               <AssetVariantCard 
                 v-for="v in inProgressVariants" 
                 :key="v.assetId" 
                 :variant="v"
                 @select="openVariantDetail(v.assetId)"
               />
           </div>
       </section>

       <!-- 3. ARCHIVED LAYER -->
       <section class="variant-group archived-group" v-if="archivedVariants.length > 0">
           <div class="section-title">
               <h3>Historical Archive</h3>
           </div>
           <div class="variants-grid">
               <AssetVariantCard 
                 v-for="v in archivedVariants" 
                 :key="v.assetId" 
                 :variant="v"
                 :isArchived="true"
                 @select="openVariantDetail(v.assetId)"
               />
           </div>
       </section>
    </div>
  </div>
  <div v-else class="loading-state">Syncing Global Manifest...</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAdminSession } from '../../store/useAdminSession';
import AssetVariantCard from '../../components/domain/AssetVariantCard.vue';
import { AssetFamilyModel } from '../../architecture/AssetLibraryRoutes';
// import { AssetRegistry } from '../../../../pipeline/registry/AssetRegistry';
// import { TeamAssignmentService } from '../../../../pipeline/teams/TeamAssignmentService';

const route = useRoute();
const router = useRouter();
const session = useAdminSession();

const family = ref<AssetFamilyModel & { assignedTeam?: any } | null>(null);

// NATIVE RBAC GATEKEEPER
const permissions = ref({
    canArchiveFamily: session.hasCapability('asset.family:archive')
});

onMounted(async () => {
    // INTEGRATION 1: AssetRegistry Hydration
    // family.value = await AssetRegistry.getFamilyTree(route.params.familyId);
    
    // INTEGRATION 6: Surface Assignments
    // const assignment = await TeamAssignmentService.getTeamForSite(family.value.siteId);

    // MOCK DATA for architectural demonstration:
    family.value = {
        familyId: route.params.familyId as string,
        siteId: 'site-alpha',
        clientId: 'client-xyz',
        sceneRole: 'hero-centerpiece',
        primaryHash: 'uuid-hash-01-live',
        createdAt: '2026-03-01T10:00:00Z',
        updatedAt: '2026-03-07T14:00:00Z',
        assignedTeam: { name: 'Studio A - External', leadReviewerId: 'usr-123' },
        variants: [
            // INTEGRATION 2: Live status explicitly mapped
            { assetId: 'uuid-hash-01-live', familyId: 'fam-xxx', status: 'published', materialPreset: 'chrome', sourceType: 'imported-logo', createdBy: 'sys', createdAt: '' },
            // INTEGRATION 4: Revision Queue Links surfaced
            { assetId: 'uuid-hash-02-trial', familyId: 'fam-xxx', status: 'reviewing', materialPreset: 'matte', sourceType: 'imported-logo', queueItemId: 'ticket-999', createdBy: 'usr-renderer', createdAt: '' },
            { assetId: 'uuid-hash-03-fail', familyId: 'fam-xxx', status: 'rejected', materialPreset: 'glass', sourceType: 'text-generated', createdBy: 'sys', createdAt: '' }
        ]
    };
});

const formatId = (id: string) => id.length > 10 ? `...${id.slice(-6)}` : id;

const liveVariant = computed(() => family.value?.variants.find(v => v.status === 'published'));
const inProgressVariants = computed(() => family.value?.variants.filter(v => ['generating', 'reviewing', 'approved'].includes(v.status)) || []);
const archivedVariants = computed(() => family.value?.variants.filter(v => ['archived', 'rejected', 'failed'].includes(v.status)) || []);

const openVariantDetail = (assetId: string) => {
    router.push(`/admin/library/asset/${assetId}`);
};
</script>

<style scoped>
.family-detail-page { padding: 32px; color: #f8fafc; }
.breadcrumb { font-size: 13px; color: #94a3b8; margin-bottom: 16px; font-family: monospace; }
.breadcrumb a { color: #3b82f6; text-decoration: none; }
.header-actions { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
.title-lockup { display: flex; align-items: center; gap: 12px; }
.title-lockup h2 { margin: 0; }
.site-badge { background: #3b82f6; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
.btn-outline.danger { background: transparent; border: 1px solid #ef4444; color: #ef4444; padding: 6px 12px; border-radius: 4px; cursor: pointer; }

.assignment-bar { background: #0f172a; border: 1px solid #334155; padding: 12px 16px; border-radius: 6px; margin-bottom: 32px; font-size: 13px; color: #cbd5e1; }
.assignment-bar .label { color: #94a3b8; margin-right: 6px; }
.assignment-bar .divider { margin: 0 12px; }

.variant-group { margin-bottom: 48px; border-top: 1px solid #334155; padding-top: 24px; }
.section-title h3 { margin: 0 0 4px 0; color: #f8fafc; }
.section-title p { margin: 0 0 20px 0; font-size: 13px; color: #94a3b8; }
.variants-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 16px; }

.live-group .section-title h3 { color: #10b981; }
.archived-group { opacity: 0.6; }
</style>
