# GovFlow — Government Document & Workflow Management System
## Comprehensive System Blueprint v1.0

---

## 1. Executive Summary

GovFlow is an enterprise-grade, on-premise government document workflow management platform designed to serve multiple departments and branch offices, supporting 1,000+ concurrent users. It digitalises the full lifecycle of government file processing — from contractor submission through multi-stage parallel approvals, digital signing, audit-compliant archival, and public-facing status tracking.

**Core design principles:**
- Every file has a traceable, tamper-proof journey
- No officer sees more than their authorised scope
- Every action is signed, timestamped, and immutably logged
- Admins configure workflows without developer involvement
- The system degrades gracefully under load and network issues

---

## 2. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        GOVFLOW PLATFORM                         │
│                                                                 │
│  ┌───────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Public    │  │ Contractor   │  │ Internal Staff Portal    │  │
│  │ Tracking  │  │ Portal       │  │ (Role-scoped dashboards) │  │
│  │ Portal    │  │              │  │                          │  │
│  └─────┬─────┘  └──────┬───────┘  └────────────┬─────────────┘  │
│        │               │                       │                │
│  ┌─────▼───────────────▼───────────────────────▼─────────────┐  │
│  │              API GATEWAY  (Auth, Rate Limit, TLS)         │  │
│  └──────────────────────────┬────────────────────────────────┘  │
│                             │                                   │
│  ┌──────────────────────────▼────────────────────────────────┐  │
│  │                    CORE SERVICES                          │  │
│  │                                                           │  │
│  │  Workflow Engine │ Document Manager │ Notification Engine │  │
│  │  Signature Svc   │ File Tracker     │ Report Generator    │  │
│  │  Audit Logger    │ SLA Monitor      │ User/Role Manager   │  │
│  └───────────────────────────┬───────────────────────────────┘  │
│                              │                                  │
│  ┌────────────┐  ┌───────────▼──────┐ ┌───────────────────────┐ │
│  │ PostgreSQL │  │  File Storage    │ │  Redis (Cache/Queue)  │ │
│  │ (Primary)  │  │  (MinIO/NFS)     │ │                       │ │
│  └────────────┘  └──────────────────┘ └───────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Deployment topology:**
- Head office server cluster (primary)
- Branch office nodes (lightweight, sync with head office)
- All inter-node communication over encrypted VPN tunnel
- Offline-tolerant branch operation with sync-on-reconnect

---

## 3. User Roles & Access Control

### 3.1 Role Hierarchy
- Role assignments should be editable by Super Admin and Department Admin. Below is the example role hierarchy:
| Role | Scope | Key Permissions |
|------|-------|----------------|
| **Super Admin** | All departments, all branches | Full system access, workflow builder, user management, cross-dept reports |
| **Department Admin** | Own department | Workflow config, file reassignment, dept reports, user onboarding for dept |
| **Branch Admin** | Own branch | Branch-level reassignment, branch reports |
| **Senior Engineer** | Files at their stage only | Review, digital sign, forward, flexible reject to any prior stage |
| **Engineer** | Files at their stage only | Review, comment, approve, reject to prior stage |
| **Sub Engineer** | Files at their stage only | BOQ check, raise queries, forward, reject to prior stage |
| **Entry Desk Officer** | Newly submitted files only | Log intake, verify, assign file ID, forward or return to contractor |
| **Contractor** | Their own submissions only | Submit, upload revisions, view status, respond to queries |
| **Citizen / Public** | Tracking-number lookup only | View status of files marked public by admin |
| **IT Admin** | System config only | No access to file content — infrastructure only |

### 3.2 Key RBAC Rules

- Role assignments are per-workflow-stage - but a user can be assigned to multiple stages in the same workflow.
- All role changes generate an audit event and require Super Admin or Department Admin approval
- Parallel approvers in a stage each see the same file simultaneously but act independently

### 3.3 Contractor Account Lifecycle

```
Contractor self-registers
        ↓
Email verification
        ↓
Pending Admin Review queue
        ↓
Admin approves / rejects (with reason)
        ↓
Contractor gets access + welcome email
        ↓
Can now submit files for any applicable workflow type
```

