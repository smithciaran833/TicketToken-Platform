import jsQR from 'jsqr';
import { createCanvas, loadImage } from 'canvas';
import crypto from 'crypto';
import { logger } from '../utils/logger';

export interface QRData {
  ticketId: string;
  eventId: string;
  userId: string;
  timestamp: number;
  signature: string;
}

export interface ValidationResult {
  isValid: boolean;
  ticketId?: string;
  eventId?: string;
  userId?: string;
  error?: string;
  metadata?: {
    scannedAt: Date;
    gateId: string;
    staffId: string;
    location: {
      latitude?: number;
      longitude?: number;
    };
  };
}

export class QRValidator {
  private secretKey: string;

  constructor(secretKey: string) {
    this.secretKey = secretKey;
  }

  /**
   * Decode QR code from image buffer
   */
  async decodeQR(imageBuffer: Buffer): Promise<string | null> {
    try {
      const image = await loadImage(imageBuffer);
      const canvas = createCanvas(image.width, image.height);
      const ctx = canvas.getContext('2d');
      
      ctx.drawImage(image, 0, 0);
      const imageData = ctx.getImageData(0, 0, image.width, image.height);
      
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      return code ? code.data : null;
    } catch (error) {
      logger.error('QR decode error:', error);
      return null;
    }
  }

  /**
   * Decode QR code from text (manual entry)
   */
  decodeQRText(qrText: string): QRData | null {
    try {
      const data = JSON.parse(qrText);
      
      // Validate required fields
      if (!data.ticketId || !data.eventId || !data.userId || !data.timestamp || !data.signature) {
        throw new Error('Missing required QR data fields');
      }
      
      return data as QRData;
    } catch (error) {
      logger.error('QR text decode error:', error);
      return null;
    }
  }

  /**
   * Verify QR signature
   */
  verifySignature(qrData: QRData): boolean {
    try {
      const payload = `${qrData.ticketId}:${qrData.eventId}:${qrData.userId}:${qrData.timestamp}`;
      const expectedSignature = crypto
        .createHmac('sha256', this.secretKey)
        .update(payload)
        .digest('hex');
      
      return expectedSignature === qrData.signature;
    } catch (error) {
      logger.error('Signature verification error:', error);
      return false;
    }
  }

  /**
   * Check if QR code is expired
   */
  isExpired(qrData: QRData, validityHours: number = 24): boolean {
    const now = Date.now();
    const expiryTime = qrData.timestamp + (validityHours * 60 * 60 * 1000);
    return now > expiryTime;
  }

  /**
   * Validate QR code completely
   */
  async validateQR(
    qrText: string,
    gateId: string,
    staffId: string,
    location?: { latitude: number; longitude: number }
  ): Promise<ValidationResult> {
    try {
      // Decode QR data
      const qrData = this.decodeQRText(qrText);
      if (!qrData) {
        return {
          isValid: false,
          error: 'Invalid QR code format'
        };
      }

      // Verify signature
      if (!this.verifySignature(qrData)) {
        return {
          isValid: false,
          error: 'Invalid QR code signature'
        };
      }

      // Check expiry
      if (this.isExpired(qrData)) {
        return {
          isValid: false,
          ticketId: qrData.ticketId,
          error: 'QR code has expired'
        };
      }

      // Success
      return {
        isValid: true,
        ticketId: qrData.ticketId,
        eventId: qrData.eventId,
        userId: qrData.userId,
        metadata: {
          scannedAt: new Date(),
          gateId,
          staffId,
          location: location || {}
        }
      };

    } catch (error) {
      logger.error('QR validation error:', error);
      return {
        isValid: false,
        error: 'QR validation failed'
      };
    }
  }
}

export const qrValidator = new QRValidator(process.env.QR_SECRET_KEY || 'default-secret');
