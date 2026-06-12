# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Lean Kitchen Management System V3** (精益厨房 V3) — A Next.js-based kitchen operations management system for small-to-medium restaurants. Manages dish recipes (BOM), production schedules, purchasing, and inventory.

## Common Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server on http://localhost:3000 |
| `npm run build` | Production build (runs `prisma generate && next build`) |
| `npm run start` | Start production server (requires build first) |
| `npm run lint` | Run ESLint |
| `npx prisma db push` | Push schema changes to PostgreSQL |
| `npx prisma db seed` | Run seed script (`prisma/seed.ts`) |
| `npx prisma generate` | Regenerate Prisma Client |

**Note:** There is currently no test framework configured.

## Architecture

### Stack
- **Framework:** Next.js 16 (App Router), React 19, TypeScript 5
- **Database:** PostgreSQL via Prisma 7 with `@prisma/adapter-pg`
- **Styling:** Tailwind CSS v4 + shadcn/ui (`style: base-rhea`)
- **Auth:** JWT (jose, HS256) in httpOnly cookies
- **AI/OCR:** OpenAI SDK → Alibaba Qwen for receipt recognition
- **Icons:** lucide-react
- **Toast notifications:** sonner

### Key Directories

```
app/                  # Next.js App Router
  (routes)/           # Page routes (schedules, dishes, inventory, etc.)
  api/                # API routes (REST, no tRPC)
  components/         # Shared client components (sidebar, wizard, etc.)
  lib/                # Client-side utilities (csv.ts, schedule-utils.ts)
lib/                  # Server-side utilities (prisma, auth, session, ai)
components/ui/        # shadcn/ui components
prisma/               # Schema + seed
```

### Domain Model (Big Picture)

The system centers on a **3-layer ingredient hierarchy** that drives cost calculation and procurement:

```
Ingredient (原料) → NetIngredient (净料) → Dish (菜品)
                        ↑                      ↑
                   yieldRate              BOM details
```

- **Ingredient**: Raw goods purchased from suppliers (e.g., whole chicken)
- **NetIngredient**: Processed/prepped ingredient with a `yieldRate` (e.g., deboned chicken at 65% yield)
- **Dish**: Composed of NetIngredients (主料/辅料), MinorIngredients (小料), SeasoningIngredients (调料), and SauceIngredients (酱料), plus `DishProcess` steps

**Schedule (排程)** is the operational core:
1. User creates a `Schedule` with dishes and quantities
2. `buildCuttingOrders()` in `app/lib/schedule-utils.ts` aggregates net/minor ingredients by category
3. `buildPurchasePlans()` calculates gross needs using yield rates, subtracts current inventory, and generates `PurchasePlan` rows
4. `CuttingOrder` and `PurchasePlan` are auto-created in a Prisma `$transaction`

**Purchase Flow:**
- `PurchaseReceipt` + `PurchaseReceiptItem` records actual deliveries
- AI recognition (`lib/ai.ts`) parses receipt images via Qwen and auto-matches to ingredient catalog
- Receipts with `status = "completed"` are protected from deletion
- `PurchaseReimbursement` groups multiple receipts for settlement

**Inventory:**
- `Inventory` tracks current qty per ingredient
- `InventoryLedger` is an immutable transaction log (入库/出库)
- No manual adjustment UI yet; stock changes only via purchase receipt auto-inbound

## Auth & Middleware

Auth is custom JWT (not NextAuth). See `middleware.ts` and `lib/session.ts`:

- **Middleware** (`middleware.ts`) verifies the `session` cookie on all routes except `/login` and `/api/auth/*`
- For API routes, it injects `x-user-id` and `x-username` headers instead of redirecting
- **Server actions/components** use `getCurrentUser()` from `lib/session.ts`
- **API routes** use `getUserFromRequest(req)` from `lib/api-auth.ts` to read the injected headers
- Operation logs (`OperationLog` model) are written via `logOperation()` helpers

**Warning:** `SESSION_SECRET` has a hardcoded fallback in `lib/session.ts`. Production must set the env var.

## Key Code Patterns

### Prisma Usage
`lib/prisma.ts` uses the new Prisma v5+ `PrismaPg` adapter pattern. The client is global-singleton cached in development.

### API Route Pattern
Most API routes follow this structure:
```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation, getUserFromRequest } from "@/lib/api-auth";

export async function GET(req: NextRequest) { /* ... */ }
export async function POST(req: NextRequest) { /* ... */ }
```

- Prisma `where` clauses often use `const where: any = {}` due to dynamic filters. This is a known tech debt item.
- There is **no input validation layer** (no zod). All POST bodies are used directly after minimal manual checks.

### Client Components
Many pages are `"use client"` and fetch data via `fetch()` to their corresponding `/api/*` endpoints rather than using Server Components. Shared components live in `app/components/`.

### Dish Creation Wizard
`app/components/dish-create-wizard.tsx` is a multi-step Dialog (not a page) that manages BOM state locally and submits to:
1. `POST /api/dishes` (create base info)
2. `PUT /api/dishes/[id]/bom` (save BOM)
3. `PUT /api/dishes/[id]/processes` (save processes)

### Schedule Utils
`app/lib/schedule-utils.ts` (~430 lines) contains the core business logic for BOM explosion. It is called inside Prisma `$transaction` during schedule creation. **Do not modify lightly** — it handles yield rate math, inventory deduction logic, and unit conversions.

### CSV Handling
`app/lib/csv.ts` provides custom CSV parse/build/download utilities. Used for bulk ingredient import (`/api/ingredients/import`).

## Styling Conventions

- Tailwind v4 with `@import "tailwindcss"` syntax in `app/globals.css`
- Theme uses oklch color values and CSS variables
- Custom focus style: blue ring (`#007AFF`) on inputs (Apple-style)
- shadcn/ui components use `base-rhea` style variant
- Font stack: DM Sans (body), Public Sans (headings), Geist (mono)
- Layout: fixed 80px sidebar on left, main content offset with `ml-20`

## Important Notes

- **Next.js breaking changes:** This is Next.js 16 with React 19. APIs and conventions may differ from older versions. Read `node_modules/next/dist/docs/` when unsure. See `AGENTS.md`.
- **Dish status lifecycle:** `draft` → `pending` → `published`. The wizard allows saving as `draft` at any step or `published` only after validation passes.
- **Code generation bugs known:** `generateDishCode` in `app/api/dishes/route.ts` has a template string bug that needs fixing.
- **No tests:** The project has zero test coverage. Any test framework addition would be new infrastructure.
- **Deployment:** `next.config.ts` sets `output: "standalone"`. Build requires `DATABASE_URL` env var.
