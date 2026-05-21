# GovFlow Phase 1 — Implementation Plan

## Goal

Build the **foundational MVP** of GovFlow: authentication, RBAC, workflow engine core, file submission/tracking, audit trail, and a basic internal staff portal. This phase establishes the architecture, security patterns, and data model that all future phases build upon.

---

## Tech Stack (Confirmed)

| Layer | Technology |
|-------|-----------|
| Backend | NestJS 10 + TypeScript 5 |
| ORM | Prisma (PostgreSQL) |
| Frontend | React 18 + TypeScript + Vite |
| UI Library | Ant Design 5 |
| State | Zustand + TanStack Query v5 |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| File Storage | MinIO (Phase 2, stubbed in Phase 1) |
| Dev Environment | Docker Compose |
| Monorepo | npm workspaces |

---

## User Review Required

> [!IMPORTANT]
> **Shared validation with Zod**: I plan to create a shared `packages/shared` workspace containing Zod schemas for all DTOs. Both backend and frontend will import from this package — single source of truth for validation. This adds a small build step but eliminates validation drift.

> [!IMPORTANT]
> **Seeded roles vs. dynamic roles**: Phase 1 will seed the 10 roles from the blueprint as database records. The admin UI for creating custom roles is deferred to Phase 2. Confirm this is acceptable.

> [!WARNING]
> **No file upload in Phase 1**: File submission in Phase 1 tracks metadata only (submission record, workflow assignment, stage progression). Actual file upload with MinIO, virus scanning, and chunked upload is Phase 2. We'll stub the upload endpoint to accept metadata and return a mock storage path.

---

## Open Questions

1. **Nepali calendar support**: Should SLA calculations use the Bikram Sambat (BS) calendar, or is Gregorian sufficient for Phase 1?
2. **Default admin credentials**: For the initial Super Admin seed, should we use a CLI-based setup wizard on first boot, or a hardcoded default that must be changed?
3. **Port preferences**: Any constraints on ports for the dev environment (default: API on 3001, Frontend on 5173, PostgreSQL on 5432, Redis on 6379)?

---

## Proposed Changes

### Project Structure (Monorepo)

```
govflow/
├── docker-compose.yml
├── package.json                  # Root workspace config
├── packages/
│   └── shared/                   # Shared types, Zod schemas, constants
│       ├── src/
│       │   ├── schemas/          # Zod validation schemas (auth, workflow, file)
│       │   ├── types/            # TypeScript interfaces & enums
│       │   └── constants/        # Role definitions, status enums, config
│       └── package.json
├── apps/
│   ├── api/                      # NestJS backend
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── common/           # Guards, interceptors, filters, decorators
│   │   │   ├── auth/             # Auth module (login, register, JWT, MFA stub)
│   │   │   ├── users/            # User CRUD, role assignment
│   │   │   ├── rbac/             # RBAC guard, permission definitions
│   │   │   ├── workflows/        # Workflow definitions, stages, routing
│   │   │   ├── submissions/      # File submissions, stage progression
│   │   │   ├── audit/            # Audit log service (hash-chained)
│   │   │   └── prisma/           # Prisma service, migrations, seed
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts
│   │   └── package.json
│   └── web/                      # React frontend (Vite)
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── routes/
│       │   ├── components/       # Shared UI components
│       │   ├── layouts/          # Dashboard layout, public layout
│       │   ├── pages/
│       │   │   ├── auth/         # Login, register (contractor)
│       │   │   ├── dashboard/    # Role-scoped dashboard
│       │   │   ├── workflows/    # Workflow list, detail view
│       │   │   ├── submissions/  # Submit file, view submissions
│       │   │   ├── admin/        # User management, role assignment
│       │   │   └── audit/        # Audit log viewer
│       │   ├── hooks/            # Custom hooks (useAuth, useRBAC)
│       │   ├── stores/           # Zustand stores
│       │   └── lib/              # API client, utils
│       └── package.json
└── .env.example
```

---

### Component 1: Infrastructure & Scaffolding

#### [NEW] docker-compose.yml
- PostgreSQL 16 service with volume persistence
- Redis 7 service
- Healthchecks on both services
- Network isolation

#### [NEW] package.json (root)
- npm workspaces configuration pointing to `packages/*` and `apps/*`
- Shared dev scripts: `dev`, `build`, `lint`, `db:migrate`, `db:seed`

#### [NEW] packages/shared/
- Zod schemas for: `LoginSchema`, `RegisterSchema`, `CreateWorkflowSchema`, `CreateSubmissionSchema`, `ForwardFileSchema`, `RejectFileSchema`
- TypeScript enums: `Role`, `SubmissionStatus`, `StageType`, `StageAction`, `AuditAction`
- Shared constants: role hierarchy map, permission matrix

