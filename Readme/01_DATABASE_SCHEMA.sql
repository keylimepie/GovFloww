-- =============================================================
-- GOVFLOW — FULL POSTGRESQL DATABASE SCHEMA
-- Version: 1.0 | Run via Flyway migration V1__initial_schema.sql
-- =============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For full-text search

-- =============================================================
-- ENUMS
-- =============================================================

CREATE TYPE user_role AS ENUM (
    'SUPER_ADMIN',
    'DEPARTMENT_ADMIN',
    'BRANCH_ADMIN',
    'SENIOR_ENGINEER',
    'ENGINEER',
    'SUB_ENGINEER',
    'ENTRY_DESK_OFFICER',
    'CONTRACTOR',
    'IT_ADMIN'
);

CREATE TYPE user_status AS ENUM (
    'PENDING_VERIFICATION',  -- awaiting email verification
    'PENDING_APPROVAL',      -- awaiting admin approval (contractors)
    'ACTIVE',
    'SUSPENDED',
    'REJECTED'
);

CREATE TYPE workflow_status AS ENUM (
    'DRAFT',
    'ACTIVE',
    'ARCHIVED'
);

CREATE TYPE stage_type AS ENUM (
    'SEQUENTIAL',
    'PARALLEL',
    'CONDITIONAL'
);

CREATE TYPE parallel_strategy AS ENUM (
    'ALL_MUST_APPROVE',
    'QUORUM'
);

CREATE TYPE submission_status AS ENUM (
    'DRAFT',
    'SUBMITTED',
    'IN_REVIEW',
    'QUERY_RAISED',
    'ON_HOLD',
    'RETURNED_TO_CONTRACTOR',
    'REJECTED',
    'APPROVED',
    'ARCHIVED'
);

CREATE TYPE file_stage_status AS ENUM (
    'PENDING',       -- assigned, officer not yet opened
    'IN_PROGRESS',   -- officer has opened/viewed
    'FORWARDED',     -- moved to next stage
    'REJECTED',      -- sent back to previous stage
    'APPROVED',      -- terminal approval
    'HELD',          -- placed on hold
    'QUERY_RAISED'   -- waiting for response
);

CREATE TYPE approval_decision AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);

CREATE TYPE comment_type AS ENUM (
    'COMMENT',
    'QUERY',
    'QUERY_RESPONSE',
    'SYSTEM_NOTE',
    'REJECTION_REASON'
);

CREATE TYPE notification_type AS ENUM (
    'FILE_ASSIGNED',
    'SLA_WARNING',
    'SLA_BREACH',
    'FILE_FORWARDED',
    'FILE_REJECTED_TO_YOU',
    'QUERY_RAISED',
    'QUERY_RESPONDED',
    'FILE_APPROVED',
    'FILE_RETURNED_TO_CONTRACTOR',
    'PARALLEL_APPROVAL_PENDING',
    'PARALLEL_APPROVAL_QUORUM_MET',
    'PARALLEL_APPROVAL_CONFLICT',
    'ACCOUNT_APPROVED',
    'ACCOUNT_REJECTED',
    'FILE_REASSIGNED',
    'DOCUMENT_UPLOADED'
);

CREATE TYPE sla_alert_type AS ENUM (
    'WARNING',
    'BREACH'
);

CREATE TYPE signature_tier AS ENUM (
    'TIER_1_PIN',
    'TIER_2_CRYPTO'
);

CREATE TYPE audit_action AS ENUM (
    'USER_REGISTERED',
    'USER_LOGIN',
    'USER_LOGOUT',
    'USER_MFA_ENABLED',
    'USER_ROLE_CHANGED',
    'USER_APPROVED',
    'USER_SUSPENDED',
    'FILE_SUBMITTED',
    'FILE_VIEWED',
    'FILE_DOWNLOADED',
    'FILE_FORWARDED',
    'FILE_REJECTED',
    'FILE_APPROVED',
    'FILE_HELD',
    'FILE_REASSIGNED',
    'FILE_ARCHIVED',
    'DOCUMENT_UPLOADED',
    'DOCUMENT_VIEWED',
    'DOCUMENT_DOWNLOADED',
    'COMMENT_ADDED',
    'QUERY_RAISED',
    'QUERY_RESPONDED',
    'SIGNATURE_APPLIED',
    'WORKFLOW_PUBLISHED',
    'WORKFLOW_UPDATED',
    'VISIBILITY_CHANGED',
    'ROLE_ASSIGNED',
    'PARALLEL_DECISION'
);