---

## 4. Workflow Engine — The Core

### 4.1 Design: Directed Acyclic Graph (DAG) per Workflow Type

Each of the 50+ workflow types is modelled as a configurable DAG, not a fixed linear list. A workflow definition contains:

- **Stages** — named steps (e.g., Entry Desk, Sub Engineer, Engineer, Senior Engineer, Director)
- **Stage type** — sequential, parallel group, or conditional branch
- **Assigned role** per stage
- **SLA timer** — working days/hours before alert fires
- **Allowed actions** per stage — forward, reject-to-any, reject-to-previous, hold, request-info, comment, digital-sign
- **Routing conditions** — e.g., "if BOQ value > NPR 50 lakh, add Director stage before archival"
- **Required attachments** — which documents must be present before forwarding

### 4.2 Parallel Approval Stages

A parallel stage is a group of two or more approvers who all receive the file simultaneously. The system supports two parallel resolution strategies, configurable per stage:

**All-must-approve:** Every approver in the group must approve before the file proceeds. If any one approves but another rejects, the file is held until the conflict is resolved or escalated.

**Quorum (N of M):** A defined threshold of approvers must approve (e.g., 2 of 3). Once the quorum is reached, the file automatically proceeds to the next stage. Remaining approvers are notified.

```
Example — Parallel Stage:
                ┌──────────────────────┐
                │  Parallel Review     │
     ┌──────────┤  Stage (2 of 3)      ├──────────┐
     │          └──────────────────────┘          │
     ▼                                            ▼
Engineer A                               Engineer B
(Structural)                             (Electrical)
     │                                            │
     ▼                                            ▼
Both approve → file proceeds automatically to Senior Engineer
One rejects → system flags, notifies stage admin
```

### 4.3 Rejection & Return Logic

Every rejection must include:
- Target stage (which prior stage to return to — any stage, admin-configured options)
- Mandatory comment / reason
- Optionally: list of required corrections

Return routing is fully flexible. A Senior Engineer can send a file back to Stage 1 (Entry Desk) if needed. The system logs the full path including all forward and return movements.

### 4.4 Workflow Versioning

When an admin edits a workflow definition:
- Files already in-flight continue on the **original** workflow version (snapshot at submission time)
- New submissions use the **updated** workflow version
- Admin can see both versions in the Workflow Builder and compare changes
- A migration tool allows admin to optionally move in-flight files to the new workflow (with full audit log of the migration)

### 4.5 Workflow Builder (Admin UI)

A no-code drag-and-drop interface where Department Admins:
1. Create a new workflow type (e.g., "Bridge Construction BOQ Approval")
2. Drag stages onto the canvas, connect them with arrows
3. Configure each stage (role, SLA, actions, conditions, required docs)
4. Add parallel groups by selecting multiple stages and grouping them
5. Set routing conditions using a simple rule builder (no coding)
6. Preview the workflow as a flow diagram
7. Publish — takes effect for new submissions immediately

---

## 5. Document Management

### 5.1 Supported File Types

| Category   | Formats                                 |
|------------|-----------------------------------------|
| Documents  | PDF, DOCX, XLSX, PPTX, TXT, ODT, ODS    |
| BOQ / Data | XLS, XLSX, CSV, XML                     |
| Drawings   | DWG, DXF, DGN (CAD), SVG                |
| Images     | JPG, PNG, TIFF, GIF, BMP, WEBP          |
| Compressed | ZIP, RAR (auto-extracted and scanned)   |
| Scanned    | PDF with embedded scan, multi-page TIFF |

All uploads are virus-scanned on arrival using ClamAV or equivalent. Files that fail scanning are quarantined and admin is notified.

### 5.2 File Size & Storage

No per-file size restriction at the application level. Storage is managed via MinIO (S3-compatible object storage, deployable on-premise) with:
- Chunked upload for large files (resumable if connection drops)
- Configurable per-submission total size limit (admin-defined, e.g., 500 MB per submission)
- Storage quotas per contractor account (admin-defined)
- Storage monitoring dashboard for IT admin with alerts at 70% / 90% usage

