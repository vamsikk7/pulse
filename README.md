# Pulse

A petition-intelligence dashboard for U.S. employment-based immigration cases.
Two independent tools share a single applicant file:

- **Petition risk review (before you file)** — Upload a draft O-1A or EB-1A
  petition PDF (plus any supporting exhibits). Pulse maps every claim against
  the USCIS regulatory criteria, scores each criterion's evidentiary strength,
  cross-checks citation and recommender claims on OpenAlex, and returns a
  ranked weakness list with a 0–100 RFE-risk score.
- **USCIS case tracking (after you file)** — Add a USCIS receipt number. Pulse
  scrapes the public case-status page (with rate-limited retries and a mock
  fallback when the live endpoint is unreachable) and uses real service-center
  processing-time bands to predict the next milestone date. Cases that exceed
  the typical p80 are flagged as **taking longer than usual**.

The two tools work independently — a user can review a draft without ever
filing through Pulse, or track an existing case without uploading a petition.

## Stack

| Concern | Choice |
|---|---|
| Frontend | Next.js 16 App Router, mostly RSC, Tailwind |
| Backend | Node.js + Express + TypeScript |
| Worker | Separate Node process; BullMQ consumer + cron |
| Auth | Currently disabled — fixed demo user. Easy to drop in Clerk or any provider later. |
| DB | MongoDB (Mongoose) |
| Object storage | MinIO (S3-compatible) |
| Queue | BullMQ + Redis |
| Virus scanning | ClamAV sidecar over INSTREAM |
| OCR | Tesseract + Poppler (`pdftoppm`) in the worker image |
| LLM | Configurable per-user, any OpenAI-compatible endpoint (Ollama, OpenAI, Anthropic, vLLM, llama.cpp, etc.) |
| External verification | OpenAlex (free + premium API key) |
| PDF generation | `pdfkit` for the report export |
| Queue admin | Bull Board mounted at `/admin/queues` |
| Dev | Docker Compose |

## Prerequisites

- Docker Desktop with at least 6 GB of memory
- (For the default config) A local OpenAI-compatible LLM endpoint — Ollama on
  the host with a chat-capable model is the easiest setup. The worker reaches
  it via `host.docker.internal:11434/v1`.
- You can swap the LLM provider at runtime from the **Settings** page in the
  dashboard — point Pulse at OpenAI, Anthropic, Together, Groq, vLLM, or any
  other OpenAI-compatible endpoint with your API key.

## Quick start

```bash
cp .env.example .env
docker compose up -d                   # brings up every service; minio-init auto-runs once and exits
docker compose exec api npm run seed   # seeds two demo applicants + a petition
```

On first boot, the ClamAV sidecar downloads ~250 MB of virus definitions —
it takes a few minutes. Subsequent boots are fast.

### Seed / reseed

`npm run seed` (or `docker compose exec api npm run seed`) creates:

- **Dr. Patel — O-1A** with two USCIS receipts (`EAC2490012345`, `WAC2390098765`)
- **Ms. Lin — EB-1A** with a real petition + exhibit uploaded to MinIO and a
  full analysis queued — open the dashboard right after seeding and you'll see
  the review in progress, then complete a couple of minutes later