-- =============================================================
-- ORGANISATION HIERARCHY
-- =============================================================

CREATE TABLE organisations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    code        VARCHAR(50)  UNIQUE NOT NULL,
    logo_path   VARCHAR(500),
    address     TEXT,
    created_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE departments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE RESTRICT,
    name            VARCHAR(255) NOT NULL,
    code            VARCHAR(50)  NOT NULL,
    description     TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organisation_id, code)
);

CREATE TABLE branches (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id   UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    name            VARCHAR(255) NOT NULL,
    code            VARCHAR(50)  NOT NULL,
    address         TEXT,
    is_head_office  BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(department_id, code)
);

-- =============================================================
-- USERS & ACCOUNTS
-- =============================================================

CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email               VARCHAR(255) UNIQUE NOT NULL,
    password_hash       VARCHAR(255) NOT NULL,
    first_name          VARCHAR(100) NOT NULL,
    last_name           VARCHAR(100) NOT NULL,
    role                user_role NOT NULL,
    department_id       UUID REFERENCES departments(id),
    branch_id           UUID REFERENCES branches(id),
    status              user_status DEFAULT 'PENDING_VERIFICATION',
    phone               VARCHAR(20),
    designation         VARCHAR(100),    -- e.g., "Junior Engineer Grade II"
    employee_code       VARCHAR(50),     -- internal employee ID
    mfa_secret          VARCHAR(255),    -- TOTP secret (encrypted)
    mfa_enabled         BOOLEAN DEFAULT FALSE,
    pin_hash            VARCHAR(255),    -- for Tier 1 digital signature
    last_login_at       TIMESTAMPTZ,
    last_login_ip       INET,
    failed_login_count  INTEGER DEFAULT 0,
    locked_until        TIMESTAMPTZ,
    email_verified_at   TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE contractor_profiles (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_name        VARCHAR(255),
    company_reg_number  VARCHAR(100),
    pan_number          VARCHAR(50),
    vat_number          VARCHAR(50),
    address             TEXT,
    contact_person      VARCHAR(100),
    storage_quota_bytes BIGINT DEFAULT 5368709120,   -- 5 GB default
    approved_by         UUID REFERENCES users(id),
    approved_at         TIMESTAMPTZ,
    rejection_reason    TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token   VARCHAR(512) UNIQUE NOT NULL,
    ip_address      INET,
    device_info     TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ
);

-- =============================================================
-- WORKFLOW DEFINITIONS
-- =============================================================

CREATE TABLE workflow_definitions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id           UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    name                    VARCHAR(255) NOT NULL,
    description             TEXT,
    version                 INTEGER NOT NULL DEFAULT 1,
    status                  workflow_status DEFAULT 'DRAFT',
    is_publicly_trackable   BOOLEAN DEFAULT FALSE,
    -- BASIC: stage name + status only | DETAILED: stage name + officer role + timestamps
    public_detail_level     VARCHAR(20) DEFAULT 'BASIC' CHECK (public_detail_level IN ('BASIC', 'DETAILED')),
    metadata_schema         JSONB DEFAULT '{}',  -- custom fields for this workflow (e.g., boq_value)
    created_by              UUID NOT NULL REFERENCES users(id),
    published_at            TIMESTAMPTZ,
    archived_at             TIMESTAMPTZ,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE workflow_stages (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_def_id             UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
    name                        VARCHAR(255) NOT NULL,
    stage_order                 INTEGER NOT NULL,
    stage_type                  stage_type DEFAULT 'SEQUENTIAL',
    assigned_role               user_role NOT NULL,
    -- sla_days counts working days; null means no SLA
    sla_days                    INTEGER,
    sla_warning_days            INTEGER DEFAULT 1,
    -- JSON array: ["FORWARD","REJECT","REJECT_ANY","COMMENT","HOLD","REQUEST_INFO","SIGN","QUERY"]
    allowed_actions             JSONB NOT NULL DEFAULT '["FORWARD","REJECT","COMMENT"]',
    -- JSON array of document type strings that must be present before forwarding
    required_document_types     JSONB DEFAULT '[]',
    is_entry_stage              BOOLEAN DEFAULT FALSE,
    is_terminal_stage           BOOLEAN DEFAULT FALSE,
    requires_digital_signature  BOOLEAN DEFAULT FALSE,
    signature_tier              INTEGER DEFAULT 1 CHECK (signature_tier IN (1, 2)),
    -- for parallel groups: which group this stage belongs to
    parallel_group_id           UUID,
    created_at                  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE parallel_stage_configs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_id        UUID UNIQUE NOT NULL REFERENCES workflow_stages(id) ON DELETE CASCADE,
    strategy        parallel_strategy NOT NULL,
    quorum_count    INTEGER,  -- required if strategy = QUORUM
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT quorum_required CHECK (
        strategy = 'ALL_MUST_APPROVE' OR (strategy = 'QUORUM' AND quorum_count IS NOT NULL)
    )
);

