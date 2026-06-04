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
    { name: 'Super Administrator', code: 'SUPER_ADMIN', hierarchyLevel: 100, isSystem: true, permissions: ['*', 'submission:forward_to_ministry'] },
    { name: 'IT Administrator', code: 'IT_ADMIN', hierarchyLevel: 90, isSystem: true, permissions: ['system:config', 'system:monitor', 'audit:verify_chain'] },
    { name: 'Department Administrator', code: 'DEPARTMENT_ADMIN', hierarchyLevel: 80, isSystem: true, permissions: ['workflow:create', 'workflow:update', 'workflow:publish', 'workflow:archive', 'user:create', 'user:update', 'user:manage_dept', 'org:manage_branches', 'submission:create', 'submission:view_all', 'submission:reassign', 'submission:manage_public_tracking', 'submission:forward', 'submission:approve', 'submission:reject_any', 'submission:hold', 'submission:comment', 'submission:sign_t1', 'submission:sign_t2', 'submission:tok_assign', 'submission:raye_request', 'submission:raye_respond', 'report:dept', 'report:export', 'audit:view'] },
    { name: 'Branch Administrator', code: 'BRANCH_ADMIN', hierarchyLevel: 70, isSystem: true, permissions: ['submission:create', 'submission:view_branch', 'submission:reassign_branch', 'report:branch', 'report:export', 'user:view_branch'] },
    { name: 'Superintending Engineer', code: 'SUPERINTENDENT_ENGINEER', hierarchyLevel: 65, isSystem: true, permissions: ['submission:create', 'submission:view_assigned', 'submission:review', 'submission:forward', 'submission:approve', 'submission:reject_any', 'submission:hold', 'submission:comment', 'submission:sign_t1', 'submission:sign_t2', 'submission:tok_assign', 'submission:raye_request', 'submission:raye_respond'] },
    { name: 'Senior Engineer', code: 'SENIOR_ENGINEER', hierarchyLevel: 60, isSystem: true, permissions: ['submission:create', 'submission:view_assigned', 'submission:review', 'submission:forward', 'submission:approve', 'submission:reject_any', 'submission:hold', 'submission:comment', 'submission:sign_t1', 'submission:sign_t2', 'submission:tok_assign', 'submission:raye_request', 'submission:raye_respond'] },
    { name: 'Engineer', code: 'ENGINEER', hierarchyLevel: 50, isSystem: true, permissions: ['submission:create', 'submission:view_assigned', 'submission:review', 'submission:forward', 'submission:reject_prev', 'submission:comment', 'submission:sign_t1', 'submission:tok_assign', 'submission:tippani_prepare'] },
    { name: 'Sub Engineer', code: 'SUB_ENGINEER', hierarchyLevel: 40, isSystem: true, permissions: ['submission:create', 'submission:view_assigned', 'submission:review', 'submission:forward', 'submission:reject_prev', 'submission:comment', 'submission:query'] },
    { name: 'Entry Desk Officer', code: 'ENTRY_DESK', hierarchyLevel: 30, isSystem: true, permissions: ['submission:create', 'submission:intake', 'submission:verify', 'submission:forward', 'submission:return', 'submission:comment'] },
    { name: 'Entry Desk Officer (DOR)', code: 'ENTRY_DESK_OFFICER', hierarchyLevel: 30, isSystem: true, permissions: ['submission:create', 'submission:intake', 'submission:verify', 'submission:forward', 'submission:return', 'submission:comment'] },
    { name: 'Section Officer', code: 'SECTION_OFFICER', hierarchyLevel: 35, isSystem: true, permissions: ['submission:create', 'submission:view_assigned', 'submission:comment', 'submission:raye_respond'] },
    { name: 'Nayeb Subba', code: 'NAYEB_SUBBA', hierarchyLevel: 25, isSystem: true, permissions: ['submission:create', 'submission:view_assigned', 'submission:comment'] },
    { name: 'Kharidaar', code: 'KHARIDAAR', hierarchyLevel: 20, isSystem: true, permissions: ['submission:create', 'submission:view_assigned', 'submission:comment'] },
    { name: 'Chief Accounts Controller', code: 'ACCOUNTS_CONTROLLER', hierarchyLevel: 55, isSystem: true, permissions: ['submission:create', 'submission:view_assigned', 'submission:comment', 'submission:raye_respond'] },
    { name: 'Account Officer', code: 'ACCOUNT_OFFICER', hierarchyLevel: 45, isSystem: true, permissions: ['submission:create', 'submission:view_assigned', 'submission:comment', 'submission:raye_respond'] },
    { name: 'Accountant', code: 'ACCOUNTANT', hierarchyLevel: 35, isSystem: true, permissions: ['submission:create', 'submission:view_assigned', 'submission:comment'] },
    { name: 'Deputy Secretary - Law', code: 'LAW_SECRETARY', hierarchyLevel: 55, isSystem: true, permissions: ['submission:create', 'submission:view_assigned', 'submission:comment', 'submission:raye_respond'] },
    { name: 'Law Officer', code: 'LAW_OFFICER', hierarchyLevel: 45, isSystem: true, permissions: ['submission:create', 'submission:view_assigned', 'submission:comment', 'submission:raye_respond'] },
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

  // ---- DOR Foundation Seed ----
  const dorOrg = await prisma.organisation.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: { name: 'Ministry of Infrastructure Development' },
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Ministry of Infrastructure Development',
    },
  });

  const dorDept = await prisma.department.upsert({
    where: { code: 'DOR' },
    update: {
      name: 'Department of Roads',
      organisationId: dorOrg.id,
    },
    create: {
      id: '00000000-0000-0000-0000-000000000020',
      name: 'Department of Roads',
      code: 'DOR',
      organisationId: dorOrg.id,
    },
  });
  console.log(`  DOR Department: ${dorDept.name} (${dorDept.code})`);

  const dorBranchSeed: Array<{
    id?: string;
    code: string;
    name: string;
    branchLevel: number;
    clusterType: string;
    parentCode: string | null;
    isDorHq?: boolean;
    nepaliName?: string | null;
  }> = [
    { id: '00000000-0000-0000-0000-000000000201', code: 'DOR-HQ', name: 'DOR Headquarters', branchLevel: 3, clusterType: 'DOR_HQ', parentCode: null, isDorHq: true },
    { id: '00000000-0000-0000-0000-000000000202', code: 'DOR-PMD', name: 'Planning and Monitoring Division', branchLevel: 3, clusterType: 'HQ_MAHASAKHA', parentCode: 'DOR-HQ' },
    { code: 'DOR-MTD', name: 'Maintenance Division', branchLevel: 3, clusterType: 'HQ_MAHASAKHA', parentCode: 'DOR-HQ' },
    { code: 'DOR-BRD', name: 'Bridge Division', branchLevel: 3, clusterType: 'HQ_MAHASAKHA', parentCode: 'DOR-HQ' },
    { code: 'DOR-DAID', name: 'Development Assistance Implementation Division', branchLevel: 3, clusterType: 'HQ_MAHASAKHA', parentCode: 'DOR-HQ' },
    { code: 'DOR-MCD', name: 'Mechanical Division', branchLevel: 3, clusterType: 'HQ_MAHASAKHA', parentCode: 'DOR-HQ' },
    { id: '00000000-0000-0000-0000-000000000203', code: 'DOR-ADM', name: 'Administration Unit', branchLevel: 3, clusterType: 'HQ_ADMIN', parentCode: 'DOR-HQ', nepaliName: 'प्रशासन शाखा' },
    { id: '00000000-0000-0000-0000-000000000204', code: 'DOR-FIN', name: 'Financial Administration Unit', branchLevel: 3, clusterType: 'HQ_ADMIN', parentCode: 'DOR-HQ', nepaliName: 'आर्थिक प्रशासन शाखा' },
    { id: '00000000-0000-0000-0000-000000000205', code: 'DOR-LAW', name: 'Law and Dispute Management Unit', branchLevel: 3, clusterType: 'HQ_ADMIN', parentCode: 'DOR-HQ', nepaliName: 'कानुन तथा विवाद व्यवस्थापन शाखा' },
    { code: 'DOR-FRSMO', name: 'Federal Road Supervision and Monitoring Offices', branchLevel: 3, clusterType: 'FRSMO_CLUSTER', parentCode: 'DOR-HQ' },
    { code: 'DOR-MECH-FIELD', name: 'Mechanical Division (HEDs / MOs)', branchLevel: 3, clusterType: 'MECHANICAL_FIELD_CLUSTER', parentCode: 'DOR-HQ' },
    { code: 'DOR-QRDC', name: 'Quality Research and Development Center (QRDC)', branchLevel: 3, clusterType: 'HQ_MAHASAKHA', parentCode: 'DOR-HQ' },

    { code: 'PMD-PMEU', name: 'Planning, Monitoring and Evaluation Branch', branchLevel: 2, clusterType: 'HQ_MAHASAKHA', parentCode: 'DOR-PMD', nepaliName: 'योजना अनुगमन तथा मूल्यांकन शाखा' },
    { code: 'PMD-GESU', name: 'Geo-Environment and Social Branch', branchLevel: 2, clusterType: 'HQ_MAHASAKHA', parentCode: 'DOR-PMD', nepaliName: 'भू-वातावरण तथा सामाजिक शाखा' },
    { code: 'PMD-RST', name: 'Road Safety and Traffic Branch', branchLevel: 2, clusterType: 'HQ_MAHASAKHA', parentCode: 'DOR-PMD', nepaliName: 'सडक सुरक्षा तथा ट्राफिक शाखा' },
    { code: 'PMD-ICT', name: 'HMIS and ICT Branch', branchLevel: 2, clusterType: 'HQ_MAHASAKHA', parentCode: 'DOR-PMD', nepaliName: 'हाईवे व्यवस्थापन सूचना प्रणाली तथा सूचना संचार प्रविधि शाखा' },
    { code: 'MTD-MRU', name: 'Maintenance and Repair Unit', branchLevel: 2, clusterType: 'HQ_MAHASAKHA', parentCode: 'DOR-MTD', nepaliName: 'सम्भार महाशाखा' },
    { code: 'MTD-RAMU', name: 'Road Assets Management Unit', branchLevel: 2, clusterType: 'HQ_MAHASAKHA', parentCode: 'DOR-MTD' },
    { code: 'BRD-DMU', name: 'Design and Monitoring Unit', branchLevel: 2, clusterType: 'HQ_MAHASAKHA', parentCode: 'DOR-BRD', nepaliName: 'पुल महाशाखा' },
    { code: 'BRD-MCU', name: 'Maintenance Coordination Unit', branchLevel: 2, clusterType: 'HQ_MAHASAKHA', parentCode: 'DOR-BRD' },
    { code: 'BRD-BCCU', name: 'Bridge Construction Coordination Unit', branchLevel: 2, clusterType: 'HQ_MAHASAKHA', parentCode: 'DOR-BRD' },
    { code: 'BRD-PIU', name: 'Project Implementation Unit', branchLevel: 2, clusterType: 'HQ_MAHASAKHA', parentCode: 'DOR-BRD' },
    { code: 'DAID-BIL', name: 'Bilateral Branch', branchLevel: 2, clusterType: 'HQ_MAHASAKHA', parentCode: 'DOR-DAID', nepaliName: 'विकास सहायता कार्यान्वयन महाशाखा' },
    { code: 'DAID-MUL', name: 'Multilateral Branch', branchLevel: 2, clusterType: 'HQ_MAHASAKHA', parentCode: 'DOR-DAID' },
    { code: 'MCD-MMU', name: 'Maintenance Management Unit', branchLevel: 2, clusterType: 'HQ_MAHASAKHA', parentCode: 'DOR-MCD', nepaliName: 'यान्त्रिक महाशाखा' },
    { code: 'MCD-PPU', name: 'Planning and Procurement Management Unit', branchLevel: 2, clusterType: 'HQ_MAHASAKHA', parentCode: 'DOR-MCD' },

    { id: '00000000-0000-0000-0000-000000000206', code: 'FRSMO-DMK', name: 'Damak FRSMO', branchLevel: 2, clusterType: 'FRSMO', parentCode: 'DOR-FRSMO' },
    { code: 'FRSMO-KTM', name: 'Kathmandu FRSMO', branchLevel: 2, clusterType: 'FRSMO', parentCode: 'DOR-FRSMO' },
    { code: 'FRSMO-PKR', name: 'Pokhara FRSMO', branchLevel: 2, clusterType: 'FRSMO', parentCode: 'DOR-FRSMO' },
    { code: 'FRSMO-SRK', name: 'Surkhet FRSMO', branchLevel: 2, clusterType: 'FRSMO', parentCode: 'DOR-FRSMO' },

    { code: 'PD-PUSH', name: 'Pushpalal (Mid-Hill) Highway Project Directorate', branchLevel: 3, clusterType: 'PROJECT_DIRECTORATE', parentCode: 'DOR-HQ' },
    { code: 'PD-MADAN', name: 'Madan Bhandari Highway Project Directorate', branchLevel: 3, clusterType: 'PROJECT_DIRECTORATE', parentCode: 'DOR-HQ' },
    { code: 'PD-HULAK', name: 'Postal Highway Directorate', branchLevel: 3, clusterType: 'PROJECT_DIRECTORATE', parentCode: 'DOR-HQ' },
    { code: 'PD-ADB', name: 'Project Directorate (ADB)', branchLevel: 3, clusterType: 'PROJECT_DIRECTORATE', parentCode: 'DOR-HQ' },
    { code: 'PD-NSTR', name: 'North-South and Trade Road Expansion Directorate', branchLevel: 3, clusterType: 'PROJECT_DIRECTORATE', parentCode: 'DOR-HQ' },

    { code: 'BS-GROUP', name: 'Bridge Sectors', branchLevel: 2, clusterType: 'BRIDGE_SECTOR_GROUP', parentCode: 'DOR-BRD' },
    { code: 'BS-DHR', name: 'Dharan Sector', branchLevel: 1, clusterType: 'BRIDGE_SECTOR', parentCode: 'BS-GROUP', nepaliName: 'पुल सेक्टर, धरान' },
    { code: 'BS-KTM', name: 'Kathmandu Sector', branchLevel: 1, clusterType: 'BRIDGE_SECTOR', parentCode: 'BS-GROUP', nepaliName: 'पुल सेक्टर, काठमाडौं' },
    { code: 'BS-PKR', name: 'Pokhara Sector', branchLevel: 1, clusterType: 'BRIDGE_SECTOR', parentCode: 'BS-GROUP', nepaliName: 'पुल सेक्टर, पाेखरा' },
    { code: 'BS-SRK', name: 'Surkhet Sector', branchLevel: 1, clusterType: 'BRIDGE_SECTOR', parentCode: 'BS-GROUP', nepaliName: 'पुल सेक्टर, सुर्खेत' },
    { code: 'BS-NPG', name: 'Nepalgunj Sector', branchLevel: 1, clusterType: 'BRIDGE_SECTOR', parentCode: 'BS-GROUP', nepaliName: 'पुल सेक्टर, नेपालगञ्ज' },
    { code: 'BS-DHG', name: 'Dhangadhi Sector', branchLevel: 1, clusterType: 'BRIDGE_SECTOR', parentCode: 'BS-GROUP', nepaliName: 'पुल सेक्टर, धनगढी' },

    { code: 'RD-ILM', name: 'Road Division Ilam', branchLevel: 1, clusterType: 'ROAD_DIVISION', parentCode: 'FRSMO-DMK', nepaliName: 'सडक डिभिजन, इलाम' },
    { code: 'RD-DMK', name: 'Road Division Damak', branchLevel: 1, clusterType: 'ROAD_DIVISION', parentCode: 'FRSMO-DMK', nepaliName: 'सडक डिभिजन, दमक' },
    { code: 'RD-BRT', name: 'Road Division Biratnagar', branchLevel: 1, clusterType: 'ROAD_DIVISION', parentCode: 'FRSMO-DMK', nepaliName: 'सडक डिभिजन, विराटनगर' },
    { code: 'RD-DHK', name: 'Road Division Dhankuta', branchLevel: 1, clusterType: 'ROAD_DIVISION', parentCode: 'FRSMO-DMK', nepaliName: 'सडक डिभिजन, धनकुटा' },
    { code: 'RD-LHN', name: 'Road Division Lahan', branchLevel: 1, clusterType: 'ROAD_DIVISION', parentCode: 'FRSMO-DMK', nepaliName: 'सडक डिभिजन, लहान' },
    { code: 'RD-TML', name: 'Road Division Tumlingtar', branchLevel: 1, clusterType: 'ROAD_DIVISION', parentCode: 'FRSMO-DMK', nepaliName: 'सडक डिभिजन, तुम्लिंगटार' },
    { code: 'RD-HRK', name: 'Road Division Harkapur', branchLevel: 1, clusterType: 'ROAD_DIVISION', parentCode: 'FRSMO-DMK', nepaliName: 'सडक डिभिजन, हर्कपुर' },
    { code: 'RD-JNK', name: 'Road Division Janakpur', branchLevel: 1, clusterType: 'ROAD_DIVISION', parentCode: 'FRSMO-KTM', nepaliName: 'सडक डिभिजन, जनकपुर' },
    { code: 'RD-CHR', name: 'Road Division Charikot', branchLevel: 1, clusterType: 'ROAD_DIVISION', parentCode: 'FRSMO-KTM', nepaliName: 'सडक डिभिजन, चरिकोट' },
    { code: 'RD-CND', name: 'Road Division Chandranigahpur', branchLevel: 1, clusterType: 'ROAD_DIVISION', parentCode: 'FRSMO-KTM', nepaliName: 'सडक डिभिजन, चन्द्रनिगाहपुर' },
    { code: 'RD-HTD', name: 'Road Division Hetauda', branchLevel: 1, clusterType: 'ROAD_DIVISION', parentCode: 'FRSMO-KTM', nepaliName: 'सडक डिभिजन, हेटौडा' },
    { code: 'RD-BRP', name: 'Road Division Bharatpur', branchLevel: 1, clusterType: 'ROAD_DIVISION', parentCode: 'FRSMO-KTM', nepaliName: 'सडक डिभिजन, भरतपुर' },
    { id: '00000000-0000-0000-0000-000000000207', code: 'RD-KTM', name: 'Road Division Kathmandu', branchLevel: 1, clusterType: 'ROAD_DIVISION', parentCode: 'FRSMO-KTM', nepaliName: 'सडक डिभिजन, काठमाडौं' },
    { code: 'RD-BKT', name: 'Road Division Bhaktapur', branchLevel: 1, clusterType: 'ROAD_DIVISION', parentCode: 'FRSMO-KTM', nepaliName: 'सडक डिभिजन, भक्तपुर' },
    { code: 'RD-LLP', name: 'Road Division Lalitpur', branchLevel: 1, clusterType: 'ROAD_DIVISION', parentCode: 'FRSMO-KTM', nepaliName: 'सडक डिभिजन, ललितपुर' },
    { code: 'RD-NWK', name: 'Road Division Nuwakot', branchLevel: 1, clusterType: 'ROAD_DIVISION', parentCode: 'FRSMO-KTM', nepaliName: 'सडक डिभिजन, नुवाकोट' },
    { code: 'RD-KHK', name: 'Road Division Khurkot', branchLevel: 1, clusterType: 'ROAD_DIVISION', parentCode: 'FRSMO-KTM', nepaliName: 'सडक डिभिजन, खुर्कोट' },
    { code: 'RD-DML', name: 'Road Division Damauli', branchLevel: 1, clusterType: 'ROAD_DIVISION', parentCode: 'FRSMO-PKR', nepaliName: 'सडक डिभिजन, दमौली' },
    { code: 'RD-PKR', name: 'Road Division Pokhara', branchLevel: 1, clusterType: 'ROAD_DIVISION', parentCode: 'FRSMO-PKR', nepaliName: 'सडक डिभिजन, पोखरा' },
    { code: 'RD-PLP', name: 'Road Division Palpa', branchLevel: 1, clusterType: 'ROAD_DIVISION', parentCode: 'FRSMO-PKR', nepaliName: 'सडक डिभिजन, पाल्पा' },
    { code: 'RD-BGL', name: 'Road Division Baglung', branchLevel: 1, clusterType: 'ROAD_DIVISION', parentCode: 'FRSMO-PKR', nepaliName: 'सडक डिभिजन, बागलुङ' },
    { code: 'RD-BTW', name: 'Road Division Butwal', branchLevel: 1, clusterType: 'ROAD_DIVISION', parentCode: 'FRSMO-PKR', nepaliName: 'सडक डिभिजन, बुटवल' },
    { code: 'RD-SHV', name: 'Road Division Shivapur', branchLevel: 1, clusterType: 'ROAD_DIVISION', parentCode: 'FRSMO-PKR', nepaliName: 'सडक डिभिजन, शिवपुर' },
    { code: 'RD-SRK', name: 'Road Division Surkhet', branchLevel: 1, clusterType: 'ROAD_DIVISION', parentCode: 'FRSMO-SRK', nepaliName: 'सडक डिभिजन, सुर्खेत' },
    { code: 'RD-CHJ', name: 'Road Division Chaurajahari', branchLevel: 1, clusterType: 'ROAD_DIVISION', parentCode: 'FRSMO-SRK', nepaliName: 'सडक डिभिजन, चौरजहारी' },
    { code: 'RD-JML', name: 'Road Division Jumla', branchLevel: 1, clusterType: 'ROAD_DIVISION', parentCode: 'FRSMO-SRK', nepaliName: 'सडक डिभिजन, जुम्ला' },
    { code: 'RD-NPG', name: 'Road Division Nepalgunj', branchLevel: 1, clusterType: 'ROAD_DIVISION', parentCode: 'FRSMO-SRK', nepaliName: 'सडक डिभिजन, नेपालगञ्ज' },
    { code: 'RD-DTI', name: 'Road Division Doti', branchLevel: 1, clusterType: 'ROAD_DIVISION', parentCode: 'FRSMO-SRK', nepaliName: 'सडक डिभिजन, डोटी' },
    { code: 'RD-DNG', name: 'Road Division Dang', branchLevel: 1, clusterType: 'ROAD_DIVISION', parentCode: 'FRSMO-SRK', nepaliName: 'सडक डिभिजन, दाङ्ग' },
    { code: 'RD-BTD', name: 'Road Division Baitadi', branchLevel: 1, clusterType: 'ROAD_DIVISION', parentCode: 'FRSMO-SRK', nepaliName: 'सडक डिभिजन, बैतडी' },
    { code: 'RD-PYT', name: 'Road Division Pyuthan', branchLevel: 1, clusterType: 'ROAD_DIVISION', parentCode: 'FRSMO-SRK', nepaliName: 'सडक डिभिजन, प्युठान' },
    { code: 'RD-SFB', name: 'Road Division Sanfebagar', branchLevel: 1, clusterType: 'ROAD_DIVISION', parentCode: 'FRSMO-SRK', nepaliName: 'सडक डिभिजन, साँफेबगर' },
    { code: 'RD-MHN', name: 'Road Division Mahendranagar', branchLevel: 1, clusterType: 'ROAD_DIVISION', parentCode: 'FRSMO-SRK', nepaliName: 'सडक डिभिजन, महेन्द्रनगर' },

    { code: 'PUSH-PO', name: 'Project Offices', branchLevel: 2, clusterType: 'PROJECT_OFFICE_GROUP', parentCode: 'PD-PUSH' },
    { code: 'PO-PUSH-PCT', name: 'Panchthar Project Office', branchLevel: 1, clusterType: 'PROJECT_OFFICE', parentCode: 'PUSH-PO', nepaliName: 'पुष्पलाल (मध्य पहाडी) राजमार्ग योजना कार्यालय, पांचथर' },
    { code: 'PO-PUSH-RMC', name: 'Ramechhap Project Office', branchLevel: 1, clusterType: 'PROJECT_OFFICE', parentCode: 'PUSH-PO', nepaliName: 'पुष्पलाल (मध्यपहाडी) राजमार्ग योजना कार्यालय, रामेछाप' },
    { code: 'PO-PUSH-GRK', name: 'Gorkha Project Office', branchLevel: 1, clusterType: 'PROJECT_OFFICE', parentCode: 'PUSH-PO', nepaliName: 'पुष्पलाल (मध्य पहाडी) राजमार्ग योजना कार्यालय, गोरखा' },
    { code: 'PO-PUSH-PRB', name: 'Parbat Project Office', branchLevel: 1, clusterType: 'PROJECT_OFFICE', parentCode: 'PUSH-PO', nepaliName: 'पुष्पलाल (मध्य पहाडी) राजमार्ग योजना कार्यालय, पर्वत' },
    { code: 'PO-PUSH-DLK', name: 'Dailekh Project Office', branchLevel: 1, clusterType: 'PROJECT_OFFICE', parentCode: 'PUSH-PO', nepaliName: 'पुष्पलाल (मध्यपहाडी) राजमार्ग योजना कार्यालय, दैलेख' },
    { code: 'MADAN-PO', name: 'Project Offices', branchLevel: 2, clusterType: 'PROJECT_OFFICE_GROUP', parentCode: 'PD-MADAN' },
    { code: 'PO-MBH-DMK', name: 'Damak Project Office', branchLevel: 1, clusterType: 'PROJECT_OFFICE', parentCode: 'MADAN-PO', nepaliName: 'मदन भण्डारी राजमार्ग योजना कार्यालय, दमक' },
    { code: 'PO-MBH-GIG', name: 'Gaighat Project Office', branchLevel: 1, clusterType: 'PROJECT_OFFICE', parentCode: 'MADAN-PO', nepaliName: 'मदन भण्डारी राजमार्ग योजना कार्यालय, गाईघाट' },
    { code: 'PO-MBH-HTD', name: 'Hetauda Project Office', branchLevel: 1, clusterType: 'PROJECT_OFFICE', parentCode: 'MADAN-PO', nepaliName: 'मदन भण्डारी राजमार्ग योजना कार्यालय, हेटौंडा' },
    { code: 'PO-MBH-GLM', name: 'Gulmi Project Office', branchLevel: 1, clusterType: 'PROJECT_OFFICE', parentCode: 'MADAN-PO', nepaliName: 'मदन भण्डारी राजमार्ग योजना कार्यालय, गुल्मी' },
    { code: 'PO-MBH-SRK', name: 'Surkhet Project Office', branchLevel: 1, clusterType: 'PROJECT_OFFICE', parentCode: 'MADAN-PO', nepaliName: 'मदन भण्डारी राजमार्ग योजना कार्यालय, सुर्खेत' },
    { code: 'HULAK-PO', name: 'Project Offices', branchLevel: 2, clusterType: 'PROJECT_OFFICE_GROUP', parentCode: 'PD-HULAK' },
    { code: 'PO-HLK-ITH', name: 'Itahari Project Office', branchLevel: 1, clusterType: 'PROJECT_OFFICE', parentCode: 'HULAK-PO', nepaliName: 'हुलाकी राजमार्ग निर्देशनालय, योजना कार्यालय, इटहरी' },
    { code: 'PO-HLK-JNK', name: 'Janakpur Project Office', branchLevel: 1, clusterType: 'PROJECT_OFFICE', parentCode: 'HULAK-PO', nepaliName: 'हुलाकी राजमार्ग निर्देशनालय, याेजना कार्यालय, जनकपुर' },
    { code: 'PO-HLK-BRG', name: 'Birgunj Project Office', branchLevel: 1, clusterType: 'PROJECT_OFFICE', parentCode: 'HULAK-PO', nepaliName: 'हुलाकी राजमार्ग निर्देशनालय, योजना कार्यालय, विरगञ्ज' },
    { code: 'PO-HLK-KPL', name: 'Kapilvastu Project Office', branchLevel: 1, clusterType: 'PROJECT_OFFICE', parentCode: 'HULAK-PO', nepaliName: 'हुलाकी राजमार्ग निर्देशनालय, योजना कार्यालय, कपिलवस्तु' },
    { code: 'PO-HLK-NPG', name: 'Nepalgunj Project Office', branchLevel: 1, clusterType: 'PROJECT_OFFICE', parentCode: 'HULAK-PO', nepaliName: 'हुलाकी राजमार्ग निर्देशनालय, योजना कार्यालय, नेपालगञ्ज' },
    { code: 'PO-HLK-DHG', name: 'Dhangadhi Project Office', branchLevel: 1, clusterType: 'PROJECT_OFFICE', parentCode: 'HULAK-PO', nepaliName: 'हुलाकी राजमार्ग निर्देशनालय, योजना कार्यालय, धनगढी' },
    { code: 'QRDC-SIDDHA', name: 'Siddhababa Tunnel Project', branchLevel: 1, clusterType: 'PROJECT_OFFICE', parentCode: 'DOR-QRDC', nepaliName: 'सिद्धबाबा सुरुङ मार्ग याेजना' },
    { code: 'QRDC-DBC', name: 'Dumre-Besishahar-Chame Road Project', branchLevel: 1, clusterType: 'PROJECT_OFFICE', parentCode: 'DOR-QRDC', nepaliName: 'डुम्रे-वेशीशहर-चामे सडक योजना' },
    { code: 'ADB-PROJECTS', name: 'ADB Projects (East/West Sections)', branchLevel: 2, clusterType: 'PROJECT_OFFICE_GROUP', parentCode: 'PD-ADB' },
    { code: 'PO-ADB-NBR', name: 'Narayangadh-Butwal Road Project', branchLevel: 1, clusterType: 'PROJECT_OFFICE', parentCode: 'ADB-PROJECTS', nepaliName: 'नारायनगढ-बुटवल सडक योजना' },
    { code: 'PO-ADB-MPR', name: 'Mugling-Pokhara Road Project', branchLevel: 1, clusterType: 'PROJECT_OFFICE', parentCode: 'ADB-PROJECTS', nepaliName: 'मुग्लिङ्ग-पोखरा सडक योजना' },
    { code: 'NSTR-CORRIDOR', name: 'Corridor Schemes', branchLevel: 2, clusterType: 'PROJECT_OFFICE_GROUP', parentCode: 'PD-NSTR' },
    { code: 'NSTR-TAMOR', name: 'Tamor Corridor Road Project', branchLevel: 1, clusterType: 'PROJECT_OFFICE', parentCode: 'NSTR-CORRIDOR', nepaliName: 'तमोर कोरिडोर सडक योजना' },
    { code: 'NSTR-KALIGANDAKI', name: 'Kaligandaki Corridor Road Project', branchLevel: 1, clusterType: 'PROJECT_OFFICE', parentCode: 'NSTR-CORRIDOR', nepaliName: 'कालिगण्डकी कोरिडोर सडक योजना' },

    { code: 'MECH-HED', name: 'Heavy Equipment Divisions', branchLevel: 2, clusterType: 'HED_GROUP', parentCode: 'DOR-MECH-FIELD' },
    { code: 'HED-ITH', name: 'Itahari HED', branchLevel: 1, clusterType: 'HED', parentCode: 'MECH-HED', nepaliName: 'हेभी इक्वीपमेन्ट डिभिजन, इटहरी' },
    { code: 'HED-JNK', name: 'Janakpur HED', branchLevel: 1, clusterType: 'HED', parentCode: 'MECH-HED', nepaliName: 'हेभी इक्वीपमेन्ट डिभिजन, जनकपुर' },
    { code: 'HED-HTD', name: 'Hetauda HED', branchLevel: 1, clusterType: 'HED', parentCode: 'MECH-HED', nepaliName: 'हेभी इक्वीपमेन्ट डिभिजन, हेटौडा' },
    { code: 'HED-KTM', name: 'Kathmandu HED', branchLevel: 1, clusterType: 'HED', parentCode: 'MECH-HED', nepaliName: 'हेभी इक्वीपमेन्ट डिभिजन, काठमाडौं' },
    { code: 'HED-PKR', name: 'Pokhara HED', branchLevel: 1, clusterType: 'HED', parentCode: 'MECH-HED', nepaliName: 'हेभी इक्वीपमेन्ट डिभिजन, पोखरा' },
    { code: 'HED-BTW', name: 'Butwal HED', branchLevel: 1, clusterType: 'HED', parentCode: 'MECH-HED', nepaliName: 'हेभी इक्वीपमेन्ट डिभिजन, बुटवल' },
    { code: 'HED-NPG', name: 'Nepalgunj HED', branchLevel: 1, clusterType: 'HED', parentCode: 'MECH-HED', nepaliName: 'हेभी इक्वीपमेन्ट डिभिजन, नेपालगन्ज' },
    { code: 'HED-GDW', name: 'Godawari HED', branchLevel: 1, clusterType: 'HED', parentCode: 'MECH-HED', nepaliName: 'हेभी इक्वीपमेन्ट डिभिजन, गोदावरी' },
    { code: 'MECH-MO', name: 'Mechanical Offices', branchLevel: 2, clusterType: 'MECHANICAL_OFFICE_GROUP', parentCode: 'DOR-MECH-FIELD' },
    { code: 'MO-PHD', name: 'Phidim MO', branchLevel: 1, clusterType: 'MECHANICAL_OFFICE', parentCode: 'MECH-MO', nepaliName: 'यान्त्रिक कार्यालय, फिदिम' },
    { code: 'MO-LHN', name: 'Lahan MO', branchLevel: 1, clusterType: 'MECHANICAL_OFFICE', parentCode: 'MECH-MO', nepaliName: 'यान्त्रिक कार्यालय, लहान' },
    { code: 'MO-MLK', name: 'Mulkot MO', branchLevel: 1, clusterType: 'MECHANICAL_OFFICE', parentCode: 'MECH-MO', nepaliName: 'यान्त्रिक कार्यालय, मुलकाेट' },
    { code: 'MO-NWK', name: 'Nuwakot MO', branchLevel: 1, clusterType: 'MECHANICAL_OFFICE', parentCode: 'MECH-MO', nepaliName: 'यान्त्रिक कार्यालय, नुवाकोट' },
    { code: 'MO-DMR', name: 'Dumre MO', branchLevel: 1, clusterType: 'MECHANICAL_OFFICE', parentCode: 'MECH-MO', nepaliName: 'यान्त्रिक कार्यालय, डुम्रे' },
    { code: 'MO-DNG', name: 'Dang MO', branchLevel: 1, clusterType: 'MECHANICAL_OFFICE', parentCode: 'MECH-MO', nepaliName: 'यान्त्रिक कार्यालय, दाङ्ग' },
    { code: 'MO-JML', name: 'Jumla MO', branchLevel: 1, clusterType: 'MECHANICAL_OFFICE', parentCode: 'MECH-MO', nepaliName: 'यान्त्रिक कार्यालय, जुम्ला' },
    { code: 'MO-BDR', name: 'Budar MO', branchLevel: 1, clusterType: 'MECHANICAL_OFFICE', parentCode: 'MECH-MO', nepaliName: 'यान्त्रिक कार्यालय, बुडर' },
    { code: 'MECH-TTC', name: 'Technical Training Center', branchLevel: 2, clusterType: 'TRAINING_CENTER', parentCode: 'DOR-MECH-FIELD' },
    { code: 'MTC-LLP', name: 'Mechanical Training Center, Lalitpur', branchLevel: 1, clusterType: 'MECHANICAL_TRAINING_CENTER', parentCode: 'MECH-TTC', nepaliName: 'यान्त्रिक तालिम केन्द्र, ललितपुर' },
  ];

  const dorBranchMap: Record<string, string> = {};
  for (const branchSeed of dorBranchSeed) {
    const parentBranchId = branchSeed.parentCode ? dorBranchMap[branchSeed.parentCode] : null;
    if (branchSeed.parentCode && !parentBranchId) {
      throw new Error(`DOR branch seed ${branchSeed.code} references unknown parent ${branchSeed.parentCode}`);
    }

    const dorBranch = await prisma.branch.upsert({
      where: { code: branchSeed.code },
      update: {
        name: branchSeed.name,
        departmentId: dorDept.id,
        branchLevel: branchSeed.branchLevel,
        parentBranchId,
        clusterType: branchSeed.clusterType,
        nepaliName: branchSeed.nepaliName || null,
        isDorHq: branchSeed.isDorHq || false,
      },
      create: {
        ...(branchSeed.id ? { id: branchSeed.id } : {}),
        code: branchSeed.code,
        name: branchSeed.name,
        departmentId: dorDept.id,
        branchLevel: branchSeed.branchLevel,
        parentBranchId,
        clusterType: branchSeed.clusterType,
        nepaliName: branchSeed.nepaliName || null,
        isDorHq: branchSeed.isDorHq || false,
      },
    });
    dorBranchMap[branchSeed.code] = dorBranch.id;
    console.log(`  DOR Branch: ${dorBranch.name} (${dorBranch.code})`);
  }

  const dorUserPasswordHash = await bcrypt.hash(process.env.SEED_DOR_USER_PASSWORD || 'Dor@2026!', 12);
  const dorUsers = [
    { email: 'dg@dor.gov.np', firstName: 'DG', lastName: 'DOR', role: 'SUPER_ADMIN', designation: 'Director General', branchCode: 'DOR-HQ' },
    { email: 'ddg.planning@dor.gov.np', firstName: 'DDG', lastName: 'Planning', role: 'DEPARTMENT_ADMIN', designation: 'Deputy Director General', branchCode: 'DOR-PMD' },
    { email: 'ddg.maintenance@dor.gov.np', firstName: 'DDG', lastName: 'Maintenance', role: 'DEPARTMENT_ADMIN', designation: 'Deputy Director General', branchCode: 'DOR-MTD' },
    { email: 'ddg.bridge@dor.gov.np', firstName: 'DDG', lastName: 'Bridge', role: 'DEPARTMENT_ADMIN', designation: 'Deputy Director General', branchCode: 'DOR-BRD' },
    { email: 'ddg.development@dor.gov.np', firstName: 'DDG', lastName: 'Development Assistance', role: 'DEPARTMENT_ADMIN', designation: 'Deputy Director General', branchCode: 'DOR-DAID' },
    { email: 'ddg.mechanical@dor.gov.np', firstName: 'DDG', lastName: 'Mechanical', role: 'DEPARTMENT_ADMIN', designation: 'Deputy Director General', branchCode: 'DOR-MCD' },
    { email: 'se.frsmo.damak@dor.gov.np', firstName: 'SE', lastName: 'Damak', role: 'SUPERINTENDENT_ENGINEER', designation: 'Superintending Engineer', branchCode: 'FRSMO-DMK' },
    { email: 'se.frsmo.ktm@dor.gov.np', firstName: 'SE', lastName: 'Kathmandu', role: 'SUPERINTENDENT_ENGINEER', designation: 'Superintending Engineer', branchCode: 'FRSMO-KTM' },
    { email: 'sde.rd.ktm@dor.gov.np', firstName: 'SDE', lastName: 'Kathmandu', role: 'SENIOR_ENGINEER', designation: 'Senior Division Engineer', branchCode: 'RD-KTM' },
    { email: 'engineer.rd.ktm@dor.gov.np', firstName: 'Engineer', lastName: 'Kathmandu', role: 'ENGINEER', designation: 'Engineer', branchCode: 'RD-KTM' },
    { email: 'sub.rd.ktm@dor.gov.np', firstName: 'SubEngineer', lastName: 'Kathmandu', role: 'SUB_ENGINEER', designation: 'Sub Engineer', branchCode: 'RD-KTM' },
    { email: 'entry.rd.ktm@dor.gov.np', firstName: 'Entry', lastName: 'Kathmandu', role: 'ENTRY_DESK_OFFICER', designation: 'Entry Desk Officer', branchCode: 'RD-KTM' },
    { email: 'admin.rd.ktm@dor.gov.np', firstName: 'Admin', lastName: 'Kathmandu', role: 'BRANCH_ADMIN', designation: 'Chief Administrative Officer', branchCode: 'RD-KTM' },
    { email: 'section.rd.ktm@dor.gov.np', firstName: 'Section', lastName: 'Kathmandu', role: 'SECTION_OFFICER', designation: 'Section Officer', branchCode: 'RD-KTM' },
    { email: 'nayeb.rd.ktm@dor.gov.np', firstName: 'Nayeb', lastName: 'Kathmandu', role: 'NAYEB_SUBBA', designation: 'Nayeb Subba', branchCode: 'RD-KTM' },
    { email: 'kharidaar.rd.ktm@dor.gov.np', firstName: 'Kharidaar', lastName: 'Kathmandu', role: 'KHARIDAAR', designation: 'Kharidaar', branchCode: 'RD-KTM' },
    { email: 'admin.dor@dor.gov.np', firstName: 'Admin', lastName: 'DOR', role: 'BRANCH_ADMIN', designation: 'Chief Administrative Officer', branchCode: 'DOR-ADM' },
    { email: 'section.dor@dor.gov.np', firstName: 'Section', lastName: 'DOR', role: 'SECTION_OFFICER', designation: 'Section Officer', branchCode: 'DOR-ADM' },
    { email: 'accounts.controller@dor.gov.np', firstName: 'Accounts', lastName: 'Controller', role: 'ACCOUNTS_CONTROLLER', designation: 'Chief Accounts Controller', branchCode: 'DOR-FIN' },
    { email: 'account.officer.dor@dor.gov.np', firstName: 'Account', lastName: 'DOR', role: 'ACCOUNT_OFFICER', designation: 'Account Officer', branchCode: 'DOR-FIN' },
    { email: 'accountant.dor@dor.gov.np', firstName: 'Accountant', lastName: 'DOR', role: 'ACCOUNTANT', designation: 'Accountant', branchCode: 'DOR-FIN' },
    { email: 'account.rd.ktm@dor.gov.np', firstName: 'Account', lastName: 'Kathmandu', role: 'ACCOUNT_OFFICER', designation: 'Account Officer', branchCode: 'RD-KTM' },
    { email: 'accountant.rd.ktm@dor.gov.np', firstName: 'Accountant', lastName: 'Kathmandu', role: 'ACCOUNTANT', designation: 'Accountant', branchCode: 'RD-KTM' },
    { email: 'law.secretary@dor.gov.np', firstName: 'Law', lastName: 'Secretary', role: 'LAW_SECRETARY', designation: 'Deputy Secretary - Law', branchCode: 'DOR-LAW' },
    { email: 'law.dor@dor.gov.np', firstName: 'Law', lastName: 'Officer', role: 'LAW_OFFICER', designation: 'Law Officer', branchCode: 'DOR-LAW' },
  ];

  const dorUserMap: Record<string, string> = {};
  for (const dorUser of dorUsers) {
    const created = await prisma.user.upsert({
      where: { email: dorUser.email },
      update: {
        firstName: dorUser.firstName,
        lastName: dorUser.lastName,
        roleId: roleMap[dorUser.role],
        departmentId: dorDept.id,
        branchId: dorBranchMap[dorUser.branchCode],
        designation: dorUser.designation,
        status: 'ACTIVE',
      },
      create: {
        email: dorUser.email,
        passwordHash: dorUserPasswordHash,
        firstName: dorUser.firstName,
        lastName: dorUser.lastName,
        roleId: roleMap[dorUser.role],
        departmentId: dorDept.id,
        branchId: dorBranchMap[dorUser.branchCode],
        designation: dorUser.designation,
        status: 'ACTIVE',
        mustChangePass: true,
      },
    });
    dorUserMap[dorUser.email] = created.id;
    console.log(`  DOR User: ${created.email}`);
  }

  const dorContractor = await prisma.user.upsert({
    where: { email: 'contractor.test@example.com' },
    update: {
      roleId: roleMap['CONTRACTOR'],
      status: 'ACTIVE',
      companyName: 'ABC Construction Pvt. Ltd.',
    },
    create: {
      email: 'contractor.test@example.com',
      passwordHash: contractorHash,
      firstName: 'Test',
      lastName: 'Contractor',
      roleId: roleMap['CONTRACTOR'],
      status: 'ACTIVE',
      companyName: 'ABC Construction Pvt. Ltd.',
      phone: '+977-9800000000',
      mustChangePass: false,
    },
  });
  console.log(`  DOR Contractor: ${dorContractor.email}`);

  const dorWorkflowSeeds = [
    {
      id: '00000000-0000-0000-0000-000000020001',
      code: 'VO',
      name: 'DOR Variation Order Approval',
      description: 'Variation Order approval with Tippani, Tok, and Raye support.',
      metadataSchema: [
        { key: 'contract_number', label: 'Contract Number', type: 'TEXT', required: true },
        { key: 'vo_percentage', label: 'VO Percentage', type: 'NUMBER', required: true },
        { key: 'variation_amount', label: 'Variation Amount (NPR)', type: 'NUMBER', required: true },
      ],
      stages: [
        { name: 'Entry Desk - Document Intake', order: 1, role: 'ENTRY_DESK_OFFICER', slaDays: 1, actions: ['FORWARD', 'REJECT_TO_CONTRACTOR', 'COMMENT'], requiredDocs: [] },
        { name: 'SDE Office Admin - Tok or Forward', order: 2, role: 'SENIOR_ENGINEER', slaDays: 2, actions: ['FORWARD', 'REJECT_TO_CONTRACTOR', 'QUERY', 'COMMENT', 'TOK'], requiredDocs: [] },
        { name: 'Sub Engineer - Initial Technical Check', order: 3, role: 'SUB_ENGINEER', slaDays: 3, actions: ['FORWARD', 'REJECT', 'QUERY', 'COMMENT'], requiredDocs: [] },
        { name: 'Engineer - Technical Review and Tippani', order: 4, role: 'ENGINEER', slaDays: 5, actions: ['FORWARD', 'REJECT', 'QUERY', 'COMMENT', 'TOK', 'TIPPANI'], requiredDocs: ['TIPPANI'] },
        { name: 'SDE - Review and Decision', order: 5, role: 'SENIOR_ENGINEER', slaDays: 5, actions: ['FORWARD', 'APPROVE', 'REJECT_ANY', 'COMMENT', 'RAYE', 'TOK', 'SIGN'], requiredDocs: [] },
        { name: 'SE - Superintending Engineer Review', order: 6, role: 'SUPERINTENDENT_ENGINEER', slaDays: 7, actions: ['FORWARD', 'APPROVE', 'REJECT_ANY', 'COMMENT', 'RAYE', 'TOK', 'SIGN'], requiredDocs: [] },
        { name: 'DDG - Department Review', order: 7, role: 'DEPARTMENT_ADMIN', slaDays: 7, actions: ['FORWARD', 'APPROVE', 'REJECT_ANY', 'COMMENT', 'RAYE', 'TOK', 'SIGN'], requiredDocs: [] },
        { name: 'DG - Final DOR Decision', order: 8, role: 'SUPER_ADMIN', slaDays: 7, actions: ['APPROVE', 'FORWARD_TO_MINISTRY', 'REJECT_ANY', 'COMMENT', 'RAYE', 'TOK', 'SIGN'], requiredDocs: [] },
      ],
      routingRules: [
        { fromOrder: 5, conditionField: 'vo_percentage', operator: 'gte', value: '10', targetOrder: 6 },
        { fromOrder: 6, conditionField: 'vo_percentage', operator: 'gte', value: '15', targetOrder: 7 },
      ],
    },
    {
      id: '00000000-0000-0000-0000-000000020002',
      code: 'IPC',
      name: 'DOR Interim Payment Certificate Approval',
      description: 'IPC approval workflow with account Raye support.',
      metadataSchema: [
        { key: 'contract_number', label: 'Contract Number', type: 'TEXT', required: true },
        { key: 'ipc_number', label: 'IPC Number', type: 'NUMBER', required: true },
        { key: 'payment_amount', label: 'Payment Amount (NPR)', type: 'NUMBER', required: true },
      ],
      stages: [
        { name: 'Entry Desk - IPC Intake', order: 1, role: 'ENTRY_DESK_OFFICER', slaDays: 1, actions: ['FORWARD', 'REJECT_TO_CONTRACTOR', 'COMMENT'], requiredDocs: [] },
        { name: 'Sub Engineer - Measurement Verification', order: 2, role: 'SUB_ENGINEER', slaDays: 3, actions: ['FORWARD', 'REJECT', 'QUERY', 'COMMENT'], requiredDocs: [] },
        { name: 'Engineer - Review and Tippani', order: 3, role: 'ENGINEER', slaDays: 5, actions: ['FORWARD', 'REJECT', 'COMMENT', 'TOK', 'TIPPANI'], requiredDocs: ['TIPPANI'] },
        { name: 'SDE - Final Approval', order: 4, role: 'SENIOR_ENGINEER', slaDays: 5, actions: ['APPROVE', 'REJECT_ANY', 'COMMENT', 'RAYE', 'TOK', 'SIGN'], requiredDocs: [] },
      ],
      routingRules: [],
    },
    {
      id: '00000000-0000-0000-0000-000000020003',
      code: 'CA',
      name: 'DOR Contract Agreement Approval',
      description: 'Contract agreement approval workflow with legal/finance consultation.',
      metadataSchema: [
        { key: 'contract_number', label: 'Contract Number', type: 'TEXT', required: true },
        { key: 'contract_amount', label: 'Contract Amount (NPR)', type: 'NUMBER', required: true },
        { key: 'project_name', label: 'Project Name', type: 'TEXT', required: true },
      ],
      stages: [
        { name: 'Entry Desk - Agreement Intake', order: 1, role: 'ENTRY_DESK_OFFICER', slaDays: 2, actions: ['FORWARD', 'REJECT_TO_CONTRACTOR', 'COMMENT', 'REQUEST_INFO'], requiredDocs: [] },
        { name: 'Sub Engineer - Technical Verification', order: 2, role: 'SUB_ENGINEER', slaDays: 3, actions: ['FORWARD', 'REJECT', 'QUERY', 'COMMENT'], requiredDocs: [] },
        { name: 'Engineer - Review and Tippani', order: 3, role: 'ENGINEER', slaDays: 5, actions: ['FORWARD', 'REJECT', 'COMMENT', 'TOK', 'TIPPANI'], requiredDocs: ['TIPPANI'] },
        { name: 'SDE - Review and Forward', order: 4, role: 'SENIOR_ENGINEER', slaDays: 5, actions: ['FORWARD', 'APPROVE', 'REJECT_ANY', 'COMMENT', 'RAYE', 'TOK', 'SIGN'], requiredDocs: [] },
        { name: 'SE - Final Approval', order: 5, role: 'SUPERINTENDENT_ENGINEER', slaDays: 7, actions: ['APPROVE', 'REJECT_ANY', 'COMMENT', 'RAYE', 'TOK', 'SIGN'], requiredDocs: [] },
      ],
      routingRules: [],
    },
  ];

  for (const workflowSeed of dorWorkflowSeeds) {
    const dorWorkflow = await prisma.workflowDefinition.upsert({
      where: {
        name_departmentId_version: {
          name: workflowSeed.name,
          departmentId: dorDept.id,
          version: 1,
        },
      },
      update: {
        code: workflowSeed.code,
        description: workflowSeed.description,
        status: 'ACTIVE',
        metadataSchema: workflowSeed.metadataSchema,
        isPubliclyTrackable: true,
        publicDetailLevel: 'BASIC',
      },
      create: {
        id: workflowSeed.id,
        code: workflowSeed.code,
        name: workflowSeed.name,
        description: workflowSeed.description,
        departmentId: dorDept.id,
        version: 1,
        status: 'ACTIVE',
        metadataSchema: workflowSeed.metadataSchema,
        isPubliclyTrackable: true,
        publicDetailLevel: 'BASIC',
        createdBy: dorUserMap['dg@dor.gov.np'] || admin.id,
      },
    });
    console.log(`  DOR Workflow: ${dorWorkflow.name}`);

    const stageByOrder = new Map<number, { id: string }>();
    for (const stage of workflowSeed.stages) {
      const savedStage = await prisma.workflowStage.upsert({
        where: {
          workflowId_stageOrder: {
            workflowId: dorWorkflow.id,
            stageOrder: stage.order,
          },
        },
        update: {
          name: stage.name,
          stageType: 'SEQUENTIAL',
          assignedRoleId: roleMap[stage.role],
          slaDays: stage.slaDays,
          allowedActions: stage.actions,
          requiredDocs: stage.requiredDocs,
        },
        create: {
          name: stage.name,
          stageOrder: stage.order,
          stageType: 'SEQUENTIAL',
          assignedRoleId: roleMap[stage.role],
          workflowId: dorWorkflow.id,
          slaDays: stage.slaDays,
          allowedActions: stage.actions,
          requiredDocs: stage.requiredDocs,
        },
      });
      stageByOrder.set(stage.order, savedStage);
    }

    for (const rule of workflowSeed.routingRules) {
      const sourceStage = stageByOrder.get(rule.fromOrder);
      const targetStage = stageByOrder.get(rule.targetOrder);
      if (!sourceStage || !targetStage) {
        throw new Error(`Invalid DOR routing rule for ${workflowSeed.code}: ${rule.fromOrder} -> ${rule.targetOrder}`);
      }

      const existingRule = await prisma.stageRoutingRule.findFirst({
        where: {
          stageId: sourceStage.id,
          conditionField: rule.conditionField,
          operator: rule.operator,
          value: rule.value,
          targetStageId: targetStage.id,
        },
      });

      if (existingRule) {
        await prisma.stageRoutingRule.update({
          where: { id: existingRule.id },
          data: {
            conditionField: rule.conditionField,
            operator: rule.operator,
            value: rule.value,
            targetStageId: targetStage.id,
          },
        });
      } else {
        await prisma.stageRoutingRule.create({
          data: {
            stageId: sourceStage.id,
            conditionField: rule.conditionField,
            operator: rule.operator,
            value: rule.value,
            targetStageId: targetStage.id,
          },
        });
      }
    }
  }

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
