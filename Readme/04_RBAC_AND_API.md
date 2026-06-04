# GovFlow — RBAC Matrix & API Specification

---

## PART 1: ROLE-BASED ACCESS CONTROL (RBAC) MATRIX

### 1.1 Role Descriptions & Scope

| Role | Scope | Primary Purpose |
|------|-------|-----------------|
| `SUPER_ADMIN` | All orgs, all depts, all branches | Full system control |
| `DEPARTMENT_ADMIN` | Own department only | Dept workflow & user management |
| `BRANCH_ADMIN` | Own branch only | Branch-level oversight |
| `SENIOR_ENGINEER` | Files at their assigned stage | Senior technical review, final sign-off |
| `ENGINEER` | Files at their assigned stage | Technical review, approval |
| `SUB_ENGINEER` | Files at their assigned stage | BOQ check, initial assessment |
| `ENTRY_DESK_OFFICER` | Files at entry stage | Intake, logging, initial verification |
| `CONTRACTOR` | Own submissions only | Submit, track, respond to queries |
| `IT_ADMIN` | System config only | User accounts, infra — NO file access |

---

### 1.2 File Action Permission Matrix

| Action | SUPER_ADMIN | DEPT_ADMIN | BRANCH_ADMIN | SR_ENGINEER | ENGINEER | SUB_ENGINEER | ENTRY_DESK | CONTRACTOR |
|--------|:-----------:|:----------:|:------------:|:-----------:|:--------:|:------------:|:----------:|:----------:|
| Submit new file | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| View own submissions | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| View files at my stage | ✗ | ✗ | ✗ | ✓* | ✓* | ✓* | ✓* | ✗ |
| View all dept files | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| View all branch files | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| View all system files | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Forward file | ✗ | ✓ (reassign) | ✓ (reassign) | ✓* | ✓* | ✓* | ✓* | ✗ |
| Reject to any stage | ✗ | ✓ | ✓ | ✓* | ✓* | ✓* | ✓* | ✗ |
| Return to contractor | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓* | ✗ |
| Place on hold | ✗ | ✓ | ✓ | ✓* | ✓* | ✓* | ✓* | ✗ |
| Add comment | ✓ | ✓ | ✓ | ✓* | ✓* | ✓* | ✓* | ✓ (own) |
| Raise query | ✗ | ✗ | ✗ | ✓* | ✓* | ✓* | ✓* | ✗ |
| Respond to query | ✗ | ✗ | ✗ | ✓* | ✓* | ✓* | ✓* | ✓ |
| Apply Tier 1 signature | ✗ | ✗ | ✗ | ✓* | ✓* | ✗ | ✗ | ✗ |
| Apply Tier 2 signature | ✗ | ✗ | ✗ | ✓* | ✗ | ✗ | ✗ | ✗ |
| Reassign file | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Upload document | ✗ | ✗ | ✗ | ✓* | ✓* | ✓* | ✓* | ✓ (own) |
| View document | ✓ | ✓ | ✓ | ✓* | ✓* | ✓* | ✓* | ✓ (own) |
| Download document | ✓ | ✓ | ✓ | ✓* | ✓* | ✓* | ✓* | ✓ (own) |
| View full audit trail | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| View file timeline | ✓ | ✓ | ✓ | ✓* | ✓* | ✓* | ✓* | ✓ (own) |

> `✓*` = permitted **only if** the file is currently at a stage assigned to this role in this branch/department.
> An officer CANNOT act on a file that has moved past their stage, unless explicitly added as a watcher.

---

### 1.3 Admin Action Permissions

