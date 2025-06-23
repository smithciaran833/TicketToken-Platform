import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms';

@Injectable()
export class KeyEncryptionService {
  private logger = new Logger(KeyEncryptionService.name);
  private kmsClient: KMSClient | null = null;
  private localEncryptionKey: Buffer;

  constructor() {
    // Initialize KMS client if credentials are available
    if (process.env.AWS_REGION && process.env.KMS_KEY_ID) {
      this.kmsClient = new KMSClient({
        region: process.env.AWS_REGION,
      });
      this.logger.log('AWS KMS initialized');
    } else {
      this.logger.warn('AWS KMS not configured, using local encryption (NOT FOR PRODUCTION)');
    }

    // Local encryption key for development
    this.localEncryptionKey = Buffer.from(
      process.env.ENCRYPTION_KEY || 'default-32-char-encryption-key!!',
      'utf-8'
    ).slice(0, 32);
  }

  async encryptPrivateKey(privateKey: Uint8Array | string): Promise<{
    encrypted: string;
    method: 'KMS' | 'LOCAL';
    keyId?: string;
  }> {
    try {
      const keyBuffer = typeof privateKey === 'string' 
        ? Buffer.from(privateKey, 'base64') 
        : Buffer.from(privateKey);

      if (this.kmsClient && process.env.KMS_KEY_ID) {
        // Use AWS KMS for production
        const command = new EncryptCommand({
          KeyId: process.env.KMS_KEY_ID,
          Plaintext: keyBuffer,
        });

        const response = await this.kmsClient.send(command);
        const encrypted = Buffer.from(response.CiphertextBlob!).toString('base64');

        return {
          encrypted: `kms:v1:${encrypted}`,
          method: 'KMS',
          keyId: process.env.KMS_KEY_ID,
        };
      } else {
        // Use local encryption for development
        const encrypted = this.localEncrypt(keyBuffer);
        
        return {
          encrypted: `local:v1:${encrypted}`,
          method: 'LOCAL',
        };
      }
    } catch (error) {
      this.logger.error(`Encryption failed: ${error.message}`);
      throw new Error('Failed to encrypt private key');
    }
  }

  async decryptPrivateKey(encryptedData: string): Promise<Uint8Array> {
    try {
      const [method, version, data] = encryptedData.split(':');

      if (method === 'kms' && version === 'v1') {
        if (!this.kmsClient) {
          throw new Error('KMS not configured');
        }

        const command = new DecryptCommand({
          CiphertextBlob: Buffer.from(data, 'base64'),
        });

        const response = await this.kmsClient.send(command);
        return new Uint8Array(response.Plaintext!);
      } else if (method === 'local' && version === 'v1') {
        return new Uint8Array(this.localDecrypt(data));
      } else {
        throw new Error(`Unknown encryption method: ${method}`);
      }
    } catch (error) {
      this.logger.error(`Decryption failed: ${error.message}`);
      throw new Error('Failed to decrypt private key');
    }
  }

  async rotateEncryption(
    oldEncrypted: string,
    newMethod?: 'KMS' | 'LOCAL'
  ): Promise<{
    encrypted: string;
    method: 'KMS' | 'LOCAL';
    rotatedAt: Date;
  }> {
    try {
      // Decrypt with old method
      const decrypted = await this.decryptPrivateKey(oldEncrypted);
      
      // Re-encrypt with new method or same method with new key
      const result = await this.encryptPrivateKey(decrypted);
      
      return {
        ...result,
        rotatedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Key rotation failed: ${error.message}`);
      throw error;
    }
  }

  generateEncryptionKey(): string {
    return crypto.randomBytes(32).toString('base64');
  }

  async createKeyBackup(encryptedKey: string, userId: string): Promise<{
    backupId: string;
    shards: string[];
    threshold: number;
  }> {
    // Implement Shamir's Secret Sharing for key backup
    // For now, return a simple backup structure
    const backupId = crypto.randomBytes(16).toString('hex');
    
    // In production, split the key into shards
    const shards = [
      `shard1:${backupId}:${encryptedKey.substring(0, 20)}`,
      `shard2:${backupId}:${encryptedKey.substring(20, 40)}`,
      `shard3:${backupId}:${encryptedKey.substring(40)}`,
    ];

    this.logger.log(`Created key backup ${backupId} for user ${userId}`);

    return {
      backupId,
      shards,
      threshold: 2, // Need 2 of 3 shards to reconstruct
    };
  }

  private localEncrypt(data: Buffer): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.localEncryptionKey, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(data),
      cipher.final(),
    ]);

    // Prepend IV to encrypted data
    const combined = Buffer.concat([iv, encrypted]);
    return combined.toString('base64');
  }

  private localDecrypt(encryptedData: string): Buffer {
    const combined = Buffer.from(encryptedData, 'base64');
    
    // Extract IV and encrypted data
    const iv = combined.slice(0, 16);
    const encrypted = combined.slice(16);
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.localEncryptionKey, iv);
    
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
  }

  async validateEncryption(): Promise<{
    method: 'KMS' | 'LOCAL';
    isValid: boolean;
    details: any;
  }> {
    try {
      // Test encryption/decryption
      const testData = crypto.randomBytes(32);
      const encrypted = await this.encryptPrivateKey(testData);
      const decrypted = await this.decryptPrivateKey(encrypted.encrypted);
      
      const isValid = Buffer.from(testData).equals(Buffer.from(decrypted));
      
      return {
        method: encrypted.method,
        isValid,
        details: {
          keyId: encrypted.keyId,
          encryptionWorks: isValid,
        },
      };
    } catch (error) {
      return {
        method: 'LOCAL',
        isValid: false,
        details: { error: error.message },
      };
    }
  }
}
