# Cloudflare Workers deployment — v2.2.1

This repository has two separate runtime components:

- Cloudflare Workers serves the **static frontend** from \`dist/\`.
- Translation models (Argos), speech recognition (Whisper) and FFmpeg rendering run in the Docker backend. A static Worker cannot run those Python/media tools.

## A. Create the two repository secrets

### 1. Create a scoped Cloudflare API token

1. Open Cloudflare Dashboard → **Manage Account → API Tokens** (or the API Tokens page from the account dashboard).
2. Select **Create Token** and use the **Edit Cloudflare Workers** template, as described in Cloudflare's [official GitHub Actions guide](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/).
3. Restrict the resource scope to the single Cloudflare account that will host this Worker.
4. Create the token and copy its value immediately. Cloudflare only displays the token secret at creation; do not commit it, paste it into an issue/chat, or put it into a source file.

Official docs: https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/

### 2. Find the Cloudflare Account ID

Open **Workers & Pages** in the intended Cloudflare account. Copy that account's Account ID from the dashboard/account details. Do not use a Zone ID or an API token in this field.

### 3. Add GitHub repository secrets

Open the repository's [Actions secrets page](https://github.com/hendyngo-servers/hendy-tools-vietsub/settings/secrets/actions), select **New repository secret**, and add the following exact names:

| Secret name | Value |
|---|---|
| \`CLOUDFLARE_API_TOKEN\` | The newly created Cloudflare API token |
| \`CLOUDFLARE_ACCOUNT_ID\` | The intended Cloudflare Account ID |

Do not add \`https://\`, quotes, JSON wrappers, or spaces around the values. Never store these values in \`wrangler.jsonc\`, \`render.yaml\`, \`.env\` committed to Git, or source code.

GitHub instructions: https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets

## B. Trigger a real deployment

Adding Secrets does **not** start a workflow automatically. Once both secrets have been added:

1. Open [GitHub Actions](https://github.com/hendyngo-servers/hendy-tools-vietsub/actions/workflows/cloudflare.yml).
2. Select **Deploy static site to Cloudflare Workers**.
3. Click **Run workflow**, choose \`main\`, then start it.

Alternatively, a new push changing a watched frontend/configuration file will trigger the workflow. It will run \`npm run check\`, build \`dist/\` and then run \`wrangler deploy\`.

## C. Verify the result

In the workflow log, confirm that the **Deploy to Cloudflare Workers static assets** step actually ran and completed successfully. A green workflow whose deploy step says **skipped** does not mean Cloudflare was deployed; it means the credentials were missing when the run started.

Use the URL printed by Wrangler to open the deployed Worker. Check these paths:

- \`/\` — should return the Hendy VietSub interface.
- \`/version.json\` — should show version \`2.2.1\` and \`staticOnly: true\`.

The Worker name is \`hendy-tools-vietsub\`; its default \`workers.dev\` hostname depends on the Cloudflare account's configured subdomain. Use the URL printed by the deployment log rather than guessing the hostname.

## D. Understand which functions are online

The Cloudflare Worker in this repository is a static-assets host. It does **not** host Python, install Argos/Whisper models, or execute FFmpeg. To use the integrated translation/transcription/rendering tools, also deploy the Docker backend from \`render.yaml\` or run \`docker compose up --build -d\` on a machine where Docker is available, then enter that backend URL in the UI.

For a production release, test the static site and the backend independently, then test a real short video end-to-end before announcing the full VietSub platform as operational.