To wipe and reseed in one shot (clears every demo-user document across all
collections AND the user's MinIO objects, then runs `seed`):

```bash
npm run reseed
# or, equivalently:
docker compose exec api npm run reseed
```

### Browse

- Web: <http://localhost:3000>
- API: <http://localhost:4000/health>
- API docs (Swagger UI): <http://localhost:4000/api-docs>
- OpenAPI JSON: <http://localhost:4000/openapi.json>
- Queue admin (Bull Board): <http://localhost:4000/admin/queues>
- MinIO console: <http://localhost:9001> (user `minio`, pass `minio12345`)
- Mongo: `mongodb://localhost:27017/pulse`

## Architecture

```
                         ┌───────────────────────────────┐
                         │      Browser (Next.js)        │
                         │  /         landing + carousel │
                         │  /app      dashboard          │
                         │  /app/cases/[id]   tabs       │
                         │  /app/settings    LLM config  │
                         └──────────────┬────────────────┘
                                        │
                              REST + Server-Sent Events
                                        │
       ┌────────────────────────────────▼────────────────────────────────┐
       │                         API (Express)                           │
       │  • cases / petitions / receipts / analyses CRUD                 │
       │  • presigned upload URLs to MinIO                               │
       │  • file validation: magic byte + size + ClamAV scan             │
       │  • per-user upload rate limit (Redis-backed)                    │
       │  • SSE: /analyses/:id/stream  (live progress)                   │
       │  • PDF report: /analyses/:id/report.pdf                         │
       │  • LLM settings: GET/PUT /settings/llm + /settings/llm/test     │
       └─┬───────────────────┬──────────────────┬─────────────────────┬──┘
         │                   │                  │                     │
   ┌─────▼──────┐    ┌───────▼──────┐    ┌──────▼──────┐    ┌─────────▼─────┐
   │   Mongo    │    │    MinIO     │    │    Redis    │    │    ClamAV     │
   │            │    │   (S3-ish)   │    │   (BullMQ)  │    │   (INSTREAM)  │
   │ Applicants │    │  Petition    │    │  Job queues │    │  Virus scan   │
   │ Petitions  │    │  uploads     │    │  + rate     │    │               │
   │ Files[]    │    │  brief +     │    │  limit      │    │               │
   │ Analyses   │    │  exhibits    │    │  counters   │    │               │
   │ Receipts   │    │              │    │             │    │               │
   │ Settings   │    │              │    │             │    │               │
   └────────────┘    └──────────────┘    └─┬───────────┘    └───────────────┘
                                           │
                              BullMQ pulls jobs from Redis
                                           │
                         ┌─────────────────▼─────────────────┐
                         │           Worker (Node)           │
                         │                                   │
                         │  petition-analysis queue:         │
                         │   ① fetch each file from MinIO    │
                         │   ② pdf-parse → OCR fallback      │
                         │   ③ pre-flight (is it a petition?)│
                         │   ④ LLM analysis (configurable)   │
                         │   ⑤ OpenAlex cross-checks         │
                         │   ⑥ deterministic heuristics      │
                         │   ⑦ persist back to Mongo         │
                         │                                   │
                         │  uscis-scrape queue:              │
                         │   live + mock fallback            │
                         │                                   │
                         │  processing-times cron:           │
                         │   nightly band refresh            │
                         │                                   │
                         │  criteria-refresh cron:           │
                         │   daily eCFR check + freshness    │
                         │                                   │
                         │  Calls out to:                    │
                         │  → Tesseract (in-container)       │
                         │  → host LLM (Ollama / OpenAI / …) │
                         │  → OpenAlex.org                   │
                         │  → egov.uscis.gov                 │
                         │  → ecfr.gov                       │
                         └───────────────────────────────────┘
```

## Petition review pipeline

Detailed flow once a file lands in MinIO:

```
Upload (browser)
   │ presigned PUT directly to MinIO (bypasses API for the big payload)
   ▼
POST /petitions  (API)
   ├─ Rate-limit check     (Redis-backed; 30/hr + 100/day by default)
   ├─ Object existence     (MinIO statObject)
   ├─ Size check           (1 KB ≤ size ≤ 25 MB)
   ├─ Magic-byte check     (file-type → must be application/pdf)
   ├─ ClamAV scan          (INSTREAM; rejects on hit, cleans MinIO obj)
   ├─ Create Petition + files[]
   ├─ Create RfeAnalysis   (status="queued", durable handle returned to client)
   └─ Enqueue BullMQ job
   ▼
Worker picks up job
   ├─ Refuse if petition.deletedAt — caller withdrew
   ├─ For each file in petition.files[]:
   │    pdf-parse → if <300 chars, OCR via Tesseract+Poppler
   │    record per-file pageCount + textChars + ocrUsed
   ├─ Concatenate text with === BRIEF / EXHIBIT === section markers
   ├─ Pre-flight: empty? non-petition? visa-mismatch? OCR used?
   │    fatal signals fail the job before LLM spend
   ├─ Resolve LLM config (per-user, cached 30s)
   │    settings.llm via Mongo → OpenAI client pointed at any base URL
   ├─ LLM call: structured JSON output, retry once with stricter prompt
   ├─ OpenAlex verification:
   │    extract petitioner name → search OpenAlex
   │    compare claimed citations vs actual
   │    extract recommender names → check co-authorship overlap
   ├─ Deterministic heuristics (negation-aware):
   │    citation count, salary comparator, recommender count,
   │    recommender independence, judging recency, publication count
   ├─ Merge LLM weaknesses + heuristic signals + OpenAlex signals
   ├─ Risk score = LLM score + severity-weighted boost
   └─ Persist: status="done", criteriaFindings, weaknesses, checks,
              preflightSignals, raw reasoning (dev-only)
   ▼
SSE stream pushes progress as Mongo updates land
   ▼
PDF export available at /analyses/:id/report.pdf
```

## USCIS case tracking flow

Three-tier fetch with automatic fallback:

```
POST /receipts                    Add a USCIS receipt (3 letters + 10 digits)
   ├─ Validate format
   ├─ Reject duplicates (against active, non-soft-deleted)
   └─ Enqueue uscis-scrape job
       │
       ▼
   Tier 1 — USCIS Developer Hub API (sandbox)
       │   Endpoint: GET {USCIS_API_BASE}/case-status/{receiptNumber}
       │   Auth:     OAuth2 client_credentials → Bearer token (cached ~1h)
       │   Config:   Set Client ID + Client Secret in /app/settings
       │             (or USCIS_API_CLIENT_ID + USCIS_API_CLIENT_SECRET in .env)
       │   Base URL: https://api-int.uscis.gov (sandbox only)
       │   Returns:  structured JSON (clean status title + detail)
       │   Skipped when no credentials configured.
       │   Sandbox-only: only staging receipt numbers are accepted.
       │   Availability: The USCIS Sandbox API is only online during normal
       │                 business hours (Monday–Friday, 7:00 AM – 8:00 PM EST).
       │                 Outside these hours, it returns HTTP 503 and falls through.
       │
       │   On 401/403:  bust token cache, fall through
       │   On 404:      receipt not found at USCIS, fall through
       │   On 5xx/err:  fall through
       ▼
   Tier 2 — HTML scrape of egov.uscis.gov/casestatus (public, no auth)
       │   • global rate limit: 1 req per 10s
       │   • 3 attempts with exponential backoff (5s base)
       │   • parses status title + detail with cheerio
       │
       │   On all attempts failing: fall through
       ▼
   Tier 3 — mock fixtures keyed by receipt prefix
       (EAC→Vermont RFE, WAC→approved, IOE→biometrics, …)
       UI labels every status with source: "Live from USCIS" or "Sample data"

   Daily refresh cron:
       processing-times-cron pulls service-center bands at 03:00 UTC
       (falls back to a checked-in Q4-2024 snapshot when the endpoint 403s)

   On every successful scrape:
       Append StatusEvent (only if status changed since last)
       Compute Prediction:
           nextMilestone     = label for the new status code
           predictedDate     = lastStatusAt + p50 of the band
           isStuck           = currentDaysAtStep > p80
       Persist Receipt.last* fields
```

### USCIS sandbox staging receipt numbers

The sandbox API only accepts specific test receipt numbers.

**With `hist_case_data` in payloads:**

`EAC9999103403`, `EAC9999103404`, `EAC9999103405`, `EAC9999103410`,
`EAC9999103411`, `EAC9999103416`, `EAC9999103419`,
`LIN9999106498`, `LIN9999106499`, `LIN9999106504`, `LIN9999106505`, `LIN9999106506`,
`SRC9999102777`–`SRC9999102787`, `SRC9999132710`, `SRC9999132719`

**Without `hist_case_data` in payloads:**

`EAC9999103400`, `EAC9999103402`, `EAC9999103406`–`EAC9999103409`,
`EAC9999103412`–`EAC9999103415`, `EAC9999103420`, `EAC9999103421`,
`EAC9999103424`–`EAC9999103426`, `EAC9999103428`, `EAC9999103429`,
`EAC9999103431`, `EAC9999103432`,
`LIN9999106501`, `LIN9999106507`,
`SRC9999132694`, `SRC9999132695`, `SRC9999132706`, `SRC9999132707`

## Background jobs &amp; the queue admin

Four BullMQ queues drive Pulse's background work, all redis-backed and
inspectable via **Bull Board at `/admin/queues`** (linked from the
list-checks icon in the dashboard header):

| Queue | Trigger | What it does |
|---|---|---|
| `petition-analysis` | On every petition upload | The full review pipeline: per-file extraction → OCR fallback → LLM → OpenAlex → heuristics → persist |
| `uscis-scrape` | On receipt creation + manual refresh | Scrape `egov.uscis.gov/casestatus` with 1 req / 10 s, exponential backoff, mock fallback |
| `processing-times-cron` | Daily `0 3 * * *` UTC | Refresh USCIS service-center processing-time bands; falls back to a checked-in 2024 snapshot |
| `criteria-refresh-cron` | Daily `0 4 * * *` UTC | Fetch eCFR (`§ 204.5`, `§ 214.2`) and hash-compare against the last snapshot; warn if anything changed |

Bull Board exposes:

- Live counts (waiting / active / completed / failed / delayed)
- Per-job inputs, return values, stack traces
- Repeatable-job schedulers (cron patterns)
- One-click retry / promote / remove

There's also a programmatic summary at `GET /admin/queues.json`:

```json
{
  "queues": [
    { "name": "petition-analysis", "counts": {…}, "schedulers": [] },
    { "name": "criteria-refresh-cron", "counts": {…},
      "schedulers": [{ "name": "refresh", "pattern": "0 4 * * *" }] }
  ]
}
```

> **No auth on `/admin/*` in the demo.** Single-user only; protect this router
> with auth before exposing the API publicly.

## Criteria freshness check

The USCIS regulatory criteria the LLM is prompted with are committed in code
(`packages/shared/src/criteria.ts`) — these are taken verbatim from
**8 CFR § 204.5(h)(3)** (EB-1A) and **8 CFR § 214.2(o)(3)(iii)** (O-1A).
Federal regulations change occasionally. The `criteria-refresh-cron` job runs
daily, fetches both sections from **eCFR**, hashes the structural payload,
and compares against the last snapshot:

- **Unchanged** → just records a fresh `lastSyncedAt` timestamp
- **Changed** → records a snapshot + logs a `⚠ eCFR sections changed` warning so the
  taxonomy can be reviewed against the latest regulation text

State lives in two collections:

- `criteria_snapshots` — one document per cron run, includes per-section hash + raw size
- `criteria_freshness` — singleton with `lastSyncedAt`, `lastSuccessfulSyncAt`,
  `lastChangedAt`, `consecutiveFailures`, `lastError`

Surfaced via `GET /health`:

```json
{
  "ok": true,
  "criteria": {
    "lastSyncedAt": "2026-05-31T08:54:22Z",
    "lastSuccessfulSyncAt": null,
    "consecutiveFailures": 2,
    "lastError": "HTTP 404"
  }
}
```

(eCFR's `/versioner/v1/full/{date}/title-8.json?section=…` endpoint returns 404
in the current implementation — the *freshness machinery* is wired, but the
upstream URL pattern needs further iteration. Logged as a follow-up.)

## Configurable LLM provider

Pulse never assumes a specific LLM. The worker reads `LlmSettings` for the user
at the start of each analysis (cached 30 s) and constructs an OpenAI-compatible
client. Settings can be edited at **/app/settings**:

| Preset | Notes |
|---|---|
| Local LLM via Ollama | `http://host.docker.internal:11434/v1` · no API key needed |
| OpenAI | `https://api.openai.com/v1` · paste API key |
| Anthropic (OpenAI-compatible) | `https://api.anthropic.com/v1/` · paste API key |
| Custom | Any OpenAI-compatible endpoint (vLLM, llama.cpp, Together, Groq, …) |

The settings page includes a **Test connection** button that fires a 16-token
request and reports latency + the model's response, all without saving.

API keys are stored on the server only — never returned to the browser. The
GET endpoint reports `apiKeyConfigured: true/false`. A `__clear__` sentinel
lets users explicitly wipe the saved key.

## USCIS API settings

The USCIS Developer Hub API is configured per-user at **/app/settings**:

| Field | Notes |
|---|---|
| Base URL | Locked to `https://api-int.uscis.gov` (sandbox only) |
| Client ID | From [developer.uscis.gov](https://developer.uscis.gov/) |
| Client Secret | Stored server-side only, never returned to browser |
| Enabled | Toggle to disable the API and fall through to HTML scraping |

The settings page includes a **Test connection** button that performs an OAuth
handshake and reports latency + token TTL. An expandable section lists all
valid staging receipt numbers.

## OpenAlex settings

OpenAlex is used for citation cross-checking and recommender independence
verification. Configured per-user at **/app/settings**:

| Field | Notes |
|---|---|
| Contact email (mailto) | Identifies requests to the OpenAlex "polite pool" for higher rate limits |
| API key | Optional premium key from [openalex.org/users](https://openalex.org/users) |

The worker reads the per-user config from MongoDB (cached 30s) and falls back
to `OPENALEX_MAILTO` and `OPENALEX_API_KEY` env vars if no user config is set.

## OpenAPI documentation

All API routes are annotated with OpenAPI 3.0 JSDoc. Available at:

- **Swagger UI**: <http://localhost:4000/api-docs>
- **JSON spec**: <http://localhost:4000/openapi.json>

No authentication required to browse the docs.

## What's in the box

```
pulse/
├── apps/
│   ├── web/                Next.js 16 — landing, dashboard, applicant detail, settings
│   ├── api/                Express — cases, petitions, receipts, analyses, uploads, settings, admin
│   │   └── src/
│   │       ├── routes/admin.ts             Bull Board + JSON queue summary
│   │       ├── routes/settings.ts          LLM provider config (GET/PUT/test)
│   │       ├── routes/uscisSettings.ts     USCIS sandbox config (GET/PUT/test)
│   │       ├── routes/openalexSettings.ts  OpenAlex config (GET/PUT/test)
│   │       ├── routes/uscisReceipts.ts     Staging receipt number allowlist
│   │       ├── swagger.ts                  OpenAPI spec (swagger-jsdoc)
│   │       ├── scripts/seed.ts             Seed demo applicants + a real petition for Lin
│   │       ├── scripts/reseed.ts           One-shot wipe + reseed
│   │       └── services/
│   │           ├── minio.ts        Presigning + direct ops
│   │           ├── clamav.ts       INSTREAM client + health ping
│   │           ├── uploadLimit.ts  Redis-backed rate limit
│   │           ├── reportPdf.ts    Server-side PDF export
│   │           └── queue.ts        BullMQ producer handles + `allQueues`
│   └── worker/             BullMQ consumer + Tesseract + OpenAlex
│       └── src/
│           ├── jobs/analyzePetition.ts    multi-file extraction → LLM → checks
│           ├── jobs/scrapeReceipt.ts      live USCIS + mock fallback
│           ├── jobs/refreshCriteria.ts    daily eCFR snapshot + freshness tracking
│           ├── pdf/extract.ts             pdf-parse wrapper
│           ├── pdf/ocr.ts                 Tesseract + Poppler pipeline
│           ├── preflight.ts               empty / non-petition / visa-mismatch
│           ├── heuristics/index.ts        6 negation-aware checks
│           ├── openalex.ts                citation + recommender independence
│           ├── extractors.ts              petitioner/recommender name regex (8 + 7 patterns)
│           └── ollama/                    LLM client + prompt builder
├── packages/
│   └── shared/             Zod schemas + USCIS criteria taxonomy
├── samples/                Synthetic PDFs (each watermarked SYNTHETIC)
└── docker-compose.yml      mongo + redis + minio + clamav + api + worker + web
```

## File security (every upload)

| Layer | What it does |
|---|---|
| Rate limit | Redis sliding windows — 30 uploads/hour, 100/day per user (configurable). Refunded on server-side rejection. |
| Size check | 1 KB ≤ file ≤ 25 MB |
| Magic-byte check | `file-type` reads the first 4 KB; rejects anything that doesn't have the PDF signature regardless of `Content-Type` header |
| Virus scan | ClamAV INSTREAM; rejects with the signature name. Fail-closed: 503 if ClamAV is unreachable |
| Cleanup on reject | Bad uploads are removed from MinIO immediately |

## Pre-flight + checks layered on top of the LLM

Before the LLM is invoked, the worker runs pre-flight checks that can **block**
the analysis (no LLM spend on garbage):

- **Empty extract** (< 300 chars) — fatal
- **Non-petition** (< 3 of 7 standard markers) — fatal
- **Short extract** (< 1500 chars) — warning
- **Visa-type mismatch** — warning (analysis proceeds against the declared visa)
- **PDF parse error** — fatal with friendly message

After the LLM result, six **negation-aware deterministic checks** layer on:

| Check | What it looks for |
|---|---|
| Citation count is meaningful | `"cited by N"` matches; flags total < 50 |
| Salary backed by peer comparator | `salary/comp/$N` near `BLS/prevailing wage/percentile/comparator`, **with negation awareness** |
| Adequate recommender count | 4 or fewer references → flagged |
| Recommender independence | Co-author / shared-lab language near recommender names |
| Judging evidence is recent | Most recent dated activity within 5 years |
| Meaningful publication record | Quantitative publication claim of ≥ 3 |

Plus two **OpenAlex** cross-checks (real external data):

- **Citation count verified on OpenAlex** — compares claimed vs actual,
  flags inflated or under-reported figures
- **Recommender independence verified on OpenAlex** — fuzz-matches extracted
  recommender names against the petitioner's OpenAlex co-author set

Both pass/fail outcomes are surfaced in a "**What Pulse looked for**" panel —
a passing petition has positive evidence, not just absence of complaints.

## Multi-file petitions

Petitions can include the brief plus supporting exhibits in one upload:

- Browser uploads each file in parallel (presigned PUTs to MinIO)
- API validates **every** file (size, magic byte, virus scan)
- Worker extracts each independently (pdf-parse → OCR fallback if needed)
- Per-file stats persisted: page count, char count, OCR usage
- All files concatenated with `=== BRIEF ===` / `=== EXHIBIT ===` section
  markers; the merged corpus is what the LLM sees
- If the brief fails to parse, the whole analysis fails. Exhibits that fail
  are noted but don't block.

The dashboard shows "+N exhibits" next to the brief filename, with an
expandable file list including each file's role, page count, and whether OCR
was used.

## Soft delete + cancellation

- **Petitions** can be withdrawn at any time. Any queued/running analyses for
  that petition are marked `cancelled`; queued BullMQ jobs are removed
  immediately. The petition is hidden from lists but kept in storage for audit.
- **Receipts** can be removed. The worker checks `deletedAt` at the start of
  each scrape and quietly skips withdrawn receipts.

## Persistence guarantees

Every long-running operation has a durable handle:

- `POST /petitions` returns `{petition._id, analysisId}` — the analysis ID is
  the client's reference for the running review
- `POST /receipts` returns `{receipt._id}` — the receipt's status events,
  predictions, and history all key off this
- The case detail URL (`/app/cases/[id]`) is the user's durable bookmark — they
  can close any tab and come back any time; SSE auto-reconnects to live
  analyses; the dashboard auto-refreshes every 10 s while in-flight work exists

## Known limitations

- **No real email/SMS alerts** — stuck-case warnings surface in the UI only
- **No payments, no team collaboration, no multi-user** — single-tenant
- **USCIS API access requires manual approval** at <https://developer.uscis.gov/>.
  Sandbox credentials can be configured in the Settings page (Client ID + Client Secret).
  Without credentials, Pulse skips Tier 1 and goes straight to HTML scraping → mock.
  Only sandbox staging receipt numbers are supported. Note that the USCIS Developer Hub Sandbox API is only online during normal business hours (Monday–Friday, 7:00 AM – 8:00 PM EST); requests outside these hours return an HTTP 503 Service Unavailable, causing the app to fall back to Tier 2/3 (mock/fixtures).
- **Live HTML scraper** 403s most of the time from cloud IPs; mock fallback
  is the realistic path when running unauthenticated outside a residential network.
- **Processing-times endpoint** is undocumented; the worker falls back to a
  checked-in snapshot

## Dashboard stats

The two tool cards on `/app` summarize the entire userspace:

| Card | Stats shown |
|---|---|
| **Petition risk review** | `petitions uploaded` · `reviews complete` (green when > 0) · `in progress` (purple + spinner, only when > 0) · `failed` (red, only when > 0) |
| **USCIS case tracking** | `receipts tracked` · `cases taking longer than usual` (red, only when > 0) · `awaiting first sync` (purple + spinner, only when > 0) |

"Uploaded" and "reviewed" are distinct numbers — uploaded counts every
non-deleted petition; reviewed counts done analyses only.

When in-flight work exists, a `<DashboardAutoRefresh>` pill in the header
calls `router.refresh()` every 10 s (via `queueMicrotask` so React doesn't
complain about updates during render) until everything settles.

## Demo script

1. `docker compose exec api npm run seed` — seeds two applicants + one real
   petition for Ms. Lin (uploaded to MinIO, analysis queued)
2. Open <http://localhost:3000> — landing page with the rotating hero carousel
3. Click **Open dashboard** — see the tool cards already reading
   `1 petition uploaded · 1 in progress · 2 receipts tracked`
4. Click into **Ms. Lin — EB-1A**:
   - **Petition review** tab — watch the worker stream progress per file
   - **Case tracking** tab — see `EAC2490012345` with the stuck banner
5. After the review completes (~2–3 min on a cold local LLM, ~30 s on a hosted
   one), inspect:
   - Animated 0–100 risk gauge
   - "Where your petition stands" — per-criterion strength bars
   - "Things to fix before filing" — ranked weaknesses with concrete fixes
   - "What Pulse looked for" — all heuristic + OpenAlex checks, pass & fail
   - Download the formatted **PDF report** from the icon next to the status pill
6. Visit `/app/settings` — switch the LLM provider, test the connection,
   configure USCIS sandbox credentials, set OpenAlex API key,
   re-run an analysis against a different model
7. Click the **list-checks icon** in the header (next to the gear) to open
   **Bull Board** at `/admin/queues` — inspect every queue, retry failed jobs,
   see cron schedules
8. Anytime: `npm run reseed` from the host to wipe and re-seed with a fresh
   in-flight analysis
