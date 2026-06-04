// =============================================================
// GOVFLOW — TYPESCRIPT TYPE DEFINITIONS
// Import these into your React/Next.js frontend and any TS tools
// =============================================================

// =============================================================
// ENUMS
// =============================================================

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  DEPARTMENT_ADMIN = 'DEPARTMENT_ADMIN',
  BRANCH_ADMIN = 'BRANCH_ADMIN',
  SENIOR_ENGINEER = 'SENIOR_ENGINEER',
  ENGINEER = 'ENGINEER',
  SUB_ENGINEER = 'SUB_ENGINEER',
  ENTRY_DESK_OFFICER = 'ENTRY_DESK_OFFICER',
  CONTRACTOR = 'CONTRACTOR',
  IT_ADMIN = 'IT_ADMIN',
}

export enum UserStatus {
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  REJECTED = 'REJECTED',
}

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

export enum SubmissionStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  IN_REVIEW = 'IN_REVIEW',
  QUERY_RAISED = 'QUERY_RAISED',
  ON_HOLD = 'ON_HOLD',
  RETURNED_TO_CONTRACTOR = 'RETURNED_TO_CONTRACTOR',
  REJECTED = 'REJECTED',
  APPROVED = 'APPROVED',
  ARCHIVED = 'ARCHIVED',
}

export enum FileStageStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  FORWARDED = 'FORWARDED',
  REJECTED = 'REJECTED',
  APPROVED = 'APPROVED',
  HELD = 'HELD',
  QUERY_RAISED = 'QUERY_RAISED',
}

