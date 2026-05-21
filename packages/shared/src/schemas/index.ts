// =============================================
// GovFlow Zod Validation Schemas
// =============================================
// Single source of truth for input validation.
// Used by backend (NestJS pipes) and frontend (form validation).

import { z } from 'zod';
import { Role, StageType, StageAction, ParallelStrategy, CommentType } from '../types';

// ---- Common ----
const sanitizedString = (minLen = 1, maxLen = 500) =>
  z
    .string()
    .min(minLen)
    .max(maxLen)
    .transform((val) => val.replace(/<[^>]*>/g, '').trim()); // Strip HTML tags

const emailSchema = z.string().email().max(255).toLowerCase();

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

const uuidSchema = z.string().uuid();

// ---- Auth Schemas ----
export const LoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
  mfaCode: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().regex(/^\d{6}$/, 'MFA code must be 6 digits').optional(),
  ),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const RegisterSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: sanitizedString(1, 100),
  lastName: sanitizedString(1, 100),
  companyName: sanitizedString(1, 200).optional(),
  phone: z
    .string()
    .max(20)
    .regex(/^\+?[0-9\s\-()]+$/, 'Invalid phone number format')
    .optional(),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;

// ---- User Management Schemas ----
export const CreateUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: sanitizedString(1, 100),
  lastName: sanitizedString(1, 100),
  roleId: uuidSchema,
  extraPermissions: z.array(z.string().min(1).max(100)).optional(),
  departmentId: uuidSchema.optional(),
  branchId: uuidSchema.optional(),
});
export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = z.object({
  firstName: sanitizedString(1, 100).optional(),
  lastName: sanitizedString(1, 100).optional(),
  roleId: uuidSchema.optional(),
  extraPermissions: z.array(z.string().min(1).max(100)).optional(),
  departmentId: uuidSchema.optional().nullable(),
  branchId: uuidSchema.optional().nullable(),
});
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

export const ChangeUserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'REJECTED']),
  reason: sanitizedString(1, 500).optional(),
});
export type ChangeUserStatusInput = z.infer<typeof ChangeUserStatusSchema>;

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

export const EnableMfaSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'MFA code must be 6 digits'),
});
export type EnableMfaInput = z.infer<typeof EnableMfaSchema>;

// ---- Workflow Schemas ----
export const CreateWorkflowSchema = z.object({
  name: sanitizedString(1, 200),
  description: sanitizedString(0, 2000).optional(),
  departmentId: uuidSchema,
});
export type CreateWorkflowInput = z.infer<typeof CreateWorkflowSchema>;

export const UpdateWorkflowSchema = z.object({
  name: sanitizedString(1, 200).optional(),
  description: sanitizedString(0, 2000).optional(),
});
export type UpdateWorkflowInput = z.infer<typeof UpdateWorkflowSchema>;

export const CreateStageSchema = z.object({
  name: sanitizedString(1, 200),
  stageOrder: z.number().int().min(1),
  stageType: z.nativeEnum(StageType).default(StageType.SEQUENTIAL),
  assignedRoleId: uuidSchema,
  slaDays: z.number().int().min(1).max(365).default(3),
  allowedActions: z.array(z.nativeEnum(StageAction)).min(1),
  requiredDocs: z.array(z.string().max(200)).optional(),
});
export type CreateStageInput = z.infer<typeof CreateStageSchema>;

export const CreateParallelConfigSchema = z.object({
  strategy: z.nativeEnum(ParallelStrategy),
  quorumCount: z.number().int().min(1).optional(),
});
export type CreateParallelConfigInput = z.infer<typeof CreateParallelConfigSchema>;

export const CreateRoutingRuleSchema = z.object({
  conditionField: sanitizedString(1, 100),
  operator: z.enum(['gt', 'lt', 'eq', 'gte', 'lte', 'contains', 'not_eq']),
  value: sanitizedString(1, 500),
  targetStageId: uuidSchema,
});
export type CreateRoutingRuleInput = z.infer<typeof CreateRoutingRuleSchema>;

// ---- Submission Schemas ----
export const CreateSubmissionSchema = z.object({
  workflowId: uuidSchema,
  branchId: uuidSchema,
  title: sanitizedString(1, 500),
  description: sanitizedString(0, 5000).optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateSubmissionInput = z.infer<typeof CreateSubmissionSchema>;

export const ForwardSubmissionSchema = z.object({
  comment: sanitizedString(0, 2000).optional(),
});
export type ForwardSubmissionInput = z.infer<typeof ForwardSubmissionSchema>;

export const RejectSubmissionSchema = z.object({
  targetStageId: uuidSchema,
  reason: sanitizedString(1, 2000),
  requiredCorrections: z.array(sanitizedString(1, 500)).optional(),
});
export type RejectSubmissionInput = z.infer<typeof RejectSubmissionSchema>;

export const HoldSubmissionSchema = z.object({
  reason: sanitizedString(1, 2000),
});
export type HoldSubmissionInput = z.infer<typeof HoldSubmissionSchema>;

export const AddCommentSchema = z.object({
  text: sanitizedString(1, 5000),
  commentType: z.nativeEnum(CommentType).default(CommentType.COMMENT),
});
export type AddCommentInput = z.infer<typeof AddCommentSchema>;

export const SignSubmissionSchema = z.object({
  pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4 to 6 digits'),
});
export type SignSubmissionInput = z.infer<typeof SignSubmissionSchema>;

export const UpdatePublicTrackingSchema = z.object({
  publicTrackable: z.boolean(),
});
export type UpdatePublicTrackingInput = z.infer<typeof UpdatePublicTrackingSchema>;

// ---- Organisation Admin Schemas ----
export const CreateDepartmentSchema = z.object({
  name: sanitizedString(1, 300),
  code: sanitizedString(1, 20).transform((value) => value.toUpperCase().replace(/\s+/g, '_')),
  organisationId: uuidSchema.optional(),
});
export type CreateDepartmentInput = z.infer<typeof CreateDepartmentSchema>;

export const UpdateDepartmentSchema = z.object({
  name: sanitizedString(1, 300).optional(),
  code: sanitizedString(1, 20).transform((value) => value.toUpperCase().replace(/\s+/g, '_')).optional(),
});
export type UpdateDepartmentInput = z.infer<typeof UpdateDepartmentSchema>;

export const CreateBranchSchema = z.object({
  name: sanitizedString(1, 300),
  code: sanitizedString(1, 20).transform((value) => value.toUpperCase().replace(/\s+/g, '_')),
  departmentId: uuidSchema,
});
export type CreateBranchInput = z.infer<typeof CreateBranchSchema>;

export const UpdateBranchSchema = z.object({
  name: sanitizedString(1, 300).optional(),
  code: sanitizedString(1, 20).transform((value) => value.toUpperCase().replace(/\s+/g, '_')).optional(),
  departmentId: uuidSchema.optional(),
});
export type UpdateBranchInput = z.infer<typeof UpdateBranchSchema>;

// ---- Pagination Schema ----
export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().max(50).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type PaginationInput = z.infer<typeof PaginationSchema>;

// ---- Search / Filter Schemas ----
export const SubmissionFilterSchema = z.object({
  status: z.enum(['SUBMITTED', 'IN_REVIEW', 'QUERY_RAISED', 'ON_HOLD', 'APPROVED', 'REJECTED', 'ARCHIVED']).optional(),
  workflowId: uuidSchema.optional(),
  branchId: uuidSchema.optional(),
  departmentId: uuidSchema.optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  search: sanitizedString(0, 200).optional(),
});
export type SubmissionFilterInput = z.infer<typeof SubmissionFilterSchema>;