### 5.3 Document Versioning

Each document within a file submission is versioned independently:

```
File #2024-PWD-0042
  └─ BOQ Spreadsheet
       ├─ v1 — uploaded by contractor on 2024-03-01 (original)
       ├─ v2 — re-uploaded by contractor on 2024-03-08 (after Entry Desk return)
       └─ v3 — re-uploaded by contractor on 2024-03-15 (after Sub Engineer query)
```

**Comparison view:** Officers can open a side-by-side diff view for:
- Excel/CSV: cell-level change highlighting (added, removed, modified values)
- PDF: visual overlay of changed pages
- Images: side-by-side slider view

All previous versions are preserved and accessible to authorised officers. Contractors can only see their own latest uploaded version unless given explicit comparison access.

### 5.4 Document Preview & Watermarking

- All documents open in a browser-based viewer (no download required for review)
- When a document is viewed, a dynamic watermark is overlaid: "Viewed by [Name] | [Role] | [Date & Time] | [IP Address]"
- Downloads are logged with the same metadata
- Officers can be restricted to view-only (no download) per role configuration

---

## 6. Digital Signature

### 6.1 Signature Tiers

GovFlow implements two signature tiers:

**Tier 1 — In-system PIN signature (all internal stages):**
- Officer sets a personal 6-digit PIN on first login
- Signing action requires: active session + correct PIN
- Signature record contains: user ID, timestamp, IP, device fingerprint, action taken, file hash at time of signing
- This is the standard for most forwarding/approval actions

**Tier 2 — Cryptographic signature (final approval stages):**
- Uses asymmetric key pairs (RSA-2048 or ECDSA P-256) stored in a hardware security module (HSM) or encrypted key vault on the government server
- Each final-approver has a key pair issued by the IT Admin
- The signed document gets an embedded signature block (PDF signing via iText or Apache PDFBox)
- Compatible with DSC dongles if legally required — USB token integration via PKCS#11

### 6.2 Signature on the Document

When a document is finally approved:
1. A signature page is appended (or an existing signature field is filled)
2. The page includes: officer name, designation, date, signature image/block, and a QR code
3. The QR code links to the GovFlow verification endpoint — anyone can scan and verify the document's authenticity without logging in
4. The document is then locked — further editing is blocked

### 6.3 Legal Compliance Note

