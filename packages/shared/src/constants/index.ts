// =============================================
// GovFlow Constants & Permission Matrix
// =============================================

import { Role, StageAction } from '../types';

// ---- Permission Definitions ----
// Format: 'resource:action'
export const PERMISSIONS = {
  [Role.SUPER_ADMIN]: ['*', 'submission:forward_to_ministry'] as const,
  [Role.DEPARTMENT_ADMIN]: [
    'workflow:create', 'workflow:update', 'workflow:publish', 'workflow:archive',
    'user:create', 'user:update', 'user:manage_dept',
    'submission:create', 'submission:view_all', 'submission:reassign', 'submission:manage_public_tracking',
    'submission:forward', 'submission:approve', 'submission:reject_any',
    'submission:hold', 'submission:comment', 'submission:sign_t1', 'submission:sign_t2',
    'submission:tok_assign', 'submission:raye_request', 'submission:raye_respond',
    'report:dept', 'report:export',
    'audit:view',
  ] as const,
  [Role.BRANCH_ADMIN]: [
    'submission:create', 'submission:view_branch', 'submission:reassign_branch',
    'report:branch', 'report:export',
    'user:view_branch',
  ] as const,
  [Role.SUPERINTENDENT_ENGINEER]: [
    'submission:create', 'submission:view_assigned', 'submission:review',
    'submission:forward', 'submission:approve', 'submission:reject_any',
    'submission:hold', 'submission:comment',
    'submission:sign_t1', 'submission:sign_t2',
    'submission:tok_assign', 'submission:raye_request', 'submission:raye_respond',
  ] as const,
  [Role.SENIOR_ENGINEER]: [
    'submission:create', 'submission:view_assigned', 'submission:review',
    'submission:forward', 'submission:approve', 'submission:reject_any',
    'submission:hold', 'submission:comment',
    'submission:sign_t1', 'submission:sign_t2',
    'submission:tok_assign', 'submission:raye_request', 'submission:raye_respond',
  ] as const,
  [Role.ENGINEER]: [
    'submission:create', 'submission:view_assigned', 'submission:review',
    'submission:forward', 'submission:reject_prev',
    'submission:comment', 'submission:sign_t1',
    'submission:tok_assign', 'submission:tippani_prepare',
  ] as const,
  [Role.SUB_ENGINEER]: [
    'submission:create', 'submission:view_assigned', 'submission:review',
    'submission:forward', 'submission:reject_prev',
    'submission:comment', 'submission:query',
  ] as const,
  [Role.ENTRY_DESK]: [
    'submission:create', 'submission:intake', 'submission:verify',
    'submission:forward', 'submission:return',
    'submission:comment',
  ] as const,
  [Role.ENTRY_DESK_OFFICER]: [
    'submission:create', 'submission:intake', 'submission:verify',
    'submission:forward', 'submission:return',
    'submission:comment',
  ] as const,
  [Role.SECTION_OFFICER]: [
    'submission:create', 'submission:view_assigned',
    'submission:comment',
    'submission:raye_respond',
  ] as const,
  [Role.NAYEB_SUBBA]: [
    'submission:create', 'submission:view_assigned',
    'submission:comment',
  ] as const,
  [Role.KHARIDAAR]: [
    'submission:create', 'submission:view_assigned',
    'submission:comment',
  ] as const,
  [Role.ACCOUNTS_CONTROLLER]: [
    'submission:create', 'submission:view_assigned',
    'submission:comment',
    'submission:raye_respond',
  ] as const,
  [Role.ACCOUNT_OFFICER]: [
    'submission:create', 'submission:view_assigned',
    'submission:comment',
    'submission:raye_respond',
  ] as const,
  [Role.ACCOUNTANT]: [
    'submission:create', 'submission:view_assigned',
    'submission:comment',
  ] as const,
  [Role.LAW_SECRETARY]: [
    'submission:create', 'submission:view_assigned',
    'submission:comment',
    'submission:raye_respond',
  ] as const,
  [Role.LAW_OFFICER]: [
    'submission:create', 'submission:view_assigned',
    'submission:comment',
    'submission:raye_respond',
  ] as const,
  [Role.CONTRACTOR]: [
    'submission:create', 'submission:view_own',
    'submission:upload', 'submission:respond_query',
  ] as const,
  [Role.CITIZEN]: [
    'submission:track_public',
  ] as const,
  [Role.IT_ADMIN]: [
    'system:config', 'system:monitor',
    'audit:verify_chain',
  ] as const,
} as const;

// ---- Role Display Names ----
export const ROLE_LABELS: Record<Role, string> = {
  [Role.SUPER_ADMIN]: 'Super Administrator',
  [Role.DEPARTMENT_ADMIN]: 'Department Administrator',
  [Role.BRANCH_ADMIN]: 'Branch Administrator',
  [Role.SUPERINTENDENT_ENGINEER]: 'Superintending Engineer',
  [Role.SENIOR_ENGINEER]: 'Senior Engineer',
  [Role.ENGINEER]: 'Engineer',
  [Role.SUB_ENGINEER]: 'Sub Engineer',
  [Role.ENTRY_DESK]: 'Entry Desk Officer',
  [Role.ENTRY_DESK_OFFICER]: 'Entry Desk Officer',
  [Role.SECTION_OFFICER]: 'Section Officer',
  [Role.NAYEB_SUBBA]: 'Nayeb Subba',
  [Role.KHARIDAAR]: 'Kharidaar',
  [Role.ACCOUNTS_CONTROLLER]: 'Chief Accounts Controller',
  [Role.ACCOUNT_OFFICER]: 'Account Officer',
  [Role.ACCOUNTANT]: 'Accountant',
  [Role.LAW_SECRETARY]: 'Deputy Secretary - Law',
  [Role.LAW_OFFICER]: 'Law Officer',
  [Role.CONTRACTOR]: 'Contractor',
  [Role.CITIZEN]: 'Citizen',
  [Role.IT_ADMIN]: 'IT Administrator',
};

