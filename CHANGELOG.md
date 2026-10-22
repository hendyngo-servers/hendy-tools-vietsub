# Changelog

## 2.2.2 — 2026-10-22

- Clear legacy localhost backend URLs when opening the editor on a public domain.
- Show actionable diagnostics for localhost, mixed-content HTTP and cross-origin CORS failures.
- Update backend default CORS and Render Blueprint to allow the deployed Cloudflare Workers origin.
- Bump the PWA shell cache so browsers download the fixed app code instead of reusing the previous cached JavaScript.

## 2.2.2 — 2026-10-22

- Add deterministic scripts/build-static.cjs output in dist/; public workflows deploy only the frontend allowlist.
- Add optional Cloudflare Workers static deployment with credential checks and a tag-driven GitHub Release workflow.
- Correct Argos model download host and align package filenames and UI language choices with models actually bundled.
- Verify model downloads and Whisper model presence during Docker image build.
- Make /health return a failing status until the offline translation worker is ready; wait for readiness before starting the frontend in Docker Compose.
- Document GitHub Pages, Cloudflare, Render and Windows Docker publication paths; clarify that static hosting does not run the AI/media backend.

## 2.2.0 — 2026-10-22

- Integrate offline Argos Translate, Whisper tiny and FFmpeg endpoints for batch translation, speech recognition and hard-subtitle MP4 rendering.
- Add Docker image, Docker Compose and Render Blueprint for self-hosted offline model execution.
- Remove the browser-based third-party API-key field from the offline UI.
- Add basic offline backend health checks and upload limits.
