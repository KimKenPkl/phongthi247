# Submission hardening implementation plan

Goal: close reproduced score-tampering, duplicate submission, false sync, unsafe fallback and report/export gaps on Pages + Apps Script.

Architecture: retain one deployment per organization. Generate a pinned, minimal exam registry from the published source. Backend validates exam revision and canonical answers, recalculates scores, and stores idempotent receipts under ScriptLock. Client POSTs and checks a capability-protected receipt before removing pending work. Private report/roster use POST credentials held only in memory; optional per-reader scopes are enforced on the server. This is not a multi-tenant account service.

Tech stack: vanilla browser JavaScript, Apps Script V8, Node built-ins for build and VM tests. No new services or dependencies.

1. `scripts/build_exam_registry.cjs` → `apps-script/ExamRegistry.gs`: allowlisted published exams, source SHA256, answer schema, authoritative policy. Do not modify chemistry content or scoring policy.
2. `apps-script/Code.gs`: bounded input, validate/regrade, receipt/idempotency/conflict handling, safe Sheet text/CSV, POST-only scoped reports, default-private leaderboard.
3. `assets/common.js`, `assets/exam.js`: trusted Apps Script URL parser, random receipt token, POST + receipt checks, queue retention/concurrency/target binding, no external fallback.
4. `assets/report.js`, `report/index.html`: POST private reads, in-memory credentials, honest connection/delete/reset labels, safe CSV.
5. VM backend/client tests for tampering, replay/conflicts, scopes, missing receipts, retries, network failures and formula safety. Run existing period/Lab/teacher/OMR tests and validator; update deployment and readiness documentation. No live submission, deployment, commit or push in this change.

Acceptance: unknown/revised exams and malformed answers fail closed; client scores ignored; identical retries do not append; mismatched retries cannot overwrite; queue survives missing/mismatched receipt; no restful-api.dev requests; scoped readers cannot escape scope through report/roster/export; GET cannot return private reports. Device acceptance and actual Apps Script deployment remain separate release gates.

Implementation: nonce capability responses expire after at most 60 seconds; atomic consume under ScriptLock. Credentials stay in POST body and page memory. Bounded CORS/no-cors requests retain pending work unless the final receipt matches. Responses over 90,000 UTF-8 bytes fail closed. Queue is target-bound and one-key-per-receipt; legacy items require manual reconciliation. Hard closeAt has no grace; offline-late work stays local. Registry revisions must remain compatible with pending work; changed revisions reject before dedupe.

Local gates: `test_submission_hardening.cjs` (backend VM), `test_submission_client.cjs` (transport/queue VM), `test_submission_browser.cjs` (Edge with synthetic responses), existing period/Lab/OMR/teacher tests, registry check, validator and diff check. Source is not committed, pushed or deployed by this work. Live Apps Script CORS/redirect and Android acceptance remain outstanding.
