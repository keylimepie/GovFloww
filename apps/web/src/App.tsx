import { useEffect, useMemo, useState } from 'react';
import type { DependencyList, ReactNode } from 'react';
import {
  Navigate,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useParams,
} from 'react-router-dom';
import {
  App as AntApp,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Layout,
  Menu,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Timeline,
  Typography,
  List,
  Upload,
  Badge,
  Popover,
  Result,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  AuditOutlined,
  BranchesOutlined,
  CheckCircleOutlined,
  DashboardOutlined,
  FileAddOutlined,
  FileOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  BarChartOutlined,
  LogoutOutlined,
  PlayCircleOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  TeamOutlined,
  UploadOutlined,
  UserAddOutlined,
  BellOutlined,
  DownloadOutlined,
  BankOutlined,
} from '@ant-design/icons';
import {
  AddCommentSchema,
  ApproveSubmissionSchema,
  ChangePasswordSchema,
  ChangeUserStatusSchema,
  CompleteTokAssignmentSchema,
  CreateBranchSchema,
  CreateDepartmentSchema,
  CreateRayeRequestSchema,
  CreateSubmissionSchema,
  CreateTokAssignmentSchema,
  CreateUserSchema,
  EnableMfaSchema,
  CreateWorkflowSchema,
  ForwardToMinistrySchema,
  ForwardSubmissionSchema,
  HoldSubmissionSchema,
  LoginSchema,
  RegisterSchema,
  RejectSubmissionSchema,
  PrepareTippaniSchema,
  RespondRayeRequestSchema,
  ROLE_LABELS,
  Role,
  STATUS_COLORS,
  StageAction,
  StageType,
  UpdateUserSchema,
  UpdateWorkflowSchema,
  type LoginInput,
} from '@govflow/shared';
import { AxiosError } from 'axios';
import { getBlob, getData, patchData, postData, putData, deleteData, uploadFile } from './lib/api';
import { useAuthStore } from './stores/auth';
import FilePreviewModal from './components/FilePreviewModal';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

type MetadataField = {
  key: string;
  label?: string;
  type?: 'TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN' | string;
  required?: boolean;
};
type Lookup = { id: string; name: string; code?: string; departmentId?: string; version?: number; metadataSchema?: MetadataField[] | null };
type RoleLookup = { id: string; name: string; code: string; hierarchyLevel: number; permissions: string[]; isSystem: boolean };
const DELEGATABLE_PERMISSIONS = [
  'user:view_branch',
  'submission:view_branch',
  'submission:reassign_branch',
  'report:branch',
  'report:export',
  'org:manage_branches',
];
type UserRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: RoleLookup | string;
  roleId?: string;
  extraPermissions?: string[];
  status: string;
  department?: { name: string };
  branch?: { name: string };
  createdAt: string;
};
type Workflow = {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  version: number;
  department?: { name: string; code: string };
  stages?: WorkflowStage[];
  _count?: { submissions: number };
};
type WorkflowStage = {
  id: string;
  name: string;
  stageOrder: number;
  stageType: StageType;
  assignedRoleId: string;
  assignedRole?: RoleLookup | string;
  slaDays: number;
  allowedActions: StageAction[];
  requiredDocs?: string[];
};
type Submission = {
  id: string;
  trackingNumber: string;
  title: string;
  description?: string | null;
  status: string;
  publicTrackable?: boolean;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  workflow?: { name: string; code?: string | null; stages?: WorkflowStage[] };
  branch?: { name: string };
  currentBranch?: { id: string; name: string; code?: string | null } | null;
  contractor?: { firstName: string; lastName: string; companyName?: string | null; email?: string };
  fileStages?: Array<{
    id: string;
    status: string;
    startedAt: string;
    completedAt?: string | null;
    slaDueAt?: string;
    stage: WorkflowStage;
    branch?: { id: string; name: string; code?: string | null } | null;
    assignedOfficer?: { firstName: string; lastName: string; role?: Role } | null;
    parallelApprovals?: Array<{
      id: string;
      decision: string;
      comment?: string | null;
      signedAt?: string | null;
      officer: { firstName: string; lastName: string; role: Role };
    }>;
  }>;
  comments?: Array<{
    id: string;
    text: string;
    commentType: string;
    createdAt: string;
    author: { firstName: string; lastName: string; role: Role };
  }>;
  documents?: Array<{
    id: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    url?: string | null;
    createdAt: string;
    uploader?: { firstName: string; lastName: string };
  }>;
};
type AvailableActionTarget = {
  targetStageId?: string;
  stageName?: string;
  stageOrder?: number;
  assignedRoleId?: string;
  assignedRole?: RoleLookup | null;
  targetBranchId?: string;
  branchName?: string | null;
  branchCode?: string | null;
  recommended?: boolean;
  reason?: string;
};
type AvailableAction = {
  action: string;
  label: string;
  targets?: AvailableActionTarget[];
  sakhaTargets?: string[];
};
type AvailableActionsResponse = {
  canAct: boolean;
  currentStage?: {
    id: string;
    name: string;
    stageOrder: number;
  };
  actions: AvailableAction[];
};
type AuditEntry = {
  id: string;
  action: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  previousHash: string;
  rowHash: string;
  actor: { firstName: string; lastName: string; role: Role };
};
type DorInboxItem = {
  id: string;
  status: string;
  targetSakha?: string;
  requestText?: string;
  responseText?: string | null;
  taskDescription?: string | null;
  responseNote?: string | null;
  assignedAt?: string;
  requestedAt?: string;
  completedAt?: string | null;
  respondedAt?: string | null;
  submission: {
    id: string;
    trackingNumber: string;
    title: string;
    status: string;
  };
  fileStage?: {
    stage?: { name: string };
  };
  assignedBy?: { id?: string; firstName: string; lastName: string };
  assignedTo?: { id?: string; firstName: string; lastName: string };
  requester?: { id?: string; firstName: string; lastName: string };
  assignedOfficer?: { id?: string; firstName: string; lastName: string };
  targetBranch?: { id: string; name: string; code?: string };
};
type DorTippani = {
  id: string;
  subject: string;
  recommendation: string;
  referenceDocuments?: string[];
  preparedAt: string;
  preparer?: { firstName: string; lastName: string; designation?: string | null };
  document?: { id: string; originalName: string; sha256?: string | null };
};
type DorActionUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  designation?: string | null;
  role?: { id: string; name: string; code: string };
  branch?: { id: string; name: string; code?: string };
};
type DorBranch = Lookup & {
  branchLevel?: number;
  parentBranchId?: string | null;
  clusterType?: string | null;
  nepaliName?: string | null;
};
type OperationalReport = {
  totals: {
    total: number;
    active: number;
    approved: number;
    rejected: number;
    onHold: number;
    archived: number;
    publicTrackable: number;
    breachedStages: number;
  };
  byStatus: Array<{ label: string; count: number }>;
  byWorkflow: Array<{ label: string; count: number }>;
  byBranch: Array<{ label: string; count: number }>;
  workload: Array<{
    key: string;
    label: string;
    role: string;
    pending: number;
    overdue: number;
  }>;
  slaBreaches: Array<{
    fileStageId: string;
    trackingNumber: string;
    title: string;
    workflowName: string;
    branchName: string;
    stageName: string;
    slaDueAt: string;
    daysOverdue: number;
  }>;
  generatedAt: string;
};

function validate(schema: { parse: (value: unknown) => unknown }, values: unknown) {
  return schema.parse(values);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof AxiosError) {
    const data = error.response?.data as { message?: string } | undefined;
    return data?.message || fallback;
  }
  return fallback;
}

function StatusTag({ status }: { status: string }) {
  return <Tag color={STATUS_COLORS[status] || 'default'}>{status.replaceAll('_', ' ')}</Tag>;
}

function RoleTag({ role }: { role: RoleLookup | string }) {
  const code = typeof role === 'string' ? role : role?.code;
  const name = typeof role === 'string' ? (ROLE_LABELS[role as Role] || role) : role?.name;
  return <Tag color={code === Role.SUPER_ADMIN ? 'geekblue' : 'cyan'}>{name}</Tag>;
}

function Protected({ children }: { children: ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);
  if (!hydrated) return null;
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);
  if (!hydrated) return null;
  return user ? <Navigate to="/dashboard" replace /> : <>{children}</>;
}

function DashboardLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const hydrate = useAuthStore((state) => state.hydrate);
  const { message } = AntApp.useApp();
  const { data: notifications, setData: setNotifications } = useAsyncData<any[]>(() => getData('/api/notifications'), []);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [mfaModalOpen, setMfaModalOpen] = useState(false);
  const [mfaSetup, setMfaSetup] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [pinForm] = Form.useForm();
  const [mfaForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const can = (...permissions: string[]) =>
    user?.permissions?.includes('*') || permissions.some((permission) => user?.permissions?.includes(permission));

  const handlePinSetup = async (values: any) => {
    try {
      await postData('/api/users/me/signature-pin', values);
      message.success('Signature PIN updated successfully');
      setPinModalOpen(false);
      pinForm.resetFields();
    } catch {
      message.error('Failed to update PIN');
    }
  };

  const handlePasswordChange = async (values: unknown) => {
    try {
      await postData('/api/users/me/password', validate(ChangePasswordSchema, values));
      message.success('Password changed successfully');
      passwordForm.resetFields();
      await hydrate();
    } catch (error) {
      message.error(getErrorMessage(error, 'Could not change password.'));
    }
  };

  const openMfaModal = async () => {
    setMfaModalOpen(true);
    mfaForm.resetFields();
    if (!user?.mfaEnabled) {
      try {
        setMfaSetup(await postData('/api/users/me/mfa/setup'));
      } catch (error) {
        message.error(getErrorMessage(error, 'Could not start MFA setup.'));
      }
    }
  };

  const handleMfaSubmit = async (values: unknown) => {
    try {
      if (user?.mfaEnabled) {
        await postData('/api/users/me/mfa/disable', validate(EnableMfaSchema, values));
        message.success('MFA disabled.');
      } else {
        await postData('/api/users/me/mfa/enable', validate(EnableMfaSchema, values));
        message.success('MFA enabled.');
      }
      setMfaModalOpen(false);
      setMfaSetup(null);
      await hydrate();
    } catch (error) {
      message.error(getErrorMessage(error, 'Could not update MFA.'));
    }
  };

  const unreadCount = notifications?.filter(n => !n.readAt).length || 0;

  const markAsRead = async (id: string) => {
    await postData(`/api/notifications/${id}/read`);
    setNotifications((prev) => prev?.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n) || []);
  };

  const notificationsContent = (
    <List
      style={{ width: 350, maxHeight: 400, overflowY: 'auto' }}
      dataSource={notifications || []}
      locale={{ emptyText: 'No notifications' }}
      renderItem={(item) => (
        <List.Item
          style={{ opacity: item.readAt ? 0.6 : 1, cursor: 'pointer', padding: '12px' }}
          onClick={() => markAsRead(item.id)}
        >
          <List.Item.Meta
            title={<Text strong={!item.readAt}>{item.title}</Text>}
            description={item.message}
          />
        </List.Item>
      )}
    />
  );

  const menuItems = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: <NavLink to="/dashboard">Dashboard</NavLink> },
    { key: '/submissions', icon: <FileTextOutlined />, label: <NavLink to="/submissions">Submissions</NavLink> },
    can('submission:create') && { key: '/submissions/new', icon: <FileAddOutlined />, label: <NavLink to="/submissions/new">New Submission</NavLink> },
    can('workflow:create', 'workflow:update', 'workflow:publish') && { key: '/workflows', icon: <BranchesOutlined />, label: <NavLink to="/workflows">Workflows</NavLink> },
    can('user:create', 'user:update', 'user:view_branch', 'user:manage_dept') && { key: '/admin/users', icon: <TeamOutlined />, label: <NavLink to="/admin/users">Users</NavLink> },
    can('org:manage_branches', '*') && { key: '/admin/organisation', icon: <BankOutlined />, label: <NavLink to="/admin/organisation">Organisation</NavLink> },
    can('report:dept', 'report:branch', 'report:export') && { key: '/reports', icon: <BarChartOutlined />, label: <NavLink to="/reports">Reports</NavLink> },
    can('system:config') && { key: '/admin/roles', icon: <SafetyCertificateOutlined />, label: <NavLink to="/admin/roles">Roles</NavLink> },
    { key: '/track', icon: <FileSearchOutlined />, label: <NavLink to="/track">Public Track</NavLink> },
  ].filter((item): item is Exclude<typeof item, false> => Boolean(item));

  return (
    <Layout className="app-shell">
      <Sider width={260} breakpoint="lg" collapsedWidth={0}>
        <div className="brand">
          <SafetyCertificateOutlined />
          <span>GovFlow</span>
        </div>
        <Menu theme="dark" mode="inline" items={menuItems} />
      </Sider>
      <Layout>
        <Header className="topbar">
          <div>
            <Text strong>{user?.firstName} {user?.lastName}</Text>
            <div className="muted"><RoleTag role={user?.role || ''} /></div>
          </div>
          <Space size="large">
            <Popover content={notificationsContent} title="Notifications" trigger="click" placement="bottomRight">
              <Badge count={unreadCount} style={{ cursor: 'pointer' }}>
                <BellOutlined style={{ fontSize: 20, cursor: 'pointer' }} />
              </Badge>
            </Popover>
            <Button icon={<SafetyCertificateOutlined />} onClick={() => setPinModalOpen(true)}>PIN Setup</Button>
            <Button icon={<SafetyCertificateOutlined />} onClick={openMfaModal}>
              {user?.mfaEnabled ? 'MFA On' : 'MFA Setup'}
            </Button>
            <Button
              icon={<LogoutOutlined />}
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
            >
              Logout
            </Button>
          </Space>
        </Header>
        <Content className="content">{children}</Content>
      </Layout>
      <Modal open={pinModalOpen} title="Setup Digital Signature PIN" onCancel={() => setPinModalOpen(false)} onOk={() => pinForm.submit()} destroyOnClose>
        <Form form={pinForm} layout="vertical" onFinish={handlePinSetup}>
          <Form.Item name="pin" label="Enter 4-6 digit PIN" rules={[{ required: true, pattern: /^\d{4,6}$/, message: 'PIN must be 4 to 6 digits' }]}>
            <Input.Password maxLength={6} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        open={mfaModalOpen}
        title={user?.mfaEnabled ? 'Disable MFA' : 'Setup MFA'}
        onCancel={() => { setMfaModalOpen(false); setMfaSetup(null); }}
        onOk={() => mfaForm.submit()}
        okText={user?.mfaEnabled ? 'Disable' : 'Enable'}
        destroyOnClose
      >
        {!user?.mfaEnabled && mfaSetup && (
          <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
            <Text>Use an authenticator app to add this secret, then enter the current 6-digit code.</Text>
            <Text copyable code>{mfaSetup.secret}</Text>
            <Text copyable type="secondary" style={{ wordBreak: 'break-all' }}>{mfaSetup.otpauthUri}</Text>
          </Space>
        )}
        <Form form={mfaForm} layout="vertical" onFinish={handleMfaSubmit}>
          <Form.Item name="code" label="Authenticator code" rules={[{ required: true, pattern: /^\d{6}$/, message: 'Enter a 6-digit code' }]}>
            <Input inputMode="numeric" maxLength={6} autoComplete="one-time-code" />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        open={Boolean(user?.mustChangePassword)}
        title="Change temporary password"
        closable={false}
        maskClosable={false}
        keyboard={false}
        footer={<Button type="primary" onClick={() => passwordForm.submit()}>Change password</Button>}
      >
        <Form form={passwordForm} layout="vertical" onFinish={handlePasswordChange}>
          <Form.Item name="currentPassword" label="Current password" rules={[{ required: true }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item name="newPassword" label="New password" rules={[{ required: true }]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}

function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-mark">
          <SafetyCertificateOutlined />
          <span>GovFlow</span>
        </div>
        {children}
      </section>
    </main>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const login = useAuthStore((state) => state.login);
  const [loading, setLoading] = useState(false);

  async function onFinish(values: LoginInput) {
    setLoading(true);
    try {
      await login(validate(LoginSchema, values) as LoginInput);
      navigate('/dashboard');
    } catch (error) {
      message.error(getErrorMessage(error, 'Login failed. Check the account status and credentials.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <Title level={2}>Sign in</Title>
      <Form layout="vertical" onFinish={onFinish} initialValues={{ email: 'admin@govflow.gov.np' }}>
        <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
          <Input autoComplete="email" />
        </Form.Item>
        <Form.Item name="password" label="Password" rules={[{ required: true }]}>
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Form.Item name="mfaCode" label="MFA code">
          <Input inputMode="numeric" maxLength={6} autoComplete="one-time-code" />
        </Form.Item>
        <Button block type="primary" htmlType="submit" loading={loading}>
          Sign in
        </Button>
      </Form>
      <Button type="link" block onClick={() => navigate('/register')}>Contractor registration</Button>
      <Button type="link" block onClick={() => navigate('/track')}>Track a public file</Button>
    </AuthLayout>
  );
}

function RegisterPage() {
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const [loading, setLoading] = useState(false);

  async function onFinish(values: unknown) {
    setLoading(true);
    try {
      await postData('/api/auth/register', validate(RegisterSchema, values));
      message.success('Registration submitted for admin approval.');
      navigate('/login');
    } catch {
      message.error('Registration failed. Please review the details.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <Title level={2}>Contractor registration</Title>
      <Form layout="vertical" onFinish={onFinish}>
        <Row gutter={12}>
          <Col span={12}><Form.Item name="firstName" label="First name" rules={[{ required: true }]}><Input /></Form.Item></Col>
          <Col span={12}><Form.Item name="lastName" label="Last name" rules={[{ required: true }]}><Input /></Form.Item></Col>
        </Row>
        <Form.Item name="companyName" label="Company" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="phone" label="Phone"><Input /></Form.Item>
        <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
        <Form.Item name="password" label="Password" rules={[{ required: true }]}><Input.Password /></Form.Item>
        <Button block type="primary" htmlType="submit" loading={loading} icon={<UserAddOutlined />}>
          Register
        </Button>
      </Form>
      <Button type="link" block onClick={() => navigate('/login')}>Back to sign in</Button>
    </AuthLayout>
  );
}

function useAsyncData<T>(loader: () => Promise<T>, deps: DependencyList) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const { message } = AntApp.useApp();

  useEffect(() => {
    let live = true;
    setLoading(true);
    loader()
      .then((value) => {
        if (live) setData(value);
      })
      .catch(() => message.error('Could not load data from the API.'))
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, deps);

  return { data, loading, setData };
}

function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const { message } = AntApp.useApp();
  const [inboxAction, setInboxAction] = useState<{ type: 'tok' | 'raye'; item: DorInboxItem } | null>(null);
  const [inboxRefresh, setInboxRefresh] = useState(0);
  const can = (...permissions: string[]) =>
    user?.permissions?.includes('*') || permissions.some((permission) => user?.permissions?.includes(permission));
  const { data, loading } = useAsyncData<Submission[]>(() => getData('/api/submissions'), []);
  const { data: tokInbox, loading: tokLoading } = useAsyncData<DorInboxItem[]>(
    () => can('submission:view_assigned') ? getData('/api/dor/tok/inbox') : Promise.resolve([]),
    [user?.id, inboxRefresh],
  );
  const { data: rayeInbox, loading: rayeLoading } = useAsyncData<DorInboxItem[]>(
    () => can('submission:raye_respond', 'submission:view_assigned') ? getData('/api/dor/raye/inbox') : Promise.resolve([]),
    [user?.id, inboxRefresh],
  );
  async function submitInboxAction(values: Record<string, unknown>) {
    if (!inboxAction) return;
    try {
      if (inboxAction.type === 'tok') {
        await postData(`/api/dor/tok/${inboxAction.item.id}/complete`, validate(CompleteTokAssignmentSchema, values));
        message.success('Tok completed.');
      } else {
        await postData(`/api/dor/raye/${inboxAction.item.id}/respond`, validate(RespondRayeRequestSchema, values));
        message.success('Raye response submitted.');
      }
      setInboxAction(null);
      setInboxRefresh((value) => value + 1);
    } catch (error) {
      message.error(getErrorMessage(error, 'Could not complete inbox action.'));
    }
  }
  const submissions = data || [];
  const terminalStatuses = ['APPROVED', 'ARCHIVED', 'REJECTED', 'FORWARDED_TO_MINISTRY'];
  const pending = submissions.filter((item) => !terminalStatuses.includes(item.status)).length;
  const onHold = submissions.filter((item) => item.status === 'ON_HOLD').length;

  return (
    <DashboardLayout>
      <Space direction="vertical" size={20} className="page-stack">
        <Title level={2}>Dashboard</Title>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}><Card><Statistic title="Active files" value={pending} prefix={<FileTextOutlined />} /></Card></Col>
          <Col xs={24} md={8}><Card><Statistic title="On hold" value={onHold} prefix={<AuditOutlined />} /></Card></Col>
          <Col xs={24} md={8}><Card><Statistic title="Total visible" value={submissions.length} prefix={<CheckCircleOutlined />} /></Card></Col>
        </Row>
        <Card title="Latest submissions">
          <SubmissionTable data={submissions.slice(0, 6)} loading={loading} />
        </Card>
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <DorInboxCard title="Tok Inbox" kind="tok" items={tokInbox || []} loading={tokLoading} onAction={(item) => setInboxAction({ type: 'tok', item })} />
          </Col>
          <Col xs={24} lg={12}>
            <DorInboxCard title="Raye Inbox" kind="raye" items={rayeInbox || []} loading={rayeLoading} onAction={(item) => setInboxAction({ type: 'raye', item })} />
          </Col>
        </Row>
      </Space>
      <DorInboxActionModal action={inboxAction} onCancel={() => setInboxAction(null)} onSubmit={submitInboxAction} />
    </DashboardLayout>
  );
}

function DorInboxCard({
  title,
  kind,
  items,
  loading,
  onAction,
}: {
  title: string;
  kind: 'tok' | 'raye';
  items: DorInboxItem[];
  loading?: boolean;
  onAction: (item: DorInboxItem) => void;
}) {
  return (
    <Card title={title} loading={loading}>
      <List
        dataSource={items.slice(0, 5)}
        locale={{ emptyText: 'No pending items' }}
        renderItem={(item) => (
          <List.Item
            actions={[
              <NavLink key="open" to={`/submissions/${item.submission.id}`}>Open</NavLink>,
              <Button key="action" type="link" onClick={() => onAction(item)}>
                {kind === 'tok' ? 'Complete' : 'Respond'}
              </Button>,
            ]}
          >
            <List.Item.Meta
              title={<Space><Text>{item.submission.trackingNumber}</Text><StatusTag status={item.submission.status} /></Space>}
              description={
                <Space direction="vertical" size={2}>
                  <Text>{item.submission.title}</Text>
                  <Text type="secondary">{item.fileStage?.stage?.name || item.targetSakha || item.status}</Text>
                  {(item.taskDescription || item.requestText) && (
                    <Text type="secondary">{item.taskDescription || item.requestText}</Text>
                  )}
                </Space>
              }
            />
          </List.Item>
        )}
      />
    </Card>
  );
}

function DorInboxActionModal({
  action,
  onCancel,
  onSubmit,
}: {
  action: { type: 'tok' | 'raye'; item: DorInboxItem } | null;
  onCancel: () => void;
  onSubmit: (values: Record<string, unknown>) => void;
}) {
  const [form] = Form.useForm();
  useEffect(() => {
    form.resetFields();
  }, [action, form]);

  return (
    <Modal
      open={Boolean(action)}
      title={action?.type === 'tok' ? 'Complete Tok' : 'Respond to Raye'}
      onCancel={onCancel}
      onOk={() => form.submit()}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Space direction="vertical" size={4} style={{ width: '100%', marginBottom: 12 }}>
          <Text strong>{action?.item.submission.trackingNumber}</Text>
          <Text>{action?.item.submission.title}</Text>
          {action?.item.taskDescription && <Text type="secondary">{action.item.taskDescription}</Text>}
          {action?.item.requestText && <Text type="secondary">{action.item.requestText}</Text>}
        </Space>
        {action?.type === 'tok' ? (
          <Form.Item name="responseNote" label="Response" rules={[{ required: true }]}>
            <Input.TextArea rows={5} />
          </Form.Item>
        ) : (
          <Form.Item name="responseText" label="Opinion" rules={[{ required: true }]}>
            <Input.TextArea rows={6} />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}

function SubmissionTable({ data, loading }: { data: Submission[]; loading?: boolean }) {
  const navigate = useNavigate();
  const columns: ColumnsType<Submission> = [
    { title: 'Tracking', dataIndex: 'trackingNumber' },
    { title: 'Title', dataIndex: 'title' },
    { title: 'Workflow', render: (_, row) => row.workflow?.name || '-' },
    { title: 'Stage', render: (_, row) => row.fileStages?.[0]?.stage?.name || '-' },
    { title: 'Status', render: (_, row) => <StatusTag status={row.status} /> },
    { title: 'Updated', render: (_, row) => new Date(row.updatedAt).toLocaleString() },
  ];
  return (
    <Table
      rowKey="id"
      columns={columns}
      dataSource={data}
      loading={loading}
      pagination={{ pageSize: 10 }}
      onRow={(row) => ({ onClick: () => navigate(`/submissions/${row.id}`) })}
    />
  );
}

function SubmissionsPage() {
  const { data, loading } = useAsyncData<Submission[]>(() => getData('/api/submissions'), []);
  return (
    <DashboardLayout>
      <Space direction="vertical" size={20} className="page-stack">
        <div className="page-title-row">
          <Title level={2}>Submissions</Title>
          <NavLink to="/submissions/new"><Button type="primary" icon={<FileAddOutlined />}>New</Button></NavLink>
        </div>
        <Card><SubmissionTable data={data || []} loading={loading} /></Card>
      </Space>
    </DashboardLayout>
  );
}

function NewSubmissionPage() {
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const { data } = useAsyncData<{ workflows: Lookup[]; branches: Lookup[] }>(
    () => getData('/api/lookups/bootstrap'),
    [],
  );
  const selectedSubmissionType = Form.useWatch('submissionType', form);
  const selectedWorkflow = useMemo(
    () =>
      (data?.workflows || []).find(
        (workflow) => workflow.id === selectedSubmissionType || workflow.code === selectedSubmissionType || workflow.name === selectedSubmissionType,
      ),
    [data?.workflows, selectedSubmissionType],
  );
  const metadataFields = Array.isArray(selectedWorkflow?.metadataSchema) ? selectedWorkflow.metadataSchema : [];

  async function onFinish(values: unknown) {
    setLoading(true);
    try {
      const submission = await postData<Submission>('/api/submissions', validate(CreateSubmissionSchema, values));
      message.success('Submission created.');
      navigate(`/submissions/${submission.id}`);
    } catch {
      message.error('Could not create submission. Contractors need an active account.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout>
      <Card title="New submission">
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="branchId" label="Branch" rules={[{ required: true }]}>
            <Select options={(data?.branches || []).map((item) => ({ value: item.id, label: item.name }))} />
          </Form.Item>
          <Form.Item name="submissionType" label="Submission type" rules={[{ required: true }]}>
            <Select
              options={(data?.workflows || []).map((item) => ({
                value: item.code || item.name,
                label: `${item.code ? `${item.code} - ` : ''}${item.name}${item.version ? ` v${item.version}` : ''}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="title" label="Title" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Description"><Input.TextArea rows={4} /></Form.Item>
          {metadataFields.map((field) => (
            <Form.Item
              key={field.key}
              name={['metadata', field.key]}
              label={field.label || field.key}
              rules={[{ required: Boolean(field.required) }]}
            >
              {field.type === 'NUMBER' ? (
                <InputNumber className="full-width-input" />
              ) : field.type === 'BOOLEAN' ? (
                <Select options={[{ value: true, label: 'Yes' }, { value: false, label: 'No' }]} />
              ) : (
                <Input />
              )}
            </Form.Item>
          ))}
          <Button type="primary" htmlType="submit" loading={loading} icon={<SendOutlined />}>Submit file metadata</Button>
        </Form>
      </Card>
    </DashboardLayout>
  );
}

function SubmissionDetailPage() {
  const { id } = useParams();
  const { message } = AntApp.useApp();
  const user = useAuthStore((state) => state.user);
  const [actionOpen, setActionOpen] = useState<string | null>(null);
  const [tippaniRefresh, setTippaniRefresh] = useState(0);
  const [dorActivityRefresh, setDorActivityRefresh] = useState(0);
  const [dorActivityAction, setDorActivityAction] = useState<{ type: 'tok' | 'raye'; item: DorInboxItem } | null>(null);
  const { data, loading, setData } = useAsyncData<Submission>(() => getData(`/api/submissions/${id}`), [id]);
  const can = (...permissions: string[]) =>
    user?.permissions?.includes('*') || permissions.some((permission) => user?.permissions?.includes(permission));
  const canRouteAcrossDor =
    user?.role === Role.SUPER_ADMIN ||
    user?.role === Role.DEPARTMENT_ADMIN ||
    can('*');
  const needsDorActionLookups = can('submission:tok_assign', 'submission:raye_request', 'submission:forward');
  const { data: dorUsers } = useAsyncData<DorActionUser[]>(
    () => needsDorActionLookups ? getData('/api/dor/users') : Promise.resolve([]),
    [user?.id],
  );
  const { data: dorBranches } = useAsyncData<DorBranch[]>(
    () => can('submission:tok_assign', 'submission:raye_request', 'submission:forward') ? getData('/api/dor/branches') : Promise.resolve([]),
    [user?.id],
  );
  const { data: tippaniList } = useAsyncData<DorTippani[]>(
    () => id ? getData(`/api/dor/submissions/${id}/tippani`) : Promise.resolve([]),
    [id, tippaniRefresh],
  );
  const { data: tokList } = useAsyncData<DorInboxItem[]>(
    () => id ? getData(`/api/dor/submissions/${id}/tok`) : Promise.resolve([]),
    [id, dorActivityRefresh],
  );
  const { data: rayeList } = useAsyncData<DorInboxItem[]>(
    () => id ? getData(`/api/dor/submissions/${id}/raye`) : Promise.resolve([]),
    [id, dorActivityRefresh],
  );
  const activeStageForPolicy = data?.fileStages?.at(-1)?.stage;
  const { data: actionPolicy } = useAsyncData<AvailableActionsResponse | null>(
    () => id && activeStageForPolicy ? getData(`/api/submissions/${id}/available-actions`) : Promise.resolve(null),
    [id, activeStageForPolicy?.id, data?.updatedAt],
  );

  async function submitDorActivityAction(values: Record<string, unknown>) {
    if (!dorActivityAction || !id) return;
    try {
      if (dorActivityAction.type === 'tok') {
        await postData(`/api/dor/tok/${dorActivityAction.item.id}/complete`, validate(CompleteTokAssignmentSchema, values));
        message.success('Tok completed.');
      } else {
        await postData(`/api/dor/raye/${dorActivityAction.item.id}/respond`, validate(RespondRayeRequestSchema, values));
        message.success('Raye response submitted.');
      }
      setDorActivityAction(null);
      setDorActivityRefresh((value) => value + 1);
      setData(await getData(`/api/submissions/${id}`));
    } catch (error) {
      message.error(getErrorMessage(error, 'Could not complete DOR activity.'));
    }
  }

  async function recallTok(tokId: string) {
    if (!id) return;
    try {
      await postData(`/api/dor/tok/${tokId}/recall`);
      message.success('Tok recalled.');
      setDorActivityRefresh((value) => value + 1);
    } catch (error) {
      message.error(getErrorMessage(error, 'Could not recall Tok.'));
    }
  }

  async function cancelRaye(rayeId: string) {
    if (!id) return;
    try {
      await postData(`/api/dor/raye/${rayeId}/cancel`);
      message.success('Raye cancelled.');
      setDorActivityRefresh((value) => value + 1);
    } catch (error) {
      message.error(getErrorMessage(error, 'Could not cancel Raye.'));
    }
  }

  async function runAction(values: Record<string, unknown>) {
    if (!id || !actionOpen) return;

    try {
      if (actionOpen === 'sign') {
        // Sign bypasses Zod schemas — just sends { pin }
        await postData(`/api/submissions/${id}/sign`, { pin: values.pin });
        setData(await getData(`/api/submissions/${id}`));
        setActionOpen(null);
        message.success('Document signed successfully.');
        return;
      }

      if (actionOpen === 'tippani') {
        await postData(`/api/dor/submissions/${id}/tippani`, validate(PrepareTippaniSchema, values));
        setData(await getData(`/api/submissions/${id}`));
        setTippaniRefresh((value) => value + 1);
        setActionOpen(null);
        message.success('Tippani prepared.');
        return;
      }

      if (actionOpen === 'tok') {
        await postData(`/api/dor/submissions/${id}/tok`, validate(CreateTokAssignmentSchema, values));
        setData(await getData(`/api/submissions/${id}`));
        setDorActivityRefresh((value) => value + 1);
        setActionOpen(null);
        message.success('Tok assignment sent.');
        return;
      }

      if (actionOpen === 'raye') {
        await postData(`/api/dor/submissions/${id}/raye`, validate(CreateRayeRequestSchema, values));
        setData(await getData(`/api/submissions/${id}`));
        setDorActivityRefresh((value) => value + 1);
        setActionOpen(null);
        message.success('Raye request sent.');
        return;
      }

      const schema = actionOpen === 'forward'
        ? ForwardSubmissionSchema
        : actionOpen === 'approve'
          ? ApproveSubmissionSchema
          : actionOpen === 'forward-to-ministry'
            ? ForwardToMinistrySchema
            : actionOpen === 'reject'
              ? RejectSubmissionSchema
              : actionOpen === 'hold'
                ? HoldSubmissionSchema
                : AddCommentSchema;
      const url = actionOpen === 'comment'
        ? `/api/submissions/${id}/comments`
        : `/api/submissions/${id}/${actionOpen}`;

      const result = await postData<Submission | unknown>(url, validate(schema, values));
      if (actionOpen === 'comment') {
        setData(await getData(`/api/submissions/${id}`));
      } else {
        setData(result as Submission);
      }
      setActionOpen(null);
      message.success('Action completed.');
    } catch {
      message.error('Action failed. Check your role, stage access, and form values.');
    }
  }

  async function updatePublicTracking(publicTrackable: boolean) {
    if (!id) return;
    try {
      const updated = await postData<Submission>(`/api/submissions/${id}/public-tracking`, { publicTrackable });
      setData((previous) => previous ? { ...previous, publicTrackable: updated.publicTrackable } : updated);
      message.success(publicTrackable ? 'Public tracking enabled.' : 'Public tracking disabled.');
    } catch (error) {
      message.error(getErrorMessage(error, 'Could not update public tracking.'));
    }
  }

  const currentStage = activeStageForPolicy;
  const allStages = data?.workflow?.stages || [];
  const priorStages = data?.fileStages?.map((item) => item.stage).filter((stage) => stage.id !== currentStage?.id) || [];
  const currentActions = currentStage?.allowedActions || [];
  const policyAllows = (...actions: StageAction[]) =>
    actions.some((action) => actionPolicy?.actions?.some((item) => item.action === action));
  const voPercentage = Number(data?.metadata?.vo_percentage);
  const hasVoPercentage = Number.isFinite(voPercentage);
  const requiresTippani = currentStage?.requiredDocs?.includes('TIPPANI') || currentActions.includes(StageAction.TIPPANI);

  return (
    <DashboardLayout>
      <Space direction="vertical" size={20} className="page-stack">
        <Card loading={loading}>
          <div className="page-title-row">
            <div>
              <Title level={2}>{data?.title || 'Submission'}</Title>
              <Text copyable>{data?.trackingNumber}</Text>
            </div>
            {data?.status && <StatusTag status={data.status} />}
          </div>
          <Descriptions column={{ xs: 1, md: 2 }} bordered>
            <Descriptions.Item label="Workflow">{data?.workflow?.name}</Descriptions.Item>
            <Descriptions.Item label="Origin office">{data?.branch?.name}</Descriptions.Item>
            <Descriptions.Item label="Current office">{data?.currentBranch?.name || data?.branch?.name}</Descriptions.Item>
            <Descriptions.Item label="Submitter">{data?.contractor?.companyName || `${data?.contractor?.firstName} ${data?.contractor?.lastName}`}</Descriptions.Item>
            <Descriptions.Item label="Current stage">{currentStage?.name || 'Complete'}</Descriptions.Item>
            {hasVoPercentage && (
              <Descriptions.Item label="VO percentage">
                <Space>
                  <Tag color={voPercentage < 10 ? 'green' : voPercentage < 15 ? 'gold' : 'red'}>
                    {voPercentage.toFixed(2)}%
                  </Tag>
                  <Text type="secondary">
                    {voPercentage < 10 ? 'SDE authority' : voPercentage < 15 ? 'SE authority' : 'HQ escalation'}
                  </Text>
                </Space>
              </Descriptions.Item>
            )}
            {requiresTippani && (
              <Descriptions.Item label="Tippani">
                <Tag color="blue">Required before forward</Tag>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Public tracking">
              {can('submission:manage_public_tracking') ? (
                <Switch
                  checked={Boolean(data?.publicTrackable)}
                  checkedChildren="Enabled"
                  unCheckedChildren="Disabled"
                  onChange={updatePublicTracking}
                />
              ) : (
                <Tag color={data?.publicTrackable ? 'green' : 'default'}>
                  {data?.publicTrackable ? 'Enabled' : 'Disabled'}
                </Tag>
              )}
            </Descriptions.Item>
          </Descriptions>
          <Space wrap className="action-bar">
            {policyAllows(StageAction.FORWARD) && <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => setActionOpen('forward')}>Forward</Button>}
            {policyAllows(StageAction.APPROVE) && <Button icon={<CheckCircleOutlined />} onClick={() => setActionOpen('approve')}>Approve</Button>}
            {policyAllows(StageAction.TIPPANI) && <Button icon={<FileTextOutlined />} onClick={() => setActionOpen('tippani')}>Prepare Tippani</Button>}
            {policyAllows(StageAction.TOK) && <Button icon={<TeamOutlined />} onClick={() => setActionOpen('tok')}>Tok</Button>}
            {policyAllows(StageAction.RAYE) && <Button icon={<BranchesOutlined />} onClick={() => setActionOpen('raye')}>Raye</Button>}
            {policyAllows(StageAction.FORWARD_TO_MINISTRY) && <Button icon={<BankOutlined />} onClick={() => setActionOpen('forward-to-ministry')}>Forward to Ministry</Button>}
            {policyAllows(StageAction.REJECT) && <Button danger onClick={() => setActionOpen('reject')}>Reject</Button>}
            {policyAllows(StageAction.HOLD) && <Button onClick={() => setActionOpen('hold')}>Hold</Button>}
            {policyAllows(StageAction.COMMENT) && <Button onClick={() => setActionOpen('comment')}>Comment</Button>}
            {policyAllows(StageAction.SIGN) && <Button icon={<SafetyCertificateOutlined />} onClick={() => setActionOpen('sign')}>Sign Document</Button>}
          </Space>
        </Card>
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={14}>
            <Space direction="vertical" size={20} style={{ width: '100%' }}>
              <DocumentsCard submission={data} onUploadSuccess={async () => setData(await getData(`/api/submissions/${id}`))} />
              <SubmissionTimeline submission={data} />
            </Space>
          </Col>
          <Col xs={24} lg={10}>
            <Space direction="vertical" size={20} style={{ width: '100%' }}>
              <DorActivityCard
                tokItems={tokList || []}
                rayeItems={rayeList || []}
                userId={user?.id || null}
                onAction={setDorActivityAction}
                onRecallTok={recallTok}
                onCancelRaye={cancelRaye}
              />
              <TippaniCard submission={data} items={tippaniList || []} />
              <CommentsCard submission={data} />
            </Space>
          </Col>
        </Row>
      </Space>
      <ActionModal
        action={actionOpen}
        allStages={allStages}
        currentStage={currentStage}
        currentOfficeBranchId={data?.currentBranch?.id || data?.fileStages?.at(-1)?.branch?.id || user?.branchId || null}
        userBranchId={user?.branchId || null}
        priorStages={priorStages}
        documents={data?.documents || []}
        dorUsers={dorUsers || []}
        dorBranches={dorBranches || []}
        availableActions={actionPolicy?.actions || []}
        canRouteAcrossDor={Boolean(canRouteAcrossDor)}
        onCancel={() => setActionOpen(null)}
        onSubmit={runAction}
      />
      <DorInboxActionModal
        action={dorActivityAction}
        onCancel={() => setDorActivityAction(null)}
        onSubmit={submitDorActivityAction}
      />
    </DashboardLayout>
  );
}

function ActionModal({
  action,
  allStages,
  currentStage,
  currentOfficeBranchId,
  userBranchId,
  priorStages,
  documents,
  dorUsers,
  dorBranches,
  availableActions,
  canRouteAcrossDor,
  onCancel,
  onSubmit,
}: {
  action: string | null;
  allStages: WorkflowStage[];
  currentStage?: WorkflowStage;
  currentOfficeBranchId?: string | null;
  userBranchId?: string | null;
  priorStages: WorkflowStage[];
  documents: NonNullable<Submission['documents']>;
  dorUsers: DorActionUser[];
  dorBranches: DorBranch[];
  availableActions: AvailableAction[];
  canRouteAcrossDor: boolean;
  onCancel: () => void;
  onSubmit: (values: Record<string, unknown>) => void;
}) {
  const [form] = Form.useForm();
  const selectedTargetBranchId = Form.useWatch('targetBranchId', form);
  const selectedTargetStageId = Form.useWatch('targetStageId', form);
  const selectedTargetStage = allStages.find((stage) => stage.id === selectedTargetStageId);
  const forwardTargets = availableActions.find((item) => item.action === StageAction.FORWARD)?.targets || [];
  const forwardStageOptions = forwardTargets.length > 0
    ? Array.from(new Map(forwardTargets.map((target) => [
        target.targetStageId,
        {
          value: target.targetStageId,
          label: `${target.stageOrder ?? ''}. ${target.stageName || 'Stage'}${target.recommended ? ' - recommended' : ''}`,
        },
      ])).values()).filter((item) => item.value)
    : allStages
        .filter((stage) => stage.id !== currentStage?.id)
        .map((stage) => ({ value: stage.id, label: `${stage.stageOrder}. ${stage.name}` }));
  const forwardBranchIds = new Set(
    forwardTargets
      .filter((target) => !selectedTargetStageId || target.targetStageId === selectedTargetStageId)
      .map((target) => target.targetBranchId)
      .filter(Boolean),
  );
  const ownOfficeBranchId = userBranchId || currentOfficeBranchId || null;
  const restrictedToOwnOffice = (action === 'tok' || action === 'raye') && !canRouteAcrossDor;
  const branchOptions = action === 'forward' && forwardBranchIds.size > 0
    ? dorBranches.filter((item) => forwardBranchIds.has(item.id))
    : restrictedToOwnOffice && ownOfficeBranchId
      ? dorBranches.filter((item) => item.id === ownOfficeBranchId)
      : dorBranches;
  const selectedOfficeBranchId = selectedTargetBranchId || (restrictedToOwnOffice ? ownOfficeBranchId : undefined);
  const officeUsers = dorUsers.filter((item) => {
    const officeMatches = !selectedOfficeBranchId || item.branch?.id === selectedOfficeBranchId;
    const roleMatches =
      action !== 'forward' ||
      !selectedTargetStage?.assignedRoleId ||
      item.role?.id === selectedTargetStage.assignedRoleId;
    return officeMatches && roleMatches;
  });
  const officerOptions = officeUsers.map((item) => ({
    value: item.id,
    label: `${item.firstName} ${item.lastName} - ${item.designation || item.role?.name || item.email}${item.branch?.name ? ` (${item.branch.name})` : ''}`,
  }));

  useEffect(() => {
    form.resetFields();
    if (restrictedToOwnOffice && ownOfficeBranchId) {
      form.setFieldsValue({ targetBranchId: ownOfficeBranchId });
    }
  }, [action, form, ownOfficeBranchId, restrictedToOwnOffice]);

  return (
    <Modal open={!!action} title={action?.toUpperCase()} onCancel={onCancel} onOk={() => form.submit()} destroyOnClose>
      <Form form={form} layout="vertical" onFinish={onSubmit} initialValues={{ commentType: 'COMMENT', continueFile: false }}>
        {action === 'forward' && (
          <>
            <Form.Item name="targetStageId" label="Target stage" rules={[{ required: true }]}>
              <Select
                showSearch
                optionFilterProp="label"
                onChange={() => {
                  form.setFieldValue('targetBranchId', undefined);
                  form.setFieldValue('assignedTo', undefined);
                }}
                options={forwardStageOptions}
              />
            </Form.Item>
            <Form.Item name="targetBranchId" label="Target office">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                onChange={() => form.setFieldValue('assignedTo', undefined)}
                options={branchOptions.map((item) => ({
                  value: item.id,
                  label: `${item.nepaliName ? `${item.nepaliName} / ` : ''}${item.name}${item.code ? ` (${item.code})` : ''}`,
                }))}
              />
            </Form.Item>
            <Form.Item name="assignedTo" label="Officer">
              <Select
                allowClear
                showSearch
                disabled={!selectedOfficeBranchId}
                optionFilterProp="label"
                options={officerOptions}
              />
            </Form.Item>
            <Form.Item name="comment" label="Comment"><Input.TextArea rows={3} /></Form.Item>
          </>
        )}
        {action === 'approve' && <Form.Item name="comment" label="Comment"><Input.TextArea rows={3} /></Form.Item>}
        {action === 'forward-to-ministry' && (
          <>
            <Form.Item name="ministryReference" label="Ministry reference"><Input maxLength={100} /></Form.Item>
            <Form.Item name="comment" label="Comment"><Input.TextArea rows={3} /></Form.Item>
          </>
        )}
        {action === 'tippani' && (
          <>
            <Form.Item name="subject" label="Subject" rules={[{ required: true }]}><Input maxLength={500} /></Form.Item>
            <Form.Item name="recommendation" label="Recommendation" rules={[{ required: true }]}><Input.TextArea rows={5} /></Form.Item>
            <Form.Item name="documentId" label="Attach document">
              <Select allowClear options={documents.map((doc) => ({ value: doc.id, label: doc.originalName }))} />
            </Form.Item>
          </>
        )}
        {action === 'tok' && (
          <>
            <Form.Item name="targetBranchId" label="Office" rules={[{ required: true }]}>
              <Select
                showSearch
                optionFilterProp="label"
                disabled={restrictedToOwnOffice && Boolean(ownOfficeBranchId)}
                onChange={() => form.setFieldValue('tokTo', undefined)}
                options={branchOptions.map((item) => ({
                  value: item.id,
                  label: `${item.nepaliName ? `${item.nepaliName} / ` : ''}${item.name}${item.code ? ` (${item.code})` : ''}`,
                }))}
              />
            </Form.Item>
            <Form.Item name="tokTo" label="Assign to" rules={[{ required: true }]}>
              <Select
                showSearch
                disabled={!selectedOfficeBranchId}
                optionFilterProp="label"
                options={officerOptions}
              />
            </Form.Item>
            <Form.Item name="taskDescription" label="Task"><Input.TextArea rows={4} /></Form.Item>
            <Form.Item name="continueFile" label="Continue file through recipient" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="targetStageId" label="Recipient stage">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                options={allStages
                  .filter((stage) => stage.id !== currentStage?.id)
                  .map((stage) => ({ value: stage.id, label: `${stage.stageOrder}. ${stage.name}` }))}
              />
            </Form.Item>
          </>
        )}
        {action === 'raye' && (
          <>
            <Form.Item name="targetSakha" label="Sakha" rules={[{ required: true }]}>
              <Select options={['PRABIDHIK', 'PRASASAN', 'LEKHA', 'KAANUN'].map((value) => ({ value, label: value }))} />
            </Form.Item>
            <Form.Item name="targetBranchId" label="Target branch" rules={[{ required: true }]}>
              <Select
                showSearch
                optionFilterProp="label"
                disabled={restrictedToOwnOffice && Boolean(ownOfficeBranchId)}
                onChange={() => form.setFieldValue('assignedTo', undefined)}
                options={branchOptions.map((item) => ({
                  value: item.id,
                  label: `${item.nepaliName ? `${item.nepaliName} / ` : ''}${item.name}${item.code ? ` (${item.code})` : ''}`,
                }))}
              />
            </Form.Item>
            <Form.Item name="assignedTo" label="Officer">
              <Select
                allowClear
                showSearch
                disabled={!selectedOfficeBranchId}
                optionFilterProp="label"
                options={officerOptions}
              />
            </Form.Item>
            <Form.Item name="requestText" label="Request" rules={[{ required: true }]}><Input.TextArea rows={4} /></Form.Item>
          </>
        )}
        {action === 'reject' && (
          <>
            <Form.Item name="targetStageId" label="Return to stage" rules={[{ required: true }]}>
              <Select options={priorStages.map((stage) => ({ value: stage.id, label: stage.name }))} />
            </Form.Item>
            <Form.Item name="reason" label="Reason" rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item>
          </>
        )}
        {action === 'hold' && <Form.Item name="reason" label="Reason" rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item>}
        {action === 'comment' && (
          <>
            <Form.Item name="commentType" label="Type"><Select options={['COMMENT', 'QUERY', 'RESPONSE'].map((value) => ({ value, label: value }))} /></Form.Item>
            <Form.Item name="text" label="Comment" rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item>
          </>
        )}
        {action === 'sign' && (
          <Form.Item name="pin" label="Enter Signature PIN" rules={[{ required: true }]}>
            <Input.Password maxLength={6} />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}

function SubmissionTimeline({ submission }: { submission: Submission | null }) {
  const stages = submission?.fileStages || ((submission as unknown as { stages?: Submission['fileStages'] })?.stages || []);

  return (
    <Card title="Stage timeline">
      <Timeline
        items={stages.map((item) => {
          const publicItem = item as unknown as { stageName?: string };
          const publicDates = item as unknown as { receivedAt?: string };
          const stageName = item.stage?.name || publicItem.stageName || 'Stage';
          const startedAt = item.startedAt || publicDates.receivedAt;
          return {
          color: item.status === 'COMPLETED' ? 'green' : item.status === 'REJECTED' ? 'red' : 'blue',
          children: (
            <Space direction="vertical" size={2}>
              <Text strong>{stageName}</Text>
              {item.branch?.name && <Text type="secondary">Office: {item.branch.name}</Text>}
              {startedAt && <Text type="secondary">{item.status} since {new Date(startedAt).toLocaleString()}</Text>}
              {item.slaDueAt && <Text type="secondary">SLA due {new Date(item.slaDueAt).toLocaleString()}</Text>}
              {item.parallelApprovals && item.parallelApprovals.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <Text strong style={{ fontSize: 12 }}>Approvals:</Text>
                  {item.parallelApprovals.map((pa: any) => (
                    <div key={pa.id} style={{ marginTop: 4 }}>
                      <Tag color="green">{pa.officer.firstName} {pa.officer.lastName}</Tag>
                      {pa.comment && <Text type="secondary" style={{ fontSize: 12 }}>"{pa.comment}"</Text>}
                    </div>
                  ))}
                </div>
              )}
            </Space>
          ),
        };
        })}
      />
    </Card>
  );
}

function DocumentsCard({ submission, onUploadSuccess }: { submission: Submission | null; onUploadSuccess: () => void }) {
  const { message } = AntApp.useApp();
  const [uploading, setUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<any>(null);

  const customRequest = async (options: any) => {
    if (!submission) return;
    setUploading(true);
    try {
      await uploadFile(`/api/submissions/${submission.id}/documents`, options.file as File);
      message.success('Document uploaded.');
      onUploadSuccess();
      options.onSuccess?.({}, options.file);
    } catch {
      message.error('Failed to upload document.');
      options.onError?.(new Error('Upload failed'));
    } finally {
      setUploading(false);
    }
  };

  const docs = submission?.documents || [];
  const signatures = (submission as any)?.signatures || [];

  const requestDocumentUrl = async (doc: NonNullable<Submission['documents']>[number]) => {
    if (!submission) throw new Error('Submission missing');
    const data = await getData<{ url: string }>(`/api/submissions/${submission.id}/documents/${doc.id}/url`);
    return { ...doc, url: data.url };
  };

  const openPreview = async (doc: NonNullable<Submission['documents']>[number]) => {
    try {
      setPreviewFile(await requestDocumentUrl(doc));
    } catch {
      message.error('Could not open document preview.');
    }
  };

  const openDownload = async (doc: NonNullable<Submission['documents']>[number]) => {
    try {
      const fileWithUrl = await requestDocumentUrl(doc);
      window.open(fileWithUrl.url!, '_blank', 'noopener,noreferrer');
    } catch {
      message.error('Could not prepare document download.');
    }
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Card title="Documents" extra={
        <Upload customRequest={customRequest} showUploadList={false}>
          <Button icon={<UploadOutlined />} loading={uploading}>Upload</Button>
        </Upload>
      }>
        <List
          dataSource={docs}
          renderItem={(doc) => (
            <List.Item
              actions={[
                <Button size="small" type="link" onClick={() => openPreview(doc)}>Preview</Button>,
                <Button size="small" type="link" icon={<DownloadOutlined />} onClick={() => openDownload(doc)}>Download</Button>,
              ].filter(Boolean)}
            >
              <List.Item.Meta
                avatar={<FileOutlined />}
                title={
                  <a onClick={(e) => { e.preventDefault(); openPreview(doc); }} href="#" style={{ fontWeight: 500 }}>{doc.originalName}</a>
                }
                description={`${(doc.sizeBytes / 1024).toFixed(1)} KB • Uploaded on ${new Date(doc.createdAt).toLocaleString()}${doc.uploader ? ` by ${doc.uploader.firstName} ${doc.uploader.lastName}` : ''}`}
              />
            </List.Item>
          )}
        />
      </Card>
      {signatures.length > 0 && (
        <Card title="Digital Signatures">
          <List
            dataSource={signatures}
            renderItem={(sig: any) => (
              <List.Item>
                <List.Item.Meta
                  avatar={<SafetyCertificateOutlined style={{ color: 'green', fontSize: 24 }} />}
                  title={`${sig.officer.firstName} ${sig.officer.lastName}`}
                  description={`Tier ${sig.tier} Signature • Signed on ${new Date(sig.createdAt).toLocaleString()}`}
                />
              </List.Item>
            )}
          />
        </Card>
      )}
      <FilePreviewModal
        open={!!previewFile}
        onClose={() => setPreviewFile(null)}
        file={previewFile}
      />
    </Space>
  );
}

function DorActivityCard({
  tokItems,
  rayeItems,
  userId,
  onAction,
  onRecallTok,
  onCancelRaye,
}: {
  tokItems: DorInboxItem[];
  rayeItems: DorInboxItem[];
  userId: string | null;
  onAction: (action: { type: 'tok' | 'raye'; item: DorInboxItem }) => void;
  onRecallTok: (tokId: string) => void;
  onCancelRaye: (rayeId: string) => void;
}) {
  const items = [
    ...tokItems.map((item) => ({ kind: 'tok' as const, item })),
    ...rayeItems.map((item) => ({ kind: 'raye' as const, item })),
  ].sort((a, b) => {
    const aDate = a.item.assignedAt || a.item.requestedAt || '';
    const bDate = b.item.assignedAt || b.item.requestedAt || '';
    return bDate.localeCompare(aDate);
  });

  return (
    <Card title="Tok and Raye">
      <List
        dataSource={items}
        locale={{ emptyText: 'No Tok or Raye activity' }}
        renderItem={({ kind, item }) => {
          const activeTok = kind === 'tok' && item.status === 'ACTIVE';
          const pendingRaye = kind === 'raye' && item.status === 'PENDING';
          const canRecallTok = activeTok && item.assignedBy?.id === userId;
          const canCancelRaye = pendingRaye && item.requester?.id === userId;
          const actor = kind === 'tok' ? item.assignedBy : item.requester;
          const recipient = kind === 'tok' ? item.assignedTo : item.assignedOfficer;
          const body = kind === 'tok' ? item.taskDescription : item.requestText;
          const response = kind === 'tok' ? item.responseNote : item.responseText;
          const timestamp = item.assignedAt || item.requestedAt;

          return (
            <List.Item
              actions={[
                activeTok ? <Button key="complete" type="link" onClick={() => onAction({ type: 'tok', item })}>Complete</Button> : null,
                pendingRaye ? <Button key="respond" type="link" onClick={() => onAction({ type: 'raye', item })}>Respond</Button> : null,
                canRecallTok ? <Button key="recall" type="link" danger onClick={() => onRecallTok(item.id)}>Recall</Button> : null,
                canCancelRaye ? <Button key="cancel" type="link" danger onClick={() => onCancelRaye(item.id)}>Cancel</Button> : null,
              ].filter(Boolean)}
            >
              <List.Item.Meta
                title={
                  <Space wrap>
                    <Tag color={kind === 'tok' ? 'blue' : 'purple'}>{kind === 'tok' ? 'TOK' : 'RAYE'}</Tag>
                    <Tag>{item.status}</Tag>
                    {item.targetSakha && <Tag>{item.targetSakha}</Tag>}
                  </Space>
                }
                description={
                  <Space direction="vertical" size={3}>
                    {body && <Text>{body}</Text>}
                    <Text type="secondary">
                      {actor ? `From ${actor.firstName} ${actor.lastName}` : 'Requested'}
                      {recipient ? ` to ${recipient.firstName} ${recipient.lastName}` : ''}
                      {item.targetBranch?.name ? ` (${item.targetBranch.name})` : ''}
                    </Text>
                    {response && <Text type="secondary">Response: {response}</Text>}
                    {timestamp && <Text type="secondary">{new Date(timestamp).toLocaleString()}</Text>}
                  </Space>
                }
              />
            </List.Item>
          );
        }}
      />
    </Card>
  );
}

function TippaniCard({ submission, items }: { submission: Submission | null; items: DorTippani[] }) {
  const { message } = AntApp.useApp();

  async function downloadTippani(item: DorTippani) {
    if (!submission || !item.document?.id) return;
    try {
      const data = await getData<{ url: string }>(`/api/submissions/${submission.id}/documents/${item.document.id}/url`);
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      message.error(getErrorMessage(error, 'Could not open Tippani PDF.'));
    }
  }

  return (
    <Card title="Tippani">
      <List
        dataSource={items}
        locale={{ emptyText: 'No Tippani prepared' }}
        renderItem={(item) => (
          <List.Item
            actions={[
              item.document?.id ? (
                <Button key="pdf" type="link" icon={<DownloadOutlined />} onClick={() => downloadTippani(item)}>
                  PDF
                </Button>
              ) : null,
            ].filter(Boolean)}
          >
            <List.Item.Meta
              title={<Text strong>{item.subject}</Text>}
              description={
                <Space direction="vertical" size={4}>
                  <Text>{item.recommendation}</Text>
                  <Text type="secondary">
                    {item.preparer ? `${item.preparer.firstName} ${item.preparer.lastName}` : 'Prepared'} - {new Date(item.preparedAt).toLocaleString()}
                  </Text>
                  {item.document?.originalName && <Text type="secondary">{item.document.originalName}</Text>}
                </Space>
              }
            />
          </List.Item>
        )}
      />
    </Card>
  );
}

function CommentsCard({ submission }: { submission: Submission | null }) {
  return (
    <Card title="Comments and queries">
      <Space direction="vertical" className="page-stack">
        {(submission?.comments || []).map((comment) => (
          <div key={comment.id} className="comment-row">
            <Text strong>{comment.author.firstName} {comment.author.lastName}</Text>
            <RoleTag role={comment.author.role} />
            <Tag>{comment.commentType}</Tag>
            <p>{comment.text}</p>
            <Text type="secondary">{new Date(comment.createdAt).toLocaleString()}</Text>
          </div>
        ))}
        {(!submission?.comments || submission.comments.length === 0) && <Text type="secondary">No comments yet.</Text>}
      </Space>
    </Card>
  );
}

function WorkflowsPage() {
  const { data, loading } = useAsyncData<Workflow[]>(() => getData('/api/workflows'), []);
  const { message } = AntApp.useApp();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Workflow[]>([]);
  const { data: lookups } = useAsyncData<{ departments: Lookup[]; roles: RoleLookup[] }>(() => getData('/api/lookups/bootstrap'), []);

  useEffect(() => setItems(data || []), [data]);

  async function createWorkflow(values: unknown) {
    try {
      const created = await postData<Workflow>('/api/workflows', validate(CreateWorkflowSchema, values));
      setItems([created, ...items]);
      setOpen(false);
      message.success('Workflow draft created.');
    } catch {
      message.error('Could not create workflow.');
    }
  }

  return (
    <DashboardLayout>
      <Space direction="vertical" size={20} className="page-stack">
        <div className="page-title-row">
          <Title level={2}>Workflows</Title>
          <Button type="primary" icon={<BranchesOutlined />} onClick={() => setOpen(true)}>Create</Button>
        </div>
        <Card>
          <Table
            rowKey="id"
            loading={loading}
            dataSource={items}
            columns={[
              { title: 'Name', dataIndex: 'name' },
              { title: 'Department', render: (_, row) => row.department?.name || '-' },
              { title: 'Status', render: (_, row) => <StatusTag status={row.status} /> },
              { title: 'Version', dataIndex: 'version' },
              { title: 'Submissions', render: (_, row) => row._count?.submissions || 0 },
              { title: '', render: (_, row) => <NavLink to={`/workflows/${row.id}`}>Open</NavLink> },
            ]}
          />
        </Card>
      </Space>
      <Modal open={open} title="Create workflow" onCancel={() => setOpen(false)} footer={null} destroyOnClose>
        <Form layout="vertical" onFinish={createWorkflow}>
          <Form.Item name="departmentId" label="Department" rules={[{ required: true }]}>
            <Select options={(lookups?.departments || []).map((item) => ({ value: item.id, label: item.name }))} />
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Description"><Input.TextArea rows={3} /></Form.Item>
          <Button type="primary" htmlType="submit">Create draft</Button>
        </Form>
      </Modal>
    </DashboardLayout>
  );
}

function WorkflowDetailPage() {
  const { id } = useParams();
  const { message } = AntApp.useApp();
  const { data, loading, setData } = useAsyncData<Workflow>(() => getData(`/api/workflows/${id}`), [id]);
  const { data: lookups } = useAsyncData<{ roles: RoleLookup[] }>(() => getData('/api/lookups/bootstrap'), []);
  const [stageOpen, setStageOpen] = useState(false);

  async function publish() {
    try {
      setData(await postData(`/api/workflows/${id}/publish`));
      message.success('Workflow published.');
    } catch {
      message.error('Publish failed. Add at least one stage and check permissions.');
    }
  }

  async function update(values: unknown) {
    try {
      setData(await putData(`/api/workflows/${id}`, validate(UpdateWorkflowSchema, values)));
      message.success('Workflow updated.');
    } catch {
      message.error('Update failed.');
    }
  }

  async function addStage(values: Record<string, unknown>) {
    try {
      const payload = {
        ...values,
        stageOrder: Number(values.stageOrder),
        slaDays: Number(values.slaDays || 3),
        requiredDocs: [],
      };
      await postData(`/api/workflows/${id}/stages`, payload);
      setData(await getData(`/api/workflows/${id}`));
      setStageOpen(false);
      message.success('Stage added.');
    } catch {
      message.error('Could not add stage.');
    }
  }

  return (
    <DashboardLayout>
      <Space direction="vertical" size={20} className="page-stack">
        <Card loading={loading}>
          <div className="page-title-row">
            <div>
              <Title level={2}>{data?.name}</Title>
              <Text type="secondary">Version {data?.version} | {data?.department?.name}</Text>
            </div>
            <Space>
              <Button onClick={() => setStageOpen(true)}>Add stage</Button>
              <Button type="primary" onClick={publish}>Publish</Button>
            </Space>
          </div>
          <Form layout="vertical" initialValues={data || {}} onFinish={update}>
            <Form.Item name="name" label="Name"><Input /></Form.Item>
            <Form.Item name="description" label="Description"><Input.TextArea rows={3} /></Form.Item>
            <Button htmlType="submit">Save draft details</Button>
          </Form>
        </Card>
        <Card title="Stage map">
          <div className="workflow-strip">
            {(data?.stages || []).map((stage) => (
              <div className="stage-node" key={stage.id}>
                <Text strong>{stage.stageOrder}. {stage.name}</Text>
                <RoleTag role={stage.assignedRole || stage.assignedRoleId} />
                <Text type="secondary">{stage.slaDays} working days</Text>
              </div>
            ))}
          </div>
        </Card>
      </Space>
      <Modal open={stageOpen} title="Add stage" onCancel={() => setStageOpen(false)} footer={null} destroyOnClose>
        <Form layout="vertical" onFinish={addStage} initialValues={{ stageType: StageType.SEQUENTIAL, slaDays: 3 }}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="stageOrder" label="Order" rules={[{ required: true }]}><Input type="number" /></Form.Item>
          <Form.Item name="stageType" label="Type"><Select options={Object.values(StageType).map((value) => ({ value, label: value }))} /></Form.Item>
          <Form.Item name="assignedRoleId" label="Assigned role" rules={[{ required: true }]}><Select options={(lookups?.roles || []).map((value) => ({ value: value.id, label: value.name }))} /></Form.Item>
          <Form.Item name="slaDays" label="SLA working days"><Input type="number" /></Form.Item>
          <Form.Item name="allowedActions" label="Allowed actions" rules={[{ required: true }]}>
            <Select mode="multiple" options={Object.values(StageAction).map((value) => ({ value, label: value }))} />
          </Form.Item>
          <Button type="primary" htmlType="submit">Add stage</Button>
        </Form>
      </Modal>
    </DashboardLayout>
  );
}

function UsersPage() {
  const { message } = AntApp.useApp();
  const { data, loading, setData } = useAsyncData<UserRow[]>(() => getData('/api/users'), []);
  const { data: lookups } = useAsyncData<{ departments: Lookup[]; branches: Lookup[]; roles: RoleLookup[] }>(() => getData('/api/lookups/bootstrap'), []);
  const [open, setOpen] = useState(false);

  async function createUser(values: unknown) {
    try {
      await postData('/api/users', validate(CreateUserSchema, values));
      setData(await getData('/api/users'));
      setOpen(false);
      message.success('User created.');
    } catch {
      message.error('Could not create user.');
    }
  }

  async function approve(id: string) {
    try {
      await patchData(`/api/users/${id}/status`, validate(ChangeUserStatusSchema, { status: 'ACTIVE' }));
      setData(await getData('/api/users'));
      message.success('User approved.');
    } catch {
      message.error('Status update failed.');
    }
  }

  async function updateUser(id: string, roleId: string) {
    try {
      await putData(`/api/users/${id}`, validate(UpdateUserSchema, { roleId }));
      setData(await getData('/api/users'));
      message.success('Role updated.');
    } catch {
      message.error('Role update failed.');
    }
  }

  async function updateExtraPermissions(id: string, extraPermissions: string[]) {
    try {
      await putData(`/api/users/${id}`, validate(UpdateUserSchema, { extraPermissions }));
      setData(await getData('/api/users'));
      message.success('Extra permissions updated.');
    } catch {
      message.error('Permission update failed.');
    }
  }

  return (
    <DashboardLayout>
      <Space direction="vertical" size={20} className="page-stack">
        <div className="page-title-row">
          <Title level={2}>Users</Title>
          <Button type="primary" icon={<TeamOutlined />} onClick={() => setOpen(true)}>Create user</Button>
        </div>
        <Card>
          <Table
            rowKey="id"
            loading={loading}
            dataSource={data || []}
            columns={[
              { title: 'Name', render: (_, row) => `${row.firstName} ${row.lastName}` },
              { title: 'Email', dataIndex: 'email' },
              { title: 'Role', render: (_, row) => <RoleTag role={row.role} /> },
              {
                title: 'Extra permissions',
                render: (_, row) => (
                  <Select
                    mode="multiple"
                    size="small"
                    style={{ minWidth: 260 }}
                    value={row.extraPermissions || []}
                    onChange={(extraPermissions) => updateExtraPermissions(row.id, extraPermissions)}
                    options={DELEGATABLE_PERMISSIONS.map((value) => ({ value, label: value }))}
                  />
                ),
              },
              { title: 'Status', render: (_, row) => <StatusTag status={row.status} /> },
              { title: 'Department', render: (_, row) => row.department?.name || '-' },
              {
                title: 'Actions',
                render: (_, row) => (
                  <Space wrap>
                    {row.status === 'PENDING' && <Button onClick={() => approve(row.id)}>Approve</Button>}
                    <Select
                      size="small"
                      value={typeof row.role === 'string' ? row.role : row.role?.id}
                      onChange={(roleId) => updateUser(row.id, roleId)}
                      options={(lookups?.roles || []).map((value) => ({ value: value.id, label: value.name }))}
                    />
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      </Space>
      <Modal open={open} title="Create user" footer={null} onCancel={() => setOpen(false)} destroyOnClose>
        <Form layout="vertical" onFinish={createUser}>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="firstName" label="First name" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="lastName" label="Last name" rules={[{ required: true }]}><Input /></Form.Item></Col>
          </Row>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
          <Form.Item name="password" label="Temporary password" rules={[{ required: true }]}><Input.Password /></Form.Item>
          <Form.Item name="roleId" label="Role" rules={[{ required: true }]}><Select options={(lookups?.roles || []).map((value) => ({ value: value.id, label: value.name }))} /></Form.Item>
          <Form.Item name="extraPermissions" label="Extra permissions"><Select mode="multiple" options={DELEGATABLE_PERMISSIONS.map((value) => ({ value, label: value }))} /></Form.Item>
          <Form.Item name="departmentId" label="Department"><Select allowClear options={(lookups?.departments || []).map((item) => ({ value: item.id, label: item.name }))} /></Form.Item>
          <Form.Item name="branchId" label="Branch"><Select allowClear options={(lookups?.branches || []).map((item) => ({ value: item.id, label: item.name }))} /></Form.Item>
          <Button type="primary" htmlType="submit">Create</Button>
        </Form>
      </Modal>
    </DashboardLayout>
  );
}

function OrganisationPage() {
  const { message } = AntApp.useApp();
  const user = useAuthStore((state) => state.user);
  const can = (...permissions: string[]) =>
    user?.permissions?.includes('*') || permissions.some((permission) => user?.permissions?.includes(permission));
  const { data: departments, loading: departmentsLoading, setData: setDepartments } = useAsyncData<any[]>(() => getData('/api/organisation/departments'), []);
  const { data: branches, loading: branchesLoading, setData: setBranches } = useAsyncData<any[]>(() => getData('/api/organisation/branches'), []);
  const [departmentOpen, setDepartmentOpen] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);

  async function refreshOrganisation() {
    setDepartments(await getData('/api/organisation/departments'));
    setBranches(await getData('/api/organisation/branches'));
  }

  async function createDepartment(values: unknown) {
    try {
      await postData('/api/organisation/departments', validate(CreateDepartmentSchema, values));
      await refreshOrganisation();
      setDepartmentOpen(false);
      message.success('Department created.');
    } catch {
      message.error('Could not create department.');
    }
  }

  async function createBranch(values: unknown) {
    try {
      await postData('/api/organisation/branches', validate(CreateBranchSchema, values));
      await refreshOrganisation();
      setBranchOpen(false);
      message.success('Branch created.');
    } catch {
      message.error('Could not create branch.');
    }
  }

  return (
    <DashboardLayout>
      <Space direction="vertical" size={20} className="page-stack">
        <div className="page-title-row">
          <Title level={2}>Organisation</Title>
          <Space>
            {can('*') && <Button icon={<BankOutlined />} onClick={() => setDepartmentOpen(true)}>Add department</Button>}
            {can('*', 'org:manage_branches') && <Button type="primary" icon={<BranchesOutlined />} onClick={() => setBranchOpen(true)}>Add branch</Button>}
          </Space>
        </div>
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title="Departments">
              <Table
                rowKey="id"
                loading={departmentsLoading}
                dataSource={departments || []}
                columns={[
                  { title: 'Name', dataIndex: 'name' },
                  { title: 'Code', dataIndex: 'code' },
                  { title: 'Branches', render: (_, row) => row._count?.branches ?? 0 },
                  { title: 'Users', render: (_, row) => row._count?.users ?? 0 },
                ]}
              />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="Branches">
              <Table
                rowKey="id"
                loading={branchesLoading}
                dataSource={branches || []}
                columns={[
                  { title: 'Name', dataIndex: 'name' },
                  { title: 'Code', dataIndex: 'code' },
                  { title: 'Department', render: (_, row) => row.department?.name || '-' },
                  { title: 'Users', render: (_, row) => row._count?.users ?? 0 },
                ]}
              />
            </Card>
          </Col>
        </Row>
      </Space>
      <Modal open={departmentOpen} title="Add department" footer={null} onCancel={() => setDepartmentOpen(false)} destroyOnClose>
        <Form layout="vertical" onFinish={createDepartment}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="code" label="Code" rules={[{ required: true }]}><Input maxLength={20} /></Form.Item>
          <Button type="primary" htmlType="submit">Create department</Button>
        </Form>
      </Modal>
      <Modal open={branchOpen} title="Add branch" footer={null} onCancel={() => setBranchOpen(false)} destroyOnClose>
        <Form layout="vertical" onFinish={createBranch} initialValues={{ departmentId: user?.departmentId || undefined }}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="code" label="Code" rules={[{ required: true }]}><Input maxLength={20} /></Form.Item>
          <Form.Item name="departmentId" label="Department" rules={[{ required: true }]}>
            <Select options={(departments || []).map((item) => ({ value: item.id, label: item.name }))} />
          </Form.Item>
          <Button type="primary" htmlType="submit">Create branch</Button>
        </Form>
      </Modal>
    </DashboardLayout>
  );
}

function TrackPage() {
  const [result, setResult] = useState<(Submission & {
    workflowName?: string;
    submittedAt?: string;
    expectedCompletionAt?: string | null;
    remainingSlaDays?: number | null;
    currentStep?: { stageName: string; status: string; receivedAt?: string } | null;
  }) | null>(null);
  const [loading, setLoading] = useState(false);
  const { message } = AntApp.useApp();

  async function onFinish(values: { trackingNumber: string }) {
    setLoading(true);
    try {
      setResult(await getData(`/api/submissions/track/${encodeURIComponent(values.trackingNumber)}`));
    } catch {
      message.error('Tracking number not found.');
    } finally {
      setLoading(false);
    }
  }

  const content = (
    <Space direction="vertical" size={20} className="page-stack">
      <Title level={2}>Public tracking</Title>
      <Card>
        <Form layout="inline" onFinish={onFinish}>
          <Form.Item name="trackingNumber" rules={[{ required: true }]}>
            <Input placeholder="DOR/RD-KTM/2082-83/VO/0001" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} icon={<FileSearchOutlined />}>Track</Button>
        </Form>
      </Card>
      {result && (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card title={result.trackingNumber}>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={8}>
                <Statistic title="Status" value={result.status.replaceAll('_', ' ')} />
              </Col>
              <Col xs={24} md={8}>
                <Statistic
                  title="Current public step"
                  value={result.currentStep?.stageName || 'Completed'}
                />
              </Col>
              <Col xs={24} md={8}>
                <Statistic
                  title="SLA remaining"
                  value={
                    result.remainingSlaDays == null
                      ? 'N/A'
                      : result.remainingSlaDays < 0
                        ? `${Math.abs(result.remainingSlaDays)} day(s) overdue`
                        : `${result.remainingSlaDays} day(s)`
                  }
                />
              </Col>
            </Row>
            <Descriptions bordered column={{ xs: 1, md: 2 }} style={{ marginTop: 16 }}>
              <Descriptions.Item label="File title">{result.title}</Descriptions.Item>
              <Descriptions.Item label="Workflow">{result.workflow?.name || result.workflowName}</Descriptions.Item>
              <Descriptions.Item label="Overall status"><StatusTag status={result.status} /></Descriptions.Item>
              <Descriptions.Item label="Submitted">{new Date(result.submittedAt || result.createdAt).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="Expected completion">
                {result.expectedCompletionAt ? new Date(result.expectedCompletionAt).toLocaleString() : 'Not available'}
              </Descriptions.Item>
              <Descriptions.Item label="Public detail level">General stage progress only</Descriptions.Item>
            </Descriptions>
          </Card>
          <SubmissionTimeline submission={result} />
        </Space>
      )}
    </Space>
  );

  return useAuthStore.getState().user ? <DashboardLayout>{content}</DashboardLayout> : <AuthLayout>{content}</AuthLayout>;
}

function AuditPage() {
  const { id } = useParams();
  const { message } = AntApp.useApp();
  const { data, loading } = useAsyncData<AuditEntry[]>(() => getData(`/api/audit/submission/${id}`), [id]);

  async function downloadAuditCsv() {
    if (!id) return;
    try {
      const blob = await getBlob(`/api/audit/submission/${id}.csv`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `govflow-audit-${id}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      message.error(getErrorMessage(error, 'Could not export audit trail.'));
    }
  }

  return (
    <DashboardLayout>
      <Card title="Audit trail" extra={<Button icon={<DownloadOutlined />} onClick={downloadAuditCsv}>Export CSV</Button>}>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={data || []}
          columns={[
            { title: 'Time', render: (_, row) => new Date(row.createdAt).toLocaleString() },
            { title: 'Action', dataIndex: 'action' },
            { title: 'Actor', render: (_, row) => `${row.actor.firstName} ${row.actor.lastName}` },
            { title: 'Hash', render: (_, row) => <Text code>{row.rowHash.slice(0, 16)}...</Text> },
          ]}
        />
      </Card>
    </DashboardLayout>
  );
}

function ReportsPage() {
  const { data, loading } = useAsyncData<OperationalReport>(() => getData('/api/reports/operational-summary'), []);
  const { message } = AntApp.useApp();
  const totals = data?.totals;

  async function downloadCsv() {
    try {
      const blob = await getBlob('/api/reports/operational-summary.csv');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `govflow-operational-summary-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      message.error(getErrorMessage(error, 'Could not export report.'));
    }
  }

  return (
    <DashboardLayout>
      <Space direction="vertical" size={20} className="page-stack">
        <div className="page-title-row">
          <Title level={2}>Reports</Title>
          <Space>
            {data?.generatedAt && <Text type="secondary">Generated {new Date(data.generatedAt).toLocaleString()}</Text>}
            <Button icon={<DownloadOutlined />} onClick={downloadCsv}>Export CSV</Button>
          </Space>
        </div>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8} xl={4}><Card loading={loading}><Statistic title="Total files" value={totals?.total || 0} /></Card></Col>
          <Col xs={24} md={8} xl={4}><Card loading={loading}><Statistic title="Active" value={totals?.active || 0} /></Card></Col>
          <Col xs={24} md={8} xl={4}><Card loading={loading}><Statistic title="Approved" value={totals?.approved || 0} /></Card></Col>
          <Col xs={24} md={8} xl={4}><Card loading={loading}><Statistic title="On hold" value={totals?.onHold || 0} /></Card></Col>
          <Col xs={24} md={8} xl={4}><Card loading={loading}><Statistic title="Public" value={totals?.publicTrackable || 0} /></Card></Col>
          <Col xs={24} md={8} xl={4}><Card loading={loading}><Statistic title="SLA breaches" value={totals?.breachedStages || 0} valueStyle={{ color: (totals?.breachedStages || 0) > 0 ? '#cf1322' : undefined }} /></Card></Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={8}>
            <BreakdownCard title="Status breakdown" data={data?.byStatus || []} loading={loading} />
          </Col>
          <Col xs={24} lg={8}>
            <BreakdownCard title="Workflow breakdown" data={data?.byWorkflow || []} loading={loading} />
          </Col>
          <Col xs={24} lg={8}>
            <BreakdownCard title="Branch breakdown" data={data?.byBranch || []} loading={loading} />
          </Col>
        </Row>

        <Card title="Officer and stage workload">
          <Table
            rowKey="key"
            loading={loading}
            dataSource={data?.workload || []}
            columns={[
              { title: 'Desk', dataIndex: 'label' },
              { title: 'Role', dataIndex: 'role' },
              { title: 'Pending', dataIndex: 'pending' },
              { title: 'Overdue', dataIndex: 'overdue', render: (value: number) => <Tag color={value > 0 ? 'red' : 'green'}>{value}</Tag> },
            ]}
          />
        </Card>

        <Card title="SLA breach report">
          <Table
            rowKey="fileStageId"
            loading={loading}
            dataSource={data?.slaBreaches || []}
            columns={[
              { title: 'Tracking', dataIndex: 'trackingNumber' },
              { title: 'Title', dataIndex: 'title' },
              { title: 'Workflow', dataIndex: 'workflowName' },
              { title: 'Branch', dataIndex: 'branchName' },
              { title: 'Stage', dataIndex: 'stageName' },
              { title: 'Due', render: (_, row) => new Date(row.slaDueAt).toLocaleString() },
              { title: 'Days overdue', dataIndex: 'daysOverdue', render: (value: number) => <Tag color="red">{value}</Tag> },
            ]}
          />
        </Card>
      </Space>
    </DashboardLayout>
  );
}

function BreakdownCard({ title, data, loading }: { title: string; data: Array<{ label: string; count: number }>; loading?: boolean }) {
  return (
    <Card title={title} loading={loading}>
      <List
        dataSource={data}
        locale={{ emptyText: 'No data' }}
        renderItem={(item) => (
          <List.Item>
            <Text>{item.label}</Text>
            <Tag color="blue">{item.count}</Tag>
          </List.Item>
        )}
      />
    </Card>
  );
}

function RolesPage() {
  const { message } = AntApp.useApp();
  const { data, loading, setData } = useAsyncData<RoleLookup[]>(() => getData('/api/roles'), []);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RoleLookup | null>(null);

  async function onFinish(values: any) {
    values.hierarchyLevel = Number(values.hierarchyLevel);
    try {
      if (editing) {
        await putData(`/api/roles/${editing.id}`, values);
        message.success('Role updated');
      } else {
        await postData('/api/roles', values);
        message.success('Role created');
      }
      setData(await getData('/api/roles'));
      setOpen(false);
      setEditing(null);
    } catch {
      message.error('Operation failed');
    }
  }

  async function deleteRole(id: string) {
    try {
      await deleteData(`/api/roles/${id}`);
      message.success('Role deleted');
      setData(await getData('/api/roles'));
    } catch {
      message.error('Cannot delete role');
    }
  }

  return (
    <DashboardLayout>
      <Space direction="vertical" size={20} className="page-stack">
        <div className="page-title-row">
          <Title level={2}>Roles Management</Title>
          <Button type="primary" onClick={() => { setEditing(null); setOpen(true); }}>New Role</Button>
        </div>
        <Card>
          <Table
            rowKey="id"
            loading={loading}
            dataSource={data || []}
            columns={[
              { title: 'Hierarchy', dataIndex: 'hierarchyLevel', render: (val) => <Tag color="purple">{val}</Tag> },
              { title: 'Code', dataIndex: 'code', render: (val) => <Tag>{val}</Tag> },
              { title: 'Name', dataIndex: 'name', render: (val, row) => <Text strong>{val} {row.isSystem && <Tag color="red">System</Tag>}</Text> },
              { title: 'Permissions', dataIndex: 'permissions', render: (perms) => (perms as string[]).map((p) => <Tag key={p} style={{ marginBottom: 4 }}>{p}</Tag>) },
              { title: 'Action', render: (_, row) => (
                <Space>
                  <Button size="small" onClick={() => { setEditing(row); setOpen(true); }}>Edit</Button>
                  {!row.isSystem && <Button size="small" danger onClick={() => deleteRole(row.id)}>Delete</Button>}
                </Space>
              )},
            ]}
          />
        </Card>
      </Space>

      <Modal
        open={open}
        title={editing ? 'Edit Role' : 'New Role'}
        onCancel={() => setOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form layout="vertical" onFinish={onFinish} initialValues={editing || { hierarchyLevel: 5 }}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input disabled={editing?.isSystem} /></Form.Item>
          {!editing && <Form.Item name="code" label="Code" rules={[{ required: true }]}><Input placeholder="E.g. CUSTOM_ROLE" /></Form.Item>}
          <Form.Item name="hierarchyLevel" label="Hierarchy Level (Higher = More Power)" rules={[{ required: true }]}><Input type="number" /></Form.Item>
          <Form.Item name="permissions" label="Permissions" rules={[{ required: true }]}>
             <Select mode="tags" placeholder="e.g. user:create, workflow:create" />
          </Form.Item>
          <Button type="primary" htmlType="submit">{editing ? 'Update' : 'Create'}</Button>
        </Form>
      </Modal>
    </DashboardLayout>
  );
}

function VerifySignaturePage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading } = useAsyncData<any>(() => getData(`/api/submissions/verify/signature/${id}`), [id]);

  if (loading) return <div style={{ padding: 50, textAlign: 'center' }}>Verifying...</div>;

  return (
    <AuthLayout>
      {data ? (
        <Card>
          {data.isValid ? (
            <Result
              status="success"
              title="Digital Signature is Valid"
              subTitle={`Cryptographically verified timestamp: ${new Date(data.signedAt).toLocaleString()}`}
              extra={[
                <Descriptions key="details" column={1} bordered size="small" style={{ textAlign: 'left', marginTop: 20 }}>
                  <Descriptions.Item label="Role">{data.role}</Descriptions.Item>
                  <Descriptions.Item label="Document Title">{data.documentTitle}</Descriptions.Item>
                  <Descriptions.Item label="Tracking Number">{data.trackingNumber}</Descriptions.Item>
                  <Descriptions.Item label="Security Tier">Tier {data.tier} (HMAC-SHA256)</Descriptions.Item>
                </Descriptions>
              ]}
            />
          ) : (
            <Result status="error" title="Signature is Invalid or Tampered" />
          )}
        </Card>
      ) : (
        <Result status="404" title="Signature Not Found" />
      )}
    </AuthLayout>
  );
}

export default function App() {
  const hydrate = useAuthStore((state) => state.hydrate);
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const routes = useMemo(() => (
    <Routes>
      <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />
      <Route path="/track" element={<TrackPage />} />
      <Route path="/verify/signature/:id" element={<VerifySignaturePage />} />
      <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
      <Route path="/submissions" element={<Protected><SubmissionsPage /></Protected>} />
      <Route path="/submissions/new" element={<Protected><NewSubmissionPage /></Protected>} />
      <Route path="/submissions/:id" element={<Protected><SubmissionDetailPage /></Protected>} />
      <Route path="/submissions/:id/audit" element={<Protected><AuditPage /></Protected>} />
      <Route path="/workflows" element={<Protected><WorkflowsPage /></Protected>} />
      <Route path="/workflows/:id" element={<Protected><WorkflowDetailPage /></Protected>} />
      <Route path="/reports" element={<Protected><ReportsPage /></Protected>} />
      <Route path="/admin/users" element={<Protected><UsersPage /></Protected>} />
      <Route path="/admin/organisation" element={<Protected><OrganisationPage /></Protected>} />
      <Route path="/admin/roles" element={<Protected><RolesPage /></Protected>} />
      <Route path="*" element={hydrated ? <Navigate to={user ? '/dashboard' : '/login'} replace /> : null} />
    </Routes>
  ), [hydrated, user]);

  return routes;
}