export enum ApprovalDecision {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum StageAction {
  FORWARD = 'FORWARD',
  REJECT = 'REJECT',            // reject to immediately previous stage
  REJECT_ANY = 'REJECT_ANY',   // reject to any prior stage
  REJECT_TO_CONTRACTOR = 'REJECT_TO_CONTRACTOR',
  COMMENT = 'COMMENT',
  HOLD = 'HOLD',
  REQUEST_INFO = 'REQUEST_INFO',
  QUERY = 'QUERY',             // raise a query to contractor or previous officer
  SIGN = 'SIGN',
}

export enum CommentType {
  COMMENT = 'COMMENT',
  QUERY = 'QUERY',
  QUERY_RESPONSE = 'QUERY_RESPONSE',
  SYSTEM_NOTE = 'SYSTEM_NOTE',
  REJECTION_REASON = 'REJECTION_REASON',
}

export enum SignatureTier {
  TIER_1_PIN = 'TIER_1_PIN',
  TIER_2_CRYPTO = 'TIER_2_CRYPTO',
}

export enum NotificationType {
  FILE_ASSIGNED = 'FILE_ASSIGNED',
  SLA_WARNING = 'SLA_WARNING',
  SLA_BREACH = 'SLA_BREACH',
  FILE_FORWARDED = 'FILE_FORWARDED',
  FILE_REJECTED_TO_YOU = 'FILE_REJECTED_TO_YOU',
  QUERY_RAISED = 'QUERY_RAISED',
  QUERY_RESPONDED = 'QUERY_RESPONDED',
  FILE_APPROVED = 'FILE_APPROVED',
  FILE_RETURNED_TO_CONTRACTOR = 'FILE_RETURNED_TO_CONTRACTOR',
  PARALLEL_APPROVAL_PENDING = 'PARALLEL_APPROVAL_PENDING',
  PARALLEL_APPROVAL_QUORUM_MET = 'PARALLEL_APPROVAL_QUORUM_MET',
  PARALLEL_APPROVAL_CONFLICT = 'PARALLEL_APPROVAL_CONFLICT',
  ACCOUNT_APPROVED = 'ACCOUNT_APPROVED',
  ACCOUNT_REJECTED = 'ACCOUNT_REJECTED',
  FILE_REASSIGNED = 'FILE_REASSIGNED',
}

export enum DocumentType {
  BOQ = 'BOQ',
  DRAWING = 'DRAWING',
  SITE_SURVEY = 'SITE_SURVEY',
  PHOTO = 'PHOTO',
  REPORT = 'REPORT',
  LETTER = 'LETTER',
  CERTIFICATE = 'CERTIFICATE',
  OTHER = 'OTHER',
}

// =============================================================
// BASE TYPES
// =============================================================

export interface PaginatedResponse<T> {
  success: true
  data: T[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

export interface DateRange {
  from: string  // ISO 8601
  to: string    // ISO 8601
}

// =============================================================
// ORGANISATION TYPES
// =============================================================

export interface Organisation {
  id: string
  name: string
  code: string
  logoPath?: string
  address?: string
  createdAt: string
}

export interface Department {
  id: string
  organisationId: string
  name: string
  code: string
  description?: string
  createdAt: string
}

export interface Branch {
  id: string
  departmentId: string
  name: string
  code: string
  address?: string
  isHeadOffice: boolean
  createdAt: string
}

// =============================================================
// USER TYPES
// =============================================================

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  fullName: string             // computed: firstName + lastName
  role: UserRole
  departmentId?: string
  department?: Department
  branchId?: string
  branch?: Branch
  status: UserStatus
  phone?: string
  designation?: string
  employeeCode?: string
  mfaEnabled: boolean
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
}

export interface ContractorProfile {
  id: string
  userId: string
  companyName?: string
  companyRegNumber?: string
  panNumber?: string
  vatNumber?: string
  address?: string
  contactPerson?: string
  storageQuotaBytes: number
  storageUsedBytes: number      // computed from document_versions
  approvedBy?: string
  approvedAt?: string
  rejectionReason?: string
}

export interface UserWithContractor extends User {
  contractorProfile?: ContractorProfile
}

// Auth
export interface LoginRequest {
  email: string
  password: string
}

export interface MfaVerifyRequest {
  tempToken: string    // short-lived token issued after password verified
  code: string         // 6-digit TOTP or SMS OTP
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number    // seconds
}

export interface AuthUser extends User {
  tokens: AuthTokens
}

export interface JwtPayload {
  userId: string
  role: UserRole
  departmentId?: string
  branchId?: string
  sessionId: string
  exp: number
  iat: number
}

// Registration
export interface ContractorRegistrationRequest {
  email: string
  password: string
  firstName: string
  lastName: string
  phone: string
  companyName?: string
  companyRegNumber?: string
  panNumber?: string
}

export interface StaffCreateRequest {
  email: string
  firstName: string
  lastName: string
  role: UserRole
  departmentId: string
  branchId: string
  phone?: string
  designation?: string
  employeeCode?: string
}

// =============================================================
// WORKFLOW TYPES
// =============================================================

export interface WorkflowDefinition {
  id: string
  departmentId: string
  department?: Department
  name: string
  description?: string
  version: number
  status: WorkflowStatus
  isPubliclyTrackable: boolean
  publicDetailLevel: 'BASIC' | 'DETAILED'
  metadataSchema: MetadataFieldSchema[]
  stages: WorkflowStage[]
  createdBy: string
  publishedAt?: string
  createdAt: string
  updatedAt: string
}

// Defines a custom input field for a workflow (e.g., BOQ value)
export interface MetadataFieldSchema {
  key: string           // e.g., 'boq_value'
  label: string         // e.g., 'BOQ Value (NPR)'
  type: 'NUMBER' | 'TEXT' | 'DATE' | 'SELECT' | 'BOOLEAN'
  required: boolean
  options?: string[]    // for SELECT type
  min?: number
  max?: number
}

export interface WorkflowStage {
  id: string
  workflowDefId: string
  name: string
  stageOrder: number
  stageType: StageType
  assignedRole: UserRole
  slaDays?: number
  slaWarningDays: number
  allowedActions: StageAction[]
  requiredDocumentTypes: DocumentType[]
  isEntryStage: boolean
  isTerminalStage: boolean
  requiresDigitalSignature: boolean
  signatureTier: 1 | 2
  parallelGroupId?: string
  parallelConfig?: ParallelStageConfig
  routingRules: StageRoutingRule[]
  allowedRejectionTargets: string[]  // stage IDs
  createdAt: string
}

export interface ParallelStageConfig {
  id: string
  stageId: string
  strategy: ParallelStrategy
  quorumCount?: number
}

export interface StageRoutingRule {
  id: string
  fromStageId: string
  conditionField?: string
  operator?: 'GT' | 'LT' | 'GTE' | 'LTE' | 'EQ' | 'NEQ' | 'IN' | 'CONTAINS'
  conditionValue?: string
  toStageId: string
  isDefaultRoute: boolean
  ruleOrder: number
}

// =============================================================
// FILE SUBMISSION TYPES
// =============================================================

export interface FileSubmission {
  id: string
  trackingNumber: string
  title: string
  description?: string
  contractorId: string
  contractor?: User
  workflowDefId: string
  workflowVersion: number
  workflowDefinition?: WorkflowDefinition
  departmentId: string
  department?: Department
  branchId: string
  branch?: Branch
  status: SubmissionStatus
  metadata: Record<string, unknown>
  currentStageId?: string
  currentStage?: WorkflowStage
  submittedAt: string
  lastActionAt: string
  approvedAt?: string
  archivedAt?: string
  archivalReference?: string
  documents?: FileDocument[]
  createdAt: string
  updatedAt: string
}

export interface SubmissionCreateRequest {
  workflowDefId: string
  title: string
  description?: string
  metadata: Record<string, unknown>
  documents: DocumentUploadIntent[]
}

export interface DocumentUploadIntent {
  documentType: DocumentType
  name: string
  isRequired: boolean
}

// Stage action requests
export interface ForwardRequest {
  comment?: string
  toStageId?: string  // if conditional routing; omit to use default routing
}

export interface RejectRequest {
  toStageId: string   // which prior stage to return to
  reason: string      // mandatory
  requiredCorrections?: string[]
}

export interface HoldRequest {
  reason: string
}

export interface QueryRequest {
  targetType: 'CONTRACTOR' | 'PREVIOUS_STAGE'
  targetUserId?: string
  queryText: string
}

export interface SignRequest {
  pin: string          // for Tier 1
  documentIds: string[]
}

// =============================================================
// FILE STAGE TYPES
// =============================================================

export interface FileStage {
  id: string
  submissionId: string
  stageId: string
  stage?: WorkflowStage
  assignedTo?: string
  assignedOfficer?: User
  status: FileStageStatus
  slaDueAt?: string
  startedAt?: string
  completedAt?: string
  daysHeld?: number
  actionTaken?: string
  actionComment?: string
  forwardedToStageId?: string
  rejectedToStageId?: string
  rejectionReason?: string
  holdReason?: string
  parallelApprovals?: ParallelApproval[]
  isSlaBreached: boolean
  isSlaWarning: boolean
  createdAt: string
}

export interface ParallelApproval {
  id: string
  fileStageId: string
  officerId: string
  officer?: User
  decision: ApprovalDecision
  comment?: string
  signedAt?: string
}

// The full visual timeline for a file
export interface FileTimeline {
  submissionId: string
  trackingNumber: string
  title: string
  status: SubmissionStatus
  totalCalendarDays: number
  totalWorkingDays: number
  events: TimelineEvent[]
}

export interface TimelineEvent {
  stageId: string
  stageName: string
  officerName?: string
  officerRole?: UserRole
  status: FileStageStatus
  startedAt?: string
  completedAt?: string
  daysHeld: number
  action?: string
  comment?: string
  isSlaBreached: boolean
  parallelApprovals?: ParallelApproval[]
}

// =============================================================
// DOCUMENT TYPES
// =============================================================

export interface FileDocument {
  id: string
  submissionId: string
  name: string
  documentType: DocumentType
  currentVersionId?: string
  currentVersion?: DocumentVersion
  versions?: DocumentVersion[]
  isRequired: boolean
  createdAt: string
}

export interface DocumentVersion {
  id: string
  documentId: string
  versionNumber: number
  storagePath: string
  fileSizeBytes: number
  mimeType: string
  originalFilename: string
  fileHash: string
  uploadedBy: string
  uploadedByUser?: User
  uploadStageId?: string
  uploadNote?: string
  isVirusClean: boolean
  isLocked: boolean
  uploadedAt: string
  // generated server-side, short-lived pre-signed URL for preview/download
  previewUrl?: string
  downloadUrl?: string
}

// For document comparison view
export interface DocumentDiff {
  documentId: string
  versionA: DocumentVersion
  versionB: DocumentVersion
  diffType: 'PDF' | 'SPREADSHEET' | 'IMAGE' | 'OTHER'
  // For spreadsheet: list of changed cells
  cellChanges?: SpreadsheetCellChange[]
}

export interface SpreadsheetCellChange {
  sheet: string
  cell: string   // e.g., 'B14'
  oldValue: string
  newValue: string
  changeType: 'ADDED' | 'REMOVED' | 'MODIFIED'
}

// =============================================================
// COMMENT & QUERY TYPES
// =============================================================

export interface Comment {
  id: string
  submissionId: string
  stageId?: string
  stageName?: string
  authorId: string
  author?: User
  commentType: CommentType
  text: string
  parentCommentId?: string
  replies?: Comment[]
  isVisibleToContractor: boolean
  isResolved: boolean
  resolvedBy?: string
  resolvedAt?: string
  createdAt: string
}

// =============================================================
// SIGNATURE TYPES
// =============================================================

export interface DigitalSignature {
  id: string
  submissionId: string
  fileStageId?: string
  documentVersionId?: string
  officerId: string
  officer?: User
  tier: SignatureTier
  documentHash: string
  verificationUrl: string
  signedAt: string
  ipAddress?: string
  isValid: boolean
}

export interface SignatureVerificationResult {
  isValid: boolean
  submissionId: string
  trackingNumber: string
  officerName: string
  officerDesignation: string
  signedAt: string
  documentHash: string
  documentName: string
  tier: SignatureTier
}

// =============================================================
// NOTIFICATION TYPES
// =============================================================

export interface Notification {
  id: string
  recipientId: string
  type: NotificationType
  title: string
  body: string
  payload: {
    submissionId?: string
    trackingNumber?: string
    stageName?: string
    daysOverSla?: number
    [key: string]: unknown
  }
  isRead: boolean
  readAt?: string
  createdAt: string
}

// =============================================================
// DASHBOARD TYPES
// =============================================================

// For internal staff (officers)
export interface OfficerDashboard {
  pendingFiles: FileSubmission[]
  slaBreachedCount: number
  slaWarningCount: number
  totalPendingCount: number
  recentActivity: TimelineEvent[]
}

// For contractors
export interface ContractorDashboard {
  submissions: FileSubmission[]
  pendingQueries: Comment[]
  recentlyApproved: FileSubmission[]
  totalSubmissions: number
  approvedCount: number
  rejectedCount: number
  inReviewCount: number
}

// For department/super admins
export interface AdminDashboard {
  slaHeatmap: SlaHeatmapEntry[]
  workloadByOfficer: OfficerWorkload[]
  workloadByStage: StageWorkload[]
  submissionTrend: TrendDataPoint[]
  averageProcessingDays: number
}

export interface SlaHeatmapEntry {
  submissionId: string
  trackingNumber: string
  title: string
  stageName: string
  officerName: string
  daysHeld: number
  slaDays: number
  slaStatus: 'GREEN' | 'AMBER' | 'RED'
}

export interface OfficerWorkload {
  officerId: string
  officerName: string
  role: UserRole
  totalPending: number
  slaBreached: number
  slaWarning: number
  avgDaysHeld: number
}

export interface StageWorkload {
  stageId: string
  stageName: string
  workflowName: string
  pendingCount: number
  avgDaysHeld: number
  breachRate: number  // percentage
}

export interface TrendDataPoint {
  date: string
  submitted: number
  approved: number
  rejected: number
}

// =============================================================
// REPORT TYPES
// =============================================================

export interface ReportFilter {
  dateRange?: DateRange
  departmentIds?: string[]
  branchIds?: string[]
  workflowDefIds?: string[]
  officerIds?: string[]
  contractorIds?: string[]
  stageIds?: string[]
  slaStatus?: ('GREEN' | 'AMBER' | 'RED')[]
  statuses?: SubmissionStatus[]
}

export interface ReportColumn {
  key: string
  label: string
  type: 'TEXT' | 'NUMBER' | 'DATE' | 'DURATION' | 'STATUS' | 'BADGE'
}

export interface ReportTemplate {
  id: string
  name: string
  createdBy: string
  filterConfig: ReportFilter
  columnConfig: ReportColumn[]
  scheduleConfig?: ReportSchedule
  lastRunAt?: string
  createdAt: string
}

export interface ReportSchedule {
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY'
  dayOfWeek?: number   // 1-7, for WEEKLY
  dayOfMonth?: number  // 1-31, for MONTHLY
  emails: string[]
}

// =============================================================
// PUBLIC TRACKING TYPES (for citizens, no auth required)
// =============================================================

export interface PublicTrackingResult {
  trackingNumber: string
  title: string
  currentStatus: 'IN_REVIEW' | 'QUERY_RAISED' | 'ON_HOLD' | 'APPROVED' | 'REJECTED'
  currentStage?: string           // stage name, no officer info
  submittedAt: string
  expectedCompletionDate?: string
  stageHistory: PublicStageHistory[]
}

export interface PublicStageHistory {
  stageName: string
  status: string
  completedAt?: string
}

// =============================================================
// WORKFLOW BUILDER TYPES (admin UI)
// =============================================================

export interface WorkflowBuilderState {
  definition: Partial<WorkflowDefinition>
  stages: WorkflowStageBuilderNode[]
  connections: WorkflowConnection[]
  isDirty: boolean
  isValid: boolean
  validationErrors: string[]
}

export interface WorkflowStageBuilderNode {
  id: string
  tempId?: string   // used before saving to server
  name: string
  stageOrder: number
  stageType: StageType
  assignedRole: UserRole
  slaDays?: number
  allowedActions: StageAction[]
  requiresDigitalSignature: boolean
  signatureTier: 1 | 2
  isEntryStage: boolean
  isTerminalStage: boolean
  parallelGroupId?: string
  parallelConfig?: ParallelStageConfig
  position: { x: number; y: number }   // canvas position for drag-and-drop
}

export interface WorkflowConnection {
  id: string
  fromStageId: string
  toStageId: string
  isDefault: boolean
  conditionField?: string
  operator?: string
  conditionValue?: string
  label?: string
}

// =============================================================
// ADMIN TYPES
// =============================================================

export interface UserManagementFilters {
  role?: UserRole
  status?: UserStatus
  departmentId?: string
  branchId?: string
  search?: string
}

export interface FileReassignRequest {
  fileStageId: string
  newOfficerId: string
  reason: string
}

export interface ContractorApprovalRequest {
  userId: string
  action: 'APPROVE' | 'REJECT'
  rejectionReason?: string
}
