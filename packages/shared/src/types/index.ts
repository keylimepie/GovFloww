// =============================================
// GovFlow Shared Types
// =============================================
// These enums and interfaces are the single source of truth
// used by both backend and frontend.

// ---- User Roles ----
export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  DEPARTMENT_ADMIN = 'DEPARTMENT_ADMIN',
  BRANCH_ADMIN = 'BRANCH_ADMIN',
  SENIOR_ENGINEER = 'SENIOR_ENGINEER',
  ENGINEER = 'ENGINEER',
  SUB_ENGINEER = 'SUB_ENGINEER',
  ENTRY_DESK = 'ENTRY_DESK',
  CONTRACTOR = 'CONTRACTOR',
  CITIZEN = 'CITIZEN',
  IT_ADMIN = 'IT_ADMIN',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  PENDING = 'PENDING',
  SUSPENDED = 'SUSPENDED',
  REJECTED = 'REJECTED',
}

// ---- Workflow ----
export enum WorkflowStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum StageType {
  SEQUENTIAL = 'SEQUENTIAL',
  PARALLEL = 'PARALLEL',
  CONDITIONAL = 'CONDITIONAL',
}

export enum ParallelStrategy {
  ALL_MUST_APPROVE = 'ALL_MUST_APPROVE',
  QUORUM = 'QUORUM',
}

export enum StageAction {
  FORWARD = 'FORWARD',
  REJECT = 'REJECT',
  HOLD = 'HOLD',
  COMMENT = 'COMMENT',
  QUERY = 'QUERY',
  SIGN_TIER1 = 'SIGN_TIER1',
  SIGN_TIER2 = 'SIGN_TIER2',
  REQUEST_INFO = 'REQUEST_INFO',
}

// ---- File Submission ----
export enum SubmissionStatus {
  SUBMITTED = 'SUBMITTED',
  IN_REVIEW = 'IN_REVIEW',
  QUERY_RAISED = 'QUERY_RAISED',
  ON_HOLD = 'ON_HOLD',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  ARCHIVED = 'ARCHIVED',
}

export enum FileStageStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
  SKIPPED = 'SKIPPED',
}

export enum CommentType {
  COMMENT = 'COMMENT',
  QUERY = 'QUERY',
  RESPONSE = 'RESPONSE',
}

// ---- Audit ----
export enum AuditAction {
  // Auth events
  USER_REGISTERED = 'USER_REGISTERED',
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  USER_LOGIN_FAILED = 'USER_LOGIN_FAILED',

  // User management
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_ROLE_CHANGED = 'USER_ROLE_CHANGED',
  USER_STATUS_CHANGED = 'USER_STATUS_CHANGED',
  CONTRACTOR_APPROVED = 'CONTRACTOR_APPROVED',
  CONTRACTOR_REJECTED = 'CONTRACTOR_REJECTED',

  // Workflow events
  WORKFLOW_CREATED = 'WORKFLOW_CREATED',
  WORKFLOW_UPDATED = 'WORKFLOW_UPDATED',
  WORKFLOW_PUBLISHED = 'WORKFLOW_PUBLISHED',
  WORKFLOW_ARCHIVED = 'WORKFLOW_ARCHIVED',

  // Submission events
  FILE_SUBMITTED = 'FILE_SUBMITTED',
  FILE_RECEIVED_AT_STAGE = 'FILE_RECEIVED_AT_STAGE',
  FILE_VIEWED = 'FILE_VIEWED',
  FILE_DOWNLOADED = 'FILE_DOWNLOADED',
  FILE_UPLOADED = 'FILE_UPLOADED',
  FILE_FORWARDED = 'FILE_FORWARDED',
  FILE_REJECTED = 'FILE_REJECTED',
  FILE_HELD = 'FILE_HELD',
  FILE_RELEASED = 'FILE_RELEASED',
  FILE_SIGNED_T1 = 'FILE_SIGNED_T1',
  FILE_SIGNED_T2 = 'FILE_SIGNED_T2',
  DOCUMENT_SIGNED = 'DOCUMENT_SIGNED',
  FILE_APPROVED = 'FILE_APPROVED',
  FILE_ARCHIVED = 'FILE_ARCHIVED',
  PUBLIC_TRACKING_CHANGED = 'PUBLIC_TRACKING_CHANGED',

  // Comment events
  COMMENT_ADDED = 'COMMENT_ADDED',
  QUERY_RAISED = 'QUERY_RAISED',
  QUERY_RESPONDED = 'QUERY_RESPONDED',

  // System events
  SYSTEM_CONFIG_CHANGED = 'SYSTEM_CONFIG_CHANGED',
}

// ---- Common Interfaces ----
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
}

export interface JwtPayload {
  sub: string; // user ID
  email: string;
  roleId: string;
  role: Role | string; // Role code
  permissions: string[];
  extraPermissions?: string[];
  hierarchyLevel: number;
  departmentId: string | null;
  branchId: string | null;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// ---- Workflow stage summary for frontend display ----
export interface StageSummary {
  id: string;
  name: string;
  stageOrder: number;
  stageType: StageType;
  assignedRole: Role;
  slaDays: number;
  allowedActions: StageAction[];
}

// ---- Submission timeline event for display ----
export interface TimelineEvent {
  id: string;
  action: AuditAction;
  actorName: string;
  actorRole: Role;
  stageName?: string;
  comment?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}
