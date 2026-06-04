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
  SUPERINTENDENT_ENGINEER = 'SUPERINTENDENT_ENGINEER',
  SENIOR_ENGINEER = 'SENIOR_ENGINEER',
  ENGINEER = 'ENGINEER',
  SUB_ENGINEER = 'SUB_ENGINEER',
  ENTRY_DESK = 'ENTRY_DESK',
  ENTRY_DESK_OFFICER = 'ENTRY_DESK_OFFICER',
  SECTION_OFFICER = 'SECTION_OFFICER',
  NAYEB_SUBBA = 'NAYEB_SUBBA',
  KHARIDAAR = 'KHARIDAAR',
  ACCOUNTS_CONTROLLER = 'ACCOUNTS_CONTROLLER',
  ACCOUNT_OFFICER = 'ACCOUNT_OFFICER',
  ACCOUNTANT = 'ACCOUNTANT',
  LAW_SECRETARY = 'LAW_SECRETARY',
  LAW_OFFICER = 'LAW_OFFICER',
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
  SUBMIT = 'SUBMIT',
  FORWARD = 'FORWARD',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  REJECT_ANY = 'REJECT_ANY',
  REJECT_TO_CONTRACTOR = 'REJECT_TO_CONTRACTOR',
  HOLD = 'HOLD',
  COMMENT = 'COMMENT',
  QUERY = 'QUERY',
  TOK = 'TOK',
  RAYE = 'RAYE',
  TIPPANI = 'TIPPANI',
  SIGN = 'SIGN',
  SIGN_TIER1 = 'SIGN_TIER1',
  SIGN_TIER2 = 'SIGN_TIER2',
  REQUEST_INFO = 'REQUEST_INFO',
  FORWARD_TO_MINISTRY = 'FORWARD_TO_MINISTRY',
}

// ---- File Submission ----
export enum SubmissionStatus {
  SUBMITTED = 'SUBMITTED',
  IN_REVIEW = 'IN_REVIEW',
  QUERY_RAISED = 'QUERY_RAISED',
  ON_HOLD = 'ON_HOLD',
  RETURNED_TO_CONTRACTOR = 'RETURNED_TO_CONTRACTOR',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  ARCHIVED = 'ARCHIVED',
  FORWARDED_TO_MINISTRY = 'FORWARDED_TO_MINISTRY',
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
  FORWARDED_TO_MINISTRY = 'FORWARDED_TO_MINISTRY',
  PUBLIC_TRACKING_CHANGED = 'PUBLIC_TRACKING_CHANGED',
  TOK_ASSIGNED = 'TOK_ASSIGNED',
  TOK_COMPLETED = 'TOK_COMPLETED',
  TOK_RECALLED = 'TOK_RECALLED',
  RAYE_REQUESTED = 'RAYE_REQUESTED',
  RAYE_RESPONDED = 'RAYE_RESPONDED',
  RAYE_CANCELLED = 'RAYE_CANCELLED',
  TIPPANI_PREPARED = 'TIPPANI_PREPARED',

  // Comment events
  COMMENT_ADDED = 'COMMENT_ADDED',
  QUERY_RAISED = 'QUERY_RAISED',
  QUERY_RESPONDED = 'QUERY_RESPONDED',

  // System events
  SYSTEM_CONFIG_CHANGED = 'SYSTEM_CONFIG_CHANGED',
}

export enum NotificationType {
  FILE_ASSIGNED = 'FILE_ASSIGNED',
  FILE_FORWARDED = 'FILE_FORWARDED',
  FILE_REJECTED_TO_YOU = 'FILE_REJECTED_TO_YOU',
  FILE_APPROVED = 'FILE_APPROVED',
  FILE_RETURNED_TO_CONTRACTOR = 'FILE_RETURNED_TO_CONTRACTOR',
  QUERY_RAISED = 'QUERY_RAISED',
  QUERY_RESPONDED = 'QUERY_RESPONDED',
  SLA_WARNING = 'SLA_WARNING',
  SLA_BREACH = 'SLA_BREACH',
  TOK_RECEIVED = 'TOK_RECEIVED',
  TOK_COMPLETED = 'TOK_COMPLETED',
  RAYE_REQUEST_RECEIVED = 'RAYE_REQUEST_RECEIVED',
  RAYE_RESPONSE_RECEIVED = 'RAYE_RESPONSE_RECEIVED',
  TIPPANI_SUBMITTED = 'TIPPANI_SUBMITTED',
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

// ---- DOR-specific concepts ----
export enum SakhaType {
  PRABIDHIK = 'PRABIDHIK',
  PRASASAN = 'PRASASAN',
  LEKHA = 'LEKHA',
  KAANUN = 'KAANUN',
}

export enum TokStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  RECALLED = 'RECALLED',
}

export enum RayeStatus {
  PENDING = 'PENDING',
  RESPONDED = 'RESPONDED',
  CANCELLED = 'CANCELLED',
}

export interface TokAssignment {
  id: string;
  fileStageId: string;
  submissionId: string;
  tokBy: string;
  tokTo: string;
  taskDescription?: string | null;
  status: TokStatus | string;
  responseNote?: string | null;
  assignedAt: string;
  completedAt?: string | null;
}

export interface RayeRequest {
  id: string;
  fileStageId: string;
  submissionId: string;
  requestedBy: string;
  targetSakha: SakhaType | string;
  targetBranchId?: string | null;
  assignedTo?: string | null;
  requestText: string;
  responseText?: string | null;
  status: RayeStatus | string;
  canReassign: boolean;
  requestedAt: string;
  respondedAt?: string | null;
  dueAt?: string | null;
}

export interface TippaniMetadata {
  id: string;
  submissionId: string;
  fileStageId?: string | null;
  documentId?: string | null;
  preparedBy: string;
  subject: string;
  recommendation: string;
  referenceDocuments: string[];
  preparedAt: string;
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