-- Routing rules evaluated in order; first matching rule wins
CREATE TABLE stage_routing_rules (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_stage_id       UUID NOT NULL REFERENCES workflow_stages(id) ON DELETE CASCADE,
    -- condition fields match keys in file_submissions.metadata JSONB
    condition_field     VARCHAR(100),       -- e.g., 'boq_value', 'project_type', null = default
    operator            VARCHAR(20),        -- 'GT', 'LT', 'GTE', 'LTE', 'EQ', 'NEQ', 'IN', 'CONTAINS'
    condition_value     VARCHAR(255),
    to_stage_id         UUID NOT NULL REFERENCES workflow_stages(id),
    is_default_route    BOOLEAN DEFAULT FALSE,
    rule_order          INTEGER DEFAULT 0,  -- lower = evaluated first
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Configures which stages an officer can reject back to from a given stage
CREATE TABLE allowed_rejection_targets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_stage_id   UUID NOT NULL REFERENCES workflow_stages(id) ON DELETE CASCADE,
    to_stage_id     UUID NOT NULL REFERENCES workflow_stages(id) ON DELETE CASCADE,
    UNIQUE(from_stage_id, to_stage_id)
);

-- =============================================================
-- FILE SUBMISSIONS & STAGE TRACKING
-- =============================================================

CREATE TABLE file_submissions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Format: DEPT-YEAR-BRANCH-SEQUENCE e.g., PWD-2024-HQ-0042
    tracking_number     VARCHAR(50) UNIQUE NOT NULL,
    title               VARCHAR(500) NOT NULL,
    description         TEXT,
    contractor_id       UUID NOT NULL REFERENCES users(id),
    workflow_def_id     UUID NOT NULL REFERENCES workflow_definitions(id),
    -- snapshot of version at submission time; in-flight files use this version
    workflow_version    INTEGER NOT NULL,
    department_id       UUID NOT NULL REFERENCES departments(id),
    branch_id           UUID NOT NULL REFERENCES branches(id),
    status              submission_status DEFAULT 'SUBMITTED',
    -- JSONB bag for custom fields defined in workflow metadata_schema
    -- e.g., { "boq_value": 5000000, "project_type": "ROAD", "location": "Lalitpur" }
    metadata            JSONB DEFAULT '{}',
    current_stage_id    UUID REFERENCES workflow_stages(id),
    submitted_at        TIMESTAMPTZ DEFAULT NOW(),
    last_action_at      TIMESTAMPTZ DEFAULT NOW(),
    approved_at         TIMESTAMPTZ,
    archived_at         TIMESTAMPTZ,
    archival_reference  VARCHAR(100),  -- e.g., PWD/2024/KR3/0042
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- One record per time a file visits a stage
CREATE TABLE file_stages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id       UUID NOT NULL REFERENCES file_submissions(id) ON DELETE CASCADE,
    stage_id            UUID NOT NULL REFERENCES workflow_stages(id),
    assigned_to         UUID REFERENCES users(id),  -- null if unassigned (admin assigns)
    status              file_stage_status DEFAULT 'PENDING',
    sla_due_at          TIMESTAMPTZ,
    started_at          TIMESTAMPTZ,    -- when officer first opened the file
    completed_at        TIMESTAMPTZ,    -- when action was taken
    -- computed: calendar days from started_at to completed_at (or NOW() if still open)
    action_taken        VARCHAR(50),    -- 'FORWARDED', 'REJECTED', 'APPROVED', 'HELD'
    action_comment      TEXT,
    forwarded_to_stage_id   UUID REFERENCES workflow_stages(id),
    rejected_to_stage_id    UUID REFERENCES workflow_stages(id),
    rejection_reason    TEXT,
    hold_reason         TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE parallel_approvals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_stage_id   UUID NOT NULL REFERENCES file_stages(id) ON DELETE CASCADE,
    officer_id      UUID NOT NULL REFERENCES users(id),
    decision        approval_decision DEFAULT 'PENDING',
    comment         TEXT,
    signed_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(file_stage_id, officer_id)
);

