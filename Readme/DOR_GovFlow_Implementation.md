# DOR — GovFlow Implementation Specification
## Department of Roads, Ministry of Infrastructure Development, Nepal
### AI Coding Reference Document v1.0

> **How to use this file:** Paste this entire document (or the relevant section) into your AI coding session alongside the GovFlow master prompt. Reference section numbers when giving the AI tasks, e.g., *"Implement the branch seed data from Section 5 using the schema in 01_DATABASE_SCHEMA.sql"*.

---

## Table of Contents

1. [Context & Overview](#1-context--overview)
2. [GovFlow Hierarchy Mapping](#2-govflow-hierarchy-mapping)
3. [Role System — DOR to GovFlow](#3-role-system--dor-to-govflow)
4. [Schema Extensions Required](#4-schema-extensions-required)
5. [Complete Branch / Office Seed Data](#5-complete-branch--office-seed-data)
6. [Personnel Structure per Office Type](#6-personnel-structure-per-office-type)
7. [DOR-Specific Concepts & GovFlow Implementation](#7-dor-specific-concepts--govflow-implementation)
8. [Workflow Configurations](#8-workflow-configurations)
9. [File Flow Patterns](#9-file-flow-patterns)
10. [RBAC Matrix for DOR Roles](#10-rbac-matrix-for-dor-roles)
11. [Seed Data — JSON Format](#11-seed-data--json-format)
12. [Implementation Checklist](#12-implementation-checklist)

---

## 1. Context & Overview

The Department of Roads (DoR) is under the **Ministry of Infrastructure Development (MID)** and operates a 5-level hierarchical structure spanning from the Ministry down to individual Road Division offices and project offices across Nepal. GovFlow needs to model this entire hierarchy, support cross-level file routing, and implement DOR-specific workflow concepts (Tok, Raye, Tippani).

### 1.1 DOR Facts for Sizing

| Metric | Value |
|--------|-------|
| Ministry (L1) | Ministry of Infrastructure Development |
| Department (L2) | Department of Roads (DoR) — 1 |
| Divisions/Directorates (L3) | 12 (Planning, Maintenance, Bridge, Dev Assistance, Mechanical, Admin, Finance, Law, + 4 Project Directorates) |
| FRSMOs / Regional Offices (L4) | 4 FRSMOs + 4 Project Directorates + 6 Bridge Sectors + 8 HEDs + misc |
| Field Offices (L5) | 33 Road Divisions + 18 Project Offices + 8 Mechanical Offices |
| Total offices to register as Branches | ~130 |
| Estimated concurrent users | 1,000+ |
| Workflow types to configure | 15–20 initially |

### 1.2 DOR Nepali Term Glossary

| Nepali Term | English | GovFlow Context |
|------------|---------|----------------|
| महाशाखा (Mahasakha) | Division / Directorate | Maps to GovFlow `cluster_type = MAHASAKHA` |
| शाखा (Sakha) | Branch / Section | Sub-unit within a Mahasakha |
| प्राविधिक शाखा (Prabidhik Sakha) | Technical Branch | Engineers, Sub-Engineers |
| प्रशासन शाखा (Prasasan Sakha) | Administration Branch | Section Officers, Nayeb Subbas |
| लेखा शाखा (Lekha Sakha) | Accounts/Finance Branch | Account Officers, Accountants |
| कानून शाखा (Kaanun Sakha) | Legal Branch | Law Officers |
| टोक (Tok) | Assignment/Delegation | New action type in GovFlow |
| राय (Raye) | Opinion/Consultation request | New action type in GovFlow |
| टिप्पणी (Tippani) | Technical note/recommendation | New document type in GovFlow |
| सडक डिभिजन (Sadak Division) | Road Division | Field-level branch in GovFlow |
| संघीय सडक सुपरीवेक्षण (FRSMO) | Federal Road Supervision & Monitoring Office | Regional-level branch |
| डिभिजनल इञ्जिनियर (DE) | Division Engineer | Office head title |
| VO (Variation Order) | Contract amendment by value change | Key workflow type |
| IPC | Interim Payment Certificate | Payment approval workflow |

---

## 2. GovFlow Hierarchy Mapping

DOR has 5 levels but GovFlow supports 3 (Organisation → Department → Branch). The solution is to flatten the 5-level DOR structure into GovFlow's 3 levels using a `branch_level` attribute, and allow cross-branch workflow routing via the workflow engine.

### 2.1 Mapping Strategy

```
DOR REAL STRUCTURE          →    GOVFLOW ENTITY
─────────────────────────────────────────────────────────────────
Level 5: Ministry            →    Organisation
Level 4: DOR (Dept)          →    Department (single dept: "DoR")
Level 3: Mahasakha/Division  →    Branch (branch_level = 3, is_headquarters = true)
Level 2: FRSMO/Directorate   →    Branch (branch_level = 2, parent_branch_id = Mahasakha)
Level 1: Road Division /     →    Branch (branch_level = 1, parent_branch_id = FRSMO)
         Project Office
```

> **Key insight:** All DOR users share `department_id = DOR`. Access control is driven by `branch_id` + `role` + stage ownership, NOT by department isolation. The `branch_level` field on the `branches` table tells the system which tier an office sits at.

### 2.2 Organisation Record

```json
{
  "name": "Ministry of Infrastructure Development",
  "code": "MID",
  "address": "Singha Durbar, Kathmandu, Nepal"
}
```

### 2.3 Department Record

```json
{
  "name": "Department of Roads",
  "code": "DOR",
  "nepali_name": "सडक विभाग",
  "address": "Babarmahal, Kathmandu, Nepal",
  "description": "National highway construction, maintenance, and supervision"
}
```

### 2.4 Branch Cluster Types

Every branch has a `cluster_type` field (stored in metadata JSONB) indicating which group it belongs to:

| cluster_type | Description | branch_level |
|-------------|-------------|-------------|
| `HQ_MAHASAKHA` | HQ Division/Directorate | 3 |
| `HQ_ADMIN` | HQ Administrative Wing | 3 |
| `FRSMO` | Federal Road Supervision & Monitoring Office | 2 |
| `PROJECT_DIRECTORATE` | Project Directorate (national projects) | 2 |
| `BRIDGE_SECTOR` | Bridge Division field sector | 2 |
| `HED` | Heavy Equipment Division | 2 |
| `MECHANICAL_OFFICE` | Mechanical Office | 1 |
| `ROAD_DIVISION` | Road Division (field) | 1 |
| `PROJECT_OFFICE` | Project Office (field) | 1 |
| `DOR_HQ` | DOR Headquarters (DG/DDG office) | 3 |

---

## 3. Role System — DOR to GovFlow

### 3.1 DOR Role Hierarchy (Complete)

```
DG (Director General)                    ← GovFlow: SUPER_ADMIN
  └─ DDG (Deputy Director General)       ← GovFlow: DEPARTMENT_ADMIN
       └─ Superintending Engineer (SE)   ← NEW ROLE: SUPERINTENDENT_ENGINEER
            └─ Senior Division Engineer (SDE)  ← GovFlow: SENIOR_ENGINEER

Technical Track (Prabidhik Sakha):
  SDE → Engineer → Sub Engineer

Administrative Track (Prasasan Sakha):
  Chief Administrative Officer → Section Officer → Nayeb Subba → Kharidaar

Finance Track (Lekha Sakha):
  Chief Accounts Controller → Account Officer → Accountant

Legal Track (Kaanun Sakha):
  Deputy Secretary - Law → Law Officer → Nayeb Subba - Law
```

### 3.2 Role Mapping Table

| DOR Role | GovFlow Role | Notes |
|----------|-------------|-------|
| DG (Director General) | `SUPER_ADMIN` | Full DOR system access |
| DDG (Deputy Director General) | `DEPARTMENT_ADMIN` | Mahasakha-scoped |
| Superintending Engineer | `SUPERINTENDENT_ENGINEER` | **NEW — add to enum** |
| Senior Division Engineer (SDE) | `SENIOR_ENGINEER` | Division/Project head |
| Engineer | `ENGINEER` | Prabidhik Sakha |
| Sub Engineer | `SUB_ENGINEER` | Prabidhik Sakha |
| Entry Desk Officer | `ENTRY_DESK_OFFICER` | File intake |
| Chief Administrative Officer | `BRANCH_ADMIN` | Prasasan Sakha head |
| Section Officer | `SECTION_OFFICER` | **NEW — add to enum** |
| Nayeb Subba | `NAYEB_SUBBA` | **NEW — add to enum** |
| Kharidaar | `KHARIDAAR` | **NEW — add to enum** |
| Chief Accounts Controller | `ACCOUNTS_CONTROLLER` | **NEW — add to enum** |
| Account Officer | `ACCOUNT_OFFICER` | **NEW — add to enum** |
| Accountant | `ACCOUNTANT` | **NEW — add to enum** |
| Deputy Secretary - Law | `LAW_SECRETARY` | **NEW — add to enum** |
| Law Officer | `LAW_OFFICER` | **NEW — add to enum** |
| Computer Engineer/Operator | `ENGINEER` | Same role, designation differentiates |
| Mechanical Engineer | `ENGINEER` | Same role, designation differentiates |
| Geologist / Sociologist | `ENGINEER` | Same role, designation differentiates |

### 3.3 Updated user_role Enum (PostgreSQL)

```sql
-- Add to existing GovFlow user_role enum in a migration file
-- V2__dor_roles.sql

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'SUPERINTENDENT_ENGINEER';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'SECTION_OFFICER';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'NAYEB_SUBBA';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'KHARIDAAR';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'ACCOUNTS_CONTROLLER';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'ACCOUNT_OFFICER';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'ACCOUNTANT';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'LAW_SECRETARY';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'LAW_OFFICER';
```

### 3.4 Role Designation Reference

Use the `designation` field on the `users` table to distinguish sub-types within the same role:

| Role | designation value |
|------|-------------------|
| ENGINEER | "Engineer" / "Computer Engineer" / "Mechanical Engineer" / "Hydrologist" / "Geologist" / "Sociologist" |
| SUPERINTENDENT_ENGINEER | "Superintending Engineer" |
| SENIOR_ENGINEER | "Senior Division Engineer" |
| BRANCH_ADMIN | "Chief Administrative Officer" |
| ACCOUNTS_CONTROLLER | "Chief Accounts Controller" |

---

## 4. Schema Extensions Required

Add the following to the GovFlow database schema specifically for DOR.

### 4.1 Branch Hierarchy Extension

```sql
-- V2__dor_schema_extensions.sql

-- Add parent hierarchy and DOR-specific branch attributes
ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS branch_level     INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_branch_id UUID REFERENCES branches(id),
  ADD COLUMN IF NOT EXISTS cluster_type     VARCHAR(50),
  ADD COLUMN IF NOT EXISTS nepali_name      VARCHAR(255),
  ADD COLUMN IF NOT EXISTS is_dor_hq        BOOLEAN DEFAULT FALSE;

-- Index for hierarchy traversal
CREATE INDEX IF NOT EXISTS idx_branches_parent ON branches(parent_branch_id);
CREATE INDEX IF NOT EXISTS idx_branches_level  ON branches(branch_level);
CREATE INDEX IF NOT EXISTS idx_branches_cluster ON branches(cluster_type);
```

### 4.2 Raye (Consultation) Table

The Raye mechanism is a formal inter-branch opinion request. It pauses the main file at the current approver and creates a sub-task for the target Sakha officer.

```sql
-- Raye request tracking
CREATE TYPE raye_status AS ENUM ('PENDING', 'RESPONDED', 'CANCELLED');
CREATE TYPE sakha_type  AS ENUM ('PRABIDHIK', 'PRASASAN', 'LEKHA', 'KAANUN');

CREATE TABLE raye_requests (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_stage_id       UUID NOT NULL REFERENCES file_stages(id) ON DELETE CASCADE,
    submission_id       UUID NOT NULL REFERENCES file_submissions(id),
    requested_by        UUID NOT NULL REFERENCES users(id),   -- the approver (SDE/SE/DDG/DG)
    target_sakha        sakha_type NOT NULL,                  -- which branch to consult
    target_branch_id    UUID REFERENCES branches(id),         -- specific branch if known
    assigned_to         UUID REFERENCES users(id),            -- officer who will respond
    request_text        TEXT NOT NULL,
    response_text       TEXT,
    status              raye_status DEFAULT 'PENDING',
    can_reassign        BOOLEAN DEFAULT TRUE,    -- can target officer assign to associate
    requested_at        TIMESTAMPTZ DEFAULT NOW(),
    responded_at        TIMESTAMPTZ,
    due_at              TIMESTAMPTZ,             -- optional SLA for Raye response
    CONSTRAINT raye_unique_active UNIQUE (file_stage_id, target_sakha, status)
      DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX idx_raye_stage     ON raye_requests(file_stage_id);
CREATE INDEX idx_raye_assigned  ON raye_requests(assigned_to) WHERE status = 'PENDING';
CREATE INDEX idx_raye_requested ON raye_requests(requested_by);
```

### 4.3 Tok (Assignment/Delegation) Table

Tok is a targeted assignment where a senior officer assigns the file (or a specific task) to a specific subordinate. Unlike a generic stage assignment, Tok records who delegated to whom and why.

```sql
-- Tok (targeted delegation) tracking
CREATE TYPE tok_status AS ENUM ('ACTIVE', 'COMPLETED', 'RECALLED');

CREATE TABLE tok_assignments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_stage_id       UUID NOT NULL REFERENCES file_stages(id) ON DELETE CASCADE,
    submission_id       UUID NOT NULL REFERENCES file_submissions(id),
    tok_by              UUID NOT NULL REFERENCES users(id),   -- the delegating officer
    tok_to              UUID NOT NULL REFERENCES users(id),   -- the delegated officer
    task_description    TEXT,
    status              tok_status DEFAULT 'ACTIVE',
    response_note       TEXT,
    assigned_at         TIMESTAMPTZ DEFAULT NOW(),
    completed_at        TIMESTAMPTZ
);

CREATE INDEX idx_tok_stage  ON tok_assignments(file_stage_id);
CREATE INDEX idx_tok_to     ON tok_assignments(tok_to) WHERE status = 'ACTIVE';
```

### 4.4 Tippani Document Type & Table

Tippani is a formal technical note prepared by an Engineer before forwarding a file upward. It is a structured document with specific metadata.

```sql
-- Add TIPPANI to document_type options
-- (document_type is VARCHAR(100) in GovFlow, so just use the string 'TIPPANI')

-- Tippani metadata table (extends document_versions for Tippani-specific fields)
CREATE TABLE tippani_metadata (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_version_id     UUID UNIQUE NOT NULL REFERENCES document_versions(id),
    prepared_by             UUID NOT NULL REFERENCES users(id),    -- Engineer who wrote it
    subject                 TEXT NOT NULL,
    recommendation          TEXT NOT NULL,                         -- Engineer's recommendation
    reference_documents     JSONB DEFAULT '[]',                    -- related docs cited
    prepared_at             TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.5 Approval Threshold Extension

DOR workflows have conditional approval authority based on percentage values (e.g., VO < 10%). Add a computed metadata field for this.

```sql
-- Approval authority thresholds per stage (stored in workflow_stages as JSONB)
-- Example workflow_stages.allowed_actions for SDE stage:
-- { "approvalThreshold": { "field": "vo_percentage", "operator": "LT", "value": 10 } }
-- No schema change needed — use existing allowed_actions JSONB field
-- The workflow engine reads this at forward-time to determine if APPROVE is permitted
```

### 4.6 New Audit Actions for DOR

```sql
-- Add DOR-specific audit actions to the audit_action enum
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'TOK_ASSIGNED';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'TOK_COMPLETED';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'RAYE_REQUESTED';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'RAYE_RESPONDED';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'TIPPANI_PREPARED';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'FORWARDED_TO_MINISTRY';
```

### 4.7 New Notification Types for DOR

```sql
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'TOK_RECEIVED';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'TOK_COMPLETED';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'RAYE_REQUEST_RECEIVED';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'RAYE_RESPONSE_RECEIVED';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'TIPPANI_SUBMITTED';
```

---

## 5. Complete Branch / Office Seed Data

### 5.1 DOR HQ (branch_level = 3, is_dor_hq = true)

```json
[
  { "code": "DOR-HQ",    "name": "DOR Headquarters",                      "nepali_name": "सडक विभाग, मुख्यालय",          "cluster_type": "DOR_HQ",         "branch_level": 3, "is_head_office": true, "parent_branch_code": null },
  { "code": "DOR-PMD",   "name": "Planning and Monitoring Division",       "nepali_name": "योजना तथा अनुगमन महाशाखा",     "cluster_type": "HQ_MAHASAKHA",   "branch_level": 3, "parent_branch_code": "DOR-HQ" },
  { "code": "DOR-MTD",   "name": "Maintenance Division",                   "nepali_name": "सम्भार महाशाखा",               "cluster_type": "HQ_MAHASAKHA",   "branch_level": 3, "parent_branch_code": "DOR-HQ" },
  { "code": "DOR-BRD",   "name": "Bridge Division",                        "nepali_name": "पुल महाशाखा",                  "cluster_type": "HQ_MAHASAKHA",   "branch_level": 3, "parent_branch_code": "DOR-HQ" },
  { "code": "DOR-DAID",  "name": "Development Assistance Implementation Division", "nepali_name": "विकास सहायता कार्यान्वयन महाशाखा", "cluster_type": "HQ_MAHASAKHA", "branch_level": 3, "parent_branch_code": "DOR-HQ" },
  { "code": "DOR-MCD",   "name": "Mechanical Division",                    "nepali_name": "यान्त्रिक महाशाखा",            "cluster_type": "HQ_MAHASAKHA",   "branch_level": 3, "parent_branch_code": "DOR-HQ" },
  { "code": "DOR-ADM",   "name": "Administration Unit",                    "nepali_name": "प्रशासन शाखा",                  "cluster_type": "HQ_ADMIN",       "branch_level": 3, "parent_branch_code": "DOR-HQ" },
  { "code": "DOR-FIN",   "name": "Financial Administration Unit",          "nepali_name": "आर्थिक प्रशासन शाखा",          "cluster_type": "HQ_ADMIN",       "branch_level": 3, "parent_branch_code": "DOR-HQ" },
  { "code": "DOR-LAW",   "name": "Law and Dispute Management Unit",        "nepali_name": "कानुन तथा विवाद व्यवस्थापन शाखा", "cluster_type": "HQ_ADMIN",    "branch_level": 3, "parent_branch_code": "DOR-HQ" },
  { "code": "DOR-QRDC",  "name": "Quality Research and Development Center","nepali_name": "गुण नियन्त्रण तथा अनुसन्धान केन्द्र", "cluster_type": "HQ_MAHASAKHA", "branch_level": 3, "parent_branch_code": "DOR-HQ" }
]
```

### 5.2 HQ Sub-Branches (branch_level = 2)

```json
[
  { "code": "PMD-PMEU",   "name": "Planning, Monitoring & Evaluation Branch (PMEU)", "nepali_name": "योजना अनुगमन तथा मूल्यांकन शाखा", "cluster_type": "HQ_MAHASAKHA", "branch_level": 2, "parent_branch_code": "DOR-PMD" },
  { "code": "PMD-GESU",   "name": "Geo-Environment and Social Branch (GESU)",         "nepali_name": "भू-वातावरण तथा सामाजिक शाखा",    "cluster_type": "HQ_MAHASAKHA", "branch_level": 2, "parent_branch_code": "DOR-PMD" },
  { "code": "PMD-RST",    "name": "Road Safety and Traffic Branch",                   "nepali_name": "सडक सुरक्षा तथा ट्राफिक शाखा",  "cluster_type": "HQ_MAHASAKHA", "branch_level": 2, "parent_branch_code": "DOR-PMD" },
  { "code": "PMD-ICT",    "name": "HMIS & ICT Branch",                                "nepali_name": "HMIS तथा ICT शाखा",             "cluster_type": "HQ_MAHASAKHA", "branch_level": 2, "parent_branch_code": "DOR-PMD" },
  { "code": "MTD-MRU",    "name": "Maintenance and Repair Unit",                      "nepali_name": "मर्मत सम्भार इकाई",             "cluster_type": "HQ_MAHASAKHA", "branch_level": 2, "parent_branch_code": "DOR-MTD" },
  { "code": "MTD-RAMU",   "name": "Road Assets Management Unit",                      "nepali_name": "सडक सम्पत्ति व्यवस्थापन इकाई",   "cluster_type": "HQ_MAHASAKHA", "branch_level": 2, "parent_branch_code": "DOR-MTD" },
  { "code": "BRD-DMU",    "name": "Design and Monitoring Unit",                       "nepali_name": "डिजाइन तथा अनुगमन इकाई",         "cluster_type": "HQ_MAHASAKHA", "branch_level": 2, "parent_branch_code": "DOR-BRD" },
  { "code": "BRD-MCU",    "name": "Maintenance Coordination Unit",                    "nepali_name": "मर्मत समन्वय इकाई",             "cluster_type": "HQ_MAHASAKHA", "branch_level": 2, "parent_branch_code": "DOR-BRD" },
  { "code": "BRD-BCCU",   "name": "Bridge Construction Coordination Unit",             "nepali_name": "पुल निर्माण समन्वय इकाई",       "cluster_type": "HQ_MAHASAKHA", "branch_level": 2, "parent_branch_code": "DOR-BRD" },
  { "code": "BRD-PIU",    "name": "Project Implementation Unit",                      "nepali_name": "परियोजना कार्यान्वयन इकाई",      "cluster_type": "HQ_MAHASAKHA", "branch_level": 2, "parent_branch_code": "DOR-BRD" },
  { "code": "DAID-BIL",   "name": "Bilateral Branch",                                 "nepali_name": "द्विपक्षीय शाखा",               "cluster_type": "HQ_MAHASAKHA", "branch_level": 2, "parent_branch_code": "DOR-DAID" },
  { "code": "DAID-MUL",   "name": "Multilateral Branch",                              "nepali_name": "बहुपक्षीय शाखा",                "cluster_type": "HQ_MAHASAKHA", "branch_level": 2, "parent_branch_code": "DOR-DAID" },
  { "code": "MCD-MMU",    "name": "Maintenance Management Unit",                      "nepali_name": "मर्मत व्यवस्थापन इकाई",          "cluster_type": "HQ_MAHASAKHA", "branch_level": 2, "parent_branch_code": "DOR-MCD" },
  { "code": "MCD-PPU",    "name": "Planning and Procurement Management Unit",         "nepali_name": "योजना तथा खरिद व्यवस्थापन इकाई", "cluster_type": "HQ_MAHASAKHA", "branch_level": 2, "parent_branch_code": "DOR-MCD" }
]
```

### 5.3 FRSMOs (branch_level = 2, cluster_type = FRSMO)

```json
[
  { "code": "FRSMO-DMK",  "name": "FRSMO Damak",     "nepali_name": "संघीय सडक सुपरीवेक्षण तथा अनुगमन कार्यालय, दमक",    "cluster_type": "FRSMO", "branch_level": 2, "parent_branch_code": "DOR-HQ" },
  { "code": "FRSMO-KTM",  "name": "FRSMO Kathmandu", "nepali_name": "संघीय सडक सुपरीवेक्षण तथा अनुगमन कार्यालय, काठमाडौं", "cluster_type": "FRSMO", "branch_level": 2, "parent_branch_code": "DOR-HQ" },
  { "code": "FRSMO-PKR",  "name": "FRSMO Pokhara",   "nepali_name": "संघीय सडक सुपरीवेक्षण तथा अनुगमन कार्यालय, पोखरा",  "cluster_type": "FRSMO", "branch_level": 2, "parent_branch_code": "DOR-HQ" },
  { "code": "FRSMO-SRK",  "name": "FRSMO Surkhet",   "nepali_name": "संघीय सडक सुपरीवेक्षण तथा अनुगमन कार्यालय, सुर्खेत", "cluster_type": "FRSMO", "branch_level": 2, "parent_branch_code": "DOR-HQ" }
]
```

### 5.4 Project Directorates (branch_level = 2, cluster_type = PROJECT_DIRECTORATE)

```json
[
  { "code": "PD-PUSH",  "name": "Pushpalal (Mid-Hill) Highway Project Directorate", "nepali_name": "पुष्पलाल (मध्यपहाडी) राजमार्ग परियोजना निर्देशनालय", "cluster_type": "PROJECT_DIRECTORATE", "branch_level": 2, "parent_branch_code": "DOR-HQ" },
  { "code": "PD-MADAN", "name": "Madan Bhandari Highway Project Directorate",       "nepali_name": "मदन भण्डारी राजमार्ग परियोजना निर्देशनालय",           "cluster_type": "PROJECT_DIRECTORATE", "branch_level": 2, "parent_branch_code": "DOR-HQ" },
  { "code": "PD-HULAK", "name": "Postal Highway Directorate",                       "nepali_name": "हुलाकी राजमार्ग निर्देशनालय",                        "cluster_type": "PROJECT_DIRECTORATE", "branch_level": 2, "parent_branch_code": "DOR-HQ" },
  { "code": "PD-ADB",   "name": "Project Directorate (ADB)",                        "nepali_name": "परियोजना निर्देशनालय (ADB)",                          "cluster_type": "PROJECT_DIRECTORATE", "branch_level": 2, "parent_branch_code": "DOR-HQ" },
  { "code": "PD-NSTR",  "name": "North-South & Trade Road Expansion Directorate",  "nepali_name": "उत्तर-दक्षिण तथा व्यापार सडक विस्तार निर्देशनालय",   "cluster_type": "PROJECT_DIRECTORATE", "branch_level": 2, "parent_branch_code": "DOR-HQ" }
]
```

### 5.5 Bridge Sectors (branch_level = 2, cluster_type = BRIDGE_SECTOR)

```json
[
  { "code": "BS-DHR",  "name": "Bridge Sector Dharan",     "nepali_name": "पुल सेक्टर, धरान",      "cluster_type": "BRIDGE_SECTOR", "branch_level": 2, "parent_branch_code": "DOR-BRD" },
  { "code": "BS-KTM",  "name": "Bridge Sector Kathmandu", "nepali_name": "पुल सेक्टर, काठमाडौं",  "cluster_type": "BRIDGE_SECTOR", "branch_level": 2, "parent_branch_code": "DOR-BRD" },
  { "code": "BS-PKR",  "name": "Bridge Sector Pokhara",   "nepali_name": "पुल सेक्टर, पोखरा",     "cluster_type": "BRIDGE_SECTOR", "branch_level": 2, "parent_branch_code": "DOR-BRD" },
  { "code": "BS-SRK",  "name": "Bridge Sector Surkhet",   "nepali_name": "पुल सेक्टर, सुर्खेत",   "cluster_type": "BRIDGE_SECTOR", "branch_level": 2, "parent_branch_code": "DOR-BRD" },
  { "code": "BS-NPG",  "name": "Bridge Sector Nepalgunj", "nepali_name": "पुल सेक्टर, नेपालगञ्ज", "cluster_type": "BRIDGE_SECTOR", "branch_level": 2, "parent_branch_code": "DOR-BRD" },
  { "code": "BS-DHG",  "name": "Bridge Sector Dhangadhi", "nepali_name": "पुल सेक्टर, धनगढी",     "cluster_type": "BRIDGE_SECTOR", "branch_level": 2, "parent_branch_code": "DOR-BRD" }
]
```

### 5.6 Road Divisions under FRSMOs (branch_level = 1, cluster_type = ROAD_DIVISION)

#### Under Damak FRSMO

```json
[
  { "code": "RD-ILM",  "name": "Road Division Ilam",        "nepali_name": "सडक डिभिजन, इलाम",       "cluster_type": "ROAD_DIVISION", "branch_level": 1, "parent_branch_code": "FRSMO-DMK" },
  { "code": "RD-DMK",  "name": "Road Division Damak",       "nepali_name": "सडक डिभिजन, दमक",        "cluster_type": "ROAD_DIVISION", "branch_level": 1, "parent_branch_code": "FRSMO-DMK" },
  { "code": "RD-BRT",  "name": "Road Division Biratnagar",  "nepali_name": "सडक डिभिजन, विराटनगर",   "cluster_type": "ROAD_DIVISION", "branch_level": 1, "parent_branch_code": "FRSMO-DMK" },
  { "code": "RD-DHK",  "name": "Road Division Dhankuta",    "nepali_name": "सडक डिभिजन, धनकुटा",     "cluster_type": "ROAD_DIVISION", "branch_level": 1, "parent_branch_code": "FRSMO-DMK" },
  { "code": "RD-LHN",  "name": "Road Division Lahan",       "nepali_name": "सडक डिभिजन, लहान",       "cluster_type": "ROAD_DIVISION", "branch_level": 1, "parent_branch_code": "FRSMO-DMK" },
  { "code": "RD-TML",  "name": "Road Division Tumlingtar",  "nepali_name": "सडक डिभिजन, तुम्लिंगटार", "cluster_type": "ROAD_DIVISION", "branch_level": 1, "parent_branch_code": "FRSMO-DMK" },
  { "code": "RD-HRK",  "name": "Road Division Harkapur",    "nepali_name": "सडक डिभिजन, हर्कपुर",    "cluster_type": "ROAD_DIVISION", "branch_level": 1, "parent_branch_code": "FRSMO-DMK" }
]
```

#### Under Kathmandu FRSMO

```json
[
  { "code": "RD-JNK",  "name": "Road Division Janakpur",       "nepali_name": "सडक डिभिजन, जनकपुर",         "cluster_type": "ROAD_DIVISION", "branch_level": 1, "parent_branch_code": "FRSMO-KTM" },
  { "code": "RD-CHR",  "name": "Road Division Charikot",        "nepali_name": "सडक डिभिजन, चरिकोट",         "cluster_type": "ROAD_DIVISION", "branch_level": 1, "parent_branch_code": "FRSMO-KTM" },
  { "code": "RD-CND",  "name": "Road Division Chandranigahpur", "nepali_name": "सडक डिभिजन, चन्द्रनिगाहपुर",  "cluster_type": "ROAD_DIVISION", "branch_level": 1, "parent_branch_code": "FRSMO-KTM" },
  { "code": "RD-HTD",  "name": "Road Division Hetauda",         "nepali_name": "सडक डिभिजन, हेटौडा",          "cluster_type": "ROAD_DIVISION", "branch_level": 1, "parent_branch_code": "FRSMO-KTM" },
  { "code": "RD-BRP",  "name": "Road Division Bharatpur",       "nepali_name": "सडक डिभिजन, भरतपुर",          "cluster_type": "ROAD_DIVISION", "branch_level": 1, "parent_branch_code": "FRSMO-KTM" },
  { "code": "RD-KTM",  "name": "Road Division Kathmandu",       "nepali_name": "सडक डिभिजन, काठमाडौं",        "cluster_type": "ROAD_DIVISION", "branch_level": 1, "parent_branch_code": "FRSMO-KTM" },
  { "code": "RD-BKT",  "name": "Road Division Bhaktapur",       "nepali_name": "सडक डिभिजन, भक्तपुर",         "cluster_type": "ROAD_DIVISION", "branch_level": 1, "parent_branch_code": "FRSMO-KTM" },
  { "code": "RD-LLP",  "name": "Road Division Lalitpur",        "nepali_name": "सडक डिभिजन, ललितपुर",         "cluster_type": "ROAD_DIVISION", "branch_level": 1, "parent_branch_code": "FRSMO-KTM" },
  { "code": "RD-NWK",  "name": "Road Division Nuwakot",         "nepali_name": "सडक डिभिजन, नुवाकोट",         "cluster_type": "ROAD_DIVISION", "branch_level": 1, "parent_branch_code": "FRSMO-KTM" },
  { "code": "RD-KHK",  "name": "Road Division Khurkot",         "nepali_name": "सडक डिभिजन, खुर्कोट",         "cluster_type": "ROAD_DIVISION", "branch_level": 1, "parent_branch_code": "FRSMO-KTM" }
]
```

#### Under Pokhara FRSMO

```json
[
  { "code": "RD-DML",  "name": "Road Division Damauli",  "nepali_name": "सडक डिभिजन, दमौली",  "cluster_type": "ROAD_DIVISION", "branch_level": 1, "parent_branch_code": "FRSMO-PKR" },
  { "code": "RD-PKR",  "name": "Road Division Pokhara",  "nepali_name": "सडक डिभिजन, पोखरा",  "cluster_type": "ROAD_DIVISION", "branch_level": 1, "parent_branch_code": "FRSMO-PKR" },
  { "code": "RD-PLP",  "name": "Road Division Palpa",    "nepali_name": "सडक डिभिजन, पाल्पा", "cluster_type": "ROAD_DIVISION", "branch_level": 1, "parent_branch_code": "FRSMO-PKR" },
  { "code": "RD-BGL",  "name": "Road Division Baglung",  "nepali_name": "सडक डिभिजन, बागलुङ", "cluster_type": "ROAD_DIVISION", "branch_level": 1, "parent_branch_code": "FRSMO-PKR" },
  { "code": "RD-BTW",  "name": "Road Division Butwal",   "nepali_name": "सडक डिभिजन, बुटवल",  "cluster_type": "ROAD_DIVISION", "branch_level": 1, "parent_branch_code": "FRSMO-PKR" },
  { "code": "RD-SHV",  "name": "Road Division Shivapur", "nepali_name": "सडक डिभिजन, शिवपुर", "cluster_type": "ROAD_DIVISION", "branch_level": 1, "parent_branch_code": "FRSMO-PKR" }
]
```

#### Under Surkhet FRSMO

```json
[
  { "code": "RD-SRK",  "name": "Road Division Surkhet",       "nepali_name": "सडक डिभिजन, सुर्खेत",    "cluster_type": "ROAD_DIVISION", "branch_level": 1, "parent_branch_code": "FRSMO-SRK" },
  { "code": "RD-CHJ",  "name": "Road Division Chaurajahari",  "nepali_name": "सडक डिभिजन, चौरजहारी",  "cluster_type": "ROAD_DIVISION", "branch_level": 1, "parent_branch_code": "FRSMO-SRK" },
  { "code": "RD-JML",  "name": "Road Division Jumla",         "nepali_name": "सडक डिभिजन, जुम्ला",    "cluster_type": "ROAD_DIVISION", "branch_level": 1, "parent_branch_code": "FRSMO-SRK" },
  { "code": "RD-NPG",  "name": "Road Division Nepalgunj",     "nepali_name": "सडक डिभिजन, नेपालगञ्ज", "cluster_type": "ROAD_DIVISION", "branch_level": 1, "parent_branch_code": "FRSMO-SRK" },
  { "code": "RD-DTI",  "name": "Road Division Doti",          "nepali_name": "सडक डिभिजन, डोटी",      "cluster_type": "ROAD_DIVISION", "branch_level": 1, "parent_branch_code": "FRSMO-SRK" },
  { "code": "RD-DNG",  "name": "Road Division Dang",          "nepali_name": "सडक डिभिजन, दाङ्ग",     "cluster_type": "ROAD_DIVISION", "branch_level": 1, "parent_branch_code": "FRSMO-SRK" },
  { "code": "RD-BTD",  "name": "Road Division Baitadi",       "nepali_name": "सडक डिभिजन, बैतडी",     "cluster_type": "ROAD_DIVISION", "branch_level": 1, "parent_branch_code": "FRSMO-SRK" },
  { "code": "RD-PYT",  "name": "Road Division Pyuthan",       "nepali_name": "सडक डिभिजन, प्युठान",   "cluster_type": "ROAD_DIVISION", "branch_level": 1, "parent_branch_code": "FRSMO-SRK" },
  { "code": "RD-SFB",  "name": "Road Division Sanfebagar",    "nepali_name": "सडक डिभिजन, साँफेबगर",  "cluster_type": "ROAD_DIVISION", "branch_level": 1, "parent_branch_code": "FRSMO-SRK" },
  { "code": "RD-MHN",  "name": "Road Division Mahendranagar", "nepali_name": "सडक डिभिजन, महेन्द्रनगर","cluster_type": "ROAD_DIVISION", "branch_level": 1, "parent_branch_code": "FRSMO-SRK" }
]
```

### 5.7 Project Offices (branch_level = 1, cluster_type = PROJECT_OFFICE)

```json
[
  { "code": "PO-PUSH-PCT", "name": "Pushpalal Project Office Panchthar", "cluster_type": "PROJECT_OFFICE", "branch_level": 1, "parent_branch_code": "PD-PUSH" },
  { "code": "PO-PUSH-RMC", "name": "Pushpalal Project Office Ramechhap", "cluster_type": "PROJECT_OFFICE", "branch_level": 1, "parent_branch_code": "PD-PUSH" },
  { "code": "PO-PUSH-GRK", "name": "Pushpalal Project Office Gorkha",    "cluster_type": "PROJECT_OFFICE", "branch_level": 1, "parent_branch_code": "PD-PUSH" },
  { "code": "PO-PUSH-PRB", "name": "Pushpalal Project Office Parbat",    "cluster_type": "PROJECT_OFFICE", "branch_level": 1, "parent_branch_code": "PD-PUSH" },
  { "code": "PO-PUSH-DLK", "name": "Pushpalal Project Office Dailekh",   "cluster_type": "PROJECT_OFFICE", "branch_level": 1, "parent_branch_code": "PD-PUSH" },
  { "code": "PO-MBH-DMK",  "name": "Madan Bhandari Project Office Damak",    "cluster_type": "PROJECT_OFFICE", "branch_level": 1, "parent_branch_code": "PD-MADAN" },
  { "code": "PO-MBH-GIG",  "name": "Madan Bhandari Project Office Gaighat",  "cluster_type": "PROJECT_OFFICE", "branch_level": 1, "parent_branch_code": "PD-MADAN" },
  { "code": "PO-MBH-HTD",  "name": "Madan Bhandari Project Office Hetauda",  "cluster_type": "PROJECT_OFFICE", "branch_level": 1, "parent_branch_code": "PD-MADAN" },
  { "code": "PO-MBH-GLM",  "name": "Madan Bhandari Project Office Gulmi",    "cluster_type": "PROJECT_OFFICE", "branch_level": 1, "parent_branch_code": "PD-MADAN" },
  { "code": "PO-MBH-SRK",  "name": "Madan Bhandari Project Office Surkhet",  "cluster_type": "PROJECT_OFFICE", "branch_level": 1, "parent_branch_code": "PD-MADAN" },
  { "code": "PO-HLK-ITH",  "name": "Postal Highway Project Office Itahari",   "cluster_type": "PROJECT_OFFICE", "branch_level": 1, "parent_branch_code": "PD-HULAK" },
  { "code": "PO-HLK-JNK",  "name": "Postal Highway Project Office Janakpur",  "cluster_type": "PROJECT_OFFICE", "branch_level": 1, "parent_branch_code": "PD-HULAK" },
  { "code": "PO-HLK-BRG",  "name": "Postal Highway Project Office Birgunj",   "cluster_type": "PROJECT_OFFICE", "branch_level": 1, "parent_branch_code": "PD-HULAK" },
  { "code": "PO-HLK-KPL",  "name": "Postal Highway Project Office Kapilvastu","cluster_type": "PROJECT_OFFICE", "branch_level": 1, "parent_branch_code": "PD-HULAK" },
  { "code": "PO-HLK-NPG",  "name": "Postal Highway Project Office Nepalgunj", "cluster_type": "PROJECT_OFFICE", "branch_level": 1, "parent_branch_code": "PD-HULAK" },
  { "code": "PO-HLK-DHG",  "name": "Postal Highway Project Office Dhangadhi", "cluster_type": "PROJECT_OFFICE", "branch_level": 1, "parent_branch_code": "PD-HULAK" },
  { "code": "PO-ADB-NBR",  "name": "ADB Project Narayangadh-Butwal",    "cluster_type": "PROJECT_OFFICE", "branch_level": 1, "parent_branch_code": "PD-ADB" },
  { "code": "PO-ADB-MPR",  "name": "ADB Project Mugling-Pokhara",       "cluster_type": "PROJECT_OFFICE", "branch_level": 1, "parent_branch_code": "PD-ADB" }
]
```

### 5.8 Heavy Equipment Divisions & Mechanical Offices

```json
[
  { "code": "HED-ITH", "name": "HED Itahari",    "cluster_type": "HED",              "branch_level": 2, "parent_branch_code": "DOR-MCD" },
  { "code": "HED-JNK", "name": "HED Janakpur",   "cluster_type": "HED",              "branch_level": 2, "parent_branch_code": "DOR-MCD" },
  { "code": "HED-HTD", "name": "HED Hetauda",    "cluster_type": "HED",              "branch_level": 2, "parent_branch_code": "DOR-MCD" },
  { "code": "HED-KTM", "name": "HED Kathmandu",  "cluster_type": "HED",              "branch_level": 2, "parent_branch_code": "DOR-MCD" },
  { "code": "HED-PKR", "name": "HED Pokhara",    "cluster_type": "HED",              "branch_level": 2, "parent_branch_code": "DOR-MCD" },
  { "code": "HED-BTW", "name": "HED Butwal",     "cluster_type": "HED",              "branch_level": 2, "parent_branch_code": "DOR-MCD" },
  { "code": "HED-NPG", "name": "HED Nepalgunj",  "cluster_type": "HED",              "branch_level": 2, "parent_branch_code": "DOR-MCD" },
  { "code": "HED-GDW", "name": "HED Godawari",   "cluster_type": "HED",              "branch_level": 2, "parent_branch_code": "DOR-MCD" },
  { "code": "MO-PHD",  "name": "MO Phidim",      "cluster_type": "MECHANICAL_OFFICE","branch_level": 1, "parent_branch_code": "HED-ITH"  },
  { "code": "MO-LHN",  "name": "MO Lahan",       "cluster_type": "MECHANICAL_OFFICE","branch_level": 1, "parent_branch_code": "HED-JNK"  },
  { "code": "MO-MLK",  "name": "MO Mulkot",      "cluster_type": "MECHANICAL_OFFICE","branch_level": 1, "parent_branch_code": "HED-HTD"  },
  { "code": "MO-NWK",  "name": "MO Nuwakot",     "cluster_type": "MECHANICAL_OFFICE","branch_level": 1, "parent_branch_code": "HED-KTM"  },
  { "code": "MO-DMR",  "name": "MO Dumre",       "cluster_type": "MECHANICAL_OFFICE","branch_level": 1, "parent_branch_code": "HED-PKR"  },
  { "code": "MO-DNG",  "name": "MO Dang",        "cluster_type": "MECHANICAL_OFFICE","branch_level": 1, "parent_branch_code": "HED-BTW"  },
  { "code": "MO-JML",  "name": "MO Jumla",       "cluster_type": "MECHANICAL_OFFICE","branch_level": 1, "parent_branch_code": "HED-NPG"  },
  { "code": "MO-BDR",  "name": "MO Budar",       "cluster_type": "MECHANICAL_OFFICE","branch_level": 1, "parent_branch_code": "HED-NPG"  },
  { "code": "MTC-LLP", "name": "Mechanical Training Center Lalitpur", "cluster_type": "MECHANICAL_OFFICE", "branch_level": 2, "parent_branch_code": "DOR-MCD" }
]
```

---

## 6. Personnel Structure per Office Type

### 6.1 FRSMO / Project Directorate

Head: **Superintending Engineer** (SUPERINTENDENT_ENGINEER)

| Level | Role | Count |
|-------|------|-------|
| Head | Superintending Engineer | 1 |
| L2 | Senior Division Engineer (SDE) | 1 |
| L3 | Engineer | 1–2 |
| L3 | Section Officer (Prasasan Sakha) | 1 |
| L3 | Account Officer (Lekha Sakha) | 1 |
| L4 | Nayeb Subba | 1–2 |
| L4 | Accountant | 1 |
| L4 | Computer Operator | 1 |
| L4 | Sub Engineer | 1–2 |
| L5 | Kharidaar | 1 |

### 6.2 Road Division / Project Office

Head: **Senior Division Engineer** (SENIOR_ENGINEER)

| Level | Role | Count |
|-------|------|-------|
| Head | Senior Division Engineer | 1 |
| L2 | Engineer | 1–2 |
| L2 | Section Officer (Prasasan Sakha) | 1 |
| L2 | Account Officer (Lekha Sakha) | 1 |
| L3 | Nayeb Subba | 1–2 |
| L3 | Accountant | 1 |
| L3 | Computer Operator | 1 |
| L3 | Sub Engineer | 1–2 |
| L4 | Kharidaar | 1 |

### 6.3 HQ Technical Branches (Prabidhik Sakha)

Head: **SDE** (1–2 depending on branch)

| Branch | Personnel |
|--------|-----------|
| PMEU | SDE + 3 Engineers |
| GESU | SDE + 2 Engineers + Geologist + Sociologist + BaNi (IT) |
| Road Safety | SDE + 2 Engineers |
| HMIS & ICT | SDE + Engineer + Computer Engineer + Computer Operator |
| Maintenance & Repair | SDE + Engineer |
| Road Assets | SDE + Engineer |
| Bridge Design & Monitoring | 2 SDEs + 8 Engineers + 2 Hydrologists |
| Bridge Maintenance Coordination | SDE + 4 Engineers |
| Bridge Construction Coordination | SDE + 4 Engineers |
| Bridge Project Implementation | SDE + 3 Engineers |
| Bilateral | SDE + Engineer |
| Multilateral | SDE + Engineer |
| Mechanical Maintenance | SDE + Mechanical Engineer |
| Mechanical Procurement | SDE + Mechanical Engineer + Store Officer + Store Mechanic |

### 6.4 HQ Administrative Wing

| Branch | Head | Staff |
|--------|------|-------|
| Administration Unit | Chief Administrative Officer | 2 Officers, 3 Computer Operators, 8 Nayeb Subbas |
| Financial Administration Unit | Chief Accounts Controller | Account Officer → Accountant |
| Law and Dispute Management Unit | Deputy Secretary - Law | Engineer + Law Officer → Nayeb Subba |

### 6.5 DOR HQ Leadership

| Position | Role | Reports To |
|----------|------|-----------|
| DG (Director General) | SUPER_ADMIN | Ministry |
| DDG (Deputy Director General) | DEPARTMENT_ADMIN | DG |
| Superintending Engineers (one per Mahasakha/FRSMO) | SUPERINTENDENT_ENGINEER | DDG |

---

## 7. DOR-Specific Concepts & GovFlow Implementation

### 7.1 Tok (टोक) — Targeted Assignment

**What it is:** A senior officer (SDE, SE, DDG, DG) formally assigns a file or a specific task within a file to a named subordinate or colleague for action. Tok creates accountability — the assigned person must complete the task and return it.

**Difference from regular assignment:** Regular GovFlow assignment is automatic based on role/stage. Tok is a deliberate, targeted delegation by name, recorded and audited.

**When it happens:**
- SDE (Office Admin) → Tok to specific Engineer (Stage 3)
- SDE/SE/DDG/DG → Tok to Lekha/Prasasan/Prabidhik Sakha officer (Stages 5–8)

**GovFlow Implementation:**
- Add `TOK` to the `StageAction` enum
- Create `tok_assignments` table (see Section 4.3)
- When Tok is executed: create a `tok_assignments` record, notify the target person, set file status to `TOK_ACTIVE`
- The file remains at the current officer's stage — it does NOT move to a new stage
- The tokked person sees the file in a "Tok Assigned to Me" dashboard section
- On completion, the tokked person submits a response note and the file returns to the original officer
- Original officer can now proceed with their action

**API endpoint to add:**
```
POST /files/:id/actions/tok
Body: { targetUserId, taskDescription }

POST /files/:id/tok/:tokId/complete
Body: { responseNote }
```

### 7.2 Raye (राय) — Formal Opinion Request

**What it is:** A formal request from a decision-maker to another Sakha (branch) for their written opinion on a file. The file pauses at the current approver while the Raye is pending. The target Sakha officer writes their opinion and returns it.

**Who requests Raye:** SDE, SE, DDG, DG — at their respective approval stages.

**Target Sakha types:**
- `PRABIDHIK` (Technical) → Engineer in the technical branch
- `PRASASAN` (Admin) → Section Officer
- `LEKHA` (Finance/Accounts) → Account Officer
- `KAANUN` (Legal) → Law Officer

**Raye can be chained:** The Raye respondent can, in some cases, further delegate within their Sakha (can assign to associates before responding).

**GovFlow Implementation:**
- Add `RAYE` to the `StageAction` enum
- Create `raye_requests` table (see Section 4.2)
- When Raye is requested: create a `raye_requests` record, set submission status to `RAYE_PENDING`, notify target officer
- File remains at the approver's stage but shows "Raye Pending" indicator
- Target Sakha officer sees Raye requests in a separate "Raye Inbox" dashboard view
- On Raye response: `raye_requests.status = RESPONDED`, notify the requesting officer, clear `RAYE_PENDING` status
- Approver can request multiple concurrent Rayes from different Sakhas

**API endpoint to add:**
```
POST /files/:id/actions/raye
Body: { targetSakha, targetBranchId, targetUserId?, requestText, dueAt? }

POST /files/:id/raye/:rayeId/respond
Body: { responseText }
```

**Dashboard panel to add:** "Raye Assigned to Me" — list of pending Raye requests with submission context.

### 7.3 Tippani (टिप्पणी) — Technical Note

**What it is:** A formal technical note prepared by the Engineer before forwarding the file to the SDE. It contains the Engineer's analysis, findings, and recommendation on the file. It is a mandatory document at Stage 4 (Engineer stage) before forwarding.

**Structure of a Tippani:**
- Subject/Title
- Reference to submission tracking number
- Summary of technical review
- Findings (issues found, if any)
- Recommendation (approve / conditional approval / reject — with reasoning)
- Prepared by (Engineer name, designation, date)

**GovFlow Implementation:**
- Add `TIPPANI` to document_type options
- Create `tippani_metadata` table (see Section 4.4)
- Make TIPPANI a required document before forwarding from the Engineer stage
- Add a "Prepare Tippani" button in the Engineer stage action panel — opens a structured form (not just a file upload)
- On submission: auto-generates a formatted PDF from the form data and stores it as a document version
- The Tippani PDF is watermarked and included in the final file archive

**In workflow_stages required_document_types:**
```json
["TIPPANI"]  // added to Engineer stage required docs
```

### 7.4 Approval Thresholds (VO-specific)

The Variation Order workflow has conditional approval authority based on the VO percentage value:

| Approval Level | Can Approve If | Must Forward If |
|---------------|---------------|----------------|
| SDE (Stage 5) | VO < 10% of original contract | VO ≥ 10% → forward to SE |
| SE (Stage 6) | VO < 15% of original contract | VO ≥ 15% → forward to DDG |
| DDG (Stage 7) | Any remaining VO | May forward to DG for very large VOs |
| DG (Stage 8) | Any | May forward to Ministry |

**Implementation in workflow routing rules:**
```json
{
  "stageId": "vo-s5-sde",
  "routingRules": [
    {
      "conditionField": "vo_percentage",
      "operator": "LT",
      "conditionValue": "10",
      "toStageId": "vo-terminal-sde",
      "isDefaultRoute": false,
      "ruleOrder": 0,
      "actionType": "APPROVE"
    },
    {
      "conditionField": "vo_percentage",
      "operator": "GTE",
      "conditionValue": "10",
      "toStageId": "vo-s6-se",
      "isDefaultRoute": false,
      "ruleOrder": 1,
      "actionType": "FORWARD"
    }
  ]
}
```

### 7.5 "Forward to Ministry" Terminal Action

At Stage 8 (DG), one possible action is "Forward to Ministry" — this escalates the file outside the GovFlow system to the Ministry. In GovFlow implementation:
- Add `FORWARDED_TO_MINISTRY` to `submission_status` enum
- Set the file status to `FORWARDED_TO_MINISTRY`
- Generate a signed summary PDF of the full file history
- Notify all relevant parties
- The file is locked in GovFlow from further editing

---

## 8. Workflow Configurations

### 8.1 Variation Order (VO) — Full 8-Stage Workflow

This is the primary workflow from the DOR sample. A contractor submits a Variation Order which may travel from Road Division level all the way to the DG depending on the VO value percentage.

```json
{
  "id": "wf-dor-001",
  "name": "Variation Order (VO) Approval",
  "nepali_name": "परिवर्तन आदेश (VO) स्वीकृति",
  "description": "Full variation order approval from contractor submission through SDE, SE, DDG, and DG based on VO percentage thresholds",
  "departmentCode": "DOR",
  "version": 1,
  "status": "ACTIVE",
  "isPubliclyTrackable": false,
  "publicDetailLevel": "BASIC",
  "metadataSchema": [
    { "key": "original_contract_amount", "label": "Original Contract Amount (NPR)", "type": "NUMBER", "required": true },
    { "key": "vo_amount",                "label": "VO Amount (NPR)",                "type": "NUMBER", "required": true },
    { "key": "vo_percentage",            "label": "VO Percentage (%)",              "type": "NUMBER", "required": false, "computed": true, "formula": "(vo_amount / original_contract_amount) * 100" },
    { "key": "contract_number",          "label": "Contract Number",                "type": "TEXT",   "required": true },
    { "key": "contractor_name",          "label": "Contractor Name",                "type": "TEXT",   "required": true },
    { "key": "project_name",             "label": "Project / Road Name",            "type": "TEXT",   "required": true },
    { "key": "vo_reason",                "label": "Reason for VO",                  "type": "TEXT",   "required": true },
    { "key": "road_division_code",       "label": "Road Division Code",             "type": "TEXT",   "required": true }
  ],
  "stages": [
    {
      "id": "vo-s1-contractor",
      "name": "Stage 1 — Contractor Submission",
      "stageOrder": 1,
      "stageType": "SEQUENTIAL",
      "assignedRole": "CONTRACTOR",
      "slaDays": null,
      "isEntryStage": true,
      "isTerminalStage": false,
      "requiresDigitalSignature": false,
      "allowedActions": ["SUBMIT"],
      "requiredDocumentTypes": ["VO_DOCUMENT", "MEASUREMENT_BOOK", "OTHER"],
      "routingRules": [
        { "isDefaultRoute": true, "toStageId": "vo-s2-entry", "ruleOrder": 0 }
      ]
    },
    {
      "id": "vo-s2-entry",
      "name": "Stage 2 — Entry Desk",
      "nepali_name": "द्वितीय चरण — दर्ता",
      "stageOrder": 2,
      "stageType": "SEQUENTIAL",
      "assignedRole": "ENTRY_DESK_OFFICER",
      "slaDays": 1,
      "slaWarningDays": 1,
      "isEntryStage": false,
      "isTerminalStage": false,
      "requiresDigitalSignature": false,
      "allowedActions": ["FORWARD", "REJECT_TO_CONTRACTOR", "COMMENT"],
      "requiredDocumentTypes": [],
      "routingRules": [
        { "isDefaultRoute": true, "toStageId": "vo-s3-sde-admin", "ruleOrder": 0 }
      ],
      "allowedRejectionTargets": []
    },
    {
      "id": "vo-s3-sde-admin",
      "name": "Stage 3 — SDE (Office Admin) — Tok Assignment",
      "nepali_name": "तृतीय चरण — वरिष्ठ डिभिजनल इञ्जिनियर (प्रशासन)",
      "stageOrder": 3,
      "stageType": "SEQUENTIAL",
      "assignedRole": "SENIOR_ENGINEER",
      "slaDays": 2,
      "slaWarningDays": 1,
      "isEntryStage": false,
      "isTerminalStage": false,
      "requiresDigitalSignature": false,
      "allowedActions": ["TOK", "COMMENT", "REJECT_TO_CONTRACTOR", "REJECT_ANY"],
      "requiredDocumentTypes": [],
      "routingRules": [
        { "isDefaultRoute": true, "toStageId": "vo-s4-engineer", "ruleOrder": 0 }
      ],
      "allowedRejectionTargets": ["vo-s1-contractor"],
      "note": "SDE (Admin) selects a specific Engineer via Tok and sends file for technical review"
    },
    {
      "id": "vo-s4-engineer",
      "name": "Stage 4 — Engineer (Prabidhik Sakha) Review",
      "nepali_name": "चतुर्थ चरण — इञ्जिनियर (प्राविधिक शाखा)",
      "stageOrder": 4,
      "stageType": "SEQUENTIAL",
      "assignedRole": "ENGINEER",
      "slaDays": 5,
      "slaWarningDays": 2,
      "isEntryStage": false,
      "isTerminalStage": false,
      "requiresDigitalSignature": false,
      "allowedActions": ["FORWARD", "REJECT_TO_CONTRACTOR", "COMMENT", "QUERY", "TOK"],
      "requiredDocumentTypes": ["TIPPANI"],
      "routingRules": [
        { "isDefaultRoute": true, "toStageId": "vo-s5-sde-head", "ruleOrder": 0 }
      ],
      "allowedRejectionTargets": ["vo-s1-contractor"],
      "note": "Engineer can Tok to Sub Engineer for BOQ check. Must prepare TIPPANI before forwarding to SDE"
    },
    {
      "id": "vo-s5-sde-head",
      "name": "Stage 5 — SDE (Division/Project Head) Decision",
      "nepali_name": "पञ्चम चरण — वरिष्ठ डिभिजनल इञ्जिनियर (कार्यालय प्रमुख)",
      "stageOrder": 5,
      "stageType": "SEQUENTIAL",
      "assignedRole": "SENIOR_ENGINEER",
      "slaDays": 5,
      "slaWarningDays": 2,
      "isEntryStage": false,
      "isTerminalStage": false,
      "requiresDigitalSignature": true,
      "signatureTier": 1,
      "allowedActions": ["FORWARD", "APPROVE", "REJECT", "REJECT_ANY", "COMMENT", "QUERY", "HOLD", "TOK", "RAYE", "SIGN"],
      "requiredDocumentTypes": [],
      "routingRules": [
        {
          "conditionField": "vo_percentage",
          "operator": "LT",
          "conditionValue": "10",
          "toStageId": "vo-terminal-approved",
          "isDefaultRoute": false,
          "ruleOrder": 0,
          "actionType": "APPROVE"
        },
        {
          "conditionField": "vo_percentage",
          "operator": "GTE",
          "conditionValue": "10",
          "toStageId": "vo-s6-se",
          "isDefaultRoute": false,
          "ruleOrder": 1,
          "actionType": "FORWARD"
        }
      ],
      "allowedRejectionTargets": ["vo-s1-contractor", "vo-s2-entry", "vo-s3-sde-admin", "vo-s4-engineer"],
      "allowedRayeTargets": ["PRABIDHIK", "PRASASAN", "LEKHA"],
      "approvalThreshold": { "field": "vo_percentage", "operator": "LT", "value": 10 }
    },
    {
      "id": "vo-s6-se",
      "name": "Stage 6 — Superintending Engineer (FRSMO/Directorate Head)",
      "nepali_name": "षष्ठ चरण — सुपरिन्टेन्डिङ इञ्जिनियर",
      "stageOrder": 6,
      "stageType": "SEQUENTIAL",
      "assignedRole": "SUPERINTENDENT_ENGINEER",
      "slaDays": 7,
      "slaWarningDays": 2,
      "isEntryStage": false,
      "isTerminalStage": false,
      "requiresDigitalSignature": true,
      "signatureTier": 1,
      "allowedActions": ["FORWARD", "APPROVE", "REJECT", "REJECT_ANY", "COMMENT", "QUERY", "HOLD", "TOK", "RAYE", "SIGN"],
      "requiredDocumentTypes": [],
      "routingRules": [
        {
          "conditionField": "vo_percentage",
          "operator": "LT",
          "conditionValue": "15",
          "toStageId": "vo-terminal-approved",
          "isDefaultRoute": false,
          "ruleOrder": 0,
          "actionType": "APPROVE"
        },
        {
          "conditionField": "vo_percentage",
          "operator": "GTE",
          "conditionValue": "15",
          "toStageId": "vo-s7-ddg",
          "isDefaultRoute": false,
          "ruleOrder": 1,
          "actionType": "FORWARD"
        }
      ],
      "allowedRejectionTargets": ["vo-s1-contractor", "vo-s2-entry", "vo-s3-sde-admin", "vo-s4-engineer", "vo-s5-sde-head"],
      "allowedRayeTargets": ["PRABIDHIK", "PRASASAN", "LEKHA"],
      "approvalThreshold": { "field": "vo_percentage", "operator": "LT", "value": 15 }
    },
    {
      "id": "vo-s7-ddg",
      "name": "Stage 7 — DDG (Mahasakha / Division Head)",
      "nepali_name": "सप्तम चरण — उप महानिर्देशक",
      "stageOrder": 7,
      "stageType": "SEQUENTIAL",
      "assignedRole": "DEPARTMENT_ADMIN",
      "slaDays": 7,
      "slaWarningDays": 2,
      "isEntryStage": false,
      "isTerminalStage": false,
      "requiresDigitalSignature": true,
      "signatureTier": 2,
      "allowedActions": ["FORWARD", "APPROVE", "REJECT", "REJECT_ANY", "COMMENT", "QUERY", "HOLD", "TOK", "RAYE", "SIGN"],
      "requiredDocumentTypes": [],
      "routingRules": [
        { "isDefaultRoute": false, "toStageId": "vo-terminal-approved", "ruleOrder": 0, "actionType": "APPROVE" },
        { "isDefaultRoute": true,  "toStageId": "vo-s8-dg",             "ruleOrder": 1, "actionType": "FORWARD" }
      ],
      "allowedRejectionTargets": ["vo-s1-contractor", "vo-s2-entry", "vo-s4-engineer", "vo-s5-sde-head", "vo-s6-se"],
      "allowedRayeTargets": ["PRABIDHIK", "PRASASAN", "LEKHA", "KAANUN"]
    },
    {
      "id": "vo-s8-dg",
      "name": "Stage 8 — DG (DOR Head)",
      "nepali_name": "अष्टम चरण — महानिर्देशक",
      "stageOrder": 8,
      "stageType": "SEQUENTIAL",
      "assignedRole": "SUPER_ADMIN",
      "slaDays": 7,
      "slaWarningDays": 2,
      "isEntryStage": false,
      "isTerminalStage": false,
      "requiresDigitalSignature": true,
      "signatureTier": 2,
      "allowedActions": ["APPROVE", "REJECT", "REJECT_ANY", "COMMENT", "QUERY", "HOLD", "TOK", "RAYE", "FORWARD_TO_MINISTRY", "SIGN"],
      "requiredDocumentTypes": [],
      "routingRules": [
        { "isDefaultRoute": false, "toStageId": "vo-terminal-approved",  "ruleOrder": 0, "actionType": "APPROVE" },
        { "isDefaultRoute": false, "toStageId": "vo-terminal-ministry",  "ruleOrder": 1, "actionType": "FORWARD_TO_MINISTRY" }
      ],
      "allowedRejectionTargets": ["vo-s1-contractor", "vo-s2-entry", "vo-s4-engineer", "vo-s5-sde-head", "vo-s6-se", "vo-s7-ddg"],
      "allowedRayeTargets": ["PRABIDHIK", "PRASASAN", "LEKHA", "KAANUN"]
    },
    {
      "id": "vo-terminal-approved",
      "name": "Approved & Archived",
      "nepali_name": "स्वीकृत तथा अभिलेखित",
      "stageOrder": 9,
      "stageType": "SEQUENTIAL",
      "assignedRole": "ENTRY_DESK_OFFICER",
      "slaDays": null,
      "isEntryStage": false,
      "isTerminalStage": true,
      "requiresDigitalSignature": false,
      "allowedActions": [],
      "routingRules": []
    },
    {
      "id": "vo-terminal-ministry",
      "name": "Forwarded to Ministry",
      "nepali_name": "मन्त्रालयमा पठाइयो",
      "stageOrder": 9,
      "stageType": "SEQUENTIAL",
      "assignedRole": "SUPER_ADMIN",
      "slaDays": null,
      "isEntryStage": false,
      "isTerminalStage": true,
      "requiresDigitalSignature": false,
      "allowedActions": [],
      "routingRules": []
    }
  ]
}
```

### 8.2 IPC (Interim Payment Certificate) — Simplified Workflow

```json
{
  "id": "wf-dor-002",
  "name": "IPC Approval — Interim Payment Certificate",
  "nepali_name": "आंशिक भुक्तानी प्रमाणपत्र स्वीकृति",
  "description": "Approval workflow for contractor interim payment certificates at Road Division level",
  "departmentCode": "DOR",
  "version": 1,
  "status": "ACTIVE",
  "isPubliclyTrackable": false,
  "metadataSchema": [
    { "key": "contract_number",    "label": "Contract Number",          "type": "TEXT",   "required": true },
    { "key": "ipc_number",         "label": "IPC Number",               "type": "NUMBER", "required": true },
    { "key": "payment_amount",     "label": "Payment Amount (NPR)",     "type": "NUMBER", "required": true },
    { "key": "physical_progress",  "label": "Physical Progress (%)",    "type": "NUMBER", "required": true },
    { "key": "financial_progress", "label": "Financial Progress (%)",   "type": "NUMBER", "required": true },
    { "key": "measurement_date",   "label": "Measurement Date",         "type": "DATE",   "required": true },
    { "key": "contractor_name",    "label": "Contractor Name",          "type": "TEXT",   "required": true }
  ],
  "stages": [
    {
      "id": "ipc-s1", "name": "Contractor Submission", "stageOrder": 1, "stageType": "SEQUENTIAL",
      "assignedRole": "CONTRACTOR", "isEntryStage": true, "isTerminalStage": false,
      "allowedActions": ["SUBMIT"],
      "requiredDocumentTypes": ["IPC_FORM", "MEASUREMENT_BOOK", "PHOTO"],
      "routingRules": [{ "isDefaultRoute": true, "toStageId": "ipc-s2" }]
    },
    {
      "id": "ipc-s2", "name": "Entry Desk", "stageOrder": 2,
      "assignedRole": "ENTRY_DESK_OFFICER", "slaDays": 1,
      "allowedActions": ["FORWARD", "REJECT_TO_CONTRACTOR", "COMMENT"],
      "routingRules": [{ "isDefaultRoute": true, "toStageId": "ipc-s3" }]
    },
    {
      "id": "ipc-s3", "name": "Sub Engineer — Measurement Verification", "stageOrder": 3,
      "assignedRole": "SUB_ENGINEER", "slaDays": 3,
      "allowedActions": ["FORWARD", "REJECT", "QUERY", "COMMENT"],
      "requiredDocumentTypes": [],
      "routingRules": [{ "isDefaultRoute": true, "toStageId": "ipc-s4" }],
      "allowedRejectionTargets": ["ipc-s1", "ipc-s2"]
    },
    {
      "id": "ipc-s4", "name": "Engineer — Technical Review & Tippani", "stageOrder": 4,
      "assignedRole": "ENGINEER", "slaDays": 5,
      "allowedActions": ["FORWARD", "REJECT", "REJECT_ANY", "QUERY", "COMMENT", "TOK"],
      "requiredDocumentTypes": ["TIPPANI"],
      "routingRules": [{ "isDefaultRoute": true, "toStageId": "ipc-s5" }],
      "allowedRejectionTargets": ["ipc-s1", "ipc-s2", "ipc-s3"]
    },
    {
      "id": "ipc-s5", "name": "Account Officer — Financial Verification (Raye)", "stageOrder": 5,
      "assignedRole": "ACCOUNT_OFFICER", "slaDays": 3,
      "allowedActions": ["FORWARD", "REJECT", "COMMENT", "QUERY"],
      "requiredDocumentTypes": [],
      "routingRules": [{ "isDefaultRoute": true, "toStageId": "ipc-s6" }],
      "allowedRejectionTargets": ["ipc-s4"],
      "note": "This stage represents the Lekha Sakha Raye response. Triggered only if Engineer or SDE requests Raye to Lekha."
    },
    {
      "id": "ipc-s6", "name": "SDE — Final Approval", "stageOrder": 6,
      "assignedRole": "SENIOR_ENGINEER", "slaDays": 5,
      "isTerminalStage": true,
      "requiresDigitalSignature": true, "signatureTier": 2,
      "allowedActions": ["APPROVE", "REJECT", "REJECT_ANY", "COMMENT", "RAYE", "TOK", "SIGN"],
      "routingRules": [],
      "allowedRejectionTargets": ["ipc-s1", "ipc-s2", "ipc-s3", "ipc-s4", "ipc-s5"]
    }
  ]
}
```

### 8.3 Contract Agreement Approval

```json
{
  "id": "wf-dor-003",
  "name": "Contract Agreement Approval",
  "nepali_name": "ठेक्का सम्झौता स्वीकृति",
  "description": "Approval workflow for new contract agreements before work commencement",
  "departmentCode": "DOR",
  "version": 1,
  "status": "ACTIVE",
  "isPubliclyTrackable": true,
  "publicDetailLevel": "BASIC",
  "metadataSchema": [
    { "key": "contract_number",     "label": "Contract Number",           "type": "TEXT",   "required": true },
    { "key": "contract_amount",     "label": "Contract Amount (NPR)",     "type": "NUMBER", "required": true },
    { "key": "project_name",        "label": "Project Name",              "type": "TEXT",   "required": true },
    { "key": "contractor_name",     "label": "Contractor Name",           "type": "TEXT",   "required": true },
    { "key": "contractor_pan",      "label": "Contractor PAN",            "type": "TEXT",   "required": true },
    { "key": "contract_type",       "label": "Contract Type",             "type": "SELECT", "required": true, "options": ["LUMP_SUM", "UNIT_RATE", "COST_PLUS", "TURNKEY"] },
    { "key": "agreement_date",      "label": "Agreement Date",            "type": "DATE",   "required": true },
    { "key": "completion_date",     "label": "Expected Completion Date",  "type": "DATE",   "required": true },
    { "key": "is_foreign_funded",   "label": "Foreign Funded",            "type": "BOOLEAN","required": true }
  ],
  "stages": [
    {
      "id": "ca-s1", "name": "Contractor Submission", "stageOrder": 1,
      "assignedRole": "CONTRACTOR", "isEntryStage": true,
      "allowedActions": ["SUBMIT"],
      "requiredDocumentTypes": ["CONTRACT_DOCUMENT", "BANK_GUARANTEE", "INSURANCE", "PAN_CERTIFICATE", "OTHER"],
      "routingRules": [{ "isDefaultRoute": true, "toStageId": "ca-s2" }]
    },
    {
      "id": "ca-s2", "name": "Entry Desk — Document Intake", "stageOrder": 2,
      "assignedRole": "ENTRY_DESK_OFFICER", "slaDays": 2,
      "allowedActions": ["FORWARD", "REJECT_TO_CONTRACTOR", "COMMENT", "REQUEST_INFO"],
      "requiredDocumentTypes": [],
      "routingRules": [{ "isDefaultRoute": true, "toStageId": "ca-s3" }]
    },
    {
      "id": "ca-s3", "name": "Sub Engineer — Technical Verification", "stageOrder": 3,
      "assignedRole": "SUB_ENGINEER", "slaDays": 3,
      "allowedActions": ["FORWARD", "REJECT", "QUERY", "COMMENT"],
      "routingRules": [{ "isDefaultRoute": true, "toStageId": "ca-s4" }],
      "allowedRejectionTargets": ["ca-s1", "ca-s2"]
    },
    {
      "id": "ca-s4", "name": "Engineer — Prabidhik Sakha Review & Tippani", "stageOrder": 4,
      "assignedRole": "ENGINEER", "slaDays": 5,
      "allowedActions": ["FORWARD", "REJECT", "REJECT_ANY", "QUERY", "COMMENT", "TOK"],
      "requiredDocumentTypes": ["TIPPANI"],
      "routingRules": [{ "isDefaultRoute": true, "toStageId": "ca-s5" }],
      "allowedRejectionTargets": ["ca-s1", "ca-s2", "ca-s3"]
    },
    {
      "id": "ca-s5", "name": "SDE — Review & Forward", "stageOrder": 5,
      "assignedRole": "SENIOR_ENGINEER", "slaDays": 5,
      "requiresDigitalSignature": true, "signatureTier": 1,
      "allowedActions": ["FORWARD", "APPROVE", "REJECT", "REJECT_ANY", "COMMENT", "QUERY", "RAYE", "TOK", "SIGN"],
      "routingRules": [
        { "conditionField": "contract_amount", "operator": "LT", "conditionValue": "10000000", "toStageId": "ca-terminal", "isDefaultRoute": false, "ruleOrder": 0 },
        { "isDefaultRoute": true, "toStageId": "ca-s6", "ruleOrder": 1 }
      ],
      "allowedRejectionTargets": ["ca-s1", "ca-s2", "ca-s3", "ca-s4"],
      "allowedRayeTargets": ["PRABIDHIK", "PRASASAN", "LEKHA", "KAANUN"]
    },
    {
      "id": "ca-s6", "name": "SE — Superintending Engineer Review", "stageOrder": 6,
      "assignedRole": "SUPERINTENDENT_ENGINEER", "slaDays": 7,
      "requiresDigitalSignature": true, "signatureTier": 2,
      "isTerminalStage": true,
      "allowedActions": ["APPROVE", "REJECT", "REJECT_ANY", "COMMENT", "RAYE", "TOK", "SIGN"],
      "routingRules": [],
      "allowedRejectionTargets": ["ca-s1", "ca-s2", "ca-s3", "ca-s4", "ca-s5"],
      "allowedRayeTargets": ["PRABIDHIK", "PRASASAN", "LEKHA", "KAANUN"]
    },
    {
      "id": "ca-terminal", "name": "Approved & Archived", "stageOrder": 7,
      "assignedRole": "ENTRY_DESK_OFFICER", "isTerminalStage": true,
      "allowedActions": [], "routingRules": []
    }
  ]
}
```

---

## 9. File Flow Patterns

### 9.1 Standard File Escalation Path (Road Division → Ministry)

```
Road Division (branch_level = 1)
  ↓ [Entry Desk + Engineer review at Road Division level]
  ↓ [SDE of Road Division approves if within threshold]
  ↓
FRSMO / Project Directorate (branch_level = 2)
  ↓ [Superintending Engineer reviews]
  ↓ [SE approves if within threshold]
  ↓
DOR HQ — Mahasakha/Division (branch_level = 3)
  ↓ [DDG reviews]
  ↓ [DDG approves or forwards to DG]
  ↓
DOR HQ — DG Office (branch_level = 3, is_dor_hq = true)
  ↓ [DG reviews, approves or forwards to Ministry]
  ↓
Ministry (external — file exits GovFlow)
```

### 9.2 Cross-Branch RBAC Rule for DOR

Because DOR files cross branch boundaries as they escalate, GovFlow's standard RBAC branch check must be modified for DOR:

```
STANDARD GOVFLOW RBAC:
  file.branch_id MUST EQUAL user.branch_id

DOR-MODIFIED RBAC:
  user.branch_id MUST BE IN hierarchy_ancestors(file.current_stage.branch_id)
  OR user.role IN [DG, DDG] (unrestricted scope within DOR)
```

Implement the `hierarchy_ancestors()` function as a recursive CTE using `parent_branch_id`:

```sql
-- Function to get all ancestor branch IDs for a given branch
CREATE OR REPLACE FUNCTION branch_ancestors(p_branch_id UUID)
RETURNS TABLE(branch_id UUID, level INTEGER) AS $$
WITH RECURSIVE ancestors AS (
    SELECT id, parent_branch_id, 0 AS lvl FROM branches WHERE id = p_branch_id
    UNION ALL
    SELECT b.id, b.parent_branch_id, a.lvl + 1
    FROM branches b JOIN ancestors a ON b.id = a.parent_branch_id
)
SELECT id, lvl FROM ancestors;
$$ LANGUAGE sql;
```

### 9.3 File Flow Summary by Office Type

| Initiating Office | Normal Approval Path | Maximum Escalation |
|------------------|---------------------|-------------------|
| Road Division (VO < 10%) | Road Division SDE | Stops at SDE |
| Road Division (VO 10–15%) | Road Division → FRSMO | Stops at SE |
| Road Division (VO ≥ 15%) | Road Div → FRSMO → HQ DDG | DDG or DG |
| Project Office | Project Office → Project Directorate → DOR HQ | DG / Ministry |
| HQ Branch | Starts at HQ SDE → DDG | DG / Ministry |

---

## 10. RBAC Matrix for DOR Roles

### 10.1 File Action Permissions

| Action | DG | DDG | SE | SDE | Engineer | Sub Eng | Entry Desk | Sec Officer | Acc Officer | Law Officer |
|--------|----|-----|----|-----|----------|---------|-----------|-------------|-------------|-------------|
| Submit | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Log/Entry | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓* | ✗ | ✗ | ✗ |
| Tok (assign) | ✓ | ✓ | ✓ | ✓ | ✓* | ✗ | ✗ | ✗ | ✗ | ✗ |
| Tok (receive) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Raye (request) | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Raye (respond) | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Tippani (write) | ✗ | ✗ | ✗ | ✗ | ✓* | ✗ | ✗ | ✗ | ✗ | ✗ |
| Forward | ✓ | ✓ | ✓ | ✓* | ✓* | ✓* | ✓* | ✗ | ✗ | ✗ |
| Reject any stage | ✓ | ✓ | ✓ | ✓* | ✓* | ✓* | ✗ | ✗ | ✗ | ✗ |
| Approve | ✓ | ✓ | ✓* | ✓* | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Sign (Tier 1) | ✓ | ✓ | ✓ | ✓ | ✓* | ✗ | ✗ | ✗ | ✗ | ✗ |
| Sign (Tier 2) | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Forward to Ministry | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Query to contractor | ✓ | ✓ | ✓ | ✓* | ✓* | ✓* | ✓* | ✗ | ✗ | ✗ |
| View audit trail | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

> `✓*` = permitted only when file is at officer's assigned stage

### 10.2 Dashboard Access by Role

| Dashboard | DG | DDG | SE | SDE | Engineer | Sub Eng | Entry Desk | Admin/Finance/Legal |
|-----------|----|----|-----|-----|----------|---------|-----------|---------------------|
| My Pending Files | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (Tok/Raye inbox) |
| Raye Inbox | ✗ | ✗ | ✗ | ✗ | ✓* | ✗ | ✗ | ✓ |
| Tok Inbox | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| SLA Heatmap | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| DOR-wide Analytics | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Mahasakha Analytics | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| FRSMO/Directorate Analytics | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Division Analytics | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Audit Log | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

---

## 11. Seed Data — JSON Format

### 11.1 Default DOR Users (for dev/staging)

```json
[
  {
    "email": "dg@dor.gov.np",
    "firstName": "DG", "lastName": "DOR",
    "role": "SUPER_ADMIN",
    "designation": "Director General",
    "branchCode": "DOR-HQ"
  },
  {
    "email": "ddg.planning@dor.gov.np",
    "firstName": "DDG", "lastName": "Planning",
    "role": "DEPARTMENT_ADMIN",
    "designation": "Deputy Director General",
    "branchCode": "DOR-PMD"
  },
  {
    "email": "se.frsmo.damak@dor.gov.np",
    "firstName": "SE", "lastName": "Damak",
    "role": "SUPERINTENDENT_ENGINEER",
    "designation": "Superintending Engineer",
    "branchCode": "FRSMO-DMK"
  },
  {
    "email": "sde.rd.ktm@dor.gov.np",
    "firstName": "SDE", "lastName": "Kathmandu",
    "role": "SENIOR_ENGINEER",
    "designation": "Senior Division Engineer",
    "branchCode": "RD-KTM"
  },
  {
    "email": "engineer.rd.ktm@dor.gov.np",
    "firstName": "Engineer", "lastName": "Kathmandu",
    "role": "ENGINEER",
    "designation": "Engineer",
    "branchCode": "RD-KTM"
  },
  {
    "email": "sub.rd.ktm@dor.gov.np",
    "firstName": "SubEngineer", "lastName": "Kathmandu",
    "role": "SUB_ENGINEER",
    "designation": "Sub Engineer",
    "branchCode": "RD-KTM"
  },
  {
    "email": "entry.rd.ktm@dor.gov.np",
    "firstName": "Entry", "lastName": "Kathmandu",
    "role": "ENTRY_DESK_OFFICER",
    "designation": "Entry Desk Officer",
    "branchCode": "RD-KTM"
  },
  {
    "email": "account.rd.ktm@dor.gov.np",
    "firstName": "Account", "lastName": "Kathmandu",
    "role": "ACCOUNT_OFFICER",
    "designation": "Account Officer",
    "branchCode": "RD-KTM"
  },
  {
    "email": "section.rd.ktm@dor.gov.np",
    "firstName": "Section", "lastName": "Kathmandu",
    "role": "SECTION_OFFICER",
    "designation": "Section Officer",
    "branchCode": "RD-KTM"
  },
  {
    "email": "contractor.test@example.com",
    "firstName": "Test", "lastName": "Contractor",
    "role": "CONTRACTOR",
    "companyName": "ABC Construction Pvt. Ltd.",
    "panNumber": "123456789"
  }
]
```

### 11.2 Sample Tracking Number Format for DOR

```
Format:  DOR / {OFFICE_CODE} / {FY} / {WORKFLOW_CODE} / {SEQUENCE}
Example: DOR/RD-KTM/2081-82/VO/0042

Components:
  DOR         = Fixed prefix
  RD-KTM      = Branch/office code (from branches.code)
  2081-82     = Nepali fiscal year (Bikram Sambat)
  VO          = Workflow type code (VO, IPC, CA, BOQ, etc.)
  0042        = 4-digit sequence per year per office per type
```

Implement this in the `TrackingNumberService` class:

```java
// TrackingNumberService.java (Spring Boot)
public String generate(Branch branch, WorkflowDefinition wf, int fiscalYear) {
    String seq = String.format("%04d", getNextSequence(branch.getId(), wf.getId(), fiscalYear));
    return "DOR/" + branch.getCode() + "/" + fiscalYear + "/" + wf.getCode() + "/" + seq;
}
```

---

## 12. Implementation Checklist

### Phase 1 — Foundation

- [ ] Run `V2__dor_schema_extensions.sql` migration (adds branch_level, parent_branch_id, cluster_type, nepali_name to branches)
- [ ] Run role enum additions (`SUPERINTENDENT_ENGINEER`, `SECTION_OFFICER`, `NAYEB_SUBBA`, etc.)
- [ ] Create `raye_requests` table
- [ ] Create `tok_assignments` table
- [ ] Create `tippani_metadata` table
- [ ] Add new audit_action and notification_type enum values
- [ ] Seed the Organisation (MOPIT) record
- [ ] Seed the Department (DOR) record
- [ ] Seed all Branch records (HQ → FRSMOs → Road Divisions) using Section 5 data
- [ ] Seed default users (Section 11.1)
- [ ] Add `TOK` and `RAYE` to StageAction enum (backend + TypeScript)
- [ ] Add `FORWARD_TO_MINISTRY` to StageAction enum
- [ ] Add `FORWARDED_TO_MINISTRY` to submission_status enum
- [ ] Implement `TokService` (create, complete, recall Tok assignments)
- [ ] Implement `RayeService` (request, respond, cancel Raye)
- [ ] Implement `TippaniService` (create structured Tippani, generate PDF)
- [ ] Implement approval threshold logic in WorkflowEngine (check vo_percentage at forward-time)
- [ ] Implement `hierarchy_ancestors()` SQL function
- [ ] Update RBAC middleware to use hierarchy-based branch check for DOR
- [ ] Seed the VO workflow config (Section 8.1)
- [ ] Seed the IPC workflow config (Section 8.2)
- [ ] Seed the Contract Agreement workflow config (Section 8.3)
- [ ] Implement DOR tracking number format (Section 11.2)
- [ ] Add "Tok Inbox" panel to officer dashboard
- [ ] Add "Raye Inbox" panel to admin/finance/legal officer dashboards
- [ ] Add "Tok to..." dropdown button in file action panel (Stage 3, 5, 6, 7, 8)
- [ ] Add "Request Raye" modal (select Sakha type + target branch + officer)
- [ ] Add "Prepare Tippani" structured form in Engineer stage
- [ ] Add Tippani PDF generation (auto-fill from form data)
- [ ] Show "VO Percentage" and approval threshold indicator in VO file detail view
- [ ] Add Nepali name display alongside English names in branch/user selectors
- [ ] Add Nepali fiscal year (BS) support in date pickers and tracking numbers
- [ ] Update public tracking portal to show DOR-formatted tracking numbers

### Phase 2 — Testing & Validation

- [ ] End-to-end test: VO < 10% path (stops at SDE)
- [ ] End-to-end test: VO 10–15% path (escalates to SE)
- [ ] End-to-end test: VO ≥ 15% path (reaches DDG/DG)
- [ ] End-to-end test: Raye flow (SDE requests Lekha Raye → Account Officer responds → SDE continues)
- [ ] End-to-end test: Tok flow (SDE Toks Engineer → Engineer completes → SDE gets response)
- [ ] End-to-end test: Tippani mandatory check (cannot forward without Tippani at Engineer stage)
- [ ] Test rejection paths (SE rejects back to Entry Desk)
- [ ] Test "Forward to Ministry" terminal action
- [ ] Test cross-branch RBAC (Road Division engineer cannot see FRSMO files)
- [ ] Load test with 100+ concurrent users across 5 Road Divisions

---

*Document version 1.0*
*Source: DOR_organization_and_personnels.xlsx + DOR Terms of Reference CMS + GovFlow System Blueprint*
*Use alongside: 00_MASTER_PROMPT.md, 01_DATABASE_SCHEMA.sql, 02_TYPESCRIPT_TYPES.ts, 03_WORKFLOW_CONFIGS.json, 04_RBAC_AND_API.md*
