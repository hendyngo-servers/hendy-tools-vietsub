# Security notes

- API keys are held in the current page only; do not paste privileged long-lived keys into browser applications.
- The client sends subtitle text only after the user explicitly starts an API action. Video files are never included in translation requests.
- Only configure endpoints you trust. Cross-origin requests depend on the selected server's CORS policy.
- Draft subtitle text is saved in the browser's localStorage. Use the export function for backups and avoid storing sensitive material in shared browser profiles.
- Report a suspected security issue privately to the repository maintainer rather than posting secrets in a public issue.
