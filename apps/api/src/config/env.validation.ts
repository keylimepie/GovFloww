const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'REDIS_PASSWORD',
  'MINIO_ACCESS_KEY',
  'MINIO_SECRET_KEY',
] as const;

const OPTIONAL_SECRET_ENV_VARS = ['CSRF_SECRET'] as const;

const INSECURE_VALUES = [
  'password',
  'changeme',
  'change_me',
  'replace_me',
  'fallback_secret',
  'govflow_secure_2026',
  'govflow_redis_2026',
  'govflow_minio_2026',
  'replace_with_a_random_64_character_secret_for_access_tokens',
  'replace_with_a_random_64_character_secret_for_refresh_tokens',
];

export function validateEnv(config: Record<string, unknown>) {
  const nodeEnv = String(config.NODE_ENV || 'development');
  const isProduction = nodeEnv === 'production';
  const errors: string[] = [];

  for (const key of REQUIRED_ENV_VARS) {
    const value = String(config[key] || '').trim();
    if (!value) {
      errors.push(`${key} is required`);
      continue;
    }

    const normalized = value.toLowerCase();
    const isInsecure = INSECURE_VALUES.some((item) =>
      item === 'password' ? normalized === item : normalized.includes(item),
    );
    if (isProduction && isInsecure) {
      errors.push(`${key} must not use a default or placeholder value in production`);
    }
  }

  for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET'] as const) {
    const value = String(config[key] || '');
    if (value && value.length < 32) {
      errors.push(`${key} must be at least 32 characters`);
    }
  }

  for (const key of OPTIONAL_SECRET_ENV_VARS) {
    const value = String(config[key] || '').trim();
    if (!value) continue;

    if (value.length < 32) {
      errors.push(`${key} must be at least 32 characters when set`);
    }

    const normalized = value.toLowerCase();
    const isInsecure = INSECURE_VALUES.some((item) =>
      item === 'password' ? normalized === item : normalized.includes(item),
    );
    if (isProduction && isInsecure) {
      errors.push(`${key} must not use a default or placeholder value in production`);
    }
  }

  const maxUploadBytes = Number(config.GOVFLOW_MAX_UPLOAD_BYTES || 10 * 1024 * 1024);
  if (!Number.isInteger(maxUploadBytes) || maxUploadBytes <= 0) {
    errors.push('GOVFLOW_MAX_UPLOAD_BYTES must be a positive integer when set');
  }

  const clamAvEnabled = String(config.CLAMAV_ENABLED || 'false') === 'true';
  if (isProduction && !clamAvEnabled) {
    errors.push('CLAMAV_ENABLED must be true in production');
  }

  if (clamAvEnabled) {
    const clamAvHost = String(config.CLAMAV_HOST || '').trim();
    const clamAvPort = Number(config.CLAMAV_PORT || 3310);
    const clamAvTimeout = Number(config.CLAMAV_TIMEOUT_MS || 5000);

    if (!clamAvHost) {
      errors.push('CLAMAV_HOST is required when CLAMAV_ENABLED is true');
    }
    if (!Number.isInteger(clamAvPort) || clamAvPort < 1 || clamAvPort > 65535) {
      errors.push('CLAMAV_PORT must be a valid TCP port');
    }
    if (!Number.isInteger(clamAvTimeout) || clamAvTimeout < 1000 || clamAvTimeout > 60000) {
      errors.push('CLAMAV_TIMEOUT_MS must be between 1000 and 60000');
    }
  }

  if (isProduction) {
    const corsOrigin = String(config.CORS_ORIGIN || '');
    if (!corsOrigin || corsOrigin.includes('localhost')) {
      errors.push('CORS_ORIGIN must be an explicit public origin in production');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid GovFlow environment:\n- ${errors.join('\n- ')}`);
  }

  return config;
}
