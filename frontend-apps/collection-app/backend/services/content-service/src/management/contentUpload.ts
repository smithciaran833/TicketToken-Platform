import { EventEmitter } from 'events';
import { Pool } from 'pg';
import Redis from 'ioredis';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import { v4 as uuidv4 } from 'uuid';

interface UploadResult {
  contentId: string;
  originalUrl: string;
  processedUrls: {
    thumbnail?: string;
    preview?: string;
    fullResolution?: string;
  };
  metadata: {
    size: number;
    duration?: number;
    dimensions?: { width: number; height: number };
    format: string;
  };
  uploadedAt: Date;
}

export class ContentUpload extends EventEmitter {
  private db: Pool;
  private redis: Redis;
  private uploadPath: string;

  constructor(db: Pool, redis: Redis, uploadPath: string = 'uploads/content') {
    super();
    this.db = db;
    this.redis = redis;
    this.uploadPath = uploadPath;
    this.ensureUploadDirectory();
  }

  async uploadContent(
    file: Express.Multer.File,
    artistId: string,
    contentType: string,
    accessLevel: string,
    releaseDate?: Date
  ): Promise<UploadResult> {
    try {
      const contentId = uuidv4();
      const fileExtension = path.extname(file.originalname);
      const fileName = `${contentId}${fileExtension}`;
      const filePath = path.join(this.uploadPath, fileName);

      // Move file to permanent location
      await fs.promises.rename(file.path, filePath);

      // Process file based on type
      const processedUrls = await this.processFile(filePath, contentType);
      const metadata = await this.extractMetadata(filePath, contentType);

      // Store in database
      await this.db.query(`
        INSERT INTO content_items (
          id, artist_id, content_type, access_level, original_url, 
          processed_urls, metadata, release_date, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      `, [
        contentId,
        artistId,
        contentType,
        accessLevel,
        filePath,
        JSON.stringify(processedUrls),
        JSON.stringify(metadata),
        releaseDate
      ]);

      // Cache metadata
      await this.redis.setex(`content:${contentId}`, 3600, JSON.stringify({
        contentId,
        artistId,
        contentType,
        accessLevel,
        metadata
      }));

      const result: UploadResult = {
        contentId,
        originalUrl: filePath,
        processedUrls,
        metadata,
        uploadedAt: new Date()
      };

      // Emit upload event
      this.emit('contentUploaded', {
        contentId,
        artistId,
        contentType,
        size: metadata.size
      });

      return result;

    } catch (error) {
      console.error('Content upload error:', error);
      throw error;
    }
  }

  async batchUpload(
    files: Express.Multer.File[],
    artistId: string,
    contentType: string,
    accessLevel: string
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = [];

    for (const file of files) {
      try {
        const result = await this.uploadContent(file, artistId, contentType, accessLevel);
        results.push(result);
      } catch (error) {
        console.error(`Failed to upload ${file.originalname}:`, error);
        // Continue with other files
      }
    }

    return results;
  }

  private async processFile(filePath: string, contentType: string): Promise<any> {
    const processedUrls: any = {};

    try {
      switch (contentType) {
        case 'image':
          processedUrls.thumbnail = await this.createImageThumbnail(filePath);
          processedUrls.preview = await this.createImagePreview(filePath);
          processedUrls.fullResolution = filePath;
          break;

        case 'video':
          processedUrls.thumbnail = await this.createVideoThumbnail(filePath);
          processedUrls.preview = await this.createVideoPreview(filePath);
          processedUrls.fullResolution = filePath;
          break;

        case 'audio':
          processedUrls.preview = await this.createAudioPreview(filePath);
          processedUrls.fullResolution = filePath;
          break;

        default:
          processedUrls.fullResolution = filePath;
      }

      return processedUrls;

    } catch (error) {
      console.error('File processing error:', error);
      return { fullResolution: filePath };
    }
  }

  private async createImageThumbnail(filePath: string): Promise<string> {
    const thumbnailPath = filePath.replace(/(\.[^.]+)$/, '_thumb$1');
    
    await sharp(filePath)
      .resize(300, 300, { 
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 80 })
      .toFile(thumbnailPath);

    return thumbnailPath;
  }

  private async createImagePreview(filePath: string): Promise<string> {
    const previewPath = filePath.replace(/(\.[^.]+)$/, '_preview$1');
    
    await sharp(filePath)
      .resize(800, 600, { 
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 85 })
      .toFile(previewPath);

    return previewPath;
  }

  private async createVideoThumbnail(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const thumbnailPath = filePath.replace(/(\.[^.]+)$/, '_thumb.jpg');

      ffmpeg(filePath)
        .screenshots({
          timestamps: ['10%'],
          filename: path.basename(thumbnailPath),
          folder: path.dirname(thumbnailPath),
          size: '300x300'
        })
        .on('end', () => resolve(thumbnailPath))
        .on('error', reject);
    });
  }

  private async createVideoPreview(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const previewPath = filePath.replace(/(\.[^.]+)$/, '_preview.mp4');

      ffmpeg(filePath)
        .duration(30) // 30 second preview
        .size('640x480')
        .videoBitrate('500k')
        .audioCodec('aac')
        .videoCodec('libx264')
        .output(previewPath)
        .on('end', () => resolve(previewPath))
        .on('error', reject)
        .run();
    });
  }

  private async createAudioPreview(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const previewPath = filePath.replace(/(\.[^.]+)$/, '_preview.mp3');

      ffmpeg(filePath)
        .duration(30) // 30 second preview
        .audioBitrate('128k')
        .output(previewPath)
        .on('end', () => resolve(previewPath))
        .on('error', reject)
        .run();
    });
  }

  private async extractMetadata(filePath: string, contentType: string): Promise<any> {
    const stats = await fs.promises.stat(filePath);
    const metadata: any = {
      size: stats.size,
      format: path.extname(filePath).slice(1)
    };

    try {
      switch (contentType) {
        case 'image':
          const imageInfo = await sharp(filePath).metadata();
          metadata.dimensions = { 
            width: imageInfo.width || 0, 
            height: imageInfo.height || 0 
          };
          break;

        case 'video':
        case 'audio':
          const mediaInfo = await this.getMediaInfo(filePath);
          metadata.duration = mediaInfo.duration;
          if (mediaInfo.width && mediaInfo.height) {
            metadata.dimensions = { 
              width: mediaInfo.width, 
              height: mediaInfo.height 
            };
          }
          break;
      }

      return metadata;

    } catch (error) {
      console.error('Metadata extraction error:', error);
      return metadata;
    }
  }

  private getMediaInfo(filePath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          const videoStream = metadata.streams.find(s => s.codec_type === 'video');
          const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
          
          resolve({
            duration: metadata.format.duration,
            width: videoStream?.width,
            height: videoStream?.height,
            bitrate: metadata.format.bit_rate
          });
        }
      });
    });
  }

  private ensureUploadDirectory(): void {
    if (!fs.existsSync(this.uploadPath)) {
      fs.mkdirSync(this.uploadPath, { recursive: true });
    }
  }
}
