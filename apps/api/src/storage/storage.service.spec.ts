import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { StorageService } from './storage.service';

function makeService(maxUploadBytes = 10 * 1024 * 1024) {
  const service = Object.create(StorageService.prototype) as any;
  service.maxUploadBytes = maxUploadBytes;
  return service;
}

function makeFile(partial: Partial<Express.Multer.File>): Express.Multer.File {
  const buffer = partial.buffer || Buffer.from('%PDF-1.7\n');
  return {
    fieldname: 'file',
    originalname: partial.originalname || 'document.pdf',
    encoding: '7bit',
    mimetype: partial.mimetype || 'application/pdf',
    size: partial.size || buffer.length,
    buffer,
    destination: '',
    filename: '',
    path: '',
    stream: undefined as any,
  };
}

describe('StorageService file validation', () => {
  it('accepts files only when extension, MIME type, and magic bytes agree', () => {
    const service = makeService();
    const file = makeFile({ buffer: Buffer.from('%PDF-1.7\ncontent') });

    expect(() => service.validateFile(file, '.pdf')).not.toThrow();
  });

  it('rejects a spoofed PDF with executable content', () => {
    const service = makeService();
    const file = makeFile({ buffer: Buffer.from('MZ executable payload') });

    expect(() => service.validateFile(file, '.pdf')).toThrow(BadRequestException);
  });

  it('rejects files over the configured application limit', () => {
    const service = makeService(4);
    const file = makeFile({ buffer: Buffer.from('%PDF-1.7\ncontent'), size: 16 });

    expect(() => service.validateFile(file, '.pdf')).toThrow(/size limit/);
  });

  it('scans accepted files before storing them', async () => {
    const service = makeService();
    const file = makeFile({ buffer: Buffer.from('%PDF-1.7\ncontent') });
    service.bucketName = 'govflow-files';
    service.virusScanService = { scanOrThrow: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) };
    service.minioClient = { putObject: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) };

    const result = await service.uploadFile(file, 'submissions/2026-PWD-0001');

    expect(service.virusScanService.scanOrThrow).toHaveBeenCalledWith(file.buffer, file.originalname);
    expect(service.minioClient.putObject).toHaveBeenCalled();
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
  });
});
