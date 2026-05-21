import { describe, expect, it } from '@jest/globals';
import { validateEnv } from './env.validation';

const validConfig = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://govflow:very_strong_database_password@postgres:5432/govflow',
  JWT_SECRET: 'a'.repeat(64),
  JWT_REFRESH_SECRET: 'b'.repeat(64),
  REDIS_PASSWORD: 'redis-password-that-is-not-a-default',
  MINIO_ACCESS_KEY: 'govflow-prod-access',
  MINIO_SECRET_KEY: 'minio-secret-that-is-not-a-default',
  GOVFLOW_MAX_UPLOAD_BYTES: '10485760',
  CLAMAV_ENABLED: 'true',
  CLAMAV_HOST: 'clamav',
  CLAMAV_PORT: '3310',
  CLAMAV_TIMEOUT_MS: '5000',
  CORS_ORIGIN: 'https://govflow.gov.np',
};

describe('validateEnv', () => {
  it('accepts a complete production configuration', () => {
    expect(validateEnv(validConfig)).toBe(validConfig);
  });

  it('rejects production placeholder secrets', () => {
    expect(() =>
      validateEnv({
        ...validConfig,
        JWT_SECRET: 'replace_with_a_random_64_character_secret_for_access_tokens',
      }),
    ).toThrow(/JWT_SECRET/);
  });

  it('rejects short JWT secrets', () => {
    expect(() => validateEnv({ ...validConfig, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  });

  it('rejects short CSRF secrets when configured', () => {
    expect(() => validateEnv({ ...validConfig, CSRF_SECRET: 'short' })).toThrow(/CSRF_SECRET/);
  });

  it('requires ClamAV in production', () => {
    expect(() => validateEnv({ ...validConfig, CLAMAV_ENABLED: 'false' })).toThrow(/CLAMAV_ENABLED/);
  });

  it('rejects invalid ClamAV configuration when scanning is enabled', () => {
    expect(() => validateEnv({ ...validConfig, CLAMAV_PORT: '70000' })).toThrow(/CLAMAV_PORT/);
  });
});
