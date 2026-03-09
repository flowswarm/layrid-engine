<!-- src/admin/pages/library/AssetBrowserList.vue -->
<template>
  <div class="asset-browser-page">
    <header class="page-header">
      <h2>Asset Library & Manifest</h2>
      
      <!-- NATIVE FILTER BAR: Controlling the AssetBrowserFilterState -->
      <div class="filter-bar">
         <input type="text" placeholder="Search Asset ID, Family, Site..." v-model="filters.searchTerm" />
         
         <select v-model="filters.siteId">
             <option value="all">All Sites</option>
             <!-- MOCK DATA: Populated from CMS -->
             <option value="site-a">Site A (Fashion)</option>
             <option value="site-b">Site B (Automotive)</option>
         </select>

         <select v-model="filters.status">
             <option value="all">All Statuses</option>
             <option value="generating">Generating / Enqueued</option>
             <option value="reviewing">In Review (Preview/Queue)</option>
             <option value="approved">Approved (Staged)</option>
             <option value="published">LIVE (Published)</option>
             <option value="archived">Archived / Rejected</option>
         </select>

         <select v-model="filters.materialPreset">
             <option value="all">All Materials</option>
             <option value="chrome">Chrome</option>
             <option value="matte">Matte</option>
             <option value="glass">Glass</option>
         </select>
      </div>
    </header>

    <!-- THE GLOBAL GRID LIST PATTERN -->
    <!-- The physical view groups families together naturally, rather than exploding purely flat. -->
    <div v-if="loading" class="loading-state">Syncing Global Manifest...</div>
    <div v-else-if="filteredFamilies.length === 0" class="empty-state">No matching families found.</div>

    <div v-else class="family-grid">
      <div 
         v-for="family in filteredFamilies" 
         :key="family.assetFamilyId" 
         class="family-card"
         @click="openFamilyDetail(family.assetFamilyId)"
      >
        <div class="card-header">
           <h4 class="site-label">{{ family.siteId }}</h4>
           <div class="role-badge">{{ family.sceneRole }}</div>
        </div>

        <div class="card-body">
           <!-- The Primary / Active Hash Thumbnail Placeholder -->
           <!-- Maps to `engine/webgl/modules/` or external CMS thumbnail endpoint -->
           <div class="primary-visual">
               <img v-if="family.activeThumbnailUrl" :src="family.activeThumbnailUrl" />
               <div v-else class="visual-placeholder">3D Preview TBD</div>
           </div>

           <div class="family-meta">
               <p class="family-id">Family: <code>...{{ family.assetFamilyId.slice(-6) }}</code></p>
               <p class="variant-count">
                  {{ family.variants.length }} Total Variants
                  <span v-if="family.hasLiveVariant" class="status-live">&bull; 1 LIVE</span>
               </p>
           </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
// import { fetchAssetRegistryFamilies } from '../../api/registryApi';
import { AssetBrowserFilterState } from '../../architecture/AssetLibraryRoutes';

const router = useRouter();

const loading = ref(true);
const families = ref<any[]>([]); // Array of AssetFamily entities containing variant arrays
const filters = ref<AssetBrowserFilterState>({
    searchTerm: '',
    siteId: 'all',
    sceneRole: 'all',
    status: 'all',
    materialPreset: 'all',
    sourceType: 'all',
    isLive: 'any',
    hasActivePreview: 'any',
    sortBy: 'updatedAt',
    sortDirection: 'desc'
});

onMounted(async () => {
    // Mathmatical Filter Interceptors check DB directly, returning the filtered array.
    // Example Mock response grouping:
    families.value = [
        {
            assetFamilyId: 'fam-1234',
            siteId: 'site-a',
            sceneRole: 'hero-centerpiece',
            activeThumbnailUrl: null,
            hasLiveVariant: true,
            hasPreviewVariant: false,
            variants: [
                { assetId: 'chrome-hash-1', status: 'published', materialPreset: 'chrome' },
                { assetId: 'matte-hash-2', status: 'archived', materialPreset: 'matte' }
            ]
        },
        {
            assetFamilyId: 'fam-9876',
            siteId: 'site-b',
            sceneRole: 'hero-centerpiece',
            activeThumbnailUrl: null,
            hasLiveVariant: false,
            hasPreviewVariant: true,
            variants: [
                { assetId: 'text-gen-hash', status: 'reviewing', materialPreset: 'matte' }
            ]
        }
    ];
    loading.value = false;
});

// Front-end UI resolution pass supporting real-time filter combinations
const filteredFamilies = computed(() => {
    return families.value.filter(fam => {
        if (filters.value.siteId !== 'all' && fam.siteId !== filters.value.siteId) return false;
        if (filters.value.searchTerm) {
            const term = filters.value.searchTerm.toLowerCase();
            return fam.assetFamilyId.includes(term) || fam.siteId.includes(term);
        }
        
        // Deep Variant Array Check:
        // E.g., The user specifically filters "chrome": only families containing a matching chrome variant survive.
        if (filters.value.materialPreset !== 'all') {
            const hasMaterial = fam.variants.some((v: any) => v.materialPreset === filters.value.materialPreset);
            if (!hasMaterial) return false;
        }

        if (filters.value.status !== 'all') {
            const hasStatus = fam.variants.some((v: any) => v.status === filters.value.status);
            if (!hasStatus) return false;
        }

        return true;
    });
});

const openFamilyDetail = (familyId: string) => {
    router.push(`/admin/library/family/${familyId}`);
};
</script>

<style scoped>
.asset-browser-page { padding: 32px; color: #f8fafc; }
.page-header { margin-bottom: 24px; }
.filter-bar { display: flex; gap: 12px; margin-top: 16px; background: #1e293b; padding: 12px; border-radius: 8px; border: 1px solid #334155; }
.filter-bar input, .filter-bar select { background: #0f172a; color: #e2e8f0; border: 1px solid #334155; padding: 8px 12px; border-radius: 4px; outline: none; }
.family-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 24px; }
.family-card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; overflow: hidden; cursor: pointer; transition: transform 0.2s; }
.family-card:hover { transform: translateY(-4px); border-color: #3b82f6; }
.card-header { padding: 12px 16px; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center; }
.site-label { margin: 0; font-size: 14px; font-weight: bold; }
.role-badge { font-size: 10px; background: #2563eb; padding: 2px 6px; border-radius: 12px; text-transform: uppercase; }
.card-body { padding: 16px; }
.primary-visual { height: 160px; background: #0f172a; border-radius: 4px; display: flex; justify-content: center; align-items: center; margin-bottom: 12px; }
.visual-placeholder { color: #64748b; font-size: 12px; }
.family-meta { font-size: 12px; color: #94a3b8; }
.family-meta p { margin: 4px 0; }
.status-live { color: #10b981; font-weight: bold; margin-left: 8px; }
.loading-state, .empty-state { padding: 32px; text-align: center; color: #94a3b8; }
</style>
