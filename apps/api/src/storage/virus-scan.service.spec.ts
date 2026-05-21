import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { VirusScanService } from './virus-scan.service';

function makeService(enabled = true) {
  const service = Object.create(VirusScanService.prototype) as any;
  service.enabled = enabled;
  service.host = 'localhost';
  service.port = 3310;
  service.timeoutMs = 5000;
  service.chunkSize = 64 * 1024;
  return service;
}

describe('VirusScanService', () => {
  beforeEach(() => {
    delete process.env.CLAMAV_ENABLED;
  });

  it('skips scanning when ClamAV is disabled', async () => {
    const service = new VirusScanService();

    await expect(service.scanBuffer(Buffer.from('file'))).resolves.toEqual({ status: 'skipped' });
  });

  it('parses clean ClamAV responses', () => {
    const service = makeService();

    expect(service.parseResponse('stream: OK')).toEqual({ status: 'clean' });
  });

  it('parses infected ClamAV responses', () => {
    const service = makeService();

    expect(service.parseResponse('stream: Eicar-Test-Signature FOUND')).toEqual({
      status: 'infected',
      signature: 'Eicar-Test-Signature',
    });
  });

  it('rejects infected uploads', async () => {
    const service = makeService();
    service.scanBuffer = async () => ({ status: 'infected', signature: 'Eicar-Test-Signature' });

    await expect(service.scanOrThrow(Buffer.from('file'), 'eicar.txt')).rejects.toThrow(BadRequestException);
  });

  it('fails closed when enabled scanner is unavailable', async () => {
    const service = makeService();
    service.scanBuffer = async () => ({ status: 'unavailable' });

    await expect(service.scanOrThrow(Buffer.from('file'), 'document.pdf')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('reports disabled health when scanning is not enabled', async () => {
    const service = new VirusScanService();

    await expect(service.checkHealth()).resolves.toBe('disabled');
  });

  it('reports scanner health from a clean scan', async () => {
    const service = makeService();
    service.scanBuffer = async () => ({ status: 'clean' });

    await expect(service.checkHealth()).resolves.toBe('ok');
  });
});
