import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { CacheConfig } from '../types';
import { Logger } from '../utils/logger';

export class SmartCDNCache {
  private cloudfront: CloudFrontClient;
  private s3: S3Client;
  private invalidationQueue: Set<string>;
  private config: CacheConfig;
  private logger: Logger;

  constructor(config: CacheConfig) {
    this.config = config;
    this.logger = new Logger('CDNCache');
    this.invalidationQueue = new Set();

    this.cloudfront = new CloudFrontClient({
      region: config.cdn.region
    });

    this.s3 = new S3Client({
      region: config.cdn.region
    });

    this.startBatchInvalidation();
  }

  async cacheAsset(url: string, content: Buffer, metadata: any): Promise<void> {
    try {
      const key = this.sanitizeKey(url);
      
      await this.s3.send(new PutObjectCommand({
        Bucket: this.config.cdn.bucketName,
        Key: key,
        Body: content,
        ContentType: metadata.contentType || 'application/octet-stream',
        CacheControl: this.calculateCacheControl(metadata),
        Metadata: {
          'x-tickettoken-version': metadata.version || '1.0',
          'x-cache-tier': 'CDN',
          'x-uploaded-at': new Date().toISOString()
        }
      }));

      this.logger.info('Asset cached successfully', { url, size: content.length });

    } catch (error) {
      this.logger.error('Failed to cache asset', { url, error: error.message });
      throw error;
    }
  }

  async getAsset(url: string): Promise<Buffer | null> {
    try {
      const key = this.sanitizeKey(url);
      
      const response = await this.s3.send(new GetObjectCommand({
        Bucket: this.config.cdn.bucketName,
        Key: key
      }));

      if (response.Body) {
        const chunks: any[] = [];
        for await (const chunk of response.Body as any) {
          chunks.push(chunk);
        }
        return Buffer.concat(chunks);
      }

      return null;

    } catch (error) {
      if (error.name !== 'NoSuchKey') {
        this.logger.error('Failed to get asset', { url, error: error.message });
      }
      return null;
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    this.invalidationQueue.add(pattern);
    this.logger.debug('Added to invalidation queue', { pattern });
  }

  async invalidateImmediate(patterns: string[]): Promise<void> {
    try {
      const command = new CreateInvalidationCommand({
        DistributionId: this.config.cdn.distributionId,
        InvalidationBatch: {
          Paths: {
            Quantity: patterns.length,
            Items: patterns
          },
          CallerReference: `invalidation-${Date.now()}`
        }
      });

      await this.cloudfront.send(command);
      this.logger.info('Immediate invalidation completed', { patterns });

    } catch (error) {
      this.logger.error('Immediate invalidation failed', { patterns, error: error.message });
      throw error;
    }
  }

  private calculateCacheControl(metadata: any): string {
    const cacheRules = {
      'ticket-image': 'public, max-age=31536000, immutable', // 1 year
      'event-poster': 'public, max-age=86400', // 1 day
      'user-avatar': 'public, max-age=3600', // 1 hour
      'event-data': 'public, max-age=300', // 5 minutes
      'static-asset': 'public, max-age=604800', // 1 week
      'api-response': 'public, max-age=60', // 1 minute
      'nft-metadata': 'public, max-age=31536000, immutable', // 1 year
    };

    return cacheRules[metadata.type] || 'public, max-age=3600'; // Default 1 hour
  }

  private sanitizeKey(url: string): string {
    return url.replace(/^https?:\/\/[^\/]+\//, '').replace(/[^a-zA-Z0-9._\-\/]/g, '');
  }

  private startBatchInvalidation(): void {
    // Process invalidation queue every 30 seconds
    setInterval(async () => {
      if (this.invalidationQueue.size > 0) {
        const patterns = Array.from(this.invalidationQueue);
        this.invalidationQueue.clear();

        try {
          await this.invalidateImmediate(patterns);
          this.logger.info(`Batch invalidated ${patterns.length} patterns`);
        } catch (error) {
          this.logger.error('Batch invalidation failed', { 
            patterns: patterns.length, 
            error: error.message 
          });
          
          // Re-queue failed patterns
          patterns.forEach(pattern => this.invalidationQueue.add(pattern));
        }
      }
    }, 30000);
  }

  getQueueSize(): number {
    return this.invalidationQueue.size;
  }

  async getStats(): Promise<any> {
    return {
      queueSize: this.invalidationQueue.size,
      distributionId: this.config.cdn.distributionId,
      bucketName: this.config.cdn.bucketName
    };
  }
}
