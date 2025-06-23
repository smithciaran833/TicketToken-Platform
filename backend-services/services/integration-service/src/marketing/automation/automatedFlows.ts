import { PrismaClient } from '@prisma/client';
import { MailchimpIntegration } from '../email/mailchimpSync';
import { TwitterEventAnnouncer } from '../../social/twitter/eventAnnouncements';
import { InstagramEventPromoter } from '../../social/instagram/eventPromotion';

interface AutomationTrigger {
  type: 'event_created' | 'ticket_purchased' | 'event_sold_out' | 'event_cancelled' | 'milestone_reached';
  conditions?: Record<string, any>;
  delay?: number; // seconds
}

interface AutomationAction {
  type: 'email' | 'social_post' | 'notification' | 'update_crm' | 'generate_report';
  platform?: string;
  template?: string;
  recipients?: string[];
  content?: any;
}

interface AutomationWorkflow {
  id: string;
  name: string;
  description: string;
  trigger: AutomationTrigger;
  actions: AutomationAction[];
  active: boolean;
  conditions?: Array<{
    field: string;
    operator: 'equals' | 'greater_than' | 'less_than' | 'contains';
    value: any;
  }>;
}

export class MarketingAutomationEngine {
  private prisma: PrismaClient;
  private mailchimp: MailchimpIntegration;
  private twitter: TwitterEventAnnouncer;
  private instagram: InstagramEventPromoter;

  constructor() {
    this.prisma = new PrismaClient();
    this.mailchimp = new MailchimpIntegration();
    this.twitter = new TwitterEventAnnouncer();
    this.instagram = new InstagramEventPromoter();
  }

  async createWorkflow(workflow: AutomationWorkflow): Promise<string> {
    const workflowRecord = await this.prisma.automationWorkflow.create({
      data: {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        trigger: workflow.trigger,
        actions: workflow.actions,
        conditions: workflow.conditions || [],
        active: workflow.active,
        created_at: new Date()
      }
    });

    console.log(`Created automation workflow: ${workflow.name}`);
    return workflowRecord.id;
  }

  async triggerWorkflow(triggerType: string, eventData: any): Promise<void> {
    // Find all active workflows for this trigger type
    const workflows = await this.prisma.automationWorkflow.findMany({
      where: {
        active: true,
        trigger: {
          path: ['type'],
          equals: triggerType
        }
      }
    });

    for (const workflow of workflows) {
      try {
        // Check if conditions are met
        if (await this.evaluateConditions(workflow.conditions as any[], eventData)) {
          await this.executeWorkflow(workflow, eventData);
        }
      } catch (error) {
        console.error(`Workflow execution failed: ${workflow.name}`, error);
        await this.logWorkflowError(workflow.id, error.message);
      }
    }
  }

