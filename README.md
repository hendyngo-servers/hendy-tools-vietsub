# Hendy Tools Vietsub v2.1.0

Hendy Tools Vietsub combines a static browser subtitle editor with an optional Node.js/FFmpeg backend. The UI can edit subtitles locally; translation and permanent video rendering use the backend.

## Features

- Import SRT and WebVTT; edit source text, Vietsub text, and timestamps.
- Search/filter cues, undo/redo, local draft storage, and local video preview.
- Export SRT, WebVTT, bilingual SRT, and JSON.
- Translate untranslated cues through the backend proxy to a configured LibreTranslate-compatible service.
- Burn subtitles into a new MP4 using FFmpeg. The source video is not modified.
- GitHub Pages frontend and Render Blueprint/Docker backend.

## Frontend

Open \`index.html\` or serve the repository with a local static server (for example, \`python -m http.server 8080\`). In the UI, enter the base URL of the deployed API, such as \`https://your-service.onrender.com\` (do not append \`/api/translate\`).

## Backend deployment on Render

1. Open the repository in Render and create a Blueprint from \`render.yaml\`, or create a Docker web service from this repository with the root \`Dockerfile\`.
2. Keep \`ALLOWED_ORIGINS\` set to the exact frontend origin, e.g. \`https://hendyngo-servers.github.io\`. Add any local development origin as a comma-separated value.
3. Configure \`LIBRETRANSLATE_URL\` as the full translation endpoint URL (including \`/translate\`) and \`LIBRETRANSLATE_API_KEY\` if your translation provider requires one. These belong in Render environment variables, never in frontend code or Git.
4. Deploy, open \`https://your-service.onrender.com/health\`, and confirm it returns \`ok: true\`. \`translationConfigured\` is true only when the translation URL is set.
5. Enter the Render service base URL in the app. Subtitle drafts remain in the user's browser; the backend does not use a persistent database.

The Blueprint defaults to the Render Free plan to avoid unexpected costs. Free services can sleep and have limited compute; FFmpeg exports may be slow or time out. Upgrade only after reviewing Render pricing and service limits. The API Docker image installs FFmpeg and DejaVu fonts.

## API endpoints

- \`GET /health\`: health status and configured capabilities.
- \`POST /api/translate\`: JSON \`{ "q": "Text to translate", "source": "auto", "target": "vi", "format": "text" }\`; returns \`{ "translatedText": "..." }\`. Provider URL/API key are server-side.
- \`POST /api/render\`: multipart form containing \`video\` (MP4/MOV/MKV/WEBM/M4V), \`subtitleSrt\` (SRT text), and optional \`fontSize\`. Returns an MP4 with hard-burned subtitles.

## Default operational limits

- Video upload up to 200 MB and 10 minutes.
- Maximum FFmpeg processing window of four minutes.
- Three render requests per IP per 15 minutes; translation calls are rate-limited.
- Rendered results and uploaded source files are temporary and removed after the response. Do not use this single-instance temporary workflow as a durable rendering queue for large-scale production.

## Tests

Run \`npm test\` with Node.js 22 or newer. The test suite checks inline UI script syntax and backend source syntax/feature markers; it does not replace an end-to-end Render/FFmpeg deployment test.

## Security and privacy

The backend uses environment variables for translation credentials. Avoid putting keys in browser code or committing them to Git. Uploaded videos and subtitle files are processed temporarily and then removed; do not upload private media unless you trust the hosting service. Configure \`ALLOWED_ORIGINS\` narrowly. Public deployment remains subject to provider limits and abuse risk; rate limits are basic safeguards, not user authentication.
