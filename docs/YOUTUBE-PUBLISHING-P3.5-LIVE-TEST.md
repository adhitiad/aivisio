# P3.5 — Production Live Publishing Test Runbook

## Scope and safety

This runbook validates one operator-selected video on one operator-selected YouTube channel. The first live test MUST use `privacyStatus=private`, with no `scheduledAt` value. Do not use a customer video, copyrighted material without permission, or a video that must remain unpublished.

A successful CI run is not a live YouTube integration test. A live test requires the deployed application, database, Neon Object Storage, Google OAuth connection, and the protected scheduler to be configured.

Never paste OAuth access tokens, refresh tokens, client secrets, cookies, or cron secrets into issues, chat, screenshots, or logs.

## Phase A — Preflight (no upload)

1. Deploy the tested `adhitiad_gpt` commit to a non-public test deployment or the intended production deployment after normal release approval.
2. Confirm the YouTube channel is connected with the `youtube.upload` scope.
3. Open `/dashboard/publishing`.
4. Select the exact channel and a completed video project.
5. Click **Periksa kesiapan**.
6. Continue only if the response is `ready: true` and all four checks pass:
   - OAuth token refresh/access
   - `youtube.upload` scope
   - channel ownership
   - exact Object Storage file-size match

If any check fails, stop and resolve the error. Do not retry an upload to bypass a failed preflight.

## Phase B — First private upload

1. Create a publication with privacy set to `private` and leave the schedule empty.
2. Verify title, description, tags, selected channel, and selected source video.
3. Obtain explicit operator approval in the dashboard.
4. Observe the dashboard until status becomes `published`.
5. Record the publication ID, YouTube video ID, upload attempts, final byte offset, and timestamps. Do not record OAuth tokens or session URIs.
6. Open the video link from the dashboard and verify in YouTube Studio that the video exists and is **Private**.
7. Verify the video ID shown by YouTube matches `youtubeVideoId` stored for the publication.

Acceptance: exactly one YouTube video exists for this test publication, the application stores one matching video ID, and the publication reaches `published`.

## Phase C — Resumable upload interruption and worker recovery

Perform this only with a separate disposable test video (or after the first test is complete), and preferably in a controlled deployment window.

1. Start a private upload of a sufficiently large test video.
2. Wait until the dashboard shows a non-zero acknowledged upload offset.
3. Interrupt the worker process or its outbound connection in a controlled way. Do not delete the publication row or its encrypted resumable-session URI.
4. Confirm the publication remains recoverable and its lease becomes stale.
5. Restart the worker / allow the protected scheduler to run.
6. Confirm the worker probes the existing Google resumable session and reconciles the acknowledged Range before sending more bytes.
7. Confirm the publication completes with the same single YouTube video ID.

Acceptance: the worker resumes the existing session, acknowledged bytes are not resent as a new upload session, and YouTube Studio contains exactly one video for that publication.

Important: do not use the dashboard's manual **Coba lagi** action while an upload outcome is ambiguous. It resets the resumable session. First inspect YouTube Studio and reconcile the existing publication; only retry when an operator has confirmed no corresponding video was created.

## Phase D — Worker restart / duplicate prevention

1. Restart the application or worker after a resumable session has been created but before the upload is complete.
2. Let the lease recovery path reclaim the stale job.
3. Confirm the same session is probed and that the database row retains one publication ID.
4. After completion, invoke the scheduler again and verify it does not create or upload a second video for the already-published row.

Acceptance: one publication row maps to one YouTube video ID; repeated scheduler invocations do not create another upload for a row with a stored video ID.

## Phase E — Scheduled publishing

Use another disposable test video, or a fresh copy of a permitted test asset. Do not convert the first private upload into a scheduled test.

1. Create a publication with privacy `private` and `scheduledAt` at least 20 minutes in the future.
2. Approve it while the scheduled time is still safely in the future.
3. Confirm the worker uploads it as private and stores the resulting video ID.
4. In YouTube Studio, confirm the video is private with the intended scheduled publish time.
5. After the scheduled time, verify the video transitions to public (subject to channel eligibility and YouTube processing).

Acceptance: the video is uploaded as private before the scheduled time, YouTube Studio shows the intended schedule, and the video transitions at the scheduled time. If YouTube Studio does not show the expected schedule, stop and investigate; do not create a duplicate.

## Evidence to record

- Deployment URL and tested Git commit SHA
- Publication ID and source project ID
- Channel title and channel ID (do not include account email)
- Preflight result and timestamp
- YouTube video ID and YouTube Studio privacy/schedule status
- Upload attempts and final acknowledged byte offset
- Worker restart/interruption timestamps
- Scheduler invocation timestamps and HTTP outcomes
- Whether exactly one video exists for each publication

## Current execution status

This document defines the live test procedure. It does not claim that a real upload, interruption, worker restart, or scheduled publication has already been executed. Those checks require an operator-selected video, an authorized connected YouTube account, and access to the deployed runtime.
