import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class DeliveryService {
  private logger = new Logger(DeliveryService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    // For now, just use SMTP (no SendGrid)
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '1025'),
      secure: false,
      auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      } : undefined,
    });
  }

  async sendTicketEmail(data: {
    to: string;
    ticketId: string;
    eventName: string;
    eventDate: Date;
    venueName: string;
    venueAddress: string;
    tier: string;
    qrDataUrl: string;
    ticketPDA: string;
  }): Promise<boolean> {
    try {
      const subject = `Your Ticket for ${data.eventName}`;
      
      const html = this.generateTicketEmailHTML({
        ...data,
        confirmationNumber: data.ticketId.substring(0, 8).toUpperCase(),
      });

      // Use SMTP
      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || 'tickets@tickettoken.io',
        to: data.to,
        subject,
        html,
        attachments: [
          {
            filename: 'ticket-qr.png',
            content: data.qrDataUrl.split(',')[1],
            encoding: 'base64',
            cid: 'qrcode',
          },
        ],
      });

      this.logger.log(`Ticket email sent to ${data.to}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send ticket email: ${error.message}`);
      throw error;
    }
  }

  async sendPurchaseConfirmation(data: {
    to: string;
    orderNumber: string;
    eventName: string;
    quantity: number;
    totalAmount: string;
    paymentMethod: string;
  }): Promise<boolean> {
    try {
      const subject = `Order Confirmation - ${data.orderNumber}`;
      const html = this.generatePurchaseConfirmationHTML(data);

      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || 'tickets@tickettoken.io',
        to: data.to,
        subject,
        html,
      });

      return true;
    } catch (error) {
      this.logger.error(`Failed to send confirmation email: ${error.message}`);
      throw error;
    }
  }

  async sendBatchTickets(
    recipients: Array<{
      email: string;
      tickets: Array<{
        ticketId: string;
        qrDataUrl: string;
        tier: string;
      }>;
    }>,
    eventDetails: {
      eventName: string;
      eventDate: Date;
      venueName: string;
      venueAddress: string;
    }
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
      try {
        for (const ticket of recipient.tickets) {
          await this.sendTicketEmail({
            to: recipient.email,
            ticketId: ticket.ticketId,
            ...eventDetails,
            tier: ticket.tier,
            qrDataUrl: ticket.qrDataUrl,
            ticketPDA: ticket.ticketId, // Using ticketId as placeholder
          });
          sent++;
        }
      } catch (error) {
        this.logger.error(`Failed to send to ${recipient.email}: ${error.message}`);
        failed++;
      }
    }

    return { sent, failed };
  }

  private generateTicketEmailHTML(data: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Your Ticket</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
          .header { background-color: #7c3aed; color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .ticket-info { background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .qr-code { text-align: center; margin: 30px 0; }
          .footer { background-color: #1f2937; color: white; padding: 20px; text-align: center; }
          h1 { margin: 0; }
          .info-row { margin: 10px 0; }
          .label { font-weight: bold; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎫 Your Ticket is Ready!</h1>
          </div>
          
          <div class="content">
            <p>Hi there!</p>
            <p>Your ticket for <strong>${data.eventName}</strong> is confirmed and ready to use.</p>
            
            <div class="ticket-info">
              <div class="info-row">
                <span class="label">Confirmation #:</span> ${data.confirmationNumber}
              </div>
              <div class="info-row">
                <span class="label">Event:</span> ${data.eventName}
              </div>
              <div class="info-row">
                <span class="label">Date:</span> ${new Date(data.eventDate).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit'
                })}
              </div>
              <div class="info-row">
                <span class="label">Venue:</span> ${data.venueName}
              </div>
              <div class="info-row">
                <span class="label">Address:</span> ${data.venueAddress}
              </div>
              <div class="info-row">
                <span class="label">Ticket Type:</span> ${data.tier.toUpperCase()}
              </div>
            </div>
            
            <div class="qr-code">
              <p><strong>Show this QR code at the entrance:</strong></p>
              <img src="cid:qrcode" alt="Ticket QR Code" style="width: 300px; height: 300px;">
            </div>
            
            <p><strong>Important Information:</strong></p>
            <ul>
              <li>Please arrive 30 minutes before the event starts</li>
              <li>This QR code is your ticket - screenshot it or save this email</li>
              <li>Each QR code can only be scanned once</li>
              <li>Tickets are non-refundable unless the event is cancelled</li>
            </ul>
          </div>
          
          <div class="footer">
            <p>Powered by TicketToken - Blockchain Ticketing</p>
            <p>Need help? Contact support@tickettoken.io</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generatePurchaseConfirmationHTML(data: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Order Confirmation</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
          .header { background-color: #10b981; color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .order-details { background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .footer { background-color: #1f2937; color: white; padding: 20px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Order Confirmed!</h1>
          </div>
          
          <div class="content">
            <p>Thank you for your purchase!</p>
            
            <div class="order-details">
              <h3>Order Details</h3>
              <p><strong>Order Number:</strong> ${data.orderNumber}</p>
              <p><strong>Event:</strong> ${data.eventName}</p>
              <p><strong>Quantity:</strong> ${data.quantity} ticket(s)</p>
              <p><strong>Total Amount:</strong> ${data.totalAmount}</p>
              <p><strong>Payment Method:</strong> ${data.paymentMethod}</p>
            </div>
            
            <p>Your tickets will be sent to this email address shortly.</p>
            <p>You can also access your tickets anytime by logging into your account.</p>
          </div>
          
          <div class="footer">
            <p>Thank you for choosing TicketToken!</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
