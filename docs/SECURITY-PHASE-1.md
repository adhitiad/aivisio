# Phase 1 security controls

This document describes the security controls added for the AIVISO Creator Growth Studio.

## Roles and bootstrap

The application roles are:

- OWNER: full administrative access.
- ADMIN: operational administration.
- CREATOR: creator-owned resources only.

User.role defaults to CREATOR. The server resolves the role from PostgreSQL on every privileged request; it never trusts a role supplied by the browser.

Set OWNER_EMAILS to a comma-separated list of verified OAuth email addresses to bootstrap the initial owner. Only accounts with emailVerified = true are elevated by this allowlist.

Additional administrators must be promoted by an authorized database operator, for example:

    UPDATE "User"
    SET role = 'ADMIN'
    WHERE lower(email) = lower('admin@example.com')
      AND "emailVerified" = true;

Do not expose a self-service role mutation endpoint.

## AI provider credentials

New provider API keys are encrypted with AES-256-GCM before being saved. Set a dedicated random value in PROVIDER_ENCRYPTION_KEY; if it is absent, the application derives the encryption key from BETTER_AUTH_SECRET.

Keep the encryption key stable and back it up securely. Rotating it without re-encrypting existing credentials will make encrypted keys unreadable.

Existing plaintext provider keys remain readable for backward compatibility until migrated. After setting the encryption key, run:

    bun run security:encrypt-provider-keys

The migration does not print or export credentials.

## Provider URL / SSRF protection

External provider URLs must use HTTPS and resolve only to public IP addresses. Private, loopback, link-local, reserved, and local hostnames are rejected. HTTP localhost is permitted only for the Ollama provider in non-production environments.

Provider requests reject redirects to avoid redirect-based SSRF.

This DNS validation reduces SSRF exposure but does not replace outbound network egress controls. Production deployments should deny access to cloud metadata services and private network ranges at the network layer.

## Same-origin protection

Cookie-authenticated mutation routes reject cross-site Fetch Metadata requests and mismatched Origin headers. Requests from non-browser server-to-server clients without an Origin header remain supported; protect such clients with their own authentication and network controls.

## Notification receipts

Broadcast notification read/dismissal state is stored per user in NotificationReadReceipt. Personal notifications continue to use Notification.read.

## Database update

The Prisma schema gained User.role and NotificationReadReceipt. Existing installations following the repository's current db:push workflow must run:

    bun run db:generate
    bun run db:push

Back up PostgreSQL before applying schema changes. This repository did not contain a migration baseline at the time this feature was added, so do not run prisma migrate deploy against an existing database until a complete baseline migration has been established.
