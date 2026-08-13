# Live events platform

A role-based live events platform for hosting interactive sessions with assigned speakers, course-style lesson/resources, real-time session rooms, attendee Q&A, and facilitator tools for managing events and attendance via an on-site kiosk.

## Getting Started

! This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

First, start the local Supabase stack and the development server:

```bash
pnpm db:start
pnpm dev
```

The first boot also needs a schema/seed reset and pointing `.env.local` at the
local stack — see [docs/LOCAL_DB.md](docs/LOCAL_DB.md) for the full sequence,
seeded logins, and remote configuration.

## Deployment

The app deploys to Cloudflare Workers. Merging to `main` deploys it, once CI,
Security and E2E are green on that commit. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
for the required configuration, local Worker preview, and rollback.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
