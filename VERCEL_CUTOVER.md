# Vercel Cutover Runbook

This repo now has two surfaces:

- `web/` is the old demo and stays live until the final alias switch.
- `app/` is the new Next.js product and is the target for Vercel production.

This document is the P9c handoff for turning the local-first `app/` build into a production deployment.

## What To Deploy

Deploy the Next app from `app/` only.

The root workspace is still the control plane for docs and scripts, but the live product lives in:

- `app/package.json`
- `app/next.config.ts`
- `app/src/`

The app is local-first and Dexie-backed, so there is no server database to migrate during cutover.

## Vercel Project Setup

Use a single Vercel project with:

- Root Directory: `app`
- Build Command: `npm run build`
- Development Command: `npm run dev`
- Install Command: default for the selected package manager

Do not point production at `web/`. That folder is the legacy demo and should remain untouched until the cutover is complete.

## Required Environment Variables

Set these in Vercel before the first production deploy:

- `TAVILY_API_KEY` for the `/api/web-search` fallback route

Keep browser-side BYOK keys out of Vercel. Provider keys that are entered in the UI stay in the user browser and are not part of the deployment secret set.

## Cutover Steps

1. Confirm the app builds cleanly in `app/`.
2. Create or update the Vercel project so the root directory is `app`.
3. Add the production environment variables.
4. Deploy a preview build and verify the app opens.
5. Smoke test the core paths:
   - new analysis creation
   - save/load persistence
   - backup export/import
   - portfolio composition
   - web-search fallback if the key is present
6. Move the production domain or alias from the legacy demo to the new Vercel deployment.
7. Keep the old `web/` deployment available as rollback until the new production alias is stable.

## Rollback Plan

If the cutover exposes a problem, point the production alias back to the legacy demo and leave the new deployment in preview.

Because the app is local-first, rollback does not require database migration or data replay on the server side.

## Post-Cutover Checks

- Open the production URL in a clean browser profile.
- Verify a new analysis can be created and persisted.
- Verify backup export produces a file and import accepts it.
- Verify the app still behaves correctly without any browser-stored provider key.
- Confirm the legacy demo is no longer the production target.

