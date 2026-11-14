# BrandKit AI

Free AI brand kit generator: enter your business details and get taglines, colour palettes, font pairing suggestions, a brand voice, sample social captions, and simple client-side logo variants.

## Stack
- Static frontend in `public/` (`index.html`, `styles.css`, `script.js`)
- Vercel serverless backend in `api/generate.js`
- Gemini REST API (`gemini-3.5-flash-lite`) with Node built-in `fetch`
- No extra npm packages

## Local run
1. Install Vercel CLI if needed: `npm i -g vercel`
2. Copy `.env.example` to `.env` and set your key:
   - `GEMINI_API_KEY=your_gemini_api_key_here`
3. Start local dev:
   - `npx vercel dev`
4. Open the local URL shown by Vercel (usually `http://localhost:3000`).

## Notes
- `.env` is gitignored; never expose `GEMINI_API_KEY` in frontend code.
- API includes input validation, origin/referer checks, in-memory rate limiting, timeout + retry, and response sanitization.
- Logos and PNG/SVG exports are generated client-side in the browser.
