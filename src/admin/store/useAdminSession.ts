import { defineStore } from 'pinia';

export interface AdminUser {
    id: string;
    role: string;
}

export const useAdminSession = defineStore('adminSession', {
    state: () => ({
        user: {
            id: 'demo-uuid-123',
            role: 'publisher' // Setting 'publisher' to let them view 'Deployments'
        } as AdminUser
    }),
    actions: {
        /**
         * Checks if the user has at least one of the required roles.
         * If the array empty/undefined, the route is open to any admin.
         */
        hasRoleAny(roles?: string[]): boolean {
            if (!roles || roles.length === 0) return true;
            if (this.user.role === 'admin') return true;
            return roles.includes(this.user.role);
        }
    }
});
