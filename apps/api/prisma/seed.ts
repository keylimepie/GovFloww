// =============================================
// Database Seed — Initial Data
// =============================================
// Seeds: Organisation, Department, Branch, Super Admin,
//         sample workflows with stages

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for database seeding`);
  }
  return value;
}

async function main() {
  console.log('🌱 Starting database seed...');

  // ---- Organisation ----
  const org = await prisma.organisation.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: process.env.SEED_ORG_NAME || 'Government of Nepal',
    },
  });
  console.log(`  ✅ Organisation: ${org.name}`);

  // ---- Department ----
  const dept = await prisma.department.upsert({
    where: { code: 'PWD' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      name: process.env.SEED_DEPT_NAME || 'Public Works Department',
      code: 'PWD',
      organisationId: org.id,
    },
  });
  console.log(`  ✅ Department: ${dept.name} (${dept.code})`);

  // ---- Branch ----
  const branch = await prisma.branch.upsert({
    where: { code: 'HO' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000100',
      name: process.env.SEED_BRANCH_NAME || 'Head Office',
      code: 'HO',
      departmentId: dept.id,
    },
  });
  console.log(`  ✅ Branch: ${branch.name} (${branch.code})`);

  // ---- Roles ----
  const systemRoles = [
    { name: 'Super Administrator', code: 'SUPER_ADMIN', hierarchyLevel: 100, isSystem: true, permissions: ['*'] },
    { name: 'IT Administrator', code: 'IT_ADMIN', hierarchyLevel: 90, isSystem: true, permissions: ['system:config', 'system:monitor', 'audit:verify_chain'] },
    { name: 'Department Administrator', code: 'DEPARTMENT_ADMIN', hierarchyLevel: 80, isSystem: true, permissions: ['workflow:create', 'workflow:update', 'workflow:publish', 'workflow:archive', 'user:create', 'user:update', 'user:manage_dept', 'org:manage_branches', 'submission:view_all', 'submission:reassign', 'submission:manage_public_tracking', 'report:dept', 'report:export', 'audit:view'] },
    { name: 'Branch Administrator', code: 'BRANCH_ADMIN', hierarchyLevel: 70, isSystem: true, permissions: ['submission:view_branch', 'submission:reassign_branch', 'report:branch', 'report:export', 'user:view_branch'] },
    { name: 'Senior Engineer', code: 'SENIOR_ENGINEER', hierarchyLevel: 60, isSystem: true, permissions: ['submission:view_assigned', 'submission:review', 'submission:forward', 'submission:reject_any', 'submission:hold', 'submission:comment', 'submission:sign_t1', 'submission:sign_t2'] },
    { name: 'Engineer', code: 'ENGINEER', hierarchyLevel: 50, isSystem: true, permissions: ['submission:view_assigned', 'submission:review', 'submission:forward', 'submission:reject_prev', 'submission:comment', 'submission:sign_t1'] },
    { name: 'Sub Engineer', code: 'SUB_ENGINEER', hierarchyLevel: 40, isSystem: true, permissions: ['submission:view_assigned', 'submission:review', 'submission:forward', 'submission:reject_prev', 'submission:comment', 'submission:query'] },
    { name: 'Entry Desk Officer', code: 'ENTRY_DESK', hierarchyLevel: 30, isSystem: true, permissions: ['submission:intake', 'submission:verify', 'submission:forward', 'submission:return', 'submission:comment'] },
    { name: 'Contractor', code: 'CONTRACTOR', hierarchyLevel: 10, isSystem: true, permissions: ['submission:create', 'submission:view_own', 'submission:upload', 'submission:respond_query'] },
    { name: 'Citizen', code: 'CITIZEN', hierarchyLevel: 0, isSystem: true, permissions: ['submission:track_public'] },
  ];

  const roleMap: Record<string, string> = {};
  for (const r of systemRoles) {
    const role = await prisma.role.upsert({
      where: { code: r.code },
      update: {
        name: r.name,
        hierarchyLevel: r.hierarchyLevel,
        permissions: r.permissions,
        isSystem: r.isSystem,
      },
      create: r,
    });
    roleMap[r.code] = role.id;
    console.log(`  ✅ Role: ${role.name}`);
  }

  // ---- Super Admin ----
  const adminEmail = requireEnv('SEED_ADMIN_EMAIL');
  const adminPassword = requireEnv('SEED_ADMIN_PASSWORD');
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000001000',
      email: adminEmail,
      passwordHash,
      firstName: process.env.SEED_ADMIN_FIRST_NAME || 'System',
      lastName: process.env.SEED_ADMIN_LAST_NAME || 'Administrator',
      roleId: roleMap['SUPER_ADMIN'],
      departmentId: dept.id,
      branchId: branch.id,
      status: 'ACTIVE',
      mustChangePass: true,
    },
  });
  console.log(`  ✅ Super Admin: ${admin.email}`);

  // ---- Sample Staff Users ----
  const staffUsers = [
    {
      id: '00000000-0000-0000-0000-000000002001',
      email: 'entry.desk@govflow.gov.np',
      firstName: 'Ram',
      lastName: 'Kumar',
      roleId: roleMap['ENTRY_DESK'],
    },
    {
      id: '00000000-0000-0000-0000-000000002002',
      email: 'sub.engineer@govflow.gov.np',
      firstName: 'Sita',
      lastName: 'Sharma',
      roleId: roleMap['SUB_ENGINEER'],
    },
    {
      id: '00000000-0000-0000-0000-000000002003',
      email: 'engineer@govflow.gov.np',
      firstName: 'Bikash',
      lastName: 'Thapa',
      roleId: roleMap['ENGINEER'],
    },
    {
      id: '00000000-0000-0000-0000-000000002004',
      email: 'senior.engineer@govflow.gov.np',
      firstName: 'Anita',
      lastName: 'Adhikari',
      roleId: roleMap['SENIOR_ENGINEER'],
    },
    {
      id: '00000000-0000-0000-0000-000000002005',
      email: 'dept.admin@govflow.gov.np',
      firstName: 'Mohan',
      lastName: 'Maharjan',
      roleId: roleMap['DEPARTMENT_ADMIN'],
    },
  ];

  const staffPasswordHash = await bcrypt.hash('Staff@2026!', 12);
  for (const staff of staffUsers) {
    await prisma.user.upsert({
      where: { email: staff.email },
      update: {},
      create: {
        ...staff,
        passwordHash: staffPasswordHash,
        departmentId: dept.id,
        branchId: branch.id,
        status: 'ACTIVE',
        mustChangePass: true,
      },
    });
    console.log(`  ✅ Staff: ${staff.firstName} ${staff.lastName} (${staff.roleId})`);
  }

  // ---- Sample Contractor ----
  const contractorHash = await bcrypt.hash('Contractor@2026!', 12);
  const contractor = await prisma.user.upsert({
    where: { email: 'contractor@example.com' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000003001',
      email: 'contractor@example.com',
      passwordHash: contractorHash,
      firstName: 'ABC',
      lastName: 'Contractors',
      roleId: roleMap['CONTRACTOR'],
      status: 'ACTIVE',
      companyName: 'ABC Contractors Pvt. Ltd.',
      phone: '+977-9801234567',
      mustChangePass: false,
    },
  });
  console.log(`  ✅ Contractor: ${contractor.companyName}`);

  // ---- Sample Workflow: BOQ Approval ----
  const workflow = await prisma.workflowDefinition.upsert({
    where: {
      name_departmentId_version: {
        name: 'BOQ Approval — Standard',
        departmentId: dept.id,
        version: 1,
      },
    },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000010000',
      name: 'BOQ Approval — Standard',
      description: 'Standard Bill of Quantities approval workflow with 4 review stages.',
      departmentId: dept.id,
      version: 1,
      status: 'ACTIVE',
      createdBy: admin.id,
    },
  });
  console.log(`  ✅ Workflow: ${workflow.name}`);

  // ---- Workflow Stages ----
  const stages = [
    {
      id: '00000000-0000-0000-0000-000000011001',
      name: 'Entry Desk — Intake & Verification',
      stageOrder: 1,
      stageType: 'SEQUENTIAL',
      assignedRoleId: roleMap['ENTRY_DESK'],
      slaDays: 1,
      allowedActions: ['FORWARD', 'REJECT', 'COMMENT'],
      requiredDocs: [],
    },
    {
      id: '00000000-0000-0000-0000-000000011002',
      name: 'Sub Engineer — BOQ Check',
      stageOrder: 2,
      stageType: 'SEQUENTIAL',
      assignedRoleId: roleMap['SUB_ENGINEER'],
      slaDays: 3,
      allowedActions: ['FORWARD', 'REJECT', 'HOLD', 'COMMENT', 'QUERY'],
      requiredDocs: [],
    },
    {
      id: '00000000-0000-0000-0000-000000011003',
      name: 'Engineer — Technical Review',
      stageOrder: 3,
      stageType: 'SEQUENTIAL',
      assignedRoleId: roleMap['ENGINEER'],
      slaDays: 3,
      allowedActions: ['FORWARD', 'REJECT', 'COMMENT', 'SIGN_TIER1'],
      requiredDocs: [],
    },
    {
      id: '00000000-0000-0000-0000-000000011004',
      name: 'Senior Engineer — Final Approval',
      stageOrder: 4,
      stageType: 'SEQUENTIAL',
      assignedRoleId: roleMap['SENIOR_ENGINEER'],
      slaDays: 2,
      allowedActions: ['FORWARD', 'REJECT', 'COMMENT', 'SIGN_TIER1', 'SIGN_TIER2'],
      requiredDocs: [],
    },
  ];

  for (const stage of stages) {
    await prisma.workflowStage.upsert({
      where: {
        workflowId_stageOrder: {
          workflowId: workflow.id,
          stageOrder: stage.stageOrder,
        },
      },
      update: {},
      create: {
        ...stage,
        workflowId: workflow.id,
      },
    });
    console.log(`    📋 Stage ${stage.stageOrder}: ${stage.name}`);
  }

  console.log('\n🎉 Database seed completed successfully!');
  console.log(`\n📧 Super Admin Login: ${adminEmail}`);
  console.log(`🔑 Super Admin Password: ${adminPassword}`);
  console.log(`⚠️  Change password on first login!\n`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
