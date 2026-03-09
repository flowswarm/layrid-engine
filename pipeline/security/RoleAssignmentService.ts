/**
 * pipeline/security/RoleAssignmentService.ts
 * 
 * LAYER C — Roles / Assignment
 * Codex Layer C requires role-based assignment for workflow operations.
 * 
 * This service manages operator roles and their assignments to
 * workflow items (reviews, approvals, deployments).
 */

export type OperatorRole =
    | 'admin'
    | 'art-director'
    | 'developer'
    | 'client-reviewer'
    | 'operator';

export interface RoleAssignment {
    operatorId: string;
    role: OperatorRole;
    assignedTo: string;     // workflowId, siteId, or familyId
    assignedAt: Date;
    assignedBy: string;
}

export class RoleAssignmentService {
    private assignments: Map<string, RoleAssignment[]> = new Map();

    /**
     * Assign an operator to a workflow item with a specific role.
     */
    public assign(
        operatorId: string,
        role: OperatorRole,
        targetId: string,
        assignedBy: string
    ): RoleAssignment {
        const assignment: RoleAssignment = {
            operatorId,
            role,
            assignedTo: targetId,
            assignedAt: new Date(),
            assignedBy
        };

        const existing = this.assignments.get(targetId) || [];
        existing.push(assignment);
        this.assignments.set(targetId, existing);

        return assignment;
    }

    /**
     * Remove an operator's assignment from a workflow item.
     */
    public unassign(operatorId: string, targetId: string): void {
        const existing = this.assignments.get(targetId);
        if (existing) {
            this.assignments.set(
                targetId,
                existing.filter(a => a.operatorId !== operatorId)
            );
        }
    }

    /**
     * Check if an operator has the required role for a target.
     */
    public hasRole(operatorId: string, targetId: string, requiredRole: OperatorRole): boolean {
        const existing = this.assignments.get(targetId) || [];
        return existing.some(a => a.operatorId === operatorId && a.role === requiredRole);
    }

    /**
     * Get all assignments for a specific target (workflow, site, family).
     */
    public getAssignments(targetId: string): RoleAssignment[] {
        return this.assignments.get(targetId) || [];
    }

    /**
     * Get all assignments for a specific operator across all targets.
     */
    public getOperatorAssignments(operatorId: string): RoleAssignment[] {
        const all: RoleAssignment[] = [];
        for (const assignments of this.assignments.values()) {
            all.push(...assignments.filter(a => a.operatorId === operatorId));
        }
        return all;
    }
}
