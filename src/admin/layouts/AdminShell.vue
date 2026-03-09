<!-- src/admin/layouts/AdminShell.vue -->
<template>
  <div class="admin-shell">
    
    <!-- LEFT SIDEBAR NAVIGATION -->
    <aside class="sidebar">
      <div class="logo">Layrid Pipeline Ops</div>
      
      <nav class="main-nav">
        <!-- Dashboard Home -->
        <router-link to="/admin" class="nav-item">
          Dashboard Overview
        </router-link>

        <!-- Dynamic Role-Based Route Groups -->
        <div v-for="group in filteredNavGroups" :key="group.title" class="nav-group">
          <h4 class="group-title">{{ group.title }}</h4>
          <router-link 
            v-for="route in group.routes" 
            :key="route.name" 
            :to="route.path"
            class="nav-item"
          >
            {{ route.name }}
          </router-link>
        </div>
      </nav>
    </aside>

    <!-- HEADER & MAIN CONTENT AREA -->
    <div class="content-wrapper">
      <header class="topbar">
        <div class="breadcrumbs">
           <!-- Dynamic Breadcrumbs -->
           Queue > Ticket-123 > Convert
        </div>
        
        <div class="user-actions">
           <!-- Notifications Dropdown -->
           <NotificationWidget />
           <div class="profile-pill">
              Logged in as: <strong>{{ activeUser.role }}</strong>
           </div>
        </div>
      </header>

      <!-- PAGE INJECTION -->
      <main class="page-container">
        <!-- Render current route explicitly inside the Operations envelope -->
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAdminSession } from '../store/useAdminSession';
import { AdminRoutes } from '../architecture/AdminControlPanelRoutes';
import NotificationWidget from '../components/widgets/NotificationWidget.vue';

const session = useAdminSession();
const activeUser = session.user; // e.g., { id: 'uuid', role: 'publisher' }

/**
 * Filter the Route configurations mathematically against the strict Node RBAC definitions!
 * If the Route Array says `meta.requireRole: ['publisher']`, and the User lacks it,
 * we entirely rip it out of the UI physically.
 */
const filteredNavGroups = computed(() => {
    // 1. Filter allowed routes
    const allowed = AdminRoutes.filter(route => {
        if (!route.meta?.navGroup) return false;
        // Uses the central `RolePermissionRegistry` mappings exported earlier
        return session.hasRoleAny(route.meta.requireRole); 
    });

    // 2. Group by `navGroup` strings (e.g. "Operations", "Registry")
    const groups: Record<string, any[]> = {};
    allowed.forEach(route => {
        const group = route.meta.navGroup as string;
        if (!groups[group]) groups[group] = [];
        groups[group].push(route);
    });

    // 3. Convert to Array for Vue Iteration
    return Object.keys(groups).map(title => ({
        title,
        routes: groups[title]
    }));
});
</script>

<style scoped>
/* Mock Layout CSS */
.admin-shell { display: flex; height: 100vh; background: #0f172a; color: #f8fafc; }
.sidebar { width: 250px; background: #1e293b; border-right: 1px solid #334155; padding: 20px; }
.nav-group { margin-top: 24px; }
.group-title { font-size: 11px; text-transform: uppercase; color: #94a3b8; }
.nav-item { display: block; padding: 8px 12px; color: #e2e8f0; text-decoration: none; border-radius: 4px; }
.nav-item:hover { background: #334155; }
.content-wrapper { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.topbar { height: 60px; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; padding: 0 24px; align-items: center; }
.page-container { flex: 1; padding: 32px; overflow-y: auto; }
</style>
