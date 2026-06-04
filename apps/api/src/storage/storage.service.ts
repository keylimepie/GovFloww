import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadRequestException,
  HttpException,
} from '@nestjs/common';
import * as Minio from 'minio';
import { extname } from 'path';
import { createHash, randomUUID } from 'crypto';
import { VirusScanService } from './virus-scan.service';

interface FileTypeRule {
  extensions: readonly string[];
  mimeTypes: readonly string[];
  matches: (buffer: Buffer) => boolean;
}

const hasPrefix = (buffer: Buffer, bytes: readonly number[]) =>
  buffer.length >= bytes.length && bytes.every((byte, index) => buffer[index] === byte);

const isZip = (buffer: Buffer) =>
  hasPrefix(buffer, [0x50, 0x4b, 0x03, 0x04]) ||
  hasPrefix(buffer, [0x50, 0x4b, 0x05, 0x06]) ||
  hasPrefix(buffer, [0x50, 0x4b, 0x07, 0x08]);

const isOleCompound = (buffer: Buffer) =>
  hasPrefix(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

const isTextLike = (buffer: Buffer) => {
  if (buffer.length === 0) return false;
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
  return !sample.includes(0);
};

const FILE_TYPE_RULES: readonly FileTypeRule[] = [
  {
    extensions: ['.pdf'],
    mimeTypes: ['application/pdf'],
    matches: (buffer) => hasPrefix(buffer, [0x25, 0x50, 0x44, 0x46]),
  },
  {
    extensions: ['.png'],
    mimeTypes: ['image/png'],
    matches: (buffer) => hasPrefix(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  {
    extensions: ['.jpg', '.jpeg'],
    mimeTypes: ['image/jpeg'],
    matches: (buffer) => hasPrefix(buffer, [0xff, 0xd8, 0xff]),
  },
  {
    extensions: ['.doc'],
    mimeTypes: ['application/msword'],
    matches: isOleCompound,
  },
  {
    extensions: ['.xls'],
    mimeTypes: ['application/vnd.ms-excel'],
    matches: isOleCompound,
  },
  {
    extensions: ['.docx'],
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    matches: isZip,
  },
  {
    extensions: ['.xlsx'],
    mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    matches: isZip,
  },
  {
    extensions: ['.pptx'],
    mimeTypes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    matches: isZip,
  },
  {
    extensions: ['.txt', '.csv'],
    mimeTypes: ['text/plain', 'text/csv', 'application/csv'],
    matches: isTextLike,
  },
];

@Injectable()
export class StorageService {
  private readonly minioClient: Minio.Client;
  private readonly logger = new Logger(StorageService.name);
  private readonly bucketName = process.env.MINIO_BUCKET_NAME || 'govflow-files';
  private readonly maxUploadBytes = Number(process.env.GOVFLOW_MAX_UPLOAD_BYTES || 10 * 1024 * 1024);

  constructor(private readonly virusScanService: VirusScanService) {
    this.minioClient = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000', 10),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY!,
      secretKey: process.env.MINIO_SECRET_KEY!,
    });

    this.initBucket();
  }

  private async initBucket() {
    try {
      const exists = await this.minioClient.bucketExists(this.bucketName);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName, 'us-east-1');
        this.logger.log(`Bucket ${this.bucketName} created successfully.`);
      }
    } catch (error) {
      this.logger.error(`Error initializing bucket ${this.bucketName}`, error);
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'submissions',
  ): Promise<{ storageKey: string; sha256: string }> {
    try {
      const extension = extname(file.originalname);
      this.validateFile(file, extension);
      await this.virusScanService.scanOrThrow(file.buffer, file.originalname);
      const storageKey = `${folder}/${randomUUID()}${extension}`;
      const sha256 = createHash('sha256').update(file.buffer).digest('hex');

      await this.minioClient.putObject(
        this.bucketName,
        storageKey,
        file.buffer,
        file.size,
        { 'Content-Type': file.mimetype }
      );

      return { storageKey, sha256 };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Failed to upload file to MinIO', error);
      throw new InternalServerErrorException('Failed to upload file');
    }
  }

  async uploadGeneratedFile(input: {
    buffer: Buffer;
    fileName: string;
    mimeType: string;
    folder?: string;
  }): Promise<{ storageKey: string; sha256: string }> {
    try {
      const extension = extname(input.fileName);
      const file = {
        originalname: input.fileName,
        mimetype: input.mimeType,
        buffer: input.buffer,
        size: input.buffer.length,
      } as Express.Multer.File;
      this.validateFile(file, extension);

      const storageKey = `${input.folder || 'generated'}/${randomUUID()}${extension}`;
      const sha256 = createHash('sha256').update(input.buffer).digest('hex');

      await this.minioClient.putObject(
        this.bucketName,
        storageKey,
        input.buffer,
        input.buffer.length,
        { 'Content-Type': input.mimeType },
      );

      return { storageKey, sha256 };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Failed to upload generated file to MinIO', error);
      throw new InternalServerErrorException('Failed to upload generated file');
    }
  }

  async getPresignedUrl(storageKey: string, expirySeconds: number = 3600): Promise<string> {
    try {
      return await this.minioClient.presignedGetObject(this.bucketName, storageKey, expirySeconds);
    } catch (error) {
      this.logger.error(`Failed to generate presigned URL for ${storageKey}`, error);
      throw new InternalServerErrorException('Failed to generate secure download link');
    }
  }

  async deleteFile(storageKey: string): Promise<void> {
    try {
      await this.minioClient.removeObject(this.bucketName, storageKey);
    } catch (error) {
      this.logger.error(`Failed to delete file ${storageKey}`, error);
    }
  }

  async isHealthy(): Promise<boolean> {
    return this.minioClient.bucketExists(this.bucketName);
  }

  private validateFile(file: Express.Multer.File, extension: string) {
    const normalizedExtension = extension.toLowerCase();
    if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
      throw new BadRequestException('Uploaded file is empty or unreadable');
    }

    if (file.size > this.maxUploadBytes || file.buffer.length > this.maxUploadBytes) {
      throw new BadRequestException('Uploaded file exceeds the configured size limit');
    }

    const rule = FILE_TYPE_RULES.find((item) => item.extensions.includes(normalizedExtension));
    if (!rule || !rule.mimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Unsupported file type');
    }

    if (!rule.matches(file.buffer)) {
      throw new BadRequestException('File content does not match the declared file type');
    }
  }
}
