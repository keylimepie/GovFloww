import { describe, expect, it } from '@jest/globals';
import { createOtpAuthUri, generateTotpSecret } from './totp';

describe('TOTP helpers', () => {
  it('generates base32 secrets', () => {
    expect(generateTotpSecret()).toMatch(/^[A-Z2-7]+$/);
  });

  it('generates otpauth URIs for authenticator apps', () => {
    const uri = createOtpAuthUri('JBSWY3DPEHPK3PXP', 'admin@govflow.gov.np');

    expect(uri).toContain('otpauth://totp/');
    expect(uri).toContain('secret=JBSWY3DPEHPK3PXP');
    expect(uri).toContain('issuer=GovFlow');
  });
});

