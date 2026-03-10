import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import {
    PipelineEventType,
    PipelineNotification,
    PipelineNotificationSchema,
    AutomationRule,
    AutomationExecutionRecord,
    NotificationTargetTypeEnum,
    NotificationChannelEnum
} from './events.types';

/**
 * 2. REFINED NOTIFICATIONS & AUTOMATION API
 * 
 * Central Event Bus operating globally across the Master Engine.
 * Intercepts cross-domain hooks securely broadcasting to arrays, emails, and webhooks.
 * Safely evaluates JSON matchers parsing Headless `AutomationRules`.
 */

export class OperationsEventBus {

    private notifications: Map<string, PipelineNotification> = new Map();
    private automationRules: Map<string, AutomationRule> = new Map();
    private executions: Map<string, AutomationExecutionRecord> = new Map();

    // Registry of actual structural functions the Automic engine can fire safely
    private actionRegistry: Map<string, (payload: any) => Promise<void>> = new Map();


    // ==========================================================================
    // A. CORE EVENT INGESTION
    // ==========================================================================
    public async emitWorkflowEvent(
        eventType: PipelineEventType,
        entityType: 'feedback' | 'queue_item' | 'job' | 'asset' | 'preview_session' | 'site',
        entityId: string,
        payload: any,
        siteId?: string
    ) {
        const eventId = uuidv4();
        console.log(`[EVENT_BUS] Caught Event: ${eventType} | Entity: ${entityId}`);

        // Immediately scan for Headless Automations listening to this state transition
        await this.processAutomations(eventId, eventType, entityId, payload, siteId);
    }

    // ==========================================================================
    // B. REFINED NOTIFICATIONS MANAGEMENT
    // ==========================================================================
    public createNotification(
        targetType: z.infer<typeof NotificationTargetTypeEnum>,
        recipientId: string, // User UUID or Role String ("all_admins")
        eventType: PipelineEventType,
        entityType: 'feedback' | 'queue_item' | 'job' | 'asset' | 'preview_session' | 'site',
        entityId: string,
        title: string,
        message: string,
        siteId?: string,
        actionUrl?: string,
        channel: z.infer<typeof NotificationChannelEnum> = 'in-app'
    ): PipelineNotification {
        const notice: PipelineNotification = {
            notificationId: uuidv4(),
            eventType,
            entityType,
            entityId,
            siteId: siteId || null,
            targetType,
            recipientId,
            channel,
            title,
            message,
            actionUrl: actionUrl || null,
            createdAt: new Date(),
            readAt: null,
            status: 'unread'
        };

        PipelineNotificationSchema.parse(notice);
        this.notifications.set(notice.notificationId, notice);

        this.dispatchToExternalChannels(notice);

        return notice;
    }

    /**
     * Adapter Layer for Future Transport Mechanisms
     */
    private dispatchToExternalChannels(notice: PipelineNotification) {
        if (notice.channel === 'email') {
            console.log(`[SendGrid_Adapter] Dispatching Email to ${notice.recipientId}: ${notice.title}`);
        } else if (notice.channel === 'slack' || notice.channel === 'discord') {
            console.log(`[Webhook_Adapter] POSTing JSON Payload to ${notice.channel} Hook: ${notice.title}`);
        }
    }

    public markNotificationRead(notificationId: string): void {
        const n = this.notifications.get(notificationId);
        if (n && n.status === 'unread') {
            n.status = 'read';
            n.readAt = new Date();
        }
    }

    public dismissNotification(notificationId: string): void {
        const n = this.notifications.get(notificationId);
        if (n) n.status = 'dismissed';
    }

    public getNotificationsForUser(userId: string, userRoles: string[], unreadOnly: boolean = false): PipelineNotification[] {
        const all = Array.from(this.notifications.values()).filter(n => {
            // Target was specifically me
            if (n.targetType === 'user' && n.recipientId === userId) return true;
            // Target was broadly a Role map I possess (e.g. "admin_team")
            if (n.targetType === 'team_role' && userRoles.includes(n.recipientId)) return true;
            return false;
        });

        if (unreadOnly) {
            return all.filter(n => n.status === 'unread');
        }
        return all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    // ==========================================================================
    // C. REFINED AUTOMATION EXECUTION
    // ==========================================================================

    public registerAutomationAction(actionName: string, executeFn: (payload: any) => Promise<void>) {
        this.actionRegistry.set(actionName, executeFn);
    }

    public registerAutomationRule(rule: AutomationRule): void {
        this.automationRules.set(rule.automationRuleId, rule);
    }

    private evaluateConditions(rule: AutomationRule, payload: any, siteId?: string): boolean {
        if (!rule.conditionFilters) return true;

        // Ensure the injected parameters physically match the Rule's required JSON schema criteria
        for (const [key, expectedValue] of Object.entries(rule.conditionFilters)) {
            if (key === 'siteId' && siteId !== expectedValue) return false;
            if (payload[key] !== expectedValue) return false;
        }
        return true;
    }

    private async processAutomations(eventId: string, eventType: PipelineEventType, entityId: string, payload: any, siteId?: string) {

        const rules = Array.from(this.automationRules.values()).filter(r =>
            r.isActive && r.triggerEventType === eventType
        );

        for (const rule of rules) {
            const execRecord: AutomationExecutionRecord = {
                executionId: uuidv4(),
                automationRuleId: rule.automationRuleId,
                triggerEventId: eventId,
                entityId,
                status: 'pending',
                errorMessage: null,
                executedAt: new Date()
            };
            this.executions.set(execRecord.executionId, execRecord);

            try {
                if (!this.evaluateConditions(rule, payload, siteId)) {
                    execRecord.status = 'skipped';
                    console.log(`[AUTOMATION] Rule Skipped: ${rule.name} (Conditions Unmet)`);
                    continue;
                }

                const actionFn = this.actionRegistry.get(rule.actionName);
                if (!actionFn) throw new Error(`Action '[${rule.actionName}]' missing`);

                console.log(`[AUTOMATION] Rule Fired: ${rule.name} -> Action: ${rule.actionName}`);
                await actionFn({ entityId, payload, siteId });
                execRecord.status = 'executed';

            } catch (err: any) {
                execRecord.status = 'failed';
                execRecord.errorMessage = err.message || "Unknown error";
                console.error(`[AUTOMATION_ERROR] ${execRecord.errorMessage}`);
            }
        }
    }

    public getAutomationExecutionsForEntity(entityId: string): AutomationExecutionRecord[] {
        return Array.from(this.executions.values())
            .filter(e => e.entityId === entityId)
            .sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime());
    }
}