-- Tracks who has been notified to watch a file (read-only access across stages)
CREATE TABLE file_watchers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id   UUID NOT NULL REFERENCES file_submissions(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    added_by        UUID NOT NULL REFERENCES users(id),
    added_at        TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(submission_id, user_id)
);

-- =============================================================
-- DOCUMENTS & VERSIONS
-- =============================================================

CREATE TABLE file_documents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id       UUID NOT NULL REFERENCES file_submissions(id) ON DELETE CASCADE,
    name                VARCHAR(255) NOT NULL,
    -- Type must match a value in workflow_stages.required_document_types
    document_type       VARCHAR(100) NOT NULL,  -- 'BOQ', 'DRAWING', 'SITE_SURVEY', 'PHOTO', 'REPORT', 'OTHER'
    current_version_id  UUID,  -- FK to document_versions; set after first version
    is_required         BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE document_versions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id         UUID NOT NULL REFERENCES file_documents(id) ON DELETE CASCADE,
    version_number      INTEGER NOT NULL DEFAULT 1,
    -- MinIO path: govflow-documents/{submission_id}/{document_id}/v{n}/{filename}
    storage_path        VARCHAR(1000) NOT NULL,
    file_size_bytes     BIGINT NOT NULL,
    mime_type           VARCHAR(100) NOT NULL,
    original_filename   VARCHAR(255) NOT NULL,
    -- SHA-256 of file bytes; used for integrity verification and signature
    file_hash           VARCHAR(64) NOT NULL,
    uploaded_by         UUID NOT NULL REFERENCES users(id),
    upload_stage_id     UUID REFERENCES workflow_stages(id),  -- stage at time of upload
    upload_note         TEXT,
    is_virus_clean      BOOLEAN DEFAULT FALSE,
    virus_scan_result   TEXT,
    scanned_at          TIMESTAMPTZ,
    is_locked           BOOLEAN DEFAULT FALSE,  -- true after final signature applied
    uploaded_at         TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(document_id, version_number)
);

-- =============================================================
-- COMMENTS & QUERIES
-- =============================================================

