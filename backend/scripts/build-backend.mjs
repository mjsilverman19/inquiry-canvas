import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('backend-public', { recursive: true });
await writeFile('backend-public/index.html', '<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><title>Inquiry Canvas AI</title><p>Inquiry Canvas AI backend.</p><p><a href="https://mjsilverman19.github.io/inquiry-canvas/">Open the canvas</a></p>');
