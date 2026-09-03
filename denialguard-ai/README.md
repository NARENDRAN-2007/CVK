# DenialGuard AI

DenialGuard AI is a worklist-first revenue cycle management workspace for billing specialists, denial analysts, and RCM leads. The frontend prototype is populated with de-identified sample claim data so the product workflow can be evaluated without connecting a clearinghouse or sending PHI.

## What is included

The application is organized around the daily denial lifecycle: triage in the prioritized worklist, inspect the complete claim record, predict pre-submission risk, prepare appeals, reference payer rules, and understand root causes in analytics. It includes the following routes:

| Route | Purpose |
| --- | --- |
| `/` and `/worklist` | Prioritized denial queue with payer, CARC/RARC, aging, deadline, assignment, search, filters, selection, and bulk actions |
| `/dashboard` | Portfolio KPIs, denial-rate trend, CARC distribution, and deadlines this week |
| `/predict` | Pre-submission risk check with likely CARC code, contributing factors, and suggested fix |
| `/claims` | Full claims log with status filtering and search |
| `/claims/:id` | Claim detail with denial summary, lifecycle stepper, ownership, notes, and next best action |
| `/appeals` | Deadline-aware appeal pipeline grouped by drafting, submitted, awaiting response, and resolved |
| `/payers` | Timely filing, authorization, appeal SLA, and submission method reference library |
| `/analytics` | Payer comparison, root-cause analysis, revenue recovery, and service-line focus |
| `/settings` | Team roles and notification preferences |
| `/login` | Clinical/administrative sign-in experience |

## Design system

The UI follows the DenialGuard specification: Fraunces is reserved for page titles and load-bearing numbers, while Inter handles UI copy and tables. The palette uses deep slate headings, muted blue primary actions, mint approved states, gold pending states, desaturated coral denials, and violet appeals. Glass treatment is limited to the sidebar, top navigation, and login shell; record-review surfaces remain solid for legibility. Dollar amounts, dates, percentages, claim IDs, risk scores, and aging values use tabular numerals.

## Local development

This project uses the Manus WebDev full-stack scaffold: Vite + React + TypeScript + Tailwind CSS on the client, with Express, tRPC, Drizzle, MySQL/TiDB, S3 helpers, and Manus OAuth available on the server.

```bash
pnpm install
cp .env.local.example .env.local
pnpm dev
```

Useful commands:

```bash
pnpm check   # TypeScript validation
pnpm build   # Client and server production build
pnpm test    # Vitest suite
pnpm format  # Prettier
```

The current screens use local typed fixtures in `client/src/pages/Home.tsx` so the visual review is deterministic. When a clearinghouse or internal API is connected, the fixture arrays can be replaced by typed tRPC procedures in `server/routers.ts` and query helpers in `server/db.ts`; no PHI should be placed in list views.

## Domain reference

The prototype hardcodes the core denial vocabulary used in the brief, including CO-50 (medical necessity), CO-197 (prior authorization required), CO-29 (timely filing limit exceeded), CO-204 (service not covered), CO-16 (missing required information), CO-18 (duplicate claim/service), CO-11 (diagnosis inconsistent with procedure), and PR-1 (deductible amount). Always validate live payer rules and member-specific contracts before submitting an appeal.
