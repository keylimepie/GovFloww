// =============================================
// Audit Service — Hash-Chained Append-Only Log
// =============================================
// Every state change in GovFlow passes through this service.
// The hash chain ensures tamper detection.

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction } from '@govflow/shared';
import * as crypto from 'crypto';
import { Prisma } from '@prisma/client';

interface AuditLogEntry {
  submissionId?: string;
  actorId: string;
  action: AuditAction;
  metadata: Record<string, unknown>;
  ipAddress: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Append a new audit log entry with hash chain integrity.
   * 1. Fetch the last row's hash
   * 2. Compute this row's hash = SHA-256(previousHash + payload)
   * 3. Insert (append-only — no UPDATE/DELETE ever)
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.writeWithRetry(entry);
    } catch (error) {
      // Audit logging failures must never crash the application,
      // but they MUST be logged for investigation
      this.logger.error(
        `CRITICAL: Failed to write audit log: ${JSON.stringify(entry)}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async writeWithRetry(entry: AuditLogEntry): Promise<void> {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.prisma.$transaction(
          async (tx) => {
            // Serializable isolation plus retry keeps concurrent audit writes ordered.
            const lastEntry = await tx.auditLog.findFirst({
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              select: { rowHash: true },
            });

            const previousHash = lastEntry?.rowHash || '0'.repeat(64);
            const createdAt = new Date();
            const payload = this.buildHashPayload({
              submissionId: entry.submissionId || null,
              actorId: entry.actorId,
              action: entry.action,
              metadata: entry.metadata,
              ipAddress: entry.ipAddress,
              previousHash,
              createdAt: createdAt.toISOString(),
            });
            const rowHash = crypto.createHash('sha256').update(payload).digest('hex');

            await tx.auditLog.create({
              data: {
                submissionId: entry.submissionId || undefined,
                actorId: entry.actorId,
                action: entry.action,
                metadata: entry.metadata as any,
                ipAddress: entry.ipAddress,
                previousHash,
                rowHash,
                createdAt,
              },
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        return;
      } catch (error) {
        if (attempt === maxAttempts || !this.isRetryableTransactionError(error)) {
          throw error;
        }
      }
    }
  }

  private isRetryableTransactionError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
  }

  /**
   * Verify the integrity of the entire audit chain.
   * Returns true if no tampering is detected.
   */
  async verifyChain(): Promise<{
    valid: boolean;
    totalEntries: number;
    firstBrokenIndex?: number;
  }> {
    const entries = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        submissionId: true,
        actorId: true,
        action: true,
        metadata: true,
        ipAddress: true,
        previousHash: true,
        rowHash: true,
        createdAt: true,
      },
    });

    if (entries.length === 0) {
      return { valid: true, totalEntries: 0 };
    }

    for (let i = 1; i < entries.length; i++) {
      const currentEntry = entries[i];
      const previousEntry = entries[i - 1];

      // Each entry's previousHash should equal the prior entry's rowHash
      if (currentEntry.previousHash !== previousEntry.rowHash) {
        this.logger.error(
          `AUDIT CHAIN BROKEN at index ${i}, entry ID: ${currentEntry.id}`,
        );
        return {
          valid: false,
          totalEntries: entries.length,
          firstBrokenIndex: i,
        };
      }
    }

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const expectedPreviousHash = i === 0 ? '0'.repeat(64) : entries[i - 1].rowHash;
      const expectedPayload = this.buildHashPayload({
        submissionId: entry.submissionId || null,
        actorId: entry.actorId,
        action: entry.action as AuditAction,
        metadata: entry.metadata as Record<string, unknown>,
        ipAddress: entry.ipAddress,
        previousHash: expectedPreviousHash,
        createdAt: entry.createdAt.toISOString(),
      });
      const expectedRowHash = crypto
        .createHash('sha256')
        .update(expectedPayload)
        .digest('hex');

      if (entry.previousHash !== expectedPreviousHash || entry.rowHash !== expectedRowHash) {
        this.logger.error(
          `AUDIT ROW HASH MISMATCH at index ${i}, entry ID: ${entry.id}`,
        );
        return {
          valid: false,
          totalEntries: entries.length,
          firstBrokenIndex: i,
        };
      }
    }

    return { valid: true, totalEntries: entries.length };
  }

  /**
   * Get audit trail for a specific submission.
   */
  async getSubmissionAuditTrail(submissionId: string) {
    return this.prisma.auditLog.findMany({
      where: { submissionId },
      orderBy: { createdAt: 'asc' },
      include: {
        actor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });
  }

  toCsv(entries: Array<{
    createdAt: Date;
    action: string;
    ipAddress: string;
    previousHash: string;
    rowHash: string;
    metadata: unknown;
    actor?: { firstName: string; lastName: string; role: unknown } | null;
  }>) {
    const rows = [
      ['Timestamp', 'Action', 'Actor', 'Actor Role', 'IP Address', 'Previous Hash', 'Row Hash', 'Metadata'],
      ...entries.map((entry) => [
        entry.createdAt.toISOString(),
        entry.action,
        entry.actor ? `${entry.actor.firstName} ${entry.actor.lastName}` : '',
        this.roleLabel(entry.actor?.role),
        entry.ipAddress,
        entry.previousHash,
        entry.rowHash,
        JSON.stringify(entry.metadata || {}),
      ]),
    ];

    return rows.map((row) => row.map((cell) => this.escapeCsv(String(cell))).join(',')).join('\n');
  }

  private buildHashPayload(payload: Record<string, unknown>): string {
    return this.stableStringify(payload);
  }

  private stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }

    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${this.stableStringify(record[key])}`)
      .join(',')}}`;
  }

  private roleLabel(role: unknown) {
    if (!role) return '';
    if (typeof role === 'string') return role;
    if (typeof role === 'object' && role !== null && 'code' in role) {
      return String((role as { code?: unknown }).code || '');
    }
    return String(role);
  }

  private escapeCsv(value: string) {
    if (/[",\n\r]/.test(value)) {
      return `"${value.replaceAll('"', '""')}"`;
    }
    return value;
  }
}
