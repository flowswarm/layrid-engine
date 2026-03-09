/**
 * pipeline/security/permissionIntegrationExamples.ts
 * 
 * Demonstrates how the core engine consumes the Central Permission Service.
 * 
 * Shows structural enforcement where Role Capabilities are physically checked
 * before allowing Asset Operations, intercepting Multi-Tenant Org bounds implicitly.
 */

import { PermissionService } from './PermissionService';
import { RevisionQueueManager } from '../operations/RevisionQueueManager';

// Mock instantiation
const permissions = new PermissionService();

let mockQueueManager: any = {};


// ============================================================================
// EXAMPLE 1: Reviewer Attempts to Approve
// -> PERMISSION DENIED (Exception Thrown due to Action Name)
// ============================================================================
export function exampleReviewerViolatesApprovalAction() {
    console.log("--- Example 1: Reviewer Illegal Action ---");
    const userId = 'reviewer-1'; // User Role is explicitly ['reviewer']

    try {
        permissions.enforceAction(userId, 'workflow.approval:approve', {
            entityType: 'queue_item',
            entityId: 'ticket-1'
        });
    } catch (err: any) {
        console.log(`Intercepted: ${err.message}`);
        // Output: [SECURITY DENIED] Action 'workflow.approval:approve' is natively prohibited for User [reviewer-1].
    }
}

// ============================================================================
// EXAMPLE 2: Publisher Publishes to Owned Site
// -> PERMISSION ALLOWED
// ============================================================================
export function examplePublisherSucceedsDeployOwned() {
    console.log("--- Example 2: Publisher Success (Owned Site) ---");

    // User configured securely to ONLY manage Site-A
    const userId = 'publisher-a';

    try {
        // Enforce the deploy targeting Site-A
        permissions.enforceAction(userId, 'site.deployment:publish', {
            entityType: 'site',
            siteId: 'site-a'
        });

        console.log("Authorized. Site-A Deploy Triggered.");

    } catch (err: any) {
        console.error("Should not throw.", err);
    }
}

// ============================================================================
// EXAMPLE 3: Publisher Attempts to Publish to Unowned Site
// -> PERMISSION DENIED (Exception Thrown due to Boundary)
// ============================================================================
export function examplePublisherViolatesTenantBounds() {
    console.log("--- Example 3: Publisher Boundary Violation ---");

    // User holds Publisher capabilities... but is strictly bounded to Site-A
    const userId = 'publisher-a';

    try {
        // Enforce the deploy attempting to hijack Site-B
        permissions.enforceAction(userId, 'site.deployment:publish', {
            entityType: 'site',
            siteId: 'site-b'
        });

    } catch (err: any) {
        console.log(`Intercepted: ${err.message}`);
        // Output: [SECURITY DENIED] Action 'site.deployment:publish' is natively prohibited for User [publisher-a].
        // Audit Reason: "Capability granted, but User is RESTRICTED from crossing boundaries into 'siteId: site-b'."
    }
}

// ============================================================================
// EXAMPLE 4: Project Manager Converts Feedback to Revision Ticket
// -> PERMISSION ALLOWED
// ============================================================================
export function exampleProjectManagerRevises() {
    console.log("--- Example 4: Project Manager Conversion ---");
    const userId = 'project_manager-1'; // PMs own Queue conversions

    try {
        permissions.enforceAction(userId, 'queue.revision:convert', {
            entityType: 'queue_item'
        });

        console.log("Authorized. Ticket Generated.");

    } catch (err: any) {
        console.error(err);
    }
}
