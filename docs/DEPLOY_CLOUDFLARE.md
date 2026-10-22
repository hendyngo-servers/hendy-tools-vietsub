# Cloudflare Workers deployment — v2.2.1

This repository uses two separate runtime components:

- Cloudflare Workers serves the sanitized static frontend from dist/. The package.json postinstall script runs scripts/build-static.cjs during the `bun install` stage in Cloudflare Workers Builds, creating dist/ before the configured deploy command runs. The dist/ directory contains only approved frontend files, so Cloudflare's direct "npx wrangler deploy" command works without a separate dashboard build command.
- Argos translation, Whisper speech recognition and FFmpeg rendering run in the separate Docker backend. A static Worker does not run those Python/media tools.

## A. Create the two repository secrets

### 1. Create a scoped Cloudflare API token

1. Open Cloudflare Dashboard → Manage Account → API Tokens.
2. Select Create Token and use the Edit Cloudflare Workers template, following Cloudflare's official GitHub Actions guide: https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/
3. Restrict the token's resource scope to the account that will host this Worker.
4. Create the token and copy its value immediately. Do not commit it, paste it into an issue/chat, or put it in a source file.

### 2. Find the Cloudflare Account ID

Open Workers & Pages in the intended Cloudflare account and copy that account's Account ID. Do not use a Zone ID or the API token.

### 3. Add GitHub repository secrets

Open https://github.com/hendyngo-servers/hendy-tools-vietsub/settings/secrets/actions, select New repository secret, and add these exact names:

| Secret name | Value |
|---|---|
| CLOUDFLARE_API_TOKEN | The Cloudflare API token created above |
| CLOUDFLARE_ACCOUNT_ID | The intended Cloudflare Account ID |

Do not add quotes, JSON wrappers, URLs or whitespace around the values. Never store these credentials in wrangler.jsonc, render.yaml, committed .env files or application source code.

GitHub instructions: https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets

## B. Deploy directly from Cloudflare Workers Builds

The repository now supports the build configuration shown in the reported error log:

- Build command: leave empty (or use the project's normal dependency-install step, if the dashboard requires one).
- Deploy command: npx wrangler deploy.
- Wrangler assets directory: "./dist".
- The build script copies only index.html, manifest.webmanifest, sw.js, version.json, assets/** and src/** into dist/. Backend code and repository config are not part of the published bundle.

After pulling the latest commit, run a fresh deployment. The previous error pointed to /opt/buildhome/repo/dist because Wrangler tried to deploy before the directory had been generated. The postinstall hook now creates dist/ during the bun install step before the direct Wrangler deploy command runs.

## C. Deploy from GitHub Actions instead

Once both secrets have been added:

1. Open https://github.com/hendyngo-servers/hendy-tools-vietsub/actions/workflows/cloudflare.yml
2. Select Deploy static site to Cloudflare Workers.
3. Click Run workflow and choose main.

This workflow runs the test suite, executes wrangler deploy --dry-run to validate the configuration and assets, then executes the real deploy only if both secrets exist. Adding secrets does not automatically rerun an earlier failed/skipped deployment.

## D. Verify the result

In the build log, confirm that Wrangler no longer reports that the assets directory is missing. For a real deployment, confirm the deploy step actually ran and completed successfully; a green workflow where deployment is skipped is not a live deployment.

Use the URL printed by Wrangler and test:
- / should show the Hendy VietSub interface.
- /version.json should report version 2.2.1 and staticOnly: true.

The workers.dev hostname depends on the Cloudflare account's configured subdomain. Use the URL printed in the deploy log rather than guessing it.

## E. Runtime limitations

Cloudflare Worker serves the web interface but does not run the Python translation models, Whisper or FFmpeg. To enable those functions, deploy the Docker backend from render.yaml or run docker compose up --build -d on a machine with Docker, then configure the backend URL in the frontend. Test both the static site and backend, including a short real video end-to-end, before announcing the full platform as operational.
