# Inquiry Canvas

A branching workspace for intellectual inquiry: choose a framing before answering, preserve paths not taken, trace concepts across answers, and turn unresolved tensions into new branches.

[Open Inquiry Canvas](https://mjsilverman19.github.io/inquiry-canvas/)

## Use

Ask a question, select a framing or synthesize all, and inspect the resulting answer. Every framing remains attached to its question, so you can return and take another path. Fork an answer, open a tension as a branch, or compare a conceptual thread across answers.

The interface uses system typography, monochrome light/dark themes, thin rules, and text controls, following the Book Critic Data explorer. Each branch inherits only its ancestor context, capped at the most recent 10,000 characters. A concept synthesis explicitly includes the selected thread's answers in its question.

## Hosted AI

The interface stays on GitHub Pages. `/api/inquiry` runs as a Vercel Function and calls Claude through Vercel AI Gateway. There is no browser model, GPU requirement, or model download. Visitors do not provide a model-provider API key. The backend authenticates with Vercel OIDC, or an optional server-side `AI_GATEWAY_API_KEY`.

Open **AI settings**, enter the backend URL and the access code supplied by the owner, then select **Connect hosted AI**. The code is stored in session storage for this tab session, separate from the inquiry and exports. It can be cleared with **Disconnect**. The endpoint URL is remembered in local storage. Owner AI credentials are never included in the static build or browser responses.

Questions and ancestor context are sent to the hosted model. Answers have no live web search or verified citations. API usage consumes the owner's AI Gateway credits or budget. Connection checks do not run inference. Each question uses one framing request followed by one answer request; the answer includes concepts, tensions, and next questions. There are no background inference calls.

Without a configured backend, the manual canvas and example remain usable. Questions and answers can be written by hand.

## Backend deployment

Import this repository into a Vercel project. Set the project Root Directory to `backend`. `backend/vercel.json` builds only the backend landing page and the `/api/inquiry` function; it does not replace the GitHub Pages interface.

Set these **server-side** environment variables in Vercel:

| Variable | Value |
|---|---|
| `INQUIRY_ACCESS_CODE` | A random private access code of at least 16 characters; share only with intended users |
| `INQUIRY_RATE_LIMIT_ID` | `inquiry-ai`, matching the firewall rule below |
| `INQUIRY_ALLOWED_ORIGINS` | Defaults to `https://mjsilverman19.github.io`; comma-separated exact origins if additional sites are needed |
| `INQUIRY_MODEL` | Optional; defaults to `anthropic/claude-sonnet-5.5` |
| `AI_GATEWAY_API_KEY` | Optional server-only fallback when OIDC is unavailable; never use a `VITE_` prefix |

Enable Vercel OIDC for the project and ensure AI Gateway is enabled and has credits. In the project's **Firewall**, create an `@vercel/firewall` rule with rate-limit ID `inquiry-ai`. For a small personal test, start with a fixed window of 60 seconds and a limit of 10 requests, using the default 429 action. Save and publish the rule. The SDK uses a constant shared key so the limit applies to the shared access pool in each region. Counters are regional, and this is not a global dollar spending cap. Set an AI Gateway project budget as the additional spending control; do not enable automatic credit purchases without a budget you intend to fund.

The function refuses inference if access control is absent, the rate-limit rule is missing, or the limit check fails. It accepts only fixed inquiry operations, limits request body and field lengths, caps output tokens, fixes the upstream URL, and takes the model only from server configuration. CORS restricts browser callers to allowed origins, while the access code protects non-browser access too. Provider error details and credentials are not forwarded.

Production deployment protection must allow requests from GitHub Pages to this API. Keep the function's own access-code protection in place. Redeploy after changing server environment variables.

After deployment, set the public backend URL in GitHub **Settings → Secrets and variables → Actions → Variables** as `INQUIRY_API_URL`, for example `https://your-project.vercel.app/api/inquiry`, then rerun the Pages workflow. This is a public URL, not a secret. The setting is baked into the interface, so users only need their access code. The URL can also be entered in AI settings during initial testing.

## Saved inquiries

The current inquiry is saved in this browser's local storage. Export JSON to keep a copy or transfer it to another device; import replaces the current inquiry after confirmation. Clearing browser data removes the saved inquiry. The built-in example is authored sample content, not live model output. Starting a new inquiry replaces the current session after confirmation.

The old app may have left a provider key under `inquiry-canvas-anthropic-key` or cached Qwen files in browser storage. This version never reads that key or loads those models. Clear those entries in the browser's site data settings if desired, after exporting your inquiry.

## Development and checks

```sh
npm ci
npm run dev
npm run lint
npm test
npm run build
npx playwright install chromium
npx playwright test
```

Vite serves at `/inquiry-canvas/` to match GitHub Pages. `src/inquiry.js` contains branch context, graph layout, export validation, and the sample inquiry. `backend/server/inquiry.js` contains the backend handler, with injectable credentials, limits, and upstream transport for tests. `backend/lib/results.js` validates model results on both sides of the connection.

Unit tests cover branch isolation, layout, imported graphs, JSON parsing, origin and access restrictions, request bounds, rate-limit failure, upstream errors, and credential isolation. UI tests cover manual branching, export/import, sample navigation, mobile overflow, configuration recovery, and a mocked hosted framing-and-answer flow. Live inference requires a deployed backend with gateway credentials and credits.

`.github/workflows/pages.yml` runs lint, unit tests, browser tests, and a build, then publishes `dist/` to GitHub Pages on pushes to `main`. Vercel deploys the backend separately from the same repository.