Jurisdiction-specific compliance (e.g., Nepal's Electronic Transactions Act 2063 for DSC requirements) should be reviewed with a legal team. GovFlow's architecture supports full DSC integration if mandated. The Tier 2 cryptographic signature is designed to meet most e-signature legal standards.

---

## 7. File Tracker & Audit Trail

### 7.1 File Lifecycle Events (All Logged)

Every file has a complete, immutable timeline:

| Event | Logged Data |
|-------|-------------|
| Submitted | Contractor ID, timestamp, file list, workflow type selected |
| Received at stage | Officer ID, stage, timestamp, file hash |
| Viewed | Officer ID, timestamp, document viewed, IP |
| Downloaded | Officer ID, timestamp, document, IP |
| Commented | Comment text, officer, timestamp |
| Query raised | Query text, target (contractor/previous stage), timestamp |
| Query responded | Response text, respondent, timestamp, any new attachments |
| Forwarded | From stage, to stage, officer, timestamp, comment |
| Rejected | From stage, to stage (any), reason, officer, timestamp |
| Held | Reason, officer, timestamp |
| Signed (Tier 1) | Officer, PIN-auth confirmed, timestamp, document hash |
| Signed (Tier 2) | Officer, cryptographic signature record, timestamp, document hash |
| Approved & archived | Final officer, timestamp, archival reference number |
| Visibility changed | Admin who changed it, old setting, new setting, timestamp |

### 7.2 Audit Log Integrity

The audit log is stored in an append-only PostgreSQL table with:
- Each row contains a hash of the previous row (blockchain-style chaining)
- Daily batch hash verification job — alerts IT Admin if any tamper is detected
- Audit log is never deleted — retention policy is configurable (e.g., 10 years)
- Separate read-only audit viewer for authorised roles (Super Admin, auditors)
- Export to signed PDF or Excel for regulatory submission

### 7.3 File Trace View (Internal)

Officers and admins see a visual timeline for any file they are authorised to view:

```
FILE #2024-PWD-0042 — BOQ for Kathmandu Ring Road Section 3
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

● 2024-03-01  Submitted by ABC Contractors Pvt. Ltd.
● 2024-03-01  Received at Entry Desk — Ram Kumar (1.2 hrs)
● 2024-03-02  Returned to Contractor — "BOQ missing site survey"
● 2024-03-08  Resubmitted with revised BOQ (v2)
● 2024-03-08  Forwarded to Sub Engineer — Sita Sharma
● 2024-03-12  Query raised → Contractor re: item 14 unit rate  ⚠ SLA 3d
● 2024-03-14  Query responded by contractor
● 2024-03-15  Approved by Sub Engineer, forwarded to Engineer
● 2024-03-15  Parallel review initiated — Engineer A + Engineer B
● 2024-03-17  Approved by Engineer A (Structural)
● 2024-03-18  Approved by Engineer B (Electrical) — Quorum reached
● 2024-03-18  Forwarded to Senior Engineer — Bikash Thapa
● 2024-03-21  ⚠ SLA ALERT — 3 days, no action
● 2024-03-22  Digitally signed & approved by Senior Engineer
● 2024-03-22  Archived — Ref: PWD/2024/KR3/0042
● 2024-03-22  Contractor notified via email + SMS

Total processing time: 21 calendar days | 13 working days
Longest hold: Sub Engineer query period (3 days)
```

### 7.4 Public Tracking (Citizen / Contractor Portal)

For files marked as "public trackable" by admin, a citizen/contractor can enter a tracking number and see:
- Current stage (generalised — not officer names)
- Date received at each completed stage
- Current status (In Review / Query Raised / Approved / Rejected)
- Expected completion date (based on remaining SLA budget)

The admin controls which workflow types are publicly trackable and what level of detail is shown.

---

## 8. SLA Monitoring & Escalation

### 8.1 SLA Configuration

Each workflow stage has configurable SLA:
- Duration: N working days (working calendar configured per department/branch)
- Warning threshold: X days before breach (e.g., warn at 1 day remaining)
- Breach action: notify officer + notify their supervisor + log breach event

### 8.2 Alert Channels

- In-app notification (bell icon, badge count)
- Email alert
- SMS alert (optional, via SMS gateway integration)
- Dashboard SLA heatmap — red/amber/green per file per stage

### 8.3 SLA Dashboard for Admins

- Table view: all files, current stage, days held, SLA status (green/amber/red)
- Filter by department, branch, workflow type, officer, date range
- Breach report: how many SLA breaches last month, by which stage, which officer
- Average processing time per stage, per workflow type, per department

---

## 9. Notifications Engine

| Trigger | Recipient | Channel |
|---------|-----------|---------|
| File assigned to your desk | Officer | In-app + Email |
| SLA warning (configurable days before breach) | Officer + Supervisor | In-app + Email + SMS |
| SLA breach | Officer + Supervisor + Dept Admin | All channels |
| File rejected back to you | Officer / Contractor | In-app + Email |
| Query raised for you | Contractor / Officer | In-app + Email |
| Query responded | Querying officer | In-app + Email |
| File approved | Contractor | Email + SMS |
| New parallel approval pending | Each parallel approver | In-app + Email |
| Parallel approval completed (quorum met) | All parallel approvers | In-app |
| Account approved / rejected | Contractor | Email |
| Admin reassignment | New officer | In-app + Email |
| Document about to expire (if applicable) | Contractor + Officer | Email |

Notification preferences are configurable per user. System-critical alerts (SLA breach) cannot be opted out of.

---

## 10. Reporting & Analytics

### 10.1 Dashboard Access by Role

| Dashboard | Accessible By |
|-----------|---------------|
| My pending files + SLA status | All internal staff |
| My submission status | Contractor |
| Department-wide file tracker + SLA | Department Admin |
| Cross-department analytics | Super Admin |
| Audit log viewer | Super Admin, designated auditors |
| Branch performance | Branch Admin, Super Admin |
| Public status | Citizen (tracking number only) |

### 10.2 Standard Reports (All Exportable to PDF & Excel)

- **File flow report** — complete trace of a single file from submission to closure
- **Officer workload report** — pending files per officer, average hold time
- **SLA compliance report** — compliance rate per stage, per officer, per department
- **Workflow efficiency report** — average processing time per workflow type, bottleneck stages
- **Contractor activity report** — submissions, approval rates, rejection rates per contractor
- **Audit report** — all actions on a file, cryptographically verifiable
- **Branch comparison report** — performance across branch offices
- **Pending files aging report** — all files currently in system, sorted by age

### 10.3 Custom Report Builder

Super Admins can build custom reports using a filter + column selector UI:
- Filter by: date range, department, branch, workflow type, officer, contractor, stage, SLA status
- Select columns to include
- Save report as a template for reuse
- Schedule report for daily/weekly/monthly email delivery

---

## 11. Multi-Branch Architecture

### 11.1 Data Model

Each file, user, and workflow belongs to a **Branch**. A Branch belongs to a **Department**. A Department belongs to the **Organisation** (top level).

```
Organisation
  └─ Department (e.g., Public Works, Revenue, Municipal)
       └─ Branch (e.g., Head Office, District Office Lalitpur, District Office Bhaktapur)
            └─ Files, Users, Workflows (branch-scoped by default)
```

### 11.2 Cross-Branch File Routing

Some workflows may require a file to move from a branch office to head office for final approval. This is supported:
- Branch office staff handle initial stages
- Workflow is configured to route to a "Head Office — Senior Engineer" stage
- The file physically stays on the server but becomes visible to the Head Office role
- On-premise VPN ensures secure access across locations

### 11.3 Branch Offline Resilience

If a branch office loses connectivity to head office:
- Local PostgreSQL replica allows read/write for in-progress files
- Changes are queued and synced when connectivity is restored
- Conflict resolution: timestamp-based, with manual review queue for detected conflicts
- Officers are notified of sync status in the UI

---

## 12. Security Architecture (Detailed)

### 12.1 Authentication

- Multi-factor authentication (MFA) mandatory for all internal staff
  - TOTP (Google Authenticator, Authy) as primary MFA method
  - SMS OTP as fallback
- LDAP/Active Directory integration for internal staff (SSO with existing government directory)
- Contractors: email + password + email OTP (no AD dependency)
- Session management: JWT with short expiry (15 min) + sliding refresh token (8 hours)
- Forced logout on suspicious activity (IP change, multiple failed refreshes)
- Device fingerprinting for anomaly detection

### 12.2 Authorisation

- Every API request passes through the RBAC middleware:
  1. Is the user authenticated?
  2. Does their role allow this action type?
  3. Is the target file currently at a stage assigned to their role?
  4. Does the file belong to their department / branch?
- Field-level access control: some fields (e.g., contractor's phone number) are masked for certain roles

### 12.3 Data Security

- Data at rest: AES-256 encryption for the database and file storage volumes
- Data in transit: TLS 1.3 minimum on all connections, including internal service-to-service
- File storage encryption: server-side encryption via MinIO (SSE-S3 compatible)
- Secrets management: HashiCorp Vault (on-premise) or encrypted environment config
- Database passwords rotated quarterly, access logged

### 12.4 Penetration & Hardening

- Input validation and sanitisation on all endpoints (OWASP Top 10 coverage)
- Content Security Policy headers, HSTS, X-Frame-Options
- SQL injection prevention via parameterised queries only (no raw SQL construction)
- File upload validation: MIME type check, magic byte check, AV scan — all three required
- Rate limiting: login (5 attempts → 15 min lockout), API (configurable per endpoint)
- Dependency vulnerability scanning in CI/CD pipeline

---

## 13. Recommended Technology Stack

### 13.1 Backend

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| API framework | Java Spring Boot 3.x | Mature, enterprise-grade, excellent security libraries, likely familiar to govt IT teams |
| ORM | Spring Data JPA + Hibernate | Standard with Spring Boot |
| Background jobs | Spring Batch + Quartz | SLA monitoring, report generation, audit verification jobs |
| Message queue | RabbitMQ | Notification dispatch, async document processing |
| Caching | Redis 7 | Session storage, rate limiting, dashboard caching |
| Search | PostgreSQL Full-Text Search (start) → Elasticsearch (scale) | FTS sufficient initially; migrate to ES for advanced search |

### 13.2 Frontend

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Internal portal | React 18 + TypeScript | Component reuse across dashboards, strong typing for complex RBAC UI |
| Public tracking | Next.js (SSR) | Better for low-bandwidth / slow devices, SEO-friendly |
| UI library | Ant Design or Mantine | Enterprise-grade, accessible, form-heavy UI components |
| State management | Zustand or Redux Toolkit | Complex multi-step form and workflow state |
| Charts | Recharts or Apache ECharts | Dashboard visualisations |

### 13.3 Infrastructure (On-Premise)

| Component | Technology |
|-----------|-----------|
| Primary database | PostgreSQL 16 with streaming replication |
| File storage | MinIO (S3-compatible, on-premise) |
| Containerisation | Docker + Docker Compose (Phase 1), Kubernetes (Phase 2 if scale demands) |
| Reverse proxy | Nginx |
| Certificate management | Internal CA + Let's Encrypt for intranet (or self-signed for air-gapped) |
| Monitoring | Prometheus + Grafana |
| Log aggregation | ELK Stack (Elasticsearch + Logstash + Kibana) |
| Backup | Automated PostgreSQL pg_dump + MinIO bucket replication to secondary server |
| Secret management | HashiCorp Vault |

### 13.4 Digital Signature

| Tier | Technology |
|------|-----------|
| Tier 1 (PIN-based) | Custom HMAC-SHA256 signature chain + PostgreSQL audit table |
| Tier 2 (Cryptographic) | Apache PDFBox (PDF signing) + Bouncy Castle (crypto) + PKCS#11 for HSM/dongle |
| Document verification QR | QR code links to `/verify/{signature-id}` — open endpoint, no login required |

---

## 14. Database Schema (Key Tables)

```sql
-- Core entities (simplified for overview)

organisations, departments, branches
users (id, role, department_id, branch_id, mfa_secret, status)
workflow_definitions (id, name, dept_id, version, status: draft/active/archived)
workflow_stages (id, workflow_def_id, name, stage_type: sequential/parallel, order, role, sla_days)
parallel_stage_config (stage_id, strategy: all/quorum, quorum_count)
stage_routing_rules (id, stage_id, condition_field, operator, value, target_stage_id)

file_submissions (id, contractor_id, workflow_def_id, workflow_version, branch_id, status, tracking_number, created_at)
file_stages (id, submission_id, stage_id, assigned_to, status, started_at, completed_at, sla_due_at)
parallel_approvals (id, file_stage_id, officer_id, decision: approved/rejected, comment, signed_at)
file_documents (id, submission_id, name, type, current_version_id)
document_versions (id, document_id, version_number, storage_path, file_hash, uploaded_by, uploaded_at)

comments (id, submission_id, stage_id, author_id, text, type: comment/query/response, created_at)
audit_log (id, submission_id, actor_id, action, metadata_json, timestamp, previous_hash, row_hash)
digital_signatures (id, submission_id, officer_id, tier, document_hash, signature_data, timestamp, ip, device_fingerprint)

notifications (id, recipient_id, type, payload_json, read_at, created_at)
sla_alerts (id, file_stage_id, alert_type: warning/breach, triggered_at, acknowledged_by)
---

*Document version 1.0 — GovFlow System Blueprint*