// ---- Role Hierarchy (higher number = higher authority) ----
export const ROLE_HIERARCHY: Record<Role, number> = {
  [Role.SUPER_ADMIN]: 100,
  [Role.IT_ADMIN]: 90,
  [Role.DEPARTMENT_ADMIN]: 80,
  [Role.BRANCH_ADMIN]: 70,
  [Role.SUPERINTENDENT_ENGINEER]: 65,
  [Role.SENIOR_ENGINEER]: 60,
  [Role.ENGINEER]: 50,
  [Role.SUB_ENGINEER]: 40,
  [Role.ENTRY_DESK]: 30,
  [Role.ENTRY_DESK_OFFICER]: 30,
  [Role.SECTION_OFFICER]: 35,
  [Role.NAYEB_SUBBA]: 25,
  [Role.KHARIDAAR]: 20,
  [Role.ACCOUNTS_CONTROLLER]: 55,
  [Role.ACCOUNT_OFFICER]: 45,
  [Role.ACCOUNTANT]: 35,
  [Role.LAW_SECRETARY]: 55,
  [Role.LAW_OFFICER]: 45,
  [Role.CONTRACTOR]: 10,
  [Role.CITIZEN]: 0,
};

// ---- Internal Roles (staff who access the internal portal) ----
export const INTERNAL_ROLES: Role[] = [
  Role.SUPER_ADMIN,
  Role.DEPARTMENT_ADMIN,
  Role.BRANCH_ADMIN,
  Role.SUPERINTENDENT_ENGINEER,
  Role.SENIOR_ENGINEER,
  Role.ENGINEER,
  Role.SUB_ENGINEER,
  Role.ENTRY_DESK,
  Role.ENTRY_DESK_OFFICER,
  Role.SECTION_OFFICER,
  Role.NAYEB_SUBBA,
  Role.KHARIDAAR,
  Role.ACCOUNTS_CONTROLLER,
  Role.ACCOUNT_OFFICER,
  Role.ACCOUNTANT,
  Role.LAW_SECRETARY,
  Role.LAW_OFFICER,
  Role.IT_ADMIN,
];

// ---- Stage Action Labels ----
export const STAGE_ACTION_LABELS: Record<StageAction, string> = {
  [StageAction.SUBMIT]: 'Submit',
  [StageAction.FORWARD]: 'Forward to Next Stage',
  [StageAction.APPROVE]: 'Approve',
  [StageAction.REJECT]: 'Reject / Return',
  [StageAction.REJECT_ANY]: 'Reject to Prior Stage',
  [StageAction.REJECT_TO_CONTRACTOR]: 'Return to Contractor',
  [StageAction.HOLD]: 'Put on Hold',
  [StageAction.COMMENT]: 'Add Comment',
  [StageAction.QUERY]: 'Raise Query',
  [StageAction.TOK]: 'Tok Assignment',
  [StageAction.RAYE]: 'Request Raye',
  [StageAction.TIPPANI]: 'Prepare Tippani',
  [StageAction.SIGN]: 'Sign',
  [StageAction.SIGN_TIER1]: 'Sign (PIN)',
  [StageAction.SIGN_TIER2]: 'Sign (Digital Certificate)',
  [StageAction.REQUEST_INFO]: 'Request Information',
  [StageAction.FORWARD_TO_MINISTRY]: 'Forward to Ministry',
};

// ---- Submission Status Display ----
export const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: '#1890ff',
  IN_REVIEW: '#722ed1',
  QUERY_RAISED: '#fa8c16',
  ON_HOLD: '#8c8c8c',
  APPROVED: '#52c41a',
  REJECTED: '#f5222d',
  ARCHIVED: '#595959',
  RETURNED_TO_CONTRACTOR: '#faad14',
  FORWARDED_TO_MINISTRY: '#13c2c2',
};

// ---- Helper: check if user has permission ----
export function hasPermission(role: Role, permission: string): boolean {
  const rolePermissions = PERMISSIONS[role];
  if (!rolePermissions) return false;

  // Super Admin has wildcard
  if ((rolePermissions as readonly string[]).includes('*')) return true;

  // Check exact match
  if ((rolePermissions as readonly string[]).includes(permission)) return true;

  // Check wildcard for resource (e.g., 'workflow:*' matches 'workflow:create')
  const [resource] = permission.split(':');
  if ((rolePermissions as readonly string[]).includes(`${resource}:*` as never)) return true;

  return false;
}

// ---- Helper: check if role A outranks role B ----
export function outranks(roleA: Role, roleB: Role): boolean {
  return ROLE_HIERARCHY[roleA] > ROLE_HIERARCHY[roleB];
}

// ---- Tracking Number Format ----
export const TRACKING_NUMBER_PREFIX = (year: number, deptCode: string): string =>
  `${year}-${deptCode}`;