CREATE TABLE comments (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id               UUID NOT NULL REFERENCES file_submissions(id) ON DELETE CASCADE,
    stage_id                    UUID REFERENCES workflow_stages(id),
    author_id                   UUID NOT NULL REFERENCES users(id),
    comment_type                comment_type DEFAULT 'COMMENT',
    text                        TEXT NOT NULL,
    parent_comment_id           UUID REFERENCES comments(id),  -- for threaded query responses
    is_visible_to_contractor    BOOLEAN DEFAULT FALSE,
    is_resolved                 BOOLEAN DEFAULT FALSE,
    resolved_by                 UUID REFERENCES users(id),
    resolved_at                 TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- DIGITAL SIGNATURES
-- =============================================================

CREATE TABLE digital_signatures (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id       UUID NOT NULL REFERENCES file_submissions(id),
    file_stage_id       UUID REFERENCES file_stages(id),
    document_version_id UUID REFERENCES document_versions(id),
    officer_id          UUID NOT NULL REFERENCES users(id),
    tier                signature_tier NOT NULL,
    -- SHA-256 of the document bytes at time of signing
    document_hash       VARCHAR(64) NOT NULL,
    -- Tier 1: HMAC-SHA256(userId + timestamp + documentHash, pinHash)
    -- Tier 2: base64-encoded CMS/CAdES signature
    signature_data      TEXT NOT NULL,
    -- for Tier 2: PEM certificate of the signing key
    certificate_data    TEXT,
    -- QR verification URL: /verify/{id}
    verification_url    VARCHAR(500),
    signed_at           TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    ip_address          INET,
    device_fingerprint  VARCHAR(255),
    is_valid            BOOLEAN DEFAULT TRUE
);

-- =============================================================
-- IMMUTABLE AUDIT LOG (APPEND ONLY — NO UPDATE/DELETE)
-- =============================================================

CREATE TABLE audit_log (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- null for system-wide actions not tied to a file
    submission_id       UUID REFERENCES file_submissions(id),
    -- null for automated/system actions
    actor_id            UUID REFERENCES users(id),
    actor_role          user_role,
    action              audit_action NOT NULL,
    -- target of the action
    target_type         VARCHAR(50),   -- 'FILE', 'DOCUMENT', 'STAGE', 'USER', 'WORKFLOW'
    target_id           UUID,
    -- additional action-specific data (stage names, file hashes, old/new values, etc.)
    metadata            JSONB DEFAULT '{}',
    ip_address          INET,
    device_fingerprint  VARCHAR(255),
    user_agent          TEXT,
    timestamp           TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    -- hash chain for tamper detection
    previous_row_hash   VARCHAR(64),   -- SHA-256 of the previous row's row_hash
    row_hash            VARCHAR(64) NOT NULL  -- SHA-256 of (id||submission_id||actor_id||action||metadata||timestamp||previous_row_hash)
);

-- PREVENT any UPDATE or DELETE on audit_log
CREATE RULE audit_log_no_update AS ON UPDATE TO audit_log DO INSTEAD NOTHING;
CREATE RULE audit_log_no_delete AS ON DELETE TO audit_log DO INSTEAD NOTHING;

-- =============================================================
-- NOTIFICATIONS
-- =============================================================

CREATE TABLE notifications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type   notification_type NOT NULL,
    title               VARCHAR(255) NOT NULL,
    body                TEXT NOT NULL,
    -- additional context: { "submissionId": "...", "trackingNumber": "...", "stageName": "..." }
    payload             JSONB DEFAULT '{}',
    is_read             BOOLEAN DEFAULT FALSE,
    read_at             TIMESTAMPTZ,
    email_sent          BOOLEAN DEFAULT FALSE,
    email_sent_at       TIMESTAMPTZ,
    sms_sent            BOOLEAN DEFAULT FALSE,
    sms_sent_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- SLA MONITORING
-- =============================================================

CREATE TABLE sla_alerts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_stage_id       UUID NOT NULL REFERENCES file_stages(id) ON DELETE CASCADE,
    alert_type          sla_alert_type NOT NULL,
    triggered_at        TIMESTAMPTZ DEFAULT NOW(),
    acknowledged_by     UUID REFERENCES users(id),
    acknowledged_at     TIMESTAMPTZ,
    UNIQUE(file_stage_id, alert_type)  -- only one alert per type per stage instance
);

-- =============================================================
-- PUBLIC TRACKING SETTINGS (admin-controlled per workflow)
-- =============================================================

