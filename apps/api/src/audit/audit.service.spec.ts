import { describe, expect, it, jest } from '@jest/globals';
import * as crypto from 'crypto';
import { AuditService } from './audit.service';
import { AuditAction } from '@govflow/shared';

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

function hashEntry(entry: Record<string, unknown>) {
  return crypto.createHash('sha256').update(stableStringify(entry)).digest('hex');
}

describe('AuditService', () => {
  it('detects tampered audit rows', async () => {
    const createdAt = new Date('2026-05-16T10:00:00.000Z');
    const previousHash = '0'.repeat(64);
    const validPayload = {
      submissionId: null,
      actorId: 'user-1',
      action: AuditAction.USER_LOGIN,
      metadata: { email: 'admin@govflow.gov.np' },
      ipAddress: '127.0.0.1',
      previousHash,
      createdAt: createdAt.toISOString(),
    };

    const prisma = {
      auditLog: {
        findMany: jest.fn<() => Promise<any>>().mockResolvedValue([
          {
            id: 'audit-1',
            ...validPayload,
            metadata: { email: 'attacker@example.com' },
            createdAt,
            rowHash: hashEntry(validPayload),
          },
        ]),
      },
    };

    const service = new AuditService(prisma as any);

    await expect(service.verifyChain()).resolves.toEqual({
      valid: false,
      totalEntries: 1,
      firstBrokenIndex: 0,
    });
  });

  it('exports audit entries as CSV', () => {
    const service = new AuditService({} as any);

    const csv = service.toCsv([
      {
        createdAt: new Date('2026-05-20T00:00:00.000Z'),
        action: AuditAction.FILE_FORWARDED,
        ipAddress: '127.0.0.1',
        previousHash: '0'.repeat(64),
        rowHash: 'a'.repeat(64),
        metadata: { comment: 'Looks good, proceed' },
        actor: {
          firstName: 'Sita',
          lastName: 'Sharma',
          role: 'ENGINEER',
        },
      },
    ]);

    expect(csv).toContain('Timestamp,Action,Actor,Actor Role');
    expect(csv).toContain('2026-05-20T00:00:00.000Z,FILE_FORWARDED,Sita Sharma,ENGINEER');
    expect(csv).toContain('"{""comment"":""Looks good, proceed""}"');
  });
});
