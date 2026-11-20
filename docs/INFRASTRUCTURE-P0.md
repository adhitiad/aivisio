# P0 — Media Storage & Durable Video Queue

## Media storage

AIVISO uses Neon Object Storage through its S3-compatible, path-style endpoint. Buckets must be private. Create the bucket on the same Neon branch used by the application and create a branch-scoped credential with `storage:read` and `storage:write` scopes.

Required environment variables:

- `AWS_ENDPOINT_URL_S3`: branch Object Storage endpoint (HTTPS).
- `NEON_STORAGE_BUCKET`: private bucket name.
- `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`: Neon scoped credential.
- `AWS_REGION`: Neon region (for SigV4 signing).

Uploads are streamed from temporary render files. The application stores the object key, MIME type, byte length and SHA-256 in `MediaAsset`. A video project is marked `done` only after the final MP4 and available scene thumbnails have been uploaded and verified with `HeadObject`. The renderer may use ephemeral local scratch space; production playback never depends on it.

New thumbnail variants are stored directly in Object Storage. Existing local files are migrated with a dry-run first:

```bash
bun run media:migrate
bun run media:migrate --apply
```

The migration is idempotent, checks the remote byte size and SHA-256 metadata, updates the database pointers only after verification, and does not delete old local files. Keep the old files until the migration report has been reviewed and backups are confirmed.

## Redis providers and job durability

Set `REDIS_PROVIDER` to `local`, `upstash` or `redis-cloud`. Use TCP Redis URLs (`redis://` or `rediss://`). Upstash REST URL/token pairs are not interchangeable with the TCP endpoint needed by this worker.

- Local: `REDIS_URL=redis://127.0.0.1:6379`
- Upstash: `UPSTASH_REDIS_URL=rediss://default:<password>@<tcp-endpoint>:6379`
- Redis Cloud: `REDIS_CLOUD_URL=rediss://default:<password>@<host>:<port>`

Redis is a FIFO wake-up/dispatch queue, not the system of record. `VideoJob` rows in PostgreSQL hold durable status, attempts, availability, locks and heartbeat data. Workers consume Redis hints, then acquire the PostgreSQL lease atomically. If Redis is unavailable, a worker polls/reconciles PostgreSQL, so an API/Redis interruption does not lose a committed video job. Duplicate Redis hints are safe because the PostgreSQL claim is conditional.

Run the worker separately:

```bash
bun run worker:video
```

## Operational checks

1. Configure a private Neon bucket and branch-scoped read/write credential.
2. Configure Redis TCP endpoint, TLS and credentials.
3. Run `bun run db:generate` then `bun run db:push`.
4. Run `bun run media:migrate` and inspect the dry-run report.
5. Run `bun run media:migrate --apply` and verify the migrated counts.
6. Start the worker and create a test video. Confirm `VideoProject.fileObjectKey` is populated, `filePath` is null, and `MediaAsset.sha256` matches remote metadata.
7. Test authenticated playback with full response and HTTP `Range` requests. Verify project deletion removes its remote object keys.

No credentials belong in git, logs, issue comments or client-side bundles. The private bucket is accessed only through authenticated server routes.
