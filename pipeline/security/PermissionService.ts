import { v4 as uuidv4 } from 'uuid';
import {
    SystemRole,
    PermissionCapability,
    RolePermissionRegistry,
    PermissionAuditLog,
    PermissionAuditLogSchema
} from './permissions.types';

export interface EntityScopeContext {
    entityType?: 'site' | 'asset' | 'queue_item' | 'preview_session' | 'comparison_session' | 'job';
    entityId?: string;
    siteId?: string;
}

// In Production, this resolves from physical Database records.
interface UserContext {
    userId: string;
    roles: SystemRole[];
    // Enterprise Scalability limits:
    assignedSiteIds?: string[];  // Empty = Global/System-Wide access
}

/**
 * 2. REFINED PERMISSION CHECK SERVICE
 * 
 * Central Authorization Gatekeeper globally validating operations.
 * Protects Queue pipelines, Preview generation, and Site Deployment targets
 * strictly via unified Capability resolution routines.
 */
export class PermissionService {

    private auditLogs: PermissionAuditLog[] = [];

    // Mock DB resolving Multi-Team Orgs.
    private userDirectory: Map<string, UserContext> = new Map();

    constructor() {
        // Seed boundary profiles
        this.userDirectory.set('admin-xyz', { userId: 'admin-xyz', roles: ['admin'] });

        // Specifically constrained to a single Brand Site natively!
        this.userDirectory.set('publisher-a', { userId: 'publisher-a', roles: ['publisher'], assignedSiteIds: ['site-a'] });

        this.userDirectory.set('approver-1', { userId: 'approver-1', roles: ['approver'] });
        this.userDirectory.set('reviewer-1', { userId: 'reviewer-1', roles: ['reviewer'] });
        this.userDirectory.set('observer-1', { userId: 'observer-1', roles: ['observer'] });
    }

    /**
     * MATHEMATICAL EVALUATOR
     */
    public canUserPerformAction(
        userId: string,
        action: PermissionCapability,
        entityContext?: EntityScopeContext
    ): boolean {

        const user = this.userDirectory.get(userId);
        let isAllowed = false;
        let reason = 'User lacks roles or does not exist.';

        if (user) {
            const userCapabilities = new Set<PermissionCapability>();

            user.roles.forEach(role => {
                const ruleSet = RolePermissionRegistry[role] || [];
                ruleSet.forEach(cap => userCapabilities.add(cap));
            });

            // Phase 1: General Role Capability Evaluation
            if (!userCapabilities.has(action)) {
                reason = `Roles [${user.roles.join(', ')}] explicitly lack capability '${action}'.`;
            } else {

                // Phase 2: Entity Scope Boundary Enforcement (Multi-Tenant Org Rules)
                isAllowed = true;
                reason = 'Granted by role inheritance natively.';

                // If a Payload Target explicitly declares a site boundary...
                if (entityContext?.siteId) {
                    // And the specific Admin explicitly has hardcoded boundary assignments limits...
                    if (user.assignedSiteIds && user.assignedSiteIds.length > 0) {
                        if (!user.assignedSiteIds.includes(entityContext.siteId)) {
                            isAllowed = false;
                            reason = `Capability granted, but User is RESTRICTED from crossing boundaries into 'siteId: ${entityContext.siteId}'.`;
                        }
                    }
                }
            }
        }

        this.recordAuditLog(userId, action, isAllowed, reason, entityContext);
        return isAllowed;
    }

    /**
     * ENFORCEMENT HOOK
     * Route Interceptor that universally shields APIs.
     */
    public enforceAction(userId: string, action: PermissionCapability, entityContext?: EntityScopeContext): void {
        if (!this.canUserPerformAction(userId, action, entityContext)) {
            throw new Error(`[SECURITY DENIED] Action '${action}' is natively prohibited for User [${userId}].`);
        }
    }

    private recordAuditLog(userId: string, action: PermissionCapability, result: boolean, reason: string, entityContext?: EntityScopeContext) {

        const logPayload = {
            permissionCheckId: uuidv4(),
            userId,
            action,
            entityContext: {
                entityType: entityContext?.entityType || null,
                entityId: entityContext?.entityId || null,
                siteId: entityContext?.siteId || null,
            },
            result: result ? 'allowed' : 'denied' as 'allowed' | 'denied',
            reason,
            checkedAt: new Date()
        };

        const log = PermissionAuditLogSchema.parse(logPayload);
        this.auditLogs.push(log);

        if (!result) {
            console.warn(`[AUDIT_DENY] ${log.userId} attempted '${log.action}' | Rejected: ${reason}`);
        }
    }

    public getAuditHistory(): PermissionAuditLog[] {
        return this.auditLogs;
    }
}
