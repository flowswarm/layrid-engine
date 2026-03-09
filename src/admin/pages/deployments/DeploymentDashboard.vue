<!-- src/admin/pages/deployments/DeploymentDashboard.vue -->
<template>
  <div class="deployment-dashboard-page">
    <header class="page-header">
       <h2>Live Operations & CDN Sync</h2>
       
       <!-- GLOBAL DEPLOYMENT WIDGETS -->
       <div class="metrics-row">
           <div class="metric-card active">
               <span class="val">{{ metrics.totalLive }}</span>
               <span class="lbl">Active Live Mappings</span>
           </div>
           <div class="metric-card pending">
               <span class="val">{{ metrics.pendingSyncs }}</span>
               <span class="lbl">Publish Actions Pending Sync</span>
           </div>
           <div class="metric-card failed">
               <span class="val">{{ metrics.failedSyncs }}</span>
               <span class="lbl">CDN Sync Failures</span>
           </div>
           <div class="metric-card history">
               <span class="val">{{ metrics.rollbacks24h }}</span>
               <span class="lbl">Rollbacks (24h)</span>
           </div>
       </div>

       <!-- THE FILTER CONSOLE -->
       <div class="filter-bar">
         <div class="search-group">
            <input type="text" placeholder="Search Site ID, Asset Hash, Client..." v-model="filters.query" />
         </div>

         <div class="select-group">
            <select v-model="filters.syncStatus">
                <option value="all">All Sync States</option>
                <option value="synced">Fully Synced (Live)</option>
                <option value="syncing">Syncing to Edge...</option>
                <option value="failed">Sync Failed</option>
            </select>

            <label class="toggle-switch">
                <input type="checkbox" v-model="filters.hasPendingPublish" />
                <span>Show Pending Publishes Only</span>
            </label>
         </div>
       </div>
    </header>

    <!-- THE LIVE MAPPINGS DATA GRID -->
    <!-- Maps physical Route/Role slots linearly against the current injected Mesh Hash -->
    <div class="mappings-list-container">
        <table class="ops-table">
            <thead>
                <tr>
                    <th>Site Target / Role</th>
                    <th>Current Live Asset</th>
                    <th>Sync Status</th>
                    <th>Last Publish</th>
                    <th>Rollback Safe?</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="mapping in filteredMappings" :key="mapping.siteId + mapping.sceneRole" class="mapping-row">
                    
                    <td class="target-col">
                        <div class="site-id">{{ mapping.siteId.toUpperCase() }}</div>
                        <div class="role-id">{{ mapping.sceneRole }}</div>
                    </td>
                    
                    <td class="asset-col">
                        <!-- Direct linkage back to the Library UI -->
                       <router-link :to="`/admin/library/asset/${mapping.currentLiveAssetId}`">
                           <code>{{ formatId(mapping.currentLiveAssetId) }}</code>
                       </router-link>
                       <div v-if="mapping.latestApprovedAssetId" class="pending-badge" title="A new approved asset is waiting to be published!">
                           &#8593; Update Available
                       </div>
                    </td>
                    
                    <td>
                        <span class="sync-indicator" :class="mapping.syncStatus">
                            <span class="dot"></span>
                            {{ mapping.syncStatus.toUpperCase() }}
                        </span>
                        <div v-if="mapping.syncStatus === 'failed'" class="sub-text danger">Requires attention</div>
                    </td>
                    
                    <td class="time-col">
                        <div class="actor">by {{ mapping.publishedBy }}</div>
                        <div class="time">{{ calculateTimeAgo(mapping.publishedAt) }}</div>
                    </td>

                    <td class="rollback-col">
                        <span v-if="mapping.previousLiveAssetId" class="safe">Yes ({{ formatId(mapping.previousLiveAssetId) }})</span>
                        <span v-else class="unsafe">No (First Publish)</span>
                    </td>

                    <td class="actions-col">
                        <!-- Navigate deep into the publish/rollback execution panel -->
                        <button class="btn-action primary" @click="openMapping(mapping.siteId, mapping.sceneRole)">
                            Inspect &rarr;
                        </button>
                    </td>
                </tr>
                <tr v-if="filteredMappings.length === 0">
                    <td colspan="6" class="empty-state">No active live mappings matching criteria.</td>
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
import { LiveMappingState } from '../../architecture/DeploymentOperationsRoutes';

const router = useRouter();
const session = useAdminSession();

const metrics = ref({ totalLive: 0, pendingSyncs: 0, failedSyncs: 0, rollbacks24h: 0 });
const mappings = ref<LiveMappingState[]>([]);

const filters = ref({
    query: '',
    syncStatus: 'all',
    hasPendingPublish: false
});