  private async evaluateConditions(conditions: any[], eventData: any): Promise<boolean> {
    if (!conditions || conditions.length === 0) return true;

    return conditions.every(condition => {
      const fieldValue = this.getNestedValue(eventData, condition.field);
      
      switch (condition.operator) {
        case 'equals':
          return fieldValue === condition.value;
        case 'greater_than':
          return Number(fieldValue) > Number(condition.value);
        case 'less_than':
          return Number(fieldValue) < Number(condition.value);
        case 'contains':
          return String(fieldValue).toLowerCase().includes(String(condition.value).toLowerCase());
        default:
          return false;
      }
    });
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private async executeWorkflow(workflow: any, eventData: any): Promise<void> {
    console.log(`Executing workflow: ${workflow.name}`);

    for (const action of workflow.actions) {
      // Apply delay if specified
      if (action.delay) {
        await new Promise(resolve => setTimeout(resolve, action.delay * 1000));
      }

      switch (action.type) {
        case 'email':
          await this.executeEmailAction(action, eventData);
          break;
        case 'social_post':
          await this.executeSocialAction(action, eventData);
          break;
        case 'notification':
          await this.executeNotificationAction(action, eventData);
          break;
        case 'update_crm':
          await this.executeCRMAction(action, eventData);
          break;
        case 'generate_report':
          await this.executeReportAction(action, eventData);
          break;
      }
    }

    // Log successful execution
    await this.logWorkflowExecution(workflow.id, eventData);
  }

  private async executeEmailAction(action: AutomationAction, eventData: any): Promise<void> {
    switch (action.template) {
      case 'event_announcement':
        await this.sendEventAnnouncementEmail(eventData);
        break;
      case 'ticket_confirmation':
        await this.sendTicketConfirmationEmail(eventData);
        break;
      case 'event_reminder':
        await this.sendEventReminderEmail(eventData);
        break;
      case 'post_event_survey':
        await this.sendPostEventSurvey(eventData);
        break;
    }
  }

  private async executeSocialAction(action: AutomationAction, eventData: any): Promise<void> {
    switch (action.platform) {
      case 'twitter':
        if (action.template === 'event_announcement') {
          await this.twitter.announceNewEvent(eventData.eventId);
        } else if (action.template === 'milestone') {
          await this.twitter.announceTicketSale(eventData.eventId, eventData.milestone);
        }
        break;
      case 'instagram':
        if (action.template === 'promotion_campaign') {
          await this.instagram.createPromotionCampaign(eventData.eventId, eventData.campaignType || 'general');
        }
        break;
    }
  }

  private async executeNotificationAction(action: AutomationAction, eventData: any): Promise<void> {
    // Send notifications to specified recipients
    const notification = {
      type: action.template || 'general',
      recipients: action.recipients || ['admin@tickettoken.io'],
      subject: this.generateNotificationSubject(action.template, eventData),
      message: this.generateNotificationMessage(action.template, eventData),
      data: eventData
    };

    await this.sendNotification(notification);
  }

  private async executeCRMAction(action: AutomationAction, eventData: any): Promise<void> {
    // Update CRM systems (Salesforce, HubSpot, etc.)
    console.log('Updating CRM with event data:', eventData);
    // Implementation would depend on which CRM is configured
  }

  private async executeReportAction(action: AutomationAction, eventData: any): Promise<void> {
    // Generate automated reports
    console.log('Generating automated report:', action.template);
    // Implementation would generate specific reports based on template
  }

  // Email action implementations
  private async sendEventAnnouncementEmail(eventData: any): Promise<void> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventData.eventId },
      include: { artist: true, venue: true }
    });

    if (!event) return;

    // Create announcement email campaign
    const audienceId = await this.getOrCreateAudienceForEvent(event);
    const campaignId = await this.createEmailCampaign(audienceId, 'event_announcement', event);
    
    console.log(`Event announcement email sent: ${campaignId}`);
  }

  private async sendTicketConfirmationEmail(eventData: any): Promise<void> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: eventData.ticketId },
      include: {
        event: { include: { artist: true, venue: true } },
        user: true
      }
    });

    if (!ticket || !ticket.user) return;

    // Send personalized confirmation email
    const emailContent = this.generateTicketConfirmationEmail(ticket);
    await this.sendTransactionalEmail(ticket.user.email, emailContent);
  }

  private async sendEventReminderEmail(eventData: any): Promise<void> {
    // Get all ticket holders for the event
    const tickets = await this.prisma.ticket.findMany({
      where: { event_id: eventData.eventId },
      include: { user: true, event: { include: { artist: true, venue: true } } }
    });

    for (const ticket of tickets) {
      if (ticket.user?.email) {
        const reminderContent = this.generateEventReminderEmail(ticket);
        await this.sendTransactionalEmail(ticket.user.email, reminderContent);
      }
    }
  }

  private async sendPostEventSurvey(eventData: any): Promise<void> {
    // Send survey to attendees after event completion
    const attendees = await this.prisma.ticket.findMany({
      where: { 
        event_id: eventData.eventId,
        status: 'USED' // Only to people who actually attended
      },
      include: { user: true, event: { include: { artist: true, venue: true } } }
    });

    for (const ticket of attendees) {
      if (ticket.user?.email) {
        const surveyContent = this.generatePostEventSurvey(ticket);
        await this.sendTransactionalEmail(ticket.user.email, surveyContent);
      }
    }
  }

  // Default workflow templates
  async setupDefaultWorkflows(): Promise<void> {
    const defaultWorkflows: AutomationWorkflow[] = [
      {
        id: 'event-announcement-flow',
        name: 'New Event Announcement',
        description: 'Automatically announce new events across all channels',
        trigger: { type: 'event_created' },
        actions: [
          {
            type: 'social_post',
            platform: 'twitter',
            template: 'event_announcement'
          },
          {
            type: 'social_post',
            platform: 'instagram', 
            template: 'promotion_campaign',
            delay: 300 // 5 minutes after Twitter
          },
          {
            type: 'email',
            template: 'event_announcement',
            delay: 600 // 10 minutes after Instagram
          }
        ],
        active: true
      },
      {
        id: 'ticket-purchase-flow',
        name: 'Ticket Purchase Confirmation',
        description: 'Send confirmation and social sharing prompts',
        trigger: { type: 'ticket_purchased' },
        actions: [
          {
            type: 'email',
            template: 'ticket_confirmation'
          },
          {
            type: 'notification',
            template: 'purchase_notification',
            recipients: ['sales@tickettoken.io'],
            delay: 60
          }
        ],
        active: true
      },
      {
        id: 'milestone-celebration-flow',
        name: 'Sales Milestone Celebration',
        description: 'Celebrate when events hit sales milestones',
        trigger: { type: 'milestone_reached' },
        conditions: [
          {
            field: 'milestone_type',
            operator: 'equals',
            value: 'half_sold'
          }
        ],
        actions: [
          {
            type: 'social_post',
            platform: 'twitter',
            template: 'milestone'
          },
          {
            type: 'email',
            template: 'urgency_campaign',
            delay: 1800 // 30 minutes later
          }
        ],
        active: true
      },
      {
        id: 'event-reminder-flow',
        name: 'Event Day Reminders',
        description: 'Remind ticket holders about upcoming events',
        trigger: { type: 'event_created' },
        actions: [
          {
            type: 'email',
            template: 'event_reminder',
            delay: 86400 // 24 hours before event
          }
        ],
        active: true
      },
      {
        id: 'post-event-flow',
        name: 'Post-Event Follow-up',
        description: 'Collect feedback and promote collectibles',
        trigger: { type: 'event_completed' },
        actions: [
          {
            type: 'email',
            template: 'post_event_survey',
            delay: 3600 // 1 hour after event
          },
          {
            type: 'email',
            template: 'collectible_activation',
            delay: 86400 // 24 hours later
          }
        ],
        active: true
      }
    ];

    for (const workflow of defaultWorkflows) {
      await this.createWorkflow(workflow);
    }

    console.log(`Created ${defaultWorkflows.length} default automation workflows`);
  }

  // Utility methods
  private async getOrCreateAudienceForEvent(event: any): Promise<string> {
    // Implementation would get or create Mailchimp audience
    return 'audience-id';
  }

  private async createEmailCampaign(audienceId: string, template: string, event: any): Promise<string> {
    // Implementation would create email campaign
    return 'campaign-id';
  }

  private async sendTransactionalEmail(email: string, content: any): Promise<void> {
    // Implementation would send individual email
    console.log(`Sending email to ${email}:`, content.subject);
  }

  private generateTicketConfirmationEmail(ticket: any) {
    return {
      subject: `Your tickets for ${ticket.event.artist.name} are confirmed! 🎵`,
      html: `
        <h1>Ticket Confirmation</h1>
        <p>Thanks for your purchase! Here are your ticket details:</p>
        <ul>
          <li>Event: ${ticket.event.name}</li>
          <li>Artist: ${ticket.event.artist.name}</li>
          <li>Venue: ${ticket.event.venue.name}</li>
          <li>Date: ${new Date(ticket.event.date).toLocaleDateString()}</li>
        </ul>
        <p>Your ticket will be available in your TicketToken account.</p>
      `
    };
  }

  private generateEventReminderEmail(ticket: any) {
    return {
      subject: `Tomorrow: ${ticket.event.artist.name} at ${ticket.event.venue.name} 🎤`,
      html: `
        <h1>Event Reminder</h1>
        <p>Don't forget! Your event is tomorrow:</p>
        <ul>
          <li>Event: ${ticket.event.name}</li>
          <li>Time: ${new Date(ticket.event.date).toLocaleString()}</li>
          <li>Venue: ${ticket.event.venue.name}</li>
          <li>Address: ${ticket.event.venue.address}</li>
        </ul>
        <p>Get ready for an amazing show!</p>
      `
    };
  }

  private generatePostEventSurvey(ticket: any) {
    return {
      subject: `How was ${ticket.event.artist.name}? Share your experience! ⭐`,
      html: `
        <h1>How was the show?</h1>
        <p>We'd love to hear about your experience at ${ticket.event.name}!</p>
        <p><a href="${process.env.FRONTEND_URL}/survey/${ticket.id}">Take our quick 2-minute survey</a></p>
        <p>As a thank you, you'll unlock exclusive behind-the-scenes content!</p>
      `
    };
  }

  private generateNotificationSubject(template: string | undefined, eventData: any): string {
    switch (template) {
      case 'purchase_notification':
        return `New ticket sale: ${eventData.eventName}`;
      case 'milestone_notification':
        return `Milestone reached: ${eventData.eventName} is ${eventData.milestone}`;
      default:
        return 'TicketToken Notification';
    }
  }

  private generateNotificationMessage(template: string | undefined, eventData: any): string {
    switch (template) {
      case 'purchase_notification':
        return `A new ticket was purchased for ${eventData.eventName}. Buyer: ${eventData.buyerEmail}`;
      case 'milestone_notification':
        return `${eventData.eventName} has reached ${eventData.milestone}! Current sales: ${eventData.ticketsSold}`;
      default:
        return JSON.stringify(eventData);
    }
  }

  private async sendNotification(notification: any): Promise<void> {
    // Implementation would send notifications via Slack, email, etc.
    console.log('Notification sent:', notification.subject);
  }

  private async logWorkflowExecution(workflowId: string, eventData: any): Promise<void> {
    await this.prisma.workflowExecution.create({
      data: {
        workflow_id: workflowId,
        trigger_data: eventData,
        status: 'completed',
        executed_at: new Date()
      }
    });
  }

  private async logWorkflowError(workflowId: string, error: string): Promise<void> {
    await this.prisma.workflowExecution.create({
      data: {
        workflow_id: workflowId,
        status: 'failed',
        error_message: error,
        executed_at: new Date()
      }
    });
  }

  // Monitoring and analytics
  async getWorkflowAnalytics(workflowId: string, days: number = 30) {
    const executions = await this.prisma.workflowExecution.findMany({
      where: {
        workflow_id: workflowId,
        executed_at: {
          gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        }
      }
    });

    const successful = executions.filter(e => e.status === 'completed').length;
    const failed = executions.filter(e => e.status === 'failed').length;
    const total = executions.length;

    return {
      total_executions: total,
      success_rate: total > 0 ? (successful / total) * 100 : 0,
      failure_rate: total > 0 ? (failed / total) * 100 : 0,
      executions_by_day: this.groupExecutionsByDay(executions),
      common_errors: this.getCommonErrors(executions.filter(e => e.status === 'failed'))
    };
  }

  private groupExecutionsByDay(executions: any[]) {
    const grouped = new Map();
    
    executions.forEach(execution => {
      const day = execution.executed_at.toISOString().split('T')[0];
      if (!grouped.has(day)) {
        grouped.set(day, { successful: 0, failed: 0 });
      }
      
      if (execution.status === 'completed') {
        grouped.get(day).successful++;
      } else {
        grouped.get(day).failed++;
      }
    });

    return Object.fromEntries(grouped);
  }

  private getCommonErrors(failedExecutions: any[]) {
    const errorCounts = new Map();
    
    failedExecutions.forEach(execution => {
      const error = execution.error_message || 'Unknown error';
      errorCounts.set(error, (errorCounts.get(error) || 0) + 1);
    });

    return Array.from(errorCounts.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([error, count]) => ({ error, count }));
  }
}
