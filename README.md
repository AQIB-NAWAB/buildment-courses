# Buildment Courses

Course-aligned project variants built from the Buildment course materials.

Each numbered folder is a **self-contained project variant** with its own source, dependencies, environment examples, tests, docs, and deployment artifacts.

## Variants

| Folder | Course | Stack | Status |
|---|---|---|---|
| [`01-food-marketplace/`](01-food-marketplace/) | FreshMarket — Multi-Vendor Grocery Marketplace | MongoDB · Express · React (Vite) · Node.js · Redis · BullMQ · Cloudinary · Stripe | Complete, with a minimal platform-owner extension |

## Structure

```
buildment-courses/
├── 01-food-marketplace/       # FreshMarket variant
│   ├── server/                # Express + Mongo + Redis + BullMQ
│   ├── client/                # React + Vite
│   ├── docs/                  # ERD, API, auth matrix, architecture, demo
│   ├── docker-compose.yml     # Mongo replica set + Redis
│   └── README.md              # setup, flows, scripts, deferred scope
├── .github/workflows/         # CI for the marketplace variant
├── .gitignore
└── README.md
```

## Run a variant

```bash
cd 01-food-marketplace
npm install --include=dev
cp server/.env.example server/.env
cp client/.env.example client/.env
# fill JWT secrets, Stripe test keys, and Cloudinary credentials
npm run services:up
npm run db:init
npm run seed
npm run dev
# separate terminal
npm run worker
```

Full setup, architecture, API, demo script, and deferred scope are in [`01-food-marketplace/README.md`](01-food-marketplace/README.md) and [`01-food-marketplace/docs/`](01-food-marketplace/docs/).

## Source material

The project requirements come from the FreshMarket course under the Buildment LMS:

`Buildment/content/import/multi-vendor-marketplace/`

The LMS application code and secrets are not part of this repository. Course variants are independent implementations.

## Secrets

Never commit `.env` files. Each variant commits only `.env.example` placeholders. Real Stripe, Cloudinary, database, and JWT values belong in the untracked local `.env` files or the deployment platform's secret store.
