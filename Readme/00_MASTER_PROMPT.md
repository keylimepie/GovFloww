# GovFlow — AI Coding Master Context Prompt
## Paste this at the start of every new AI coding session

---

## WHAT YOU ARE BUILDING

You are building **GovFlow** — an on-premise, enterprise-grade government document and workflow management system. It digitalises the complete lifecycle of government file processing: contractor submission → multi-stage approvals → digital signing → archival.

This system must be production-ready, secure, auditable, and maintainable by a government IT team.

---

## TECH STACK (NON-NEGOTIABLE)

### Backend
- **Runtime:** Java 17 + Spring Boot 3.x
- **ORM:** Spring Data JPA + Hibernate
- **Auth:** Spring Security + JWT (15-min access token, 8-hour refresh token)
- **MFA:** TOTP (Google Authenticator) + SMS OTP fallback
- **LDAP:** Spring LDAP for AD integration (optional, fallback to internal auth)
- **Background jobs:** Spring Batch + Quartz Scheduler
- **Message queue:** RabbitMQ (notifications, async processing)
- **Cache:** Redis 7 (sessions, rate limiting, dashboard cache)
- **Search:** PostgreSQL Full-Text Search initially → Elasticsearch later
- **PDF signing:** Apache PDFBox + Bouncy Castle
- **File scanning:** ClamAV (via REST API or Java bindings)
- **Storage client:** MinIO Java SDK (S3-compatible)

### Frontend
- **Framework:** React 18 + TypeScript
- **Build:** Vite
- **UI library:** Ant Design 5.x
- **State:** Zustand
- **Data fetching:** TanStack Query (React Query v5)
- **Routing:** React Router v6
- **Charts:** Apache ECharts
- **PDF viewer:** PDF.js (Mozilla)
- **Forms:** React Hook Form + Zod validation
- **Public tracking page:** Next.js 14 (separate app, SSR)

### Database & Storage
- **Primary DB:** PostgreSQL 16
- **File storage:** MinIO (S3-compatible, on-premise)
- **Cache/Queue:** Redis 7 + RabbitMQ 3.x

### Infrastructure
- **Containerisation:** Docker + Docker Compose
- **Reverse proxy:** Nginx
- **Monitoring:** Prometheus + Grafana
- **Logs:** ELK Stack
- **Secrets:** HashiCorp Vault (or environment config for dev)

---

## PROJECT STRUCTURE

```
govflow/
├── backend/
│   ├── src/main/java/com/govflow/
│   │   ├── auth/           # JWT, MFA, LDAP, session management
│   │   ├── users/          # User CRUD, role management, contractor onboarding
│   │   ├── workflows/      # Workflow engine, DAG, stage routing
│   │   ├── files/          # File submission, stage tracking, assignment
│   │   ├── documents/      # Upload, versioning, virus scan, preview URLs
│   │   ├── signatures/     # Tier 1 PIN + Tier 2 crypto signing
│   │   ├── audit/          # Immutable audit log with hash chaining
│   │   ├── notifications/  # Email, SMS, in-app notifications
│   │   ├── sla/            # SLA monitoring, alerts, escalation
│   │   ├── reports/        # Report generation, export PDF/Excel
│   │   ├── admin/          # Workflow builder, user management APIs
│   │   └── common/         # Shared utilities, exceptions, DTOs
│   └── src/main/resources/
│       ├── application.yml
│       └── db/migration/   # Flyway migrations
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── auth/       # Login, MFA, forgot password
│   │   │   ├── dashboard/  # Role-specific home dashboards
│   │   │   ├── files/      # File list, detail, timeline view
│   │   │   ├── stage/      # Stage action panel (forward/reject/sign)
│   │   │   ├── documents/  # Viewer, version comparison
│   │   │   ├── admin/      # Workflow builder, user management
│   │   │   └── reports/    # Reports, SLA dashboard, analytics
│   │   ├── components/     # Shared UI components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── stores/         # Zustand state stores
│   │   ├── api/            # API client functions
│   │   └── types/          # TypeScript types (import from 02_TYPESCRIPT_TYPES.ts)
│   └── public/
└── public-tracker/         # Next.js public tracking portal
    └── src/
        └── app/
            ├── page.tsx    # Tracking number input
            └── track/[id]/ # Status display page
```

---

## CORE SYSTEM RULES (ENFORCE THESE EVERYWHERE)

### 1. Authentication & Session
- Every API endpoint (except `/auth/**`, `/public/**`, `/verify/**`) requires a valid JWT
- MFA is mandatory for all internal staff roles; optional for contractors
- JWT payload must include: `userId`, `role`, `departmentId`, `branchId`, `sessionId`
- On suspicious activity (IP change during session), force re-login

### 2. Authorisation (RBAC — 4 checks on every file request)
When any user tries to act on a file, the system MUST verify:
1. **Authentication** — is the JWT valid and not expired?
2. **Role permission** — does their role allow this action type?
3. **Stage ownership** — is the file currently at a stage assigned to their role?
4. **Scope** — does the file belong to their department and branch?

A Sub Engineer CANNOT see a file at the Engineer stage.
A Department Admin CANNOT see files from another department.
Contractors CANNOT see each other's files.

