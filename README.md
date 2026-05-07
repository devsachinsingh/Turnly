# Turnly — Who's Paying Next?

A fair payment turn manager for groups. Create a group, share the code, and Turnly tracks whose turn it is to pay — across all devices.

## Stack

- **Next.js 16** (App Router)
- **Neon Postgres** + **Drizzle ORM**
- **Auth.js v5** — magic link via **Resend**
- **Tailwind CSS** + **shadcn/ui**
- **Vercel** deployment

## Local Development

1. Clone the repo
2. Install dependencies: `pnpm install`
3. Create a Neon database at [console.neon.tech](https://console.neon.tech)
4. Create a Resend account at [resend.com](https://resend.com) and get an API key
5. Copy `.env.local.example` to `.env.local` and fill in the values
6. Push the schema to your database: `pnpm db:push`
7. Start the dev server: `pnpm dev`

## Deployment (Vercel)

1. Connect your GitHub repo to Vercel
2. Add environment variables in the Vercel dashboard (same as `.env.local` but with production values — set `AUTH_URL` to your Vercel domain)
3. Deploy

## Running Tests

```bash
pnpm test
```