| Action | SUPER_ADMIN | DEPT_ADMIN | BRANCH_ADMIN | ENGINEER/SUB | IT_ADMIN |
|--------|:-----------:|:----------:|:------------:|:------------:|:--------:|
| Create/edit workflow | ✓ | ✓ (own dept) | ✗ | ✗ | ✗ |
| Publish workflow | ✓ | ✓ (own dept) | ✗ | ✗ | ✗ |
| Archive workflow | ✓ | ✓ (own dept) | ✗ | ✗ | ✗ |
| Create department | ✓ | ✗ | ✗ | ✗ | ✗ |
| Create branch | ✓ | ✓ (own dept) | ✗ | ✗ | ✗ |
| Create internal user | ✓ | ✓ (own dept) | ✓ (own branch) | ✗ | ✓ |
| Approve contractor | ✓ | ✓ (own dept) | ✗ | ✗ | ✗ |
| Suspend user | ✓ | ✓ (own dept) | ✗ | ✗ | ✗ |
| Change user role | ✓ | ✓ (own dept) | ✗ | ✗ | ✗ |
| View reports | ✓ (all) | ✓ (own dept) | ✓ (own branch) | ✗ | ✗ |
| Export reports | ✓ | ✓ (own dept) | ✓ (own branch) | ✗ | ✗ |
| Configure SLA | ✓ | ✓ (own dept) | ✗ | ✗ | ✗ |
| Set public tracking | ✓ | ✓ (own dept) | ✗ | ✗ | ✗ |
| View audit log | ✓ | ✓ (own dept) | ✗ | ✗ | ✗ |
| Export audit log | ✓ | ✓ (own dept) | ✗ | ✗ | ✗ |
| Server/infra config | ✗ | ✗ | ✗ | ✗ | ✓ |

---

### 1.4 RBAC Enforcement Rules (implement in middleware)

```
RULE 1 — Stage Ownership Check
  IF action = [FORWARD, REJECT, HOLD, SIGN, COMMENT, QUERY, UPLOAD]
  AND user.role NOT IN [SUPER_ADMIN, DEPARTMENT_ADMIN, BRANCH_ADMIN]
  THEN: file.currentStage.assignedRole MUST EQUAL user.role
  AND:  file.branch_id MUST EQUAL user.branch_id
  AND:  file.department_id MUST EQUAL user.department_id

RULE 2 — Contractor Isolation
  IF user.role = CONTRACTOR
  THEN: file.contractor_id MUST EQUAL user.id (always)

RULE 3 — Department Admin Scope
  IF user.role = DEPARTMENT_ADMIN
  THEN: file.department_id MUST EQUAL user.department_id

RULE 4 — Branch Admin Scope
  IF user.role = BRANCH_ADMIN
  THEN: file.branch_id MUST EQUAL user.branch_id
  AND:  file.department_id MUST EQUAL user.department_id

RULE 5 — Watcher Exception
  IF user is in file_watchers for this submission
  THEN: allow VIEW_ONLY access regardless of current stage

RULE 6 — IT Admin Isolation
  IF user.role = IT_ADMIN
  THEN: DENY all file/document/workflow access
  ALLOW: user management, system config only
```

---

## PART 2: REST API SPECIFICATION

Base URL: `https://govflow.domain/api/v1`

All requests require: `Authorization: Bearer <access_token>`
All responses use the standard format from `00_MASTER_PROMPT.md`

---

### 2.1 Authentication

```
POST   /auth/login
  Body: { email, password }
  Response: { tempToken } | { tokens } (if MFA not enabled)

POST   /auth/mfa/verify
  Body: { tempToken, code }
  Response: { tokens: AuthTokens, user: User }

POST   /auth/refresh
  Body: { refreshToken }
  Response: { tokens: AuthTokens }

POST   /auth/logout
  Body: { refreshToken }
  Response: { success: true }

POST   /auth/forgot-password
  Body: { email }
  Response: { success: true }

POST   /auth/reset-password
  Body: { token, newPassword }
  Response: { success: true }

GET    /auth/me
  Response: { user: User }

POST   /auth/mfa/setup
  Response: { secret, qrCodeUrl }

POST   /auth/mfa/confirm
  Body: { code }
  Response: { success: true, backupCodes: string[] }

POST   /auth/pin/set
  Body: { pin: string (6 digits) }
  Response: { success: true }
```

---

### 2.2 Contractor Registration & Onboarding

