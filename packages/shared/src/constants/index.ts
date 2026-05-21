// =============================================
// GovFlow Constants & Permission Matrix
// =============================================

import { Role, StageAction } from '../types';

// ---- Permission Definitions ----
// Format: 'resource:action'
export const PERMISSIONS = {
  [Role.SUPER_ADMIN]: ['*'] as const,
  [Role.DEPARTMENT_ADMIN]: [
    'workflow:create', 'workflow:update', 'workflow:publish', 'workflow:archive',
    'user:create', 'user:update', 'user:manage_dept',
    'submission:view_all', 'submission:reassign', 'submission:manage_public_tracking',
    'report:dept', 'report:export',
    'audit:view',
  ] as const,
  [Role.BRANCH_ADMIN]: [
    'submission:view_branch', 'submission:reassign_branch',
    'report:branch', 'report:export',
    'user:view_branch',
  ] as const,
  [Role.SENIOR_ENGINEER]: [
    'submission:view_assigned', 'submission:review',
    'submission:forward', 'submission:reject_any',
    'submission:hold', 'submission:comment',
    'submission:sign_t1', 'submission:sign_t2',
  ] as const,
  [Role.ENGINEER]: [
    'submission:view_assigned', 'submission:review',
    'submission:forward', 'submission:reject_prev',
    'submission:comment', 'submission:sign_t1',
  ] as const,
  [Role.SUB_ENGINEER]: [
    'submission:view_assigned', 'submission:review',
    'submission:forward', 'submission:reject_prev',
    'submission:comment', 'submission:query',
  ] as const,
  [Role.ENTRY_DESK]: [
    'submission:intake', 'submission:verify',
    'submission:forward', 'submission:return',
    'submission:comment',
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
  [Role.SENIOR_ENGINEER]: 'Senior Engineer',
  [Role.ENGINEER]: 'Engineer',
  [Role.SUB_ENGINEER]: 'Sub Engineer',
  [Role.ENTRY_DESK]: 'Entry Desk Officer',
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
  [Role.SENIOR_ENGINEER]: 60,
  [Role.ENGINEER]: 50,
  [Role.SUB_ENGINEER]: 40,
  [Role.ENTRY_DESK]: 30,
  [Role.CONTRACTOR]: 10,
  [Role.CITIZEN]: 0,
};

// ---- Internal Roles (staff who access the internal portal) ----
export const INTERNAL_ROLES: Role[] = [
  Role.SUPER_ADMIN,
  Role.DEPARTMENT_ADMIN,
  Role.BRANCH_ADMIN,
  Role.SENIOR_ENGINEER,
  Role.ENGINEER,
  Role.SUB_ENGINEER,
  Role.ENTRY_DESK,
  Role.IT_ADMIN,
];

// ---- Stage Action Labels ----
export const STAGE_ACTION_LABELS: Record<StageAction, string> = {
  [StageAction.FORWARD]: 'Forward to Next Stage',
  [StageAction.REJECT]: 'Reject / Return',
  [StageAction.HOLD]: 'Put on Hold',
  [StageAction.COMMENT]: 'Add Comment',
  [StageAction.QUERY]: 'Raise Query',
  [StageAction.SIGN_TIER1]: 'Sign (PIN)',
  [StageAction.SIGN_TIER2]: 'Sign (Digital Certificate)',
  [StageAction.REQUEST_INFO]: 'Request Information',
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
