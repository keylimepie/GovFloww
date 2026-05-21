# GovFlow On-Prem Deployment Notes

## Production Baseline
- Use `docker-compose.yml` plus `docker-compose.prod.yml` for the on-prem stack.
- Put production secrets only in `.env`; never commit `.env`.
- Set `NODE_ENV=production`, a public `CORS_ORIGIN`, and strong unique values for database, Redis, MinIO, `JWT_SECRET`, and `JWT_REFRESH_SECRET`.
- Set `CLAMAV_ENABLED=true`, `CLAMAV_HOST=clamav` for Docker Compose deployments, and a bounded `GOVFLOW_MAX_UPLOAD_BYTES` value suitable for the department's upload policy.
- Terminate TLS at the government reverse proxy or load balancer in front of the `web` service.

## Health Checks
- API: `GET /api/health`
- PostgreSQL, Redis, and MinIO are checked by the API health endpoint and their container health checks.
- ClamAV runs as an upload-scanning dependency. The API fails startup in production unless scanning is enabled.

## Backup Basics
- PostgreSQL: run scheduled `pg_dump` backups and test restore into a separate database before each release.
- MinIO: back up the `minio_data` volume or mirror the bucket to approved offline storage.
- Redis: used for queues/notifications; persist `redis_data`, but PostgreSQL remains the source of record.

## Release Checks
- `npm run typecheck`
- `npm run build`
- `npm run test --workspace=apps/api`
- `docker compose -f docker-compose.yml -f docker-compose.prod.yml build`