```
POST   /public/register/contractor
  Body: ContractorRegistrationRequest
  Response: { userId, message: "Verification email sent" }

POST   /public/verify-email
  Body: { token }
  Response: { success: true }

GET    /admin/contractors/pending
  Role: SUPER_ADMIN, DEPARTMENT_ADMIN
  Response: PaginatedResponse<UserWithContractor>

POST   /admin/contractors/:userId/approve
  Role: SUPER_ADMIN, DEPARTMENT_ADMIN
  Body: { action: "APPROVE" | "REJECT", rejectionReason?: string }
  Response: { user: User }
```

---

### 2.3 Users & Roles

```
GET    /users
  Role: SUPER_ADMIN, DEPARTMENT_ADMIN, BRANCH_ADMIN
  Query: ?role=&status=&departmentId=&branchId=&search=&page=&limit=
  Response: PaginatedResponse<User>

GET    /users/:id
  Role: SUPER_ADMIN, DEPARTMENT_ADMIN, BRANCH_ADMIN, self
  Response: UserWithContractor

POST   /users
  Role: SUPER_ADMIN, DEPARTMENT_ADMIN, BRANCH_ADMIN, IT_ADMIN
  Body: StaffCreateRequest
  Response: User

PUT    /users/:id
  Role: SUPER_ADMIN, DEPARTMENT_ADMIN (own dept), self (limited fields)
  Body: Partial<StaffCreateRequest>
  Response: User

POST   /users/:id/suspend
  Role: SUPER_ADMIN, DEPARTMENT_ADMIN
  Body: { reason }
  Response: User

POST   /users/:id/activate
  Role: SUPER_ADMIN, DEPARTMENT_ADMIN
  Response: User

GET    /users/officers/available
  Role: SUPER_ADMIN, DEPARTMENT_ADMIN, BRANCH_ADMIN
  Query: ?role=&branchId=&stageId=
  Response: User[]  (for reassignment dropdowns)
```

---

### 2.4 Organisations, Departments, Branches

```
GET    /org/departments
  Response: Department[]

POST   /org/departments
  Role: SUPER_ADMIN
  Body: { name, code, description }
  Response: Department

GET    /org/departments/:id/branches
  Response: Branch[]

POST   /org/departments/:id/branches
  Role: SUPER_ADMIN, DEPARTMENT_ADMIN
  Body: { name, code, address, isHeadOffice }
  Response: Branch
```

---

### 2.5 Workflow Definitions (Admin)

```
GET    /workflows
  Role: SUPER_ADMIN, DEPARTMENT_ADMIN
  Query: ?departmentId=&status=&page=&limit=
  Response: PaginatedResponse<WorkflowDefinition>

GET    /workflows/:id
  Response: WorkflowDefinition (with stages)

POST   /workflows
  Role: SUPER_ADMIN, DEPARTMENT_ADMIN
  Body: { name, description, departmentId, metadataSchema, isPubliclyTrackable }
  Response: WorkflowDefinition

PUT    /workflows/:id
  Role: SUPER_ADMIN, DEPARTMENT_ADMIN (own dept)
  Body: Partial<WorkflowDefinition>
  NOTE: Updates create a new draft version; published version unaffected
  Response: WorkflowDefinition

POST   /workflows/:id/publish
  Role: SUPER_ADMIN, DEPARTMENT_ADMIN
  Response: WorkflowDefinition

POST   /workflows/:id/archive
  Role: SUPER_ADMIN, DEPARTMENT_ADMIN
  Response: WorkflowDefinition

POST   /workflows/:id/stages
  Role: SUPER_ADMIN, DEPARTMENT_ADMIN
  Body: WorkflowStageBuilderNode
  Response: WorkflowStage

PUT    /workflows/:id/stages/:stageId
  Body: Partial<WorkflowStageBuilderNode>
  Response: WorkflowStage

DELETE /workflows/:id/stages/:stageId
  Response: { success: true }

POST   /workflows/:id/stages/:stageId/routing-rules
  Body: StageRoutingRule
  Response: StageRoutingRule

PUT    /workflows/:id/stages/:stageId/parallel-config
  Body: ParallelStageConfig
  Response: ParallelStageConfig

POST   /workflows/:id/tracking-settings
  Role: SUPER_ADMIN, DEPARTMENT_ADMIN
  Body: PublicTrackingSettings
  Response: PublicTrackingSettings
```

