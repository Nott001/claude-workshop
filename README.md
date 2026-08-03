# Live events platform

A role-based live events platform for hosting interactive sessions with assigned speakers, course-style lesson/resources, real-time session rooms, attendee Q&A, and facilitator tools for managing events and attendance via an on-site kiosk.

## Getting Started

! This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

First, run the development server:

```bashv
pnpm dev
```

## Deployment

The app deploys to Cloudflare Workers. Merging to `main` deploys it, once CI,
Security and E2E are green on that commit. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
for the required configuration, local Worker preview, and rollback.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
