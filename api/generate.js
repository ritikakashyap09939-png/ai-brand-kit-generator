const MODEL = 'gemini-3.5-flash-lite';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const HEX_RE = /^#[0-9A-F]{6}$/;
const VIBES = new Set(['Modern', 'Luxury', 'Playful', 'Minimal', 'Bold']);
const LANGUAGES = new Set(['English', 'Hindi', 'Hinglish']);
const ROLES = ['primary', 'secondary', 'accent', 'background', 'text'];
const MAX_NAME = 60;
const MAX_DESC = 150;
const MAX_TAGLINE_WORDS = 8;

const rateStore = globalThis.__brandKitRateStore || new Map();
globalThis.__brandKitRateStore = rateStore;

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function getClientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) return xf.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function isAllowedOrigin(req) {
  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  const host = req.headers.host || '';
  const candidates = [origin, referer].filter(Boolean);
  if (candidates.length === 0) return true; // allow non-browser/local tooling
  return candidates.some((value) => {
    try {
      const url = new URL(value);
      const h = url.host;
      if (h === host) return true;
      if (h === 'localhost' || h.startsWith('localhost:') || h === '127.0.0.1' || h.startsWith('127.0.0.1:')) return true;
      if (h.endsWith('.vercel.app')) return true;
      return false;
    } catch {
      return false;
    }
  });
}

function checkRateLimit(ip) {
  const now = Date.now();
  const minuteAgo = now - 60_000;
  const hourAgo = now - 3_600_000;
  let entry = rateStore.get(ip);
  if (!entry) {
    entry = [];
    rateStore.set(ip, entry);
  }
  while (entry.length && entry[0] < hourAgo) entry.shift();
  const lastMinute = entry.filter((t) => t >= minuteAgo).length;
  if (lastMinute >= 5) return { ok: false, retryAfter: 60 };
  if (entry.length >= 30) return { ok: false, retryAfter: 3600 };
  entry.push(now);
  // light cleanup to avoid unbounded growth
  if (rateStore.size > 5000) {
    for (const [k, v] of rateStore) {
      if (!v.length || v[v.length - 1] < hourAgo) rateStore.delete(k);
    }
  }
  return { ok: true };
}

function normalizeHex(value) {
  if (typeof value !== 'string') return null;
  let v = value.trim();
  if (/^[0-9A-Fa-f]{6}$/.test(v)) v = '#' + v;
  if (/^#[0-9A-Fa-f]{3}$/.test(v)) {
    v = '#' + v.slice(1).split('').map((c) => c + c).join('');
  }
  if (!/^#[0-9A-Fa-f]{6}$/.test(v)) return null;
  return v.toUpperCase();
}

function fallbackHex(role) {
  const map = {
    primary: '#4F46E5',
    secondary: '#1E1B4B',
    accent: '#818CF8',
    background: '#FFFFFF',
    text: '#1E1B4B',
  };
  return map[role] || '#4F46E5';
}

function sanitizePalettes(palettes) {
  if (!Array.isArray(palettes)) return [];
  const out = [];
  for (const p of palettes) {
    if (!p || typeof p !== 'object') continue;
    const name = typeof p.name === 'string' && p.name.trim() ? p.name.trim().slice(0, 40) : 'Palette';
    const colorsIn = Array.isArray(p.colors) ? p.colors : [];
    const byRole = new Map();
    for (const c of colorsIn) {
      if (!c || typeof c !== 'object') continue;
      const role = typeof c.role === 'string' ? c.role.toLowerCase().trim() : '';
      if (!ROLES.includes(role)) continue;
      const hex = normalizeHex(c.hex);
      if (hex) byRole.set(role, hex);
    }
    const colors = ROLES.map((role) => ({ role, hex: byRole.get(role) || fallbackHex(role) }));
    out.push({ name, colors });
    if (out.length === 3) break;
  }
  return out;
}

function sanitizeStringArray(arr, count, maxLen, maxWords) {
  if (!Array.isArray(arr)) return null;
  const out = arr
    .filter((x) => typeof x === 'string')
    .map((x) => x.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, count)
    .map((x) => {
      if (maxWords && x.split(/\s+/).length > maxWords) {
        return x.split(/\s+/).slice(0, maxWords).join(' ');
      }
      if (x.length > maxLen) return x.slice(0, maxLen).trim();
      return x;
    });
  return out.length === count ? out : null;
}

function sanitizeFonts(fonts) {
  if (!fonts || typeof fonts !== 'object') return null;
  const heading = typeof fonts.heading === 'string' ? fonts.heading.trim().slice(0, 60) : '';
  const body = typeof fonts.body === 'string' ? fonts.body.trim().slice(0, 60) : '';
  const why = typeof fonts.why === 'string' ? fonts.why.replace(/\s+/g, ' ').trim().slice(0, 180) : '';
  if (!heading || !body || !why) return null;
  return { heading, body, why };
}

function sanitizeVoice(voice) {
  if (!voice || typeof voice !== 'object') return null;
  const adjectives = sanitizeStringArray(voice.adjectives, 3, 30);
  const description = typeof voice.description === 'string' ? voice.description.replace(/\s+/g, ' ').trim().slice(0, 220) : '';
  if (!adjectives || !description) return null;
  return { adjectives, description };
}

function validateResult(data) {
  const taglines = sanitizeStringArray(data?.taglines, 3, 80, MAX_TAGLINE_WORDS);
  const captions = sanitizeStringArray(data?.captions, 3, 280);
  const palettes = sanitizePalettes(data?.palettes);
  const fonts = sanitizeFonts(data?.fonts);
  const voice = sanitizeVoice(data?.voice);
  if (!taglines || !captions || palettes.length !== 3 || !fonts || !voice) return null;
  return { taglines, palettes, fonts, voice, captions };
}

function buildPrompt({ name, description, vibe, language }) {
  const langRule = language === 'Hindi'
    ? 'taglines aur captions देवनागरी (Hindi) mein likho.'
    : language === 'Hinglish'
      ? 'taglines aur captions Roman Hindi (Hinglish) mein likho.'
      : 'taglines aur captions English mein likho.';
  return `You are a brand strategist. Return ONLY valid JSON (no markdown) for this business.

Business name: ${name}
Business description: ${description}
Vibe: ${vibe}
Language: ${language}

Rules:
- ${langRule}
- Brand name ko bilkul jaisa diya gaya hai waise hi treat karo (badalna nahi).
- Font names hamesha English mein aur sirf real Google Fonts ke naam.
- taglines: exactly 3 items, each max 8 words.
- palettes: exactly 3 items. Each item: { "name": string, "colors": [ { "role": "primary"|"secondary"|"accent"|"background"|"text", "hex": "#RRGGBB" } ] } with all 5 roles.
- fonts: { "heading": string, "body": string, "why": string } (why one short line).
- voice: { "adjectives": [3 strings], "description": "one line" }.
- captions: exactly 3 items, each 1-2 lines with relevant hashtags.

JSON schema:
{
  "taglines": ["","",""],
  "palettes": [
    {"name":"","colors":[{"role":"primary","hex":"#RRGGBB"},{"role":"secondary","hex":"#RRGGBB"},{"role":"accent","hex":"#RRGGBB"},{"role":"background","hex":"#RRGGBB"},{"role":"text","hex":"#RRGGBB"}]},
    {"name":"","colors":[{"role":"primary","hex":"#RRGGBB"},{"role":"secondary","hex":"#RRGGBB"},{"role":"accent","hex":"#RRGGBB"},{"role":"background","hex":"#RRGGBB"},{"role":"text","hex":"#RRGGBB"}]},
    {"name":"","colors":[{"role":"primary","hex":"#RRGGBB"},{"role":"secondary","hex":"#RRGGBB"},{"role":"accent","hex":"#RRGGBB"},{"role":"background","hex":"#RRGGBB"},{"role":"text","hex":"#RRGGBB"}]}
  ],
  "fonts": {"heading":"","body":"","why":""},
  "voice": {"adjectives":["","",""],"description":""},
  "captions": ["","",""]
}`;
}

async function callGemini(prompt, apiKey, signal) {
  const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.8,
        maxOutputTokens: 3000,
      },
    }),
    signal,
  });
  if (!res.ok) {
    let errorMessage = String(res.status);
    try {
      const errData = await res.json();
      if (errData && errData.error && typeof errData.error.message === 'string') {
        errorMessage = errData.error.message;
      }
    } catch {}
    const err = new Error('UPSTREAM');
    err.status = res.status;
    err.errorMessage = errorMessage;
    throw err;
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  if (!text) {
    const err = new Error('EMPTY');
    err.status = res.status;
    err.errorMessage = 'EMPTY';
    throw err;
  }
  try {
    return JSON.parse(text);
  } catch (parseErr) {
    const err = new Error('PARSE');
    err.status = res.status;
    err.errorMessage = parseErr.message;
    throw err;
  }
}