### 3. Audit Log
- EVERY state-changing action writes an immutable audit log entry
- Audit log uses SHA-256 hash chaining (each row hashes previous row's hash)
- The audit log table is append-only — no UPDATE or DELETE ever
- Audit records include: actor, action, timestamp, IP, device fingerprint, document hash

### 4. File Lifecycle
- Every file has exactly ONE active stage at any time
- Moving a file to a new stage creates a new `file_stages` record; old record is completed
- All stage transitions are logged in the audit trail
- Files cannot skip forward past their workflow definition

### 5. Document Management
- Every uploaded document is virus-scanned BEFORE being made accessible
- Each upload creates a new `document_versions` record; old versions are preserved
- File hash (SHA-256) is calculated on upload and stored
- Documents are watermarked on-the-fly when viewed (name + role + timestamp + IP)

### 6. Notifications
- Notifications are queued via RabbitMQ and processed asynchronously
- Email delivery uses JavaMailSender; SMS via configurable HTTP gateway
- SLA alerts are triggered by a Quartz job running every 15 minutes
- Critical alerts (SLA breach) cannot be suppressed by user preferences

### 7. Workflow Engine
- Workflows are defined as a Directed Acyclic Graph (DAG)
- Stage routing uses configurable conditions evaluated at forward-time
- Parallel stages are groups: strategy is ALL_MUST_APPROVE or QUORUM (N of M)
- In-flight files always follow the workflow version they were submitted under
- When a workflow is updated, only new submissions use the new version

---

## ENVIRONMENT VARIABLES (application.yml structure)

```yaml
govflow:
  jwt:
    secret: ${JWT_SECRET}
    access-expiry-minutes: 15
    refresh-expiry-hours: 8
  mfa:
    issuer: "GovFlow"
    totp-enabled: true
    sms-fallback-enabled: true
  storage:
    minio:
      endpoint: ${MINIO_ENDPOINT:http://minio:9000}
      access-key: ${MINIO_ACCESS_KEY}
      secret-key: ${MINIO_SECRET_KEY}
      bucket: govflow-documents
  antivirus:
    clamav-host: ${CLAMAV_HOST:clamav}
    clamav-port: 3310
  email:
    smtp-host: ${SMTP_HOST}
    smtp-port: ${SMTP_PORT:587}
    from-address: noreply@govflow.gov.np
  sms:
    gateway-url: ${SMS_GATEWAY_URL}
    api-key: ${SMS_API_KEY}
  sla:
    check-interval-minutes: 15
  signature:
    tier2:
      keystore-path: ${KEYSTORE_PATH}
      keystore-password: ${KEYSTORE_PASSWORD}

spring:
  datasource:
    url: jdbc:postgresql://${DB_HOST:postgres}:5432/govflow
    username: ${DB_USER}
    password: ${DB_PASS}
  jpa:
    hibernate:
      ddl-auto: validate  # Use Flyway for migrations
  flyway:
    enabled: true
  redis:
    host: ${REDIS_HOST:redis}
    port: 6379
  rabbitmq:
    host: ${RABBITMQ_HOST:rabbitmq}
    port: 5672
```

---

## API RESPONSE FORMAT (always use this structure)

```json
// Success
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "limit": 20, "total": 150 }
}

// Error
{
  "success": false,
  "error": {
    "code": "FILE_NOT_AT_YOUR_STAGE",
    "message": "You are not authorised to act on this file at its current stage",
    "details": {}
  }
}
```

---

## ERROR CODES TO IMPLEMENT

| Code | HTTP | Meaning |
|------|------|---------|
| `AUTH_INVALID_CREDENTIALS` | 401 | Wrong email/password |
| `AUTH_MFA_REQUIRED` | 403 | Valid password but MFA not verified |
| `AUTH_TOKEN_EXPIRED` | 401 | JWT expired |
| `AUTH_INSUFFICIENT_ROLE` | 403 | Role not permitted for this action |
| `FILE_NOT_AT_YOUR_STAGE` | 403 | File is not at a stage assigned to this user |
| `FILE_NOT_IN_YOUR_SCOPE` | 403 | File belongs to different dept/branch |
| `FILE_WRONG_STATUS` | 409 | File status does not allow this action |
| `WORKFLOW_STAGE_MISMATCH` | 422 | Routing target stage invalid |
| `DOCUMENT_VIRUS_DETECTED` | 422 | Uploaded file failed AV scan |
| `DOCUMENT_NOT_FOUND` | 404 | Document ID does not exist |
| `SLA_CONFIGURATION_ERROR` | 422 | Invalid SLA configuration |
| `SIGNATURE_INVALID_PIN` | 401 | Incorrect signing PIN |
| `SIGNATURE_ALREADY_SIGNED` | 409 | Document already has final signature |
| `AUDIT_INTEGRITY_ERROR` | 500 | Hash chain verification failure (CRITICAL) |

---

## WHEN GENERATING CODE, ALWAYS:

1. Use constructor injection (not field injection) for all Spring beans
2. Never put business logic in controllers — use Service → Repository pattern
3. Use `@Transactional` on service methods that modify multiple tables
4. Log with SLF4J; include correlation ID in every log line
5. Use `Optional<T>` instead of returning null
6. Validate all DTOs with `@Valid` and Bean Validation annotations
7. Write a Flyway migration for every schema change
8. Write unit tests for all service-layer business logic
9. Use TypeScript strict mode; no `any` types in frontend
10. All API calls in frontend go through the `/api` service layer, never direct fetch in components

---

*This file is the master context for all GovFlow coding sessions.*
*Reference 01_DATABASE_SCHEMA.sql, 02_TYPESCRIPT_TYPES.ts, 03_WORKFLOW_CONFIGS.json, and 04_API_SPECIFICATION.md for detailed specs.*
