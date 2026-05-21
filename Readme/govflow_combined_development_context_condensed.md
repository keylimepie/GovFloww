# GovFlow — Combined Development Context (Condensed)

## Project Overview
GovFlow is an enterprise-grade government document workflow management platform for multi-department and multi-branch deployments. It handles:
- Contractor submissions
- Multi-stage workflow approvals
- Parallel approvals
- Audit logging
- Digital signatures
- SLA monitoring
- Notifications
- Public tracking
- Document versioning and storage

Target characteristics:
- 1000+ concurrent users
- On-premise deployment
- Government security requirements
- Tamper-proof audit trail
- RBAC with department and branch scoping
- Offline-tolerant branch architecture

---

# Current Tech Stack

## Monorepo
- npm workspaces
- apps/api → NestJS backend
- apps/web → React + Vite frontend
- packages/shared → shared TS types + schemas

## Backend
- NestJS
- Prisma ORM
- PostgreSQL
- Redis
- BullMQ
- MinIO (S3-compatible object storage)
- JWT authentication
- Zod shared validation

## Frontend
- React 18
- TypeScript
- Ant Design
- Zustand
- TanStack Query

---

# Major Completed Features

## Phase 1 — Core Platform

### Authentication
Implemented:
- JWT authentication
- Contractor self-registration
- Role-aware login
- Refresh token flow groundwork
- Seeded Super Admin account

Security direction:
- Moving away from localStorage tokens toward httpOnly cookie flow
- Environment validation planned/enforced for production

### RBAC (Role Based Access Control)
Implemented:
- Dynamic DB-backed roles
- Permission system
- Department and branch scoped access
- Role management UI
- Hierarchy levels
- Guards/decorators in NestJS

Important fix completed:
- `hierarchyLevel` type mismatch fixed by explicit Number conversion on frontend and backend.

### Workflow Engine
Implemented:
- Workflow definitions
- Stage definitions
- Sequential stages
- Parallel stages
- Workflow versioning foundations
- Submission routing
- Reject/forward logic
- Timeline tracking

Parallel approvals now support:
- ALL_MUST_APPROVE
- QUORUM

Logic:
- Approvals are recorded independently.
- Workflow advances only when strategy conditions are satisfied.

### Submissions
Implemented:
- Submission creation
- Submission tracking
- Assignment
- Comments
- Forward/reject/hold actions
- Public tracking number support

### Audit Trail
Implemented:
- Immutable-style audit events
- Timeline visualization
- Hash-chain groundwork

Security concern identified:
- Need transaction/concurrency hardening to prevent audit-chain corruption under simultaneous writes.

---

# Phase 2 Completed Features

## Document Management
Implemented:
- MinIO integration
- Multipart uploads
- Presigned URLs
- Submission document attachments
- Document listing
- Browser preview support groundwork

Known security hardening still required:
- MIME validation
- Magic-byte validation
- Virus scanning integration (ClamAV planned)
- Download authorization tightening
- Audit logging for downloads

### Important Fix
Issue:
- `uuid` package caused `ERR_REQUIRE_ESM` crash because latest uuid is ESM-only while NestJS compiled CommonJS.

Fix:
- Replaced `uuid` dependency usage with native `crypto.randomUUID()`.

Effect:
- Backend crash resolved.
- Vite proxy `ECONNREFUSED` issue disappeared after backend recovery.

---

## SLA Monitoring
Implemented:
- BullMQ integration
- Redis-backed queues
- Scheduled SLA checks
- SLA breach detection
- Alert creation

Cron behavior:
- Periodic scan for overdue stages
- Creates SLA alert records
- Dispatches notifications

Planned improvement:
- Bikram Sambat-aware SLA calendar logic
- Government holiday support

---

## Notifications
Implemented:
- Notifications module
- Notification API
- Notification bell UI
- Unread badge
- Mark-as-read behavior
- SLA breach notifications

Future work:
- Email notifications
- SMS integration
- Real-time websocket updates

---

# Frontend State

## Current Structure
Frontend currently contains:
- Dashboard
- Submission list/detail
- Workflow management
- Role management
- Notification UI
- Upload UI
- Timeline UI
- Public tracking

Observation:
A large amount of frontend logic still exists inside a very large `App.tsx`.

Recommended refactor:
- Modularize into:
  - layouts/
  - pages/
  - features/
  - hooks/
  - api/
  - components/
  - shared/

---

# Security Stabilization Sprint (Current Priority)

A major planning shift occurred after reviewing the codebase.

Conclusion:
The platform already has substantial functionality, but before adding more blueprint features, the project must undergo a security stabilization and verification sprint.

Reason:
This will be deployed on a public government server.

---

# Stabilization Priorities

## 1. Repository Safety
Completed:
- Git repository initialized
- Baseline commit created

Need:
- Enforce `.env` hygiene
- Ensure secrets never committed
- Add production environment validation

---

## 2. Backend Hardening

### Required Environment Validation
Need:
- Fail startup if critical env vars missing:
  - JWT secrets
  - DB URL
  - Redis URL
  - MinIO credentials
  - Seed credentials