CREATE TABLE public_tracking_settings (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_def_id         UUID UNIQUE NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
    is_enabled              BOOLEAN DEFAULT FALSE,
    -- which fields to show on the public page
    show_stage_names        BOOLEAN DEFAULT TRUE,
    show_timestamps         BOOLEAN DEFAULT TRUE,
    show_expected_completion BOOLEAN DEFAULT TRUE,
    show_officer_role       BOOLEAN DEFAULT FALSE,  -- never show officer names
    show_rejection_reasons  BOOLEAN DEFAULT FALSE,
    updated_by              UUID REFERENCES users(id),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- WORKING CALENDAR (for SLA calculation)
-- =============================================================

CREATE TABLE working_calendars (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id   UUID REFERENCES departments(id),  -- null = global default
    branch_id       UUID REFERENCES branches(id),     -- null = applies to all branches
    name            VARCHAR(100) NOT NULL,
    working_days    INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',  -- 0=Sun, 1=Mon ... 6=Sat
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public_holidays (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_id     UUID NOT NULL REFERENCES working_calendars(id) ON DELETE CASCADE,
    holiday_date    DATE NOT NULL,
    name            VARCHAR(100) NOT NULL,
    UNIQUE(calendar_id, holiday_date)
);

-- =============================================================
-- REPORT TEMPLATES (saved by Super Admin)
-- =============================================================

CREATE TABLE report_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    created_by      UUID NOT NULL REFERENCES users(id),
    -- filter config: { "dateRange": "LAST_30_DAYS", "departments": [...], "status": [...] }
    filter_config   JSONB NOT NULL DEFAULT '{}',
    -- column config: ["tracking_number", "title", "stage", "days_held", "sla_status"]
    column_config   JSONB NOT NULL DEFAULT '[]',
    -- schedule: null = manual | { "frequency": "WEEKLY", "dayOfWeek": 1, "email": ["..."] }
    schedule_config JSONB,
    last_run_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- PERFORMANCE INDEXES
-- =============================================================

-- File submissions
CREATE INDEX idx_submissions_contractor        ON file_submissions(contractor_id);
CREATE INDEX idx_submissions_status            ON file_submissions(status);
CREATE INDEX idx_submissions_branch            ON file_submissions(branch_id);
CREATE INDEX idx_submissions_dept              ON file_submissions(department_id);
CREATE INDEX idx_submissions_current_stage     ON file_submissions(current_stage_id);
CREATE INDEX idx_submissions_tracking          ON file_submissions(tracking_number);
CREATE INDEX idx_submissions_workflow          ON file_submissions(workflow_def_id, workflow_version);

-- File stages
CREATE INDEX idx_file_stages_submission        ON file_stages(submission_id);
CREATE INDEX idx_file_stages_assigned          ON file_stages(assigned_to) WHERE status IN ('PENDING', 'IN_PROGRESS', 'QUERY_RAISED');
CREATE INDEX idx_file_stages_status            ON file_stages(status);
CREATE INDEX idx_file_stages_sla_due           ON file_stages(sla_due_at) WHERE status NOT IN ('FORWARDED', 'APPROVED', 'REJECTED');

-- Audit log
CREATE INDEX idx_audit_submission              ON audit_log(submission_id);
CREATE INDEX idx_audit_actor                   ON audit_log(actor_id);
CREATE INDEX idx_audit_timestamp               ON audit_log(timestamp DESC);
CREATE INDEX idx_audit_action                  ON audit_log(action);

-- Notifications
CREATE INDEX idx_notifications_recipient       ON notifications(recipient_id, is_read, created_at DESC);

-- Documents
CREATE INDEX idx_doc_versions_document         ON document_versions(document_id, version_number DESC);
CREATE INDEX idx_doc_submissions               ON file_documents(submission_id);

-- Users
CREATE INDEX idx_users_email                   ON users(email);
CREATE INDEX idx_users_role_dept               ON users(role, department_id);
CREATE INDEX idx_users_branch                  ON users(branch_id);

-- Full-text search
CREATE INDEX idx_submissions_fts               ON file_submissions USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));
CREATE INDEX idx_comments_fts                  ON comments USING gin(to_tsvector('english', text));

-- =============================================================
-- VIEWS
-- =============================================================

-- Active workload per officer (used for dashboard)
CREATE VIEW officer_workload AS
SELECT
    fs.assigned_to          AS officer_id,
    COUNT(*)                AS total_pending,
    COUNT(*) FILTER (WHERE fs.sla_due_at < NOW())           AS sla_breached,
    COUNT(*) FILTER (WHERE fs.sla_due_at BETWEEN NOW() AND NOW() + INTERVAL '1 day') AS sla_warning,
    AVG(EXTRACT(EPOCH FROM (NOW() - fs.started_at))/86400)::NUMERIC(5,1) AS avg_days_held
FROM file_stages fs
WHERE fs.status IN ('PENDING', 'IN_PROGRESS', 'QUERY_RAISED')
  AND fs.assigned_to IS NOT NULL
GROUP BY fs.assigned_to;

-- File timeline for the trace view
CREATE VIEW file_timeline AS
SELECT
    fs.submission_id,
    ws.name              AS stage_name,
    u.first_name || ' ' || u.last_name AS officer_name,
    u.role               AS officer_role,
    fs.status,
    fs.started_at,
    fs.completed_at,
    fs.action_taken,
    fs.action_comment,
    fs.sla_due_at,
    CASE WHEN fs.completed_at IS NULL AND fs.sla_due_at < NOW()
         THEN TRUE ELSE FALSE END AS is_sla_breached,
    fs.stage_id,
    fs.created_at
FROM file_stages fs
JOIN workflow_stages ws ON fs.stage_id = ws.id
LEFT JOIN users u ON fs.assigned_to = u.id
ORDER BY fs.created_at ASC;
