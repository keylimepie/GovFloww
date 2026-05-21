import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createConnection, Socket } from 'net';

type ScanStatus = 'clean' | 'infected' | 'unavailable' | 'skipped';

interface ScanResult {
  status: ScanStatus;
  signature?: string;
  details?: string;
}

@Injectable()
export class VirusScanService {
  private readonly enabled = process.env.CLAMAV_ENABLED === 'true';
  private readonly host = process.env.CLAMAV_HOST || 'localhost';
  private readonly port = Number(process.env.CLAMAV_PORT || 3310);
  private readonly timeoutMs = Number(process.env.CLAMAV_TIMEOUT_MS || 5000);
  private readonly chunkSize = 64 * 1024;

  async scanOrThrow(buffer: Buffer, fileName: string): Promise<void> {
    const result = await this.scanBuffer(buffer);
    if (result.status === 'skipped' || result.status === 'clean') return;

    if (result.status === 'infected') {
      throw new BadRequestException(
        `Upload rejected by virus scanner${result.signature ? `: ${result.signature}` : ''}`,
      );
    }

    throw new ServiceUnavailableException(
      `Virus scanner unavailable while scanning ${fileName}`,
    );
  }

  async scanBuffer(buffer: Buffer): Promise<ScanResult> {
    if (!this.enabled) return { status: 'skipped' };

    try {
      const response = await this.sendInstream(buffer);
      return this.parseResponse(response);
    } catch (error) {
      return {
        status: 'unavailable',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async checkHealth(): Promise<'ok' | 'disabled' | 'unavailable'> {
    if (!this.enabled) return 'disabled';

    const result = await this.scanBuffer(Buffer.from('GovFlow ClamAV health check'));
    return result.status === 'clean' ? 'ok' : 'unavailable';
  }

  private sendInstream(buffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = createConnection({ host: this.host, port: this.port });
      let settled = false;
      let response = '';

      const settle = (callback: () => void) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        callback();
      };

      socket.setTimeout(this.timeoutMs);
      socket.on('connect', () => this.writeInstream(socket, buffer));
      socket.on('data', (chunk) => {
        response += chunk.toString('utf8');
      });
      socket.on('end', () => settle(() => resolve(response)));
      socket.on('close', () => {
        if (response) settle(() => resolve(response));
      });
      socket.on('timeout', () => settle(() => reject(new Error('ClamAV scan timed out'))));
      socket.on('error', (error) => settle(() => reject(error)));
    });
  }

  private writeInstream(socket: Socket, buffer: Buffer) {
    socket.write('zINSTREAM\0');

    for (let offset = 0; offset < buffer.length; offset += this.chunkSize) {
      const chunk = buffer.subarray(offset, Math.min(offset + this.chunkSize, buffer.length));
      const size = Buffer.alloc(4);
      size.writeUInt32BE(chunk.length, 0);
      socket.write(size);
      socket.write(chunk);
    }

    socket.write(Buffer.alloc(4));
  }

  private parseResponse(response: string): ScanResult {
    const trimmed = response.trim();
    if (/\bOK\b/.test(trimmed)) return { status: 'clean' };

    const infected = trimmed.match(/:\s*(.+)\s+FOUND$/);
    if (infected) {
      return { status: 'infected', signature: infected[1] };
    }

    return { status: 'unavailable', details: trimmed || 'Empty ClamAV response' };
  }
}