### Auth Hardening
Direction:
- Replace localStorage token persistence
- Use httpOnly secure cookies
- Tighten refresh-token handling

### Permission Hardening
Need explicit permission decorators for:
- forward
- reject
- hold
- comment
- sign
- upload
- download

### Upload Hardening
Need:
- MIME validation
- Magic byte validation
- File size enforcement
- Virus scanning
- Quarantine flow

### Signature Integrity Issue
Critical issue discovered:
Current signature verification partially depends on mutable submission data (`updatedAt`).

Need:
- Immutable signing payload
- Stable document hash
- Signature verification independent of future edits

### Audit Concurrency
Need:
- Transaction-safe append-only audit writes
- Hash-chain protection during concurrent requests

---

## 3. Frontend Hardening

Need:
- Tight role-aware UI hiding
- Better upload errors
- Better signature UX
- Sanitized public verification views
- Stronger auth persistence strategy

---

## 4. Deployment Hardening

Need:
- Production Dockerfiles
- Production compose profile
- Reverse proxy assumptions
- TLS setup
- Backup/restore documentation
- Health endpoints

Health checks planned:
- API
- PostgreSQL
- Redis
- MinIO

---

# Testing Gap (Critical)

Current status:
- Typecheck passes
- Very limited/no real automated tests existed initially

Need:

## Backend Unit Tests
- Auth flows
- Permission guards
- Submission access scoping
- Upload authorization
- Signature verification
- Audit integrity

## API E2E Tests
- Contractor workflow
- Staff approval flow
- Public tracking
- Public signature verification

## Frontend Tests
- Login
- Submission pages
- Upload flow
- Notifications
- Signature modal

Acceptance criteria:
- `npm run typecheck` passes
- `npm run build` passes
- Real tests exist and pass
- No stack traces or secret leakage in responses

---

# Architecture Notes

## Workflow Engine Design
- DAG-based workflow system
- Versioned workflow definitions
- Snapshot workflows for in-flight submissions
- Future drag-and-drop workflow builder planned

## Parallel Approval Logic
Current logic:
- Parallel approvals stored independently.
- Threshold evaluation after each approval.
- Auto-progression after threshold reached.
- Rejection escalation path planned.

---

# Known Operational Issues Encountered

## 1. ECONNREFUSED from Vite
Root cause:
- NestJS API crashed.

Actual issue:
- ESM/CommonJS incompatibility from `uuid` package.

Fix:
- Use `crypto.randomUUID()`.

---

## 2. Prisma Int/String Error
Error:
`Argument hierarchyLevel: Invalid value provided. Expected Int, provided String.`

Fix:
- Explicit numeric conversion in frontend and backend.

---

# Current Functional Status

Working:
- Authentication
- RBAC
- Role management
- Workflow management
- Submission management
- Parallel approvals
- Notifications
- SLA monitoring
- Document uploads
- MinIO integration
- Public tracking
- Audit timeline

Partially complete / needs hardening:
- Digital signatures
- Audit chain immutability
- Upload validation
- Public verification
- Production auth strategy
- Deployment readiness
- Test coverage

Not yet implemented from blueprint:
- Full workflow builder canvas
- Advanced reporting
- Full contractor portal experience
- Citizen portal expansion
- Offline branch sync
- HSM-backed cryptographic signatures
- Document diffing
- ClamAV integration
- Advanced analytics
- Multi-node synchronization
- BS calendar holiday SLA engine

---

# Recommended Immediate Next Steps

## Priority 1 — Security Stabilization
Before any new features:
1. Complete env validation
2. Harden auth cookies
3. Harden uploads
4. Harden signatures
5. Harden audit-chain writes
6. Add health checks
7. Add automated tests

## Priority 2 — Production Readiness
1. Production Docker setup
2. Reverse proxy + TLS
3. Backups
4. Monitoring/logging
5. Error sanitization

## Priority 3 — Feature Expansion
Only after stabilization:
1. Advanced workflow builder
2. Reporting
3. Contractor portal enhancements
4. Public portal expansion
5. Digital signature Tier 2
6. BS calendar SLA logic

---

# Important Development Constraints

## Security Rules
- No raw SQL
- Strict validation everywhere
- Least privilege RBAC
- Signed/audited actions only
- No unrestricted presigned URLs
- No secrets in repo

## Deployment Assumptions
- On-premise government infrastructure
- Docker-based deployment
- PostgreSQL primary DB
- Redis queue/cache
- MinIO object storage
- VPN between branch nodes

---

# Seed/Admin Notes

Default seeded admin exists.
Super Admin bootstrap uses seeded default strategy.

Need before production:
- Force password change on first login
- MFA/TOTP support
- Admin rotation process

---

# Key Architectural Insight

The project is no longer in “greenfield MVP” stage.
It already contains substantial enterprise workflow infrastructure.

The biggest risk now is not missing features.
The biggest risk is:
- security hardening
- integrity guarantees
- deployment safety
- operational reliability
- automated verification

Future development should preserve and stabilize the existing architecture rather than rewriting it.

