# Buildment Courses

Course-aligned project variants built from the Buildment course materials.

The repository is grouped by **course**, and each course folder contains its **variants**. Each variant is a self-contained project with its own source, dependencies, environment examples, tests, docs, and deployment artifacts.

```text
buildment-courses/
└── multi-vendor-course/
    └── 01-food-marketplace/
```

## Courses and variants

| Course | Variant folder | Project | Stack | Status |
|---|---|---|---|---|
| Multi-Vendor Marketplace | [`multi-vendor-course/01-food-marketplace/`](multi-vendor-course/01-food-marketplace/) | FreshMarket — Multi-Vendor Grocery Marketplace | MongoDB · Express · React (Vite) · Node.js · Redis · BullMQ · Cloudinary · Stripe | Complete, with a minimal platform-owner extension |

## Repository layout

```text
buildment-courses/
├── multi-vendor-course/
│   └── 01-food-marketplace/
│       ├── server/                # Express + Mongo + Redis + BullMQ
│       ├── client/                # React + Vite
│       ├── docs/                  # ERD, API, auth matrix, architecture, demo
│       ├── docker-compose.yml     # Mongo replica set + Redis
│       └── README.md              # setup, flows, scripts, deferred scope
├── .github/workflows/             # CI for the multi-vendor food-marketplace variant
├── .gitignore
└── README.md
```

## Run the food-marketplace variant

```bash
cd multi-vendor-course/01-food-marketplace
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

Full setup, architecture, API, demo script, and deferred scope are in [`multi-vendor-course/01-food-marketplace/README.md`](multi-vendor-course/01-food-marketplace/README.md) and [`multi-vendor-course/01-food-marketplace/docs/`](multi-vendor-course/01-food-marketplace/docs/).

## Source material

The requirements come from the FreshMarket course under the Buildment LMS:

`Buildment/content/import/multi-vendor-marketplace/`

The LMS application code and secrets are not part of this repository. Course variants are independent implementations.

## Secrets

Never commit `.env` files. Each variant commits only `.env.example` placeholders. Real Stripe, Cloudinary, database, and JWT values belong in the untracked local `.env` files or the deployment platform's secret store.

## Adding future variants

Add them beside the existing variant inside the course folder, for example:

```text
multi-vendor-course/
├── 01-food-marketplace/
└── 02-<next-variant>/
```

Extend the CI workflow's `paths` filters and `working-directory` (or convert it to a matrix) when a second variant is added.
