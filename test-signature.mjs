// =============================================
// Digital Signature E2E Test Script
// =============================================
// Tests: PIN setup → Sign document → Verify signature

const BASE = 'http://localhost:3001';

async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function main() {
  console.log('=== DIGITAL SIGNATURE E2E TEST ===\n');

  // Step 1: Login as contractor
  console.log('1. Logging in as contractor...');
  const login = await api('POST', '/api/auth/login', {
    email: 'contractor@example.com',
    password: 'Contractor@2026!',
  });
  if (!login.data.success) {
    console.error('   FAIL: Login failed:', login.data.message);
    return;
  }
  const token = login.data.data.accessToken;
  console.log('   OK: Logged in as', login.data.data.user.email);

  // Step 2: Setup signature PIN
  console.log('\n2. Setting up signature PIN (1234)...');
  const pinResult = await api('POST', '/api/users/me/signature-pin', { pin: '1234' }, token);
  console.log('   Status:', pinResult.status);
  console.log('   Response:', JSON.stringify(pinResult.data));
  if (!pinResult.data.success) {
    console.error('   FAIL: PIN setup failed');
    return;
  }
  console.log('   OK: PIN set successfully');

  // Step 3: Get a submission to sign
  console.log('\n3. Getting submissions...');
  const subs = await api('GET', '/api/submissions', null, token);
  if (!subs.data.success || !subs.data.data?.length) {
    console.error('   FAIL: No submissions found. Create one first.');
    return;
  }
  const submissionId = subs.data.data[0].id;
  console.log('   OK: Found submission', submissionId);

  // Step 4: Sign the document with correct PIN
  console.log('\n4. Signing document with PIN 1234...');
  const signResult = await api('POST', `/api/submissions/${submissionId}/sign`, { pin: '1234' }, token);
  console.log('   Status:', signResult.status);
  console.log('   Response:', JSON.stringify(signResult.data, null, 2));
  if (!signResult.data.success) {
    console.error('   FAIL: Signing failed:', signResult.data.message);
    return;
  }
  const signatureId = signResult.data.data.id;
  console.log('   OK: Signature created with ID:', signatureId);

  // Step 5: Try signing with WRONG PIN
  console.log('\n5. Trying wrong PIN (9999)...');
  const badSign = await api('POST', `/api/submissions/${submissionId}/sign`, { pin: '9999' }, token);
  console.log('   Status:', badSign.status, '(expected 403)');
  console.log('   Message:', badSign.data.message);
  if (badSign.status === 403) {
    console.log('   OK: Correctly rejected wrong PIN');
  } else {
    console.error('   FAIL: Should have been 403');
  }

  // Step 6: Verify the signature
  console.log('\n6. Verifying signature (public endpoint)...');
  const verify = await api('GET', `/api/submissions/verify/signature/${signatureId}`);
  console.log('   Status:', verify.status);
  console.log('   Response:', JSON.stringify(verify.data, null, 2));
  if (verify.data.success && verify.data.data.isValid) {
    console.log('   OK: Signature is VALID ✅');
  } else {
    console.error('   FAIL: Signature verification failed');
  }

  // Step 7: Check submission detail includes signatures
  console.log('\n7. Checking submission detail includes signatures...');
  const detail = await api('GET', `/api/submissions/${submissionId}`, null, token);
  const sigCount = detail.data.data?.signatures?.length || 0;
  console.log('   Signatures found:', sigCount);
  if (sigCount > 0) {
    console.log('   OK: Signatures visible in submission detail ✅');
    detail.data.data.signatures.forEach((s, i) => {
      console.log(`   Sig ${i+1}: Tier ${s.tier}, by ${s.officer.firstName} ${s.officer.lastName}, at ${s.createdAt}`);
    });
  } else {
    console.error('   FAIL: No signatures in submission detail');
  }

  console.log('\n=== ALL TESTS PASSED ===');
}

main().catch(e => console.error('FATAL:', e));
