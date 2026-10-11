# Inquiry Canvas

A branching workspace for intellectual inquiry: choose a framing before answering, preserve paths not taken, trace concepts across answers, and turn unresolved tensions into new branches.

[Open Inquiry Canvas](https://mjsilverman19.github.io/inquiry-canvas/)

## Use

Ask a question, select a framing or synthesize all, and inspect the resulting answer. Every framing remains attached to its question, so you can return and take another path. Fork an answer, open a tension as a branch, or compare a conceptual thread across answers.

The default is a key-free canvas. Open **AI settings** to download a model that runs on your device using WebLLM. Qwen 3.5 4B needs roughly 3.9 GB of available GPU memory; the lighter Qwen 2.5 1.5B option needs roughly 1.9 GB. These figures are runtime estimates, not download sizes. Model files are large and cached when browser storage permits. Use a recent browser with WebGPU and a compatible GPU. No model is downloaded before you request it. If loading fails or the device is unsupported, questions and manual answers still work.

Browser models have lower reasoning capacity than hosted frontier models. Answers do not have live web search or verified citations. Questions are processed locally; model weights and runtime files are downloaded from the WebLLM distribution sources. There are no API keys, inference servers, or metered AI calls.

The interface follows the Book Critic Data explorer: system typography, monochrome light/dark themes, thin rules, and text controls. The graph lays out actual branches. Answer generation receives only ancestor context, capped at the most recent 10,000 characters; a concept synthesis explicitly includes the selected thread's answers in its question.

## Saved inquiries

The current inquiry is saved in this browser's local storage. Export JSON to keep a copy or transfer it to another device; import replaces the current inquiry after confirmation. Clearing browser data removes the saved inquiry. The built-in example is authored sample content, not live model output. Starting a new inquiry replaces the current session after confirmation.

No API key is read or used. If you used the old app, it may have left a key under `inquiry-canvas-anthropic-key` in local storage. Clear that entry in your browser's site data settings if needed.

## Development

```sh
npm ci
npm run dev
npm run lint
npm test
npm run build
```

Vite serves at `/inquiry-canvas/` to match GitHub Pages. Browser inference runs in a worker, loaded on demand. `src/inquiry.js` contains branch context, graph layout, export validation, and the sample inquiry. `src/ai.js` consolidates answer, concepts, tensions, and suggested questions into one generation after the framing generation; there are no idle/background inference calls.

## Deployment

`.github/workflows/pages.yml` checks and builds the app, then publishes `dist/` to GitHub Pages on pushes to `main`. In the repository's **Settings → Pages**, set the source to **GitHub Actions**. Initial Pages configuration requires a repository administrator. No deployment secrets or AI keys are required.

## Validation

Unit tests cover branch isolation, sibling layout, imported graph validation, and model JSON parsing. UI tests can run with `npx playwright test`; they cover manual branching, export/import, sample navigation, and mobile overflow. Live GPU inference requires testing on a compatible device and downloading model weights.