---

### 2.6 File Submissions

```
GET    /files
  Role: all internal, contractors (own only)
  Query: ?status=&workflowId=&departmentId=&branchId=&contractorId=&assignedTo=
         &slaStatus=GREEN|AMBER|RED&search=&page=&limit=&sortBy=&sortDir=
  Response: PaginatedResponse<FileSubmission>

GET    /files/:id
  Response: FileSubmission (with currentStage, documents, recent comments)

GET    /files/:id/timeline
  Response: FileTimeline

POST   /files
  Role: CONTRACTOR
  Body: SubmissionCreateRequest
  Response: FileSubmission

GET    /files/my-desk
  Role: internal staff
  Query: ?page=&limit=&slaStatus=
  Response: PaginatedResponse<FileSubmission>  (files at my current stage)
```

---

### 2.7 File Stage Actions

All actions below require the file to be at the officer's assigned stage.

```
POST   /files/:id/actions/forward
  Role: ENTRY_DESK_OFFICER, SUB_ENGINEER, ENGINEER, SENIOR_ENGINEER
  Body: ForwardRequest
  Response: FileSubmission

POST   /files/:id/actions/reject
  Role: ENTRY_DESK_OFFICER, SUB_ENGINEER, ENGINEER, SENIOR_ENGINEER
  Body: RejectRequest
  Response: FileSubmission

POST   /files/:id/actions/hold
  Body: HoldRequest
  Response: FileSubmission

POST   /files/:id/actions/unhold
  Response: FileSubmission

POST   /files/:id/actions/query
  Body: QueryRequest
  Response: Comment

POST   /files/:id/actions/sign
  Role: ENGINEER, SENIOR_ENGINEER (per workflow config)
  Body: SignRequest
  Response: DigitalSignature

POST   /files/:id/actions/reassign
  Role: SUPER_ADMIN, DEPARTMENT_ADMIN, BRANCH_ADMIN
  Body: FileReassignRequest
  Response: FileStage
```

---

### 2.8 Parallel Approval Actions

```
POST   /files/:id/stages/:stageId/parallel-decision
  Role: ENGINEER (assigned parallel approver)
  Body: { decision: "APPROVED" | "REJECTED", comment, pin? }
  Response: ParallelApproval

GET    /files/:id/stages/:stageId/parallel-status
  Response: { approvals: ParallelApproval[], quorumMet: boolean, allDecided: boolean }
```

---

### 2.9 Documents

```
GET    /files/:id/documents
  Response: FileDocument[]

POST   /files/:id/documents
  Role: CONTRACTOR, internal officers (at current stage)
  Body: multipart/form-data { file, documentType, name, uploadNote }
  Response: { document: FileDocument, version: DocumentVersion }

GET    /files/:id/documents/:docId/versions
  Response: DocumentVersion[]

GET    /files/:id/documents/:docId/versions/:versionId/preview-url
  Response: { url: string, expiresAt: string }  (short-lived presigned URL)

GET    /files/:id/documents/:docId/versions/:versionId/download-url
  Response: { url: string, expiresAt: string }

GET    /files/:id/documents/:docId/diff
  Query: ?versionA=<versionId>&versionB=<versionId>
  Response: DocumentDiff
```

---

### 2.10 Comments & Queries

```
GET    /files/:id/comments
  Query: ?type=COMMENT|QUERY|QUERY_RESPONSE&visibleToContractor=true|false
  Response: Comment[]

POST   /files/:id/comments
  Body: { text, commentType, isVisibleToContractor, parentCommentId? }
  Response: Comment

POST   /files/:id/comments/:commentId/resolve
  Response: Comment

DELETE /files/:id/comments/:commentId
  Role: SUPER_ADMIN, author (within 5 min of creation only)
  Response: { success: true }
```

---

### 2.11 Notifications

```
GET    /notifications
  Query: ?read=true|false&type=&page=&limit=
  Response: PaginatedResponse<Notification>

GET    /notifications/unread-count
  Response: { count: number }

POST   /notifications/:id/read
  Response: Notification

POST   /notifications/read-all
  Response: { success: true }

PUT    /notifications/preferences
  Body: { disabledTypes: NotificationType[], smsEnabled: boolean, emailEnabled: boolean }
  Response: { success: true }
```