---

### Component 2: Database Schema (Prisma)

#### [NEW] apps/api/prisma/schema.prisma

Core tables for Phase 1:

```prisma
model Organisation {
  id        String   @id @default(uuid())
  name      String
  departments Department[]
  createdAt DateTime @default(now())
}

model Department {
  id             String   @id @default(uuid())
  name           String
  organisationId String
  organisation   Organisation @relation(fields: [organisationId])
  branches       Branch[]
  workflows      WorkflowDefinition[]
}

model Branch {
  id           String   @id @default(uuid())
  name         String
  departmentId String
  department   Department @relation(fields: [departmentId])
  users        User[]
  submissions  FileSubmission[]
}

model User {
  id            String   @id @default(uuid())
  email         String   @unique
  passwordHash  String
  firstName     String
  lastName      String
  role          Role     @default(CONTRACTOR)
  departmentId  String?
  branchId      String?
  status        UserStatus @default(PENDING)
  signaturePin  String?  // Hashed 6-digit PIN for Tier 1 signing
  mfaSecret     String?  // TOTP secret (Phase 2 enforcement)
  mfaEnabled    Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model WorkflowDefinition {
  id           String   @id @default(uuid())
  name         String
  description  String?
  departmentId String
  version      Int      @default(1)
  status       WorkflowStatus @default(DRAFT)
  stages       WorkflowStage[]
  submissions  FileSubmission[]
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model WorkflowStage {
  id               String   @id @default(uuid())
  workflowId       String
  name             String
  stageOrder       Int
  stageType        StageType @default(SEQUENTIAL)
  assignedRole     Role
  slaDays          Int      @default(3)
  allowedActions   String[] // ["forward","reject","hold","comment","sign"]
  requiredDocs     String[] // Document type names required at this stage
  routingRules     StageRoutingRule[]
  parallelConfig   ParallelStageConfig?
  workflow         WorkflowDefinition @relation(fields: [workflowId])
}

model ParallelStageConfig {
  id           String @id @default(uuid())
  stageId      String @unique
  strategy     ParallelStrategy // ALL_MUST_APPROVE | QUORUM
  quorumCount  Int?
  stage        WorkflowStage @relation(fields: [stageId])
}

model StageRoutingRule {
  id             String @id @default(uuid())
  stageId        String
  conditionField String
  operator       String // "gt","lt","eq","contains"
  value          String
  targetStageId  String
  stage          WorkflowStage @relation(fields: [stageId])
}

model FileSubmission {
  id               String   @id @default(uuid())
  trackingNumber   String   @unique // e.g., "2024-PWD-0042"
  contractorId     String
  workflowId       String
  workflowVersion  Int
  branchId         String
  status           SubmissionStatus @default(SUBMITTED)
  currentStageId   String?
  title            String
  description      String?
  metadata         Json?    // Flexible key-value for workflow-specific data
  fileStages       FileStage[]
  comments         Comment[]
  auditLogs        AuditLog[]
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}

model FileStage {
  id           String   @id @default(uuid())
  submissionId String
  stageId      String
  assignedTo   String?  // Officer user ID
  status       FileStageStatus @default(PENDING)
  startedAt    DateTime @default(now())
  completedAt  DateTime?
  slaDueAt     DateTime
  submission   FileSubmission @relation(fields: [submissionId])
  parallelApprovals ParallelApproval[]
}

model ParallelApproval {
  id          String   @id @default(uuid())
  fileStageId String
  officerId   String
  decision    String?  // "approved" | "rejected" | null (pending)
  comment     String?
  signedAt    DateTime?
  fileStage   FileStage @relation(fields: [fileStageId])
}

model Comment {
  id           String   @id @default(uuid())
  submissionId String
  stageId      String?
  authorId     String
  text         String
  commentType  CommentType @default(COMMENT) // COMMENT | QUERY | RESPONSE
  submission   FileSubmission @relation(fields: [submissionId])
  createdAt    DateTime @default(now())
}

model AuditLog {
  id            String   @id @default(uuid())
  submissionId  String?
  actorId       String
  action        String   // e.g., "FILE_SUBMITTED", "STAGE_FORWARDED"
  metadata      Json     // Flexible payload
  ipAddress     String
  previousHash  String   // Hash of previous audit row (chain integrity)
  rowHash       String   // Hash of this row's content
  submission    FileSubmission? @relation(fields: [submissionId])
  createdAt     DateTime @default(now())

  @@index([submissionId])
  @@index([actorId])
  @@index([createdAt])
}
```