async function callGeminiWithRetry(prompt, apiKey) {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      const parsed = await callGemini(prompt, apiKey, controller.signal);
      clearTimeout(timer);
      return parsed;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (err && err.name === 'AbortError') {
        lastErr = new Error('TIMEOUT');
        lastErr.errorMessage = 'Request timed out';
      }
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw lastErr;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }

  if (!isAllowedOrigin(req)) {
    return json(res, 403, { error: 'Forbidden' });
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(ip);
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retryAfter));
    return json(res, 429, { error: 'Too many requests. Please try again later.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json(res, 500, { error: 'Server busy hai, please dobara try karo' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return json(res, 400, { error: 'Invalid JSON body.' }); }
  }
  if (!body || typeof body !== 'object') {
    return json(res, 400, { error: 'Invalid request body.' });
  }

  const name = typeof body.businessName === 'string' ? body.businessName.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const vibe = typeof body.vibe === 'string' ? body.vibe.trim() : '';
  const language = typeof body.language === 'string' ? body.language.trim() : '';

  if (!name || !description || !vibe || !language) {
    return json(res, 400, { error: 'Saari fields bharna zaroori hai.' });
  }
  if (name.length > MAX_NAME) {
    return json(res, 400, { error: `Business name ${MAX_NAME} characters se zyada nahi ho sakta.` });
  }
  if (description.length > MAX_DESC) {
    return json(res, 400, { error: `Description ${MAX_DESC} characters se zyada nahi ho sakti.` });
  }
  if (!VIBES.has(vibe)) {
    return json(res, 400, { error: 'Invalid vibe selected.' });
  }
  if (!LANGUAGES.has(language)) {
    return json(res, 400, { error: 'Invalid language selected.' });
  }

  try {
    const prompt = buildPrompt({ name, description, vibe, language });
    const raw = await callGeminiWithRetry(prompt, apiKey);
    const result = validateResult(raw);
    if (!result) {
      console.error('[brandkit]', 200, 'VALIDATION_FAILED');
      return json(res, 502, { error: 'Server busy hai, please dobara try karo' });
    }
    return json(res, 200, result);
  } catch (_err) {
    console.error('[brandkit]', _err.status, _err.errorMessage);
    return json(res, 502, { error: 'Server busy hai, please dobara try karo' });
  }
};
