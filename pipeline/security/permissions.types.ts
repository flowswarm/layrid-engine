import { z } from 'zod';

/**
 * 1. REFINED PERMISSIONS & ROLE SCHEMA
 * 
 * Formal structural capabilities defining explicitly what a User or Role 
 * can perform physically against the core engine architecture, enforcing
 * strict multi-tenant boundary constraints safely.
 */

// ============================================================================
// A. ATOMIC PERMISSIONS (Capabilities)
// Consistent nomenclature: [domain]:[action]:[entity]
// ============================================================================
export const PermissionCapabilityEnum = z.enum([
    // Asset Generation & Job Runner
    'asset.generation:request',
    'asset.generation:trigger',
    'asset.generation:view_status',

    // Review & Revision (Queue)
    'queue.revision:review',
    'queue.revision:convert',
    'queue.revision:trigger_job',
    'queue.revision:view',
    'queue.revision:assign',

    // Previews & Comparisons
    'preview.session:create',
    'preview.session:create_client_link',
    'comparison.session:create',

    // Approval Workflow
    'workflow.approval:approve',
    'workflow.approval:reject',

    // Publishing & Deployment Sync
    'site.deployment:publish',
    'site.deployment:rollback',

    // System Administration
    'system.roles:manage',
    'system.permissions:manage',
    'system.audit:view'
]);

export type PermissionCapability = z.infer<typeof PermissionCapabilityEnum>;

// ============================================================================
// B. ROLES
// ============================================================================
export const SystemRoleEnum = z.enum([
    'observer',
    'asset_operator',
    'reviewer',
    'approver',
    'publisher',
    'project_manager',
    'admin'
]);

export type SystemRole = z.infer<typeof SystemRoleEnum>;

// ============================================================================
// C. ROLE -> PERMISSION MAPPINGS (INHERITANCE STRUCTURE)
// ============================================================================
const ObserverCapabilities: PermissionCapability[] = [
    'asset.generation:view_status',
    'queue.revision:view'
];

const AssetOperatorCapabilities: PermissionCapability[] = [
    ...ObserverCapabilities,
    'asset.generation:request',
    'asset.generation:trigger'
];

const ReviewerCapabilities: PermissionCapability[] = [
    ...ObserverCapabilities,
    'queue.revision:review',
    'comparison.session:create',
    'preview.session:create',
    'preview.session:create_client_link'
];

const ApproverCapabilities: PermissionCapability[] = [
    ...ReviewerCapabilities,
    'workflow.approval:approve',
    'workflow.approval:reject'
];

const PublisherCapabilities: PermissionCapability[] = [
    ...ApproverCapabilities,
    'site.deployment:publish',
    'site.deployment:rollback'
];

const ProjectManagerCapabilities: PermissionCapability[] = [
    ...AssetOperatorCapabilities,
    ...ReviewerCapabilities,
    'queue.revision:assign',
    'queue.revision:convert',
    'queue.revision:trigger_job'
];

const AdminCapabilities = PermissionCapabilityEnum.options as unknown as PermissionCapability[];

export const RolePermissionRegistry: Record<SystemRole, PermissionCapability[]> = {
    'observer': ObserverCapabilities,
    'asset_operator': AssetOperatorCapabilities,
    'reviewer': ReviewerCapabilities,
    'approver': ApproverCapabilities,
    'publisher': PublisherCapabilities,
    'project_manager': ProjectManagerCapabilities,
    'admin': AdminCapabilities
};

// ============================================================================
// D. PERMISSION AUDIT LOGGING SCHEMA
// ============================================================================
export const PermissionAuditLogSchema = z.object({
    permissionCheckId: z.string().uuid(),
    userId: z.string().uuid(),

    // What Capability was attempted?
    action: PermissionCapabilityEnum,

    // Mathematical Scope
    entityContext: z.object({
        entityType: z.enum(['site', 'asset', 'queue_item', 'preview_session', 'comparison_session', 'job']).nullable().default(null),
        entityId: z.string().nullable().default(null),
        siteId: z.string().uuid().nullable().default(null).describe('Boundary enforcement restriction')
    }).nullable(),

    // Verdict
    result: z.enum(['allowed', 'denied']),
    reason: z.string().optional(),

    checkedAt: z.date()
});

export type PermissionAuditLog = z.infer<typeof PermissionAuditLogSchema>;