---

### 2.12 Reports & Analytics

```
GET    /reports/sla-dashboard
  Role: SUPER_ADMIN, DEPARTMENT_ADMIN, BRANCH_ADMIN
  Query: ?departmentId=&branchId=&workflowId=&dateRange=
  Response: AdminDashboard

GET    /reports/officer-workload
  Query: ?departmentId=&branchId=&dateRange=
  Response: OfficerWorkload[]

GET    /reports/sla-compliance
  Query: ?departmentId=&branchId=&workflowId=&dateRange=
  Response: { byStage: ..., byOfficer: ..., byDepartment: ... }

GET    /reports/file-flow/:submissionId
  Response: FileTimeline (full)

GET    /reports/pending-aging
  Query: ?departmentId=&branchId=&sortBy=oldest
  Response: PaginatedResponse<FileSubmission>

GET    /reports/custom
  Query: filter + columns as query params
  Response: PaginatedResponse<Record<string, unknown>>

POST   /reports/templates
  Role: SUPER_ADMIN
  Body: ReportTemplate
  Response: ReportTemplate

GET    /reports/templates
  Response: ReportTemplate[]

POST   /reports/export
  Body: { templateId?, filter: ReportFilter, columns: ReportColumn[], format: "PDF" | "EXCEL" }
  Response: { downloadUrl: string }
```

---

### 2.13 Digital Signature Verification (Public — No Auth)

```
GET    /public/verify/:signatureId
  Response: SignatureVerificationResult

GET    /public/track/:trackingNumber
  Response: PublicTrackingResult
```

---

### 2.14 Audit Log

```
GET    /audit
  Role: SUPER_ADMIN, DEPARTMENT_ADMIN
  Query: ?submissionId=&actorId=&action=&from=&to=&page=&limit=
  Response: PaginatedResponse<AuditLogEntry>

GET    /audit/verify-integrity
  Role: SUPER_ADMIN, IT_ADMIN
  Response: { isValid: boolean, lastVerifiedAt: string, failedRowId?: string }

POST   /audit/export
  Role: SUPER_ADMIN, DEPARTMENT_ADMIN
  Body: { submissionId?, dateRange?, format: "PDF" | "EXCEL" }
  Response: { downloadUrl: string }
```

---

### 2.15 SLA Configuration (Admin)

```
GET    /admin/working-calendars
  Response: WorkingCalendar[]

POST   /admin/working-calendars
  Role: SUPER_ADMIN, DEPARTMENT_ADMIN
  Body: { name, departmentId?, workingDays, branchId? }
  Response: WorkingCalendar

POST   /admin/working-calendars/:id/holidays
  Body: { holidayDate, name }
  Response: PublicHoliday
```

---

### 2.16 System Health (IT Admin Only)

```
GET    /system/health
  Role: IT_ADMIN, SUPER_ADMIN
  Response: { db: ok|err, minio: ok|err, redis: ok|err, rabbitmq: ok|err, clamav: ok|err }

GET    /system/storage-usage
  Role: IT_ADMIN
  Response: { totalBytes, usedBytes, availableBytes, percentUsed, byDepartment: [] }
```

---

## PART 3: WEBHOOK EVENTS (for future integrations)

If external systems need to receive GovFlow events:

```
Event: file.submitted         payload: { submissionId, trackingNumber, workflowName, contractorName }
Event: file.stage_changed     payload: { submissionId, fromStage, toStage, action, officerRole }
Event: file.approved          payload: { submissionId, trackingNumber, archivalReference }
Event: file.rejected          payload: { submissionId, rejectedToStage, reason }
Event: sla.breach             payload: { submissionId, stageName, daysOverSla, officerName }
Event: signature.applied      payload: { submissionId, signatureId, tier, verificationUrl }
```

---

*This document covers all RBAC rules and API contracts for GovFlow v1.0*
*Implement all RBAC checks in a Spring Security filter chain BEFORE any controller logic*