onMounted(() => {
    // API Call: fetchLiveMappings() bounds to the SiteDeploymentSync database
    mappings.value = [
        {
            siteId: 'site-a', clientId: 'cli-1', sceneRole: 'hero-centerpiece',
            currentLiveAssetId: 'hash-chrome-1234', currentFamilyId: 'fam-abc',
            previousLiveAssetId: 'hash-matte-0000',
            syncStatus: 'synced', publishedBy: 'usr-publisher-01', publishedAt: new Date(Date.now() - 86400000).toISOString()
        },
        {
            siteId: 'site-b', clientId: 'cli-2', sceneRole: 'hero-centerpiece',
            currentLiveAssetId: 'hash-text-7777', currentFamilyId: 'fam-xyz',
            latestApprovedAssetId: 'hash-glass-8888', // <-- An Approver signed this off, waiting for Publisher
            syncStatus: 'synced', publishedBy: 'usr-admin', publishedAt: new Date(Date.now() - 172800000).toISOString()
        },
        {
            siteId: 'site-c', clientId: 'cli-3', sceneRole: 'product-viewer',
            currentLiveAssetId: 'hash-matte-5555', currentFamilyId: 'fam-111',
            previousLiveAssetId: 'hash-chrome-2222',
            syncStatus: 'failed', lastFailedSync: new Date(Date.now() - 300000).toISOString(),
            publishedBy: 'usr-publisher-02', publishedAt: new Date(Date.now() - 305000).toISOString()
        }
    ];

    // Hydrate top widgets
    metrics.value = {
        totalLive: mappings.value.length,
        pendingSyncs: mappings.value.filter(m => m.latestApprovedAssetId).length,
        failedSyncs: mappings.value.filter(m => m.syncStatus === 'failed').length,
        rollbacks24h: 1 // Mock metric
    };
});

const filteredMappings = computed(() => {
    return mappings.value.filter(map => {
        if (filters.value.syncStatus !== 'all' && map.syncStatus !== filters.value.syncStatus) return false;
        if (filters.value.hasPendingPublish && !map.latestApprovedAssetId) return false;
        if (filters.value.query) {
            const q = filters.value.query.toLowerCase();
            return map.siteId.includes(q) || map.currentLiveAssetId.includes(q);
        }
        return true;
    });
});

const formatId = (id: string) => id.length > 10 ? `...${id.slice(-6)}` : id;

const calculateTimeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
    return `${Math.floor(diff/86400000)}d ago`;
};

const openMapping = (siteId: string, sceneRole: string) => router.push(`/admin/deployments/target/${siteId}/${sceneRole}`);
</script>

<style scoped>
.deployment-dashboard-page { padding: 32px; color: #f8fafc; }
.page-header h2 { margin-bottom: 24px; }

/* Dashboard Widgets */
.metrics-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
.metric-card { background: #1e293b; border: 1px solid #334155; padding: 20px; border-radius: 8px; display: flex; flex-direction: column; align-items: flex-start; }
.metric-card .val { font-size: 32px; font-weight: bold; font-family: monospace; color: #f8fafc; }
.metric-card .lbl { font-size: 12px; color: #94a3b8; text-transform: uppercase; margin-top: 8px; font-weight: bold;}
.metric-card.active { border-top: 4px solid #10b981; }
.metric-card.pending { border-top: 4px solid #f59e0b; }
.metric-card.failed { border-top: 4px solid #ef4444; }
.metric-card.history { border-top: 4px solid #64748b; }

.filter-bar { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 24px; background: #0f172a; padding: 16px; border-radius: 8px; border: 1px solid #334155;}
.filter-bar input, .filter-bar select { background: #1e293b; color: #e2e8f0; border: 1px solid #334155; padding: 8px 12px; border-radius: 4px; outline: none; }
.search-group { flex: 1; }
.search-group input { width: 100%; max-width: 400px; }
.select-group { display: flex; align-items: center; gap: 16px; }

.toggle-switch { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #cbd5e1; cursor: pointer; }

/* Grid Table */
.ops-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.ops-table th { text-align: left; padding: 12px 16px; background: #1e293b; color: #94a3b8; border-bottom: 1px solid #334155; font-weight: normal; }
.ops-table td { padding: 16px; border-bottom: 1px solid #1e293b; vertical-align: middle; }
.mapping-row:hover { background: rgba(30, 41, 59, 0.5); }

.target-col .site-id { font-weight: bold; font-size: 14px; color: #f8fafc; }
.target-col .role-id { font-size: 11px; color: #94a3b8; font-family: monospace; margin-top: 4px; }

.asset-col a { color: #3b82f6; text-decoration: none; font-weight: bold; }
.asset-col a:hover { text-decoration: underline; }
.pending-badge { display: inline-block; margin-top: 6px; font-size: 10px; color: #f59e0b; background: rgba(245,158,11,0.1); padding: 2px 6px; border-radius: 4px; font-weight: bold; }

.sync-indicator { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: bold; padding: 4px 8px; border-radius: 12px; background: #334155; color: #cbd5e1; }
.sync-indicator .dot { width: 8px; height: 8px; border-radius: 50%; background: #94a3b8; }
.sync-indicator.synced { background: rgba(16, 185, 129, 0.1); color: #10b981; }
.sync-indicator.synced .dot { background: #10b981; }
.sync-indicator.syncing { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
.sync-indicator.syncing .dot { background: #f59e0b; animation: pulse 1s infinite alternate; }
.sync-indicator.failed { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
.sync-indicator.failed .dot { background: #ef4444; }

.sub-text { font-size: 11px; color: #64748b; margin-top: 4px; }
.sub-text.danger { color: #ef4444; }

.time-col .actor { color: #cbd5e1; font-weight: bold; }
.time-col .time { font-size: 11px; color: #94a3b8; margin-top: 2px; }

.rollback-col .safe { color: #10b981; font-family: monospace; }
.rollback-col .unsafe { color: #ef4444; font-style: italic; }

.btn-action { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 12px; }
.btn-action.primary { background: #3b82f6; color: white; }
.btn-action.primary:hover { background: #2563eb; }

.empty-state { text-align: center; color: #64748b; padding: 48px !important; }

@keyframes pulse {
    0% { opacity: 0.5; }
    100% { opacity: 1; }
}
</style>
