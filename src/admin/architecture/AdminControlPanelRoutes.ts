/**
 * src/admin/architecture/AdminControlPanelRoutes.ts
 * 
 * Defines the structural Vue/Nuxt routing paradigm required for the
 * centralized Operations Dashboard.
 */

export const AdminRoutes = [
    // 1. OVERVIEW WIDGETS
    {
        path: '/admin',
        name: 'AdminDashboard',
        component: 'admin/pages/Dashboard.vue',
        meta: { requireRole: ['observer'] } // Everyone sees the home
    },

    // 2. REVISION QUEUE OPERATIONS
    {
        path: '/admin/queue',
        name: 'RevisionQueueList',
        component: 'admin/pages/queue/QueueList.vue',
        meta: { requireRole: ['reviewer', 'project_manager'], navGroup: 'Operations' }
    },
    {
        path: '/admin/queue/:ticketId',
        name: 'RevisionQueueDetail',
        component: 'admin/pages/queue/QueueDetail.vue',
        meta: { requireRole: ['reviewer', 'project_manager'] }
    },

    // 3. JOB MONITORING
    {
        path: '/admin/jobs',
        name: 'JobMonitorList',
        component: 'admin/pages/jobs/JobMonitorList.vue',
        meta: { requireRole: ['asset_operator', 'project_manager'], navGroup: 'Pipeline' }
    },

    // 4. ASSET LIBRARY & VARIANTS
    {
        path: '/admin/library',
        name: 'AssetLibraryList',
        component: 'admin/pages/library/AssetList.vue',
        meta: { requireRole: ['reviewer', 'approver', 'publisher'], navGroup: 'Registry' }
    },
    {
        path: '/admin/library/:assetFamily',
        name: 'AssetFamilyDetail',
        component: 'admin/pages/library/AssetFamilyDetail.vue', // Compares multiple generated hashes globally
        meta: { requireRole: ['reviewer', 'approver', 'publisher'] }
    },

    // 5. APPROVALS & PUBLISHING SYNC
    {
        path: '/admin/deployments',
        name: 'DeploymentSyncList',
        component: 'admin/pages/deployments/DeploymentList.vue',
        meta: { requireRole: ['publisher'], navGroup: 'Operations' }
    },

    // 6. PREVIEWS & COMPARISON LINKS
    {
        path: '/admin/previews',
        name: 'ClientPreviewLinks',
        component: 'admin/pages/previews/PreviewList.vue',
        meta: { requireRole: ['reviewer', 'approver'], navGroup: 'Registry' }
    },

    // 7. TEAM ASSIGNMENTS & ROLES
    {
        path: '/admin/settings/team',
        name: 'TeamManagement',
        component: 'admin/pages/settings/TeamRoles.vue',
        meta: { requireRole: ['admin', 'project_manager'], navGroup: 'Settings' }
    }
];

/**
 * RECOMMENDED VUE/NUXT FILE STRUCTURE:
 * 
 * src/
 *  admin/
 *   ├─ layouts/
 *   │   └─ AdminShell.vue         (Master wrapping layout with Side Nav and Header)
 *   ├─ pages/
 *   │   ├─ Dashboard.vue          (Widget Host)
 *   │   ├─ queue/                 (Lists + Detail Maps)
 *   │   ├─ library/
 *   │   └─ deployments/
 *   ├─ components/
 *   │   ├─ ui/                    (Generic Buttons, Badges, Modals)
 *   │   ├─ widgets/               (JobsInProgressCard, QueueReviewCard)
 *   │   └─ domain/                (AssetVariantCompareModal, FeedbackConvertForm)
 *   ├─ store/
 *   │   └─ useAdminSession.ts     (Pinia store managing User Roles & active Navigation)
 */
