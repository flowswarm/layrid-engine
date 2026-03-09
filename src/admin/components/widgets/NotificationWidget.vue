<!-- src/admin/components/widgets/NotificationWidget.vue -->
<template>
  <div class="notification-widget" @click="toggleDropdown">
    
    <div class="bell-icon">
      🛎️
      <div v-if="unreadCount > 0" class="badge">{{ unreadCount }}</div>
    </div>

    <!-- Dropdown Menu -->
    <div v-if="isOpen" class="dropdown-pane">
       
       <div class="dropdown-header">
           <h4>Recent Alerts</h4>
           <!-- RBAC CONDITIONAL: Managers can broadcast announcements -->
           <button v-if="permissions.canBroadcast" class="btn-text" @click="openBroadcastModal">
               New Broadcast
           </button>
       </div>

       <div v-if="notifications.length === 0" class="empty-state">
           No new notifications.
       </div>

       <ul class="notification-list">
           <li 
             v-for="alert in notifications" 
             :key="alert.notificationId"
             class="alert-item"
             :class="{ unread: !alert.readAt }"
           >
               <div class="alert-title">{{ alert.title }}</div>
               <div class="alert-body">{{ alert.message }}</div>
               <div class="alert-meta">
                   {{ formatDate(alert.createdAt) }}
                   <button @click.stop="markAsRead(alert.notificationId)" class="btn-text sz-sm">Mark Read</button>
               </div>
               
               <!-- Deep Link into the specific entity that fired the alert -->
               <router-link v-if="alert.entityId" :to="getAlertRoute(alert)" class="alert-link">
                   View {{ formatEntityType(alert.entityType) }} &rarr;
               </router-link>
           </li>
       </ul>

    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAdminSession } from '../../store/useAdminSession';
// import { fetchMyNotifications, markNotificationRead } from '../../api/notificationsApi';

const session = useAdminSession();
const isOpen = ref(false);
const notifications = ref<any[]>([]);

const permissions = ref({
    // Only Project Managers and Admins possess arbitrary assignment & broadcast rights
    canBroadcast: session.hasCapability('queue.revision:assign')
});

const unreadCount = computed(() => notifications.value.filter(n => !n.readAt).length);

onMounted(async () => {
    // 1. ENGINE INTEGRATION:
    // The UI securely queries the Event Bus API for alerts explicitly targeting this `userId`
    // or targeting `team_roles` that this current UUID organically possesses.
    notifications.value = [
        { 
            notificationId: 'notif-1', 
            title: 'Render Complete', 
            message: 'Your requested matte variant has finished executing in Blender.', 
            entityType: 'queue_item', 
            entityId: 'ticket-1',
            createdAt: new Date(),
            readAt: null
        },
        { 
            notificationId: 'notif-2', 
            title: 'Client Approval Received', 
            message: 'Client-123 approved target mesh.', 
            entityType: 'asset', 
            entityId: 'glb-hash-456',
            createdAt: new Date(Date.now() - 3600000),
            readAt: new Date()
        }
    ];
});

const toggleDropdown = () => isOpen.value = !isOpen.value;
const markAsRead = async (id: string) => { /* await markNotificationRead(id); */ };
const openBroadcastModal = () => { /* ... */ };

// 2. NATIVE DEEP LINK RESOLUTION
const getAlertRoute = (alert: any) => {
    if (alert.entityType === 'queue_item') return `/admin/queue/${alert.entityId}`;
    if (alert.entityType === 'asset') return `/admin/deployments/${alert.entityId}`;
    return '/admin';
};
const formatEntityType = (type: string) => type.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
const formatDate = (date: Date) => date.toLocaleTimeString();
</script>

<style scoped>
.notification-widget { position: relative; cursor: pointer; }
.bell-icon { font-size: 20px; position: relative; }
.badge { position: absolute; top: -5px; right: -8px; background: #ef4444; color: white; border-radius: 50%; width: 18px; height: 18px; font-size: 10px; display: flex; justify-content: center; align-items: center; font-weight: bold; }
.dropdown-pane { position: absolute; top: 35px; right: 0; width: 320px; background: #1e293b; border: 1px solid #334155; border-radius: 6px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.5); z-index: 100; cursor: default; }
.dropdown-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid #334155; }
.dropdown-header h4 { margin: 0; font-size: 14px; color: #cbd5e1; }
.empty-state { padding: 24px; text-align: center; color: #94a3b8; font-size: 13px; }
.notification-list { list-style: none; padding: 0; margin: 0; max-height: 400px; overflow-y: auto; }
.alert-item { padding: 12px 16px; border-bottom: 1px solid #334155; }
.alert-item.unread { background: #0f172a; border-left: 2px solid #3b82f6; }
.alert-title { font-weight: bold; font-size: 13px; color: #e2e8f0; margin-bottom: 4px; }
.alert-body { font-size: 12px; color: #94a3b8; margin-bottom: 8px; line-height: 1.4; }
.alert-meta { display: flex; justify-content: space-between; font-size: 11px; color: #64748b; margin-bottom: 8px; }
.btn-text { background: none; border: none; color: #3b82f6; cursor: pointer; padding: 0; text-decoration: underline; font-size: 12px; }
.btn-text.sz-sm { font-size: 10px; }
.alert-link { display: inline-block; font-size: 11px; color: #10b981; text-decoration: none; }
.alert-link:hover { text-decoration: underline; }
</style>