#### [NEW] apps/api/prisma/seed.ts
- Seed default Organisation, Department, Branch
- Seed Super Admin user (password must be changed on first login)
- Seed all 10 roles with permission definitions
- Seed 2-3 sample workflow definitions with stages for testing

---

### Component 3: Authentication Module

#### [NEW] apps/api/src/auth/
- **POST `/api/auth/login`** — email + password → JWT access token (15 min) + refresh token (8 hr, HTTP-only cookie)
- **POST `/api/auth/register`** — contractor self-registration → status = PENDING
- **POST `/api/auth/refresh`** — rotate refresh token, issue new access token
- **POST `/api/auth/logout`** — invalidate refresh token in Redis blacklist
- **JWT strategy** using Passport.js with RS256 signing (asymmetric keys)
- **Rate limiting**: 5 login attempts per 15 minutes per IP (via `@nestjs/throttler`)
- Password hashing: bcrypt with cost factor 12
- MFA field stored but not enforced in Phase 1 (structure ready for Phase 2 TOTP)

---

### Component 4: RBAC System

#### [NEW] apps/api/src/rbac/
- **`RolesGuard`** — NestJS guard that reads `@Roles()` decorator and checks against user's JWT role
- **`PermissionsGuard`** — checks granular permissions (e.g., `submission:forward`, `workflow:create`)
- **Permission matrix** defined in `packages/shared`:

```typescript
// Simplified permission matrix
const PERMISSIONS = {
  SUPER_ADMIN: ['*'],  // All permissions
  DEPARTMENT_ADMIN: ['workflow:*', 'user:manage_dept', 'submission:*', 'report:dept'],
  BRANCH_ADMIN: ['submission:reassign_branch', 'report:branch'],
  SENIOR_ENGINEER: ['submission:review', 'submission:sign', 'submission:forward', 'submission:reject_any'],
  ENGINEER: ['submission:review', 'submission:approve', 'submission:reject_prev', 'submission:comment'],
  SUB_ENGINEER: ['submission:review', 'submission:forward', 'submission:reject_prev', 'submission:query'],
  ENTRY_DESK: ['submission:intake', 'submission:verify', 'submission:forward', 'submission:return'],
  CONTRACTOR: ['submission:create', 'submission:upload', 'submission:view_own'],
  CITIZEN: ['submission:track_public'],
  IT_ADMIN: ['system:config'],
} as const;
```

- **Scope guard**: validates the user's department/branch matches the resource they're accessing
- Every role change writes to `AuditLog`

---

### Component 5: Workflow Engine (Core)

#### [NEW] apps/api/src/workflows/
- **GET `/api/workflows`** — list workflow definitions (scoped by dept)
- **GET `/api/workflows/:id`** — full workflow with stages, rules
- **POST `/api/workflows`** — create workflow definition (Dept Admin+)
- **PUT `/api/workflows/:id`** — update (creates new version, old version frozen)
- **Workflow versioning**: on edit, increment version, snapshot current for in-flight files

#### [NEW] apps/api/src/submissions/
- **POST `/api/submissions`** — contractor submits a file (creates submission + first FileStage)
- **GET `/api/submissions`** — list submissions (scoped: contractor sees own, officer sees assigned stage)
- **GET `/api/submissions/:id`** — full detail with stage history
- **POST `/api/submissions/:id/forward`** — move file to next stage (validates current stage, role, required docs)
- **POST `/api/submissions/:id/reject`** — reject to a target stage (validates target is a prior stage, requires comment)
- **POST `/api/submissions/:id/hold`** — hold file with reason
- **POST `/api/submissions/:id/comment`** — add comment/query
- **GET `/api/submissions/track/:trackingNumber`** — public tracking (sanitized response, no officer names)

**Stage progression logic:**
1. Validate officer is assigned to current stage and has the action permission
2. Validate required documents are present (metadata check in Phase 1)
3. Create new `FileStage` for the target stage
4. Update `FileSubmission.currentStageId`
5. Calculate SLA due date (current date + stage.slaDays working days)
6. Write `AuditLog` entry with hash chain
7. Return updated submission

**Tracking number generation:** `YYYY-DEPT_CODE-NNNN` (e.g., `2026-PWD-0001`), auto-incrementing per department per year.

---

### Component 6: Audit Trail (Hash-Chained)

