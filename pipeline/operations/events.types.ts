import { z } from 'zod';

/**
 * 1. REFINED NOTIFICATIONS & AUTOMATION SCHEMA
 *
 * Production-ready Event Bus definitions. Explicitly types global engine actions
 * and routes them as physical audit logs targeting specific Channels and Users.
 */

// ============================================================================
// A. MASTER EVENT DICTIONARY (Standardized & Consistent Naming)
// ============================================================================
export const PipelineEventTypeEnum = z.enum([
    // Feedback Layer
    'feedback.submitted',
    'feedback.converted_to_request',

    // Revision Queue
    'queue.item.created',
    'queue.item.assigned',
    'queue.item.ready_for_preview',
    'queue.item.ready_for_publish_review',

    // Job Runner 
    'job.started',
    'job.failed',
    'job.completed',

    // Registries / Assets
    'asset.variant.generated',
    'asset.variant.attached_to_queue',

    // Previews & Approvals
    'preview.session.created',
    'preview.client.viewed',
    'preview.client.approved',
    'preview.client.requested_changes',

    // Deployment Sync
    'site.asset.approved',
    'site.asset.published',
    'site.asset.replaced',
    'site.rollback.executed'
]);

export type PipelineEventType = z.infer<typeof PipelineEventTypeEnum>;

// ============================================================================
// B. REFINED NOTIFICATIONS
// ============================================================================
export const NotificationStatusEnum = z.enum([
    'unread',
    'read',
    'dismissed',
    'archived'
]);

export const NotificationChannelEnum = z.enum([
    'in-app',
    'email',
    'webhook',
    'slack',
    'discord'
]);

export const NotificationTargetTypeEnum = z.enum([
    'user',           // Specific Admin / Reviewer GUID
    'team_role',      // Broadcast: "All Admins", "All Artists"
    'client'          // Future: Send email to the brand client
]);

export const PipelineNotificationSchema = z.object({
    notificationId: z.string().uuid(),

    // Audit Context
    eventType: PipelineEventTypeEnum,
    entityType: z.enum(['feedback', 'queue_item', 'job', 'asset', 'preview_session', 'site']),
    entityId: z.string().uuid().describe('The primary UUID of the object that changed'),

    // Granular Routing & Targeting
    siteId: z.string().uuid().nullable().describe('Which brand environment this relates to'),

    targetType: NotificationTargetTypeEnum.default('user'),
    recipientId: z.string().describe('The GUID of the user OR the Role Name (e.g. "admin-group")'),

    channel: NotificationChannelEnum.default('in-app'),

    // Content
    title: z.string(),
    message: z.string(),
    actionUrl: z.string().nullable().describe('Actionable deep-link (e.g., /dashboard/queue/xyz)'),

    // Ledger
    createdAt: z.date(),
    readAt: z.date().nullable().default(null),
    status: NotificationStatusEnum.default('unread')
});

export type PipelineNotification = z.infer<typeof PipelineNotificationSchema>;

// ============================================================================
// C. REFINED HEADLESS AUTOMATIONS
// ============================================================================
export const AutomationExecutionStatusEnum = z.enum([
    'pending',
    'executed',
    'skipped',
    'failed'
]);

export const AutomationRuleSchema = z.object({
    automationRuleId: z.string().uuid(),
    name: z.string(),
    description: z.string(),

    // The explicitly mapped trigger
    triggerEventType: PipelineEventTypeEnum,

    // JSON Matcher (e.g. { "siteId": "site-a" })
    conditionFilters: z.record(z.any()).optional().describe('Only fire if Payload properties match this object'),

    // The target action (Arbitrary callback pointer securely registered in the engine)
    actionName: z.string().describe('The Registry key of the function to fire (e.g., "markQueueGenerated")'),

    isActive: z.boolean().default(true)
});

export type AutomationRule = z.infer<typeof AutomationRuleSchema>;

export const AutomationExecutionRecordSchema = z.object({
    executionId: z.string().uuid(),
    automationRuleId: z.string().uuid(),
    triggerEventId: z.string().uuid(),

    entityId: z.string().uuid(),

    status: AutomationExecutionStatusEnum,
    errorMessage: z.string().nullable().default(null),

    executedAt: z.date()
});

export type AutomationExecutionRecord = z.infer<typeof AutomationExecutionRecordSchema>;