#### [NEW] apps/api/src/audit/
- **`AuditService.log()`** — core method called by all other services:
  1. Fetch the last audit row's `rowHash`
  2. Construct payload: `{ submissionId, actorId, action, metadata, ipAddress, timestamp }`
  3. Set `previousHash` = last row's `rowHash`
  4. Compute `rowHash` = SHA-256 of `(previousHash + JSON.stringify(payload))`
  5. Insert row (append-only — no UPDATE or DELETE on this table)
- **GET `/api/audit/submission/:id`** — view audit trail for a file (Super Admin, Dept Admin, assigned officers)
- **GET `/api/audit/verify`** — verify chain integrity (Super Admin / IT Admin only)
- Database-level protection: revoke UPDATE/DELETE on `audit_log` table for the application DB user

---

### Component 7: Frontend — Internal Staff Portal

#### [NEW] apps/web/

**Pages:**

| Route | Page | Access |
|-------|------|--------|
| `/login` | Login page | Public |
| `/register` | Contractor registration | Public |
| `/dashboard` | Role-scoped dashboard | All authenticated |
| `/submissions` | Submission list (scoped) | All authenticated |
| `/submissions/new` | Create submission form | Contractor |
| `/submissions/:id` | Submission detail + actions | Scoped by role/stage |
| `/submissions/:id/timeline` | Visual audit timeline | Scoped |
| `/workflows` | Workflow definitions list | Dept Admin+ |
| `/workflows/:id` | Workflow detail view | Dept Admin+ |
| `/admin/users` | User management | Super Admin, Dept Admin |
| `/track` | Public tracking (no auth) | Public |

**Key UI components:**
- `DashboardLayout` — sidebar nav, top bar with notifications bell, user menu
- `SubmissionTimeline` — vertical timeline showing all audit events for a file
- `StageActionBar` — contextual action buttons (Forward, Reject, Hold, Comment) based on user's role and current stage
- `WorkflowDiagram` — read-only flow visualization of workflow stages (using a simple DAG renderer)
- `RoleBadge`, `StatusTag`, `SLAIndicator` — reusable display components

**Design system:**
- Dark sidebar + light content area
- Color palette: deep navy primary (#1B2A4A), teal accent (#0891B2), amber warning, red danger
- Ant Design theme customization via `ConfigProvider`
- Responsive down to tablet (government offices may use tablets)

---

### Component 8: Security Hardening (Cross-Cutting)

Applied across all components:

- **Helmet middleware** — CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- **CORS** — strict origin whitelist
- **Global validation pipe** — all DTOs validated via class-validator + Zod
- **Global exception filter** — never leak stack traces or internal errors to client
- **Request logging interceptor** — log method, path, user, duration (not body for security)
- **SQL injection prevention** — Prisma parameterized queries only, no raw SQL
- **XSS prevention** — input sanitization via `sanitize-html` on all text fields
- **Rate limiting** — `@nestjs/throttler` with Redis store

---

## Verification Plan

### Automated Tests

```bash
# Unit tests (backend)
npm run test --workspace=apps/api

# E2E tests (backend API)
npm run test:e2e --workspace=apps/api

# Lint + type check (all workspaces)
npm run lint
npm run typecheck
```

**Key test cases for Phase 1:**
- Auth: login, register, refresh, rate limiting, invalid credentials
- RBAC: role-based access denial, scope checking (can't access other dept's files)
- Workflow: create definition, stage ordering, version increment
- Submission: create, forward through stages, reject to prior, hold
- Audit: hash chain integrity, append-only enforcement, verify endpoint
- Security: SQL injection attempts, XSS payloads, oversized inputs

### Manual Verification
- Walk through contractor registration → submission → stage progression → approval flow in the browser
- Verify dashboard shows correct data per role (login as different roles)
- Verify audit timeline renders correctly
- Verify public tracking page works without auth
- Test with multiple concurrent users via browser tabs

### Browser Testing
- Use the browser tool to navigate the full flow end-to-end
- Screenshot each major page for visual verification
- Verify responsive layout on smaller viewport

---

## Execution Order

1. **Scaffolding** — monorepo, Docker Compose, project init
2. **Shared package** — types, enums, Zod schemas
3. **Database** — Prisma schema, migrations, seed
4. **Auth module** — JWT, login/register, guards
5. **RBAC module** — roles guard, permissions guard, scope guard
6. **Audit module** — hash-chained logging service
7. **Workflow module** — CRUD for definitions and stages
8. **Submission module** — create, forward, reject, hold, track
9. **Frontend shell** — Vite + React + Ant Design + routing + auth pages
10. **Frontend dashboard** — role-scoped views, submission list, detail, timeline
11. **Security hardening** — helmet, CORS, rate limiting, validation
12. **Testing & verification**
