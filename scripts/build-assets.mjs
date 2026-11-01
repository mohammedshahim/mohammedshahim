// Generates the README artwork in ../assets (one dark and one light SVG per piece).
// Text is outlined to paths so it looks the same on every OS: edit the copy here, then `npm run build`.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import opentype from 'opentype.js';

const here = new URL('./', import.meta.url);
const fontFile = (pkg, file) => {
  const b = readFileSync(new URL(`node_modules/@fontsource/${pkg}/files/${file}.woff`, here));
  return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
};
const F = {
  serif: fontFile('instrument-serif', 'instrument-serif-latin-400-normal'),
  italic: fontFile('instrument-serif', 'instrument-serif-latin-400-italic'),
  sans: fontFile('inter', 'inter-latin-400-normal'),
  medium: fontFile('inter', 'inter-latin-500-normal'),
  semi: fontFile('inter', 'inter-latin-600-normal'),
  mono: fontFile('jetbrains-mono', 'jetbrains-mono-latin-500-normal'),
};

const THEMES = {
  dark: { bg: '#101314', panel: '#181C1D', line: '#2C3234', ink: '#F4F1EA', muted: '#A3ABAA', accent: '#FF6A3D', live: '#4FD6A6', dot: '#262B2C', glow: '#FF6A3D', glowOp: 0.16 },
  light: { bg: '#F6F2E9', panel: '#FFFDF8', line: '#DAD3C3', ink: '#16191A', muted: '#585F5C', accent: '#D13F16', live: '#0B8560', dot: '#E2DCCD', glow: '#FF8A5C', glowOp: 0.22 },
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const width = (s, size, font, track = 0) => F[font].getAdvanceWidth(s, size, { letterSpacing: track });

function text(s, x, y, size, font, fill, { anchor = 'start', track = 0, cls = '' } = {}) {
  const w = width(s, size, font, track);
  const left = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  const d = F[font].getPath(s, left, y, size, { letterSpacing: track }).toPathData(1);
  return `<path d="${d}" fill="${fill}"${cls ? ` class="${cls}"` : ''}/>`;
}

// One path per letter, so the name can rise in letter by letter.
function letters(s, x, y, size, font, fill, startDelay = 0) {
  return [...s].map((ch, i) => {
    if (ch === ' ') return '';
    const left = x + F[font].getAdvanceWidth(s.slice(0, i + 1), size) - F[font].getAdvanceWidth(ch, size);
    const d = F[font].getPath(ch, left, y, size).toPathData(1);
    return `<path class="rise" style="animation-delay:${(startDelay + i * 0.045).toFixed(3)}s" d="${d}" fill="${fill}"/>`;
  }).join('');
}

const svg = (w, h, label, css, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title><style>${css}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>${body}</svg>`;

const BASE_CSS = `
.rise{animation:rise .8s cubic-bezier(.2,.8,.2,1) both}
@keyframes rise{from{transform:translateY(14px)}to{transform:none}}
.pulse{animation:pulse 2.2s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.72)}}`;

function backdrop(w, h, t, id, glowX = 0.82, glowY = 0.1) {
  return `<defs><pattern id="${id}d" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.3" fill="${t.dot}"/></pattern>
<radialGradient id="${id}g" cx="${glowX}" cy="${glowY}" r=".7"><stop offset="0" stop-color="${t.glow}" stop-opacity="${t.glowOp}"/><stop offset="1" stop-color="${t.glow}" stop-opacity="0"/></radialGradient>
<clipPath id="${id}c"><rect width="${w}" height="${h}" rx="24"/></clipPath></defs>
<rect width="${w}" height="${h}" rx="24" fill="${t.bg}"/><rect width="${w}" height="${h}" rx="24" fill="url(#${id}d)"/><rect width="${w}" height="${h}" rx="24" fill="url(#${id}g)"/>
<rect x=".75" y=".75" width="${w - 1.5}" height="${h - 1.5}" rx="23.5" fill="none" stroke="${t.line}" stroke-width="1.5"/>`;
}

// A row of labelled nodes with a signal that travels through them.
// `hold` is the node where the signal waits, which is how the hero shows a human approving the action.
function pipeline(id, t, nodes, { x, y, w, nodeW, nodeH = 74, duration = 11, hold = -1 }) {
  const gap = (w - nodeW * nodes.length) / (nodes.length - 1);
  const centers = nodes.map((_, i) => x + nodeW / 2 + i * (nodeW + gap));
  const [x0, xN] = [centers[0], centers.at(-1)];
  const frac = (i) => (centers[i] - x0) / (xN - x0);
  const END = 82;
  const timeAt = (f) => {
    if (hold < 0) return f * END;
    const fh = frac(hold);
    const [arrive, leave] = [52, 66];
    return f <= fh ? (f / fh) * arrive : leave + ((f - fh) / (1 - fh)) * (END - leave);
  };
  const off = (f) => (-(f * 100) + 3).toFixed(2);
  const frames = [`0%{stroke-dashoffset:3;opacity:0}`, `2%{opacity:1}`];
  if (hold >= 0) frames.push(`52%{stroke-dashoffset:${off(frac(hold))}}`, `66%{stroke-dashoffset:${off(frac(hold))}}`);
  frames.push(`${END}%{stroke-dashoffset:-97;opacity:1}`, `${END + 3}%,100%{stroke-dashoffset:-97;opacity:0}`);

  let css = `.${id}s{stroke-dasharray:6 100;animation:${id}m ${duration}s linear infinite}@keyframes ${id}m{${frames.join('')}}`;
  let out = `<path d="M${x0} ${y + nodeH / 2}H${xN}" stroke="${t.line}" stroke-width="2.5" fill="none"/>`;
  out += `<path class="${id}s" d="M${x0} ${y + nodeH / 2}H${xN}" pathLength="100" stroke="${t.accent}" stroke-width="4" stroke-linecap="round" fill="none"/>`;

  nodes.forEach((n, i) => {
    const nx = centers[i] - nodeW / 2;
    const at = Math.max(timeAt(frac(i)), 2);
    const off2 = Math.min((i === hold ? 66 : at) + 7, 99.5);
    const on = Math.max(at - 2, 0.1);
    css += `.${id}n${i}{opacity:0;animation:${id}k${i} ${duration}s linear infinite}@keyframes ${id}k${i}{0%,${on.toFixed(1)}%{opacity:0}${at.toFixed(1)}%,${(i === hold ? 66 : at + 1).toFixed(1)}%{opacity:1}${off2.toFixed(1)}%,100%{opacity:0}}`;
    out += `<rect x="${nx}" y="${y}" width="${nodeW}" height="${nodeH}" rx="16" fill="${t.panel}" stroke="${n.accent ? t.accent : t.line}" stroke-width="${n.accent ? 2.5 : 1.5}"/>`;
    out += `<rect class="${id}n${i}" x="${nx}" y="${y}" width="${nodeW}" height="${nodeH}" rx="16" fill="${t.accent}" fill-opacity=".14" stroke="${t.accent}" stroke-width="2.5"/>`;
    out += text(n.label, centers[i], y + nodeH / 2 + 8.5, 24, 'semi', t.ink, { anchor: 'middle' });
    if (n.sub) out += text(n.sub, centers[i], y + nodeH + 31, 18, 'mono', n.accent ? t.accent : t.muted, { anchor: 'middle' });
  });
  return { css, out };
}

function arrow(x, y, c, s = 1) {
  return `<path d="M${x} ${y + 12 * s}L${x + 12 * s} ${y}M${x + 3 * s} ${y}H${x + 12 * s}V${y + 9 * s}" stroke="${c}" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function pill(x, y, label, fg, border, { dot, h = 40, size = 17 } = {}) {
  const tw = width(label, size, 'mono', 0.04);
  const pad = 18, dw = dot ? 20 : 0, w = tw + pad * 2 + dw;
  return {
    w,
    out: `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="none" stroke="${border}" stroke-width="1.5"/>` +
      (dot ? `<circle class="pulse" cx="${x + pad + 4}" cy="${y + h / 2}" r="5.5" fill="${dot}"/>` : '') +
      text(label, x + pad + dw, y + h / 2 + size * 0.36, size, 'mono', fg, { track: 0.04 }),
  };
}

// ---------- pieces ----------

function hero(t) {
  const W = 1200, H = 640;
  const p = pipeline('h', t, [
    { label: 'Guest asks', sub: 'chat' },
    { label: 'Agent', sub: 'LangGraph' },
    { label: 'Tools', sub: 'search, book' },
    { label: 'Confirm', sub: 'human approves', accent: true },
    { label: 'Checkout', sub: 'Stripe' },
  ], { x: 56, y: 462, w: W - 112, nodeW: 184, hold: 3, duration: 11 });
  const body = backdrop(W, H, t, 'h') +
    text('FULL-STACK & AI ENGINEER', 56, 72, 20, 'mono', t.muted, { track: 0.12 }) +
    `<circle class="pulse" cx="${W - 56 - width('STAYZY IS LIVE', 20, 'mono', 0.12) - 20}" cy="65" r="6.5" fill="${t.live}"/>` +
    text('STAYZY IS LIVE', W - 56, 72, 20, 'mono', t.live, { anchor: 'end', track: 0.12 }) +
    letters('Mohammed', 50, 228, 158, 'serif', t.ink, 0.1) +
    letters('Shahim', 50, 362, 158, 'italic', t.accent, 0.5) +
    text('I build AI products and ship them', 570, 276, 40, 'serif', t.ink) +
    text('to production, from the agent graph', 570, 322, 40, 'serif', t.ink) +
    text('to the payment page.', 570, 368, 40, 'serif', t.muted) +
    text("HOW STAYZY'S BOOKING AGENT RUNS", 56, 432, 18, 'mono', t.muted, { track: 0.1 }) +
    p.out;
  return svg(W, H, "Mohammed Shahim, full-stack and AI engineer. I build AI products and ship them to production. Animated diagram of Stayzy's booking agent: guest asks, agent, tools, human confirms, Stripe checkout.", BASE_CSS + p.css, body);
}

function stayzy(t) {
  const W = 1200, H = 720;
  const img = readFileSync(new URL('stayzy.jpg', here)).toString('base64');
  const fx = 560, fy = 84, fw = 760, fh = 560;
  const live = pill(56, 56, 'LIVE IN PRODUCTION', t.live, t.line, { dot: t.live });
  const surfaces = ['Smart search', 'Hotel summaries', 'Compare summaries', 'Navigator chat widget', 'Booking chatbot that asks first'];
  const body = backdrop(W, H, t, 's', 0.9, 0.5) +
    `<g clip-path="url(#sc)"><g class="float">
<rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" rx="16" fill="${t.panel}" stroke="${t.line}" stroke-width="1.5"/>
<circle cx="${fx + 28}" cy="${fy + 25}" r="6.5" fill="${t.accent}"/><circle cx="${fx + 50}" cy="${fy + 25}" r="6.5" fill="${t.line}"/><circle cx="${fx + 72}" cy="${fy + 25}" r="6.5" fill="${t.line}"/>
${text('stayzy.shahim.dev', fx + 104, fy + 31, 17, 'mono', t.muted)}
<clipPath id="ss"><rect x="${fx + 1}" y="${fy + 50}" width="${fw - 2}" height="${fh - 51}" rx="2"/></clipPath>
<image clip-path="url(#ss)" x="${fx + 1}" y="${fy + 50}" width="${fw - 2}" height="${((fw - 2) * 1000) / 1440}" href="data:image/jpeg;base64,${img}"/></g></g>` +
    live.out +
    text('Stayzy', 50, 202, 112, 'serif', t.ink) +
    text('Hotel search, comparison, booking', 56, 248, 25, 'sans', t.ink) +
    text('and payment in one flow, with an', 56, 283, 25, 'sans', t.ink) +
    text('AI agent working alongside.', 56, 318, 25, 'sans', t.ink) +
    text('AI IN PRODUCTION', 56, 374, 18, 'mono', t.accent, { track: 0.1 }) +
    surfaces.map((s, i) => `<rect x="56" y="${396 + i * 36}" width="10" height="10" rx="2" fill="${t.accent}"/>` + text(s, 80, 408 + i * 36, 23, 'medium', t.ink)).join('') +
    text('Next.js · Express · PostGIS · Stripe', 56, 616, 18, 'mono', t.muted) +
    text('FastAPI · LangGraph · LangSmith', 56, 644, 18, 'mono', t.muted);
  const css = BASE_CSS + `.float{animation:float 9s ease-in-out infinite}@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}`;
  return svg(W, H, 'Stayzy, a hotel booking platform live in production, with smart search, AI summaries, a navigator chat widget and a booking chatbot. Screenshot of the site. Opens the live site.', css, body);
}

function projectCard(t, id, { name, status, statusColor, dot, line, nodes, label }) {
  const W = 1200, H = 372;
  const p = pipeline(id, t, nodes, { x: 56, y: 212, w: W - 112, nodeW: 232, nodeH: 66, duration: 9 });
  const s = pill(0, 0, status, statusColor, t.line, { dot });
  const body = backdrop(W, H, t, id, 0.95, 0) +
    text(name, 52, 112, 84, 'serif', t.ink) +
    `<g transform="translate(${W - 56 - s.w} 46)">${s.out}</g>` +
    text(line, 56, 160, 25, 'sans', t.muted) +
    p.out;
  return svg(W, H, label, BASE_CSS + p.css, body);
}

const jobpilot = (t) => projectCard(t, 'j', {
  name: 'JobPilot', status: 'IN BUILD', statusColor: t.accent, dot: t.accent,
  line: 'An AI assistant that does the preparation work of a job hunt.',
  nodes: [{ label: 'Discover', sub: 'Adzuna' }, { label: 'Score', sub: 'GPT-4o, your profile' }, { label: 'Research', sub: 'company dossier' }, { label: 'Apply', sub: 'one click', accent: true }],
  label: 'JobPilot, in build: an AI job hunting assistant that discovers jobs, scores them against your profile, researches each company, and lets you apply in one click.',
});

const vista = (t) => projectCard(t, 'v', {
  name: 'AI Stay Vista', status: 'SOURCE', statusColor: t.muted,
  line: 'Natural-language hotel search over embedded listings and reviews.',
  nodes: [{ label: 'Embed', sub: 'listings, reviews' }, { label: 'Store', sub: 'vector store' }, { label: 'Search', sub: 'LangGraph' }, { label: 'Answer', sub: 'summaries, assistant', accent: true }],
  label: 'AI Stay Vista: natural-language hotel search over embedded listings and reviews, with LangGraph workflows for search, property summaries and a travel assistant.',
});

function timeline(t) {
  const W = 1200, H = 272;
  const rows = [
    ['2019', ['Started on the', 'web: HTML, CSS,', 'JavaScript']],
    ['2021', ['MERN apps and', 'realtime chat', 'with Socket.IO']],
    ['2023', ['Docker, logging', 'and hardening', 'Node services']],
    ['2024', ['Next.js, token', 'auth and RTK', 'Query']],
    ['2025', ['Kafka, K8s,', 'FastAPI and', 'MCP servers']],
    ['2026', ['LangGraph, RAG,', 'Stayzy goes', 'live in July']],
  ];
  const colW = (W - 112) / rows.length;
  const y = 104;
  const lastX = 56 + colW * (rows.length - 1) + 8;
  const css = BASE_CSS + `.draw{stroke-dasharray:100;animation:draw 9s ease-in-out infinite}@keyframes draw{0%{stroke-dashoffset:100}45%,100%{stroke-dashoffset:0}}`;
  const body = backdrop(W, H, t, 't', 1, 0.1) +
    `<path d="M64 ${y}H${W - 56}" stroke="${t.line}" stroke-width="2.5"/>` +
    `<path class="draw" d="M64 ${y}H${lastX}" pathLength="100" stroke="${t.accent}" stroke-width="3.5" fill="none"/>` +
    rows.map(([yr, ls], i) => {
      const x = 56 + i * colW;
      const last = i === rows.length - 1;
      return `<g>` +
        (last ? `<circle class="pulse" cx="${x + 8}" cy="${y}" r="18" fill="${t.accent}" fill-opacity=".28"/>` : '') +
        `<circle cx="${x + 8}" cy="${y}" r="9" fill="${last ? t.accent : t.bg}" stroke="${t.accent}" stroke-width="3"/>` +
        text(yr, x, y - 32, 50, last ? 'italic' : 'serif', last ? t.accent : t.ink) +
        ls.map((l, j) => text(l, x, y + 56 + j * 30, 20, 'sans', last ? t.ink : t.muted)).join('') +
        `</g>`;
    }).join('');
  return svg(W, H, 'Timeline. 2019: Started on the web with HTML, CSS and JavaScript. 2021: MERN apps and realtime chat. 2023: Docker, logging and hardening Node services. 2024: Next.js, token auth and RTK Query. 2025: Kafka, Kubernetes, FastAPI and MCP servers. 2026: LangGraph, RAG, and Stayzy goes live in July.', css, body);
}

function stack(t) {
  const W = 1200, H = 440;
  const cols = [
    ['AI', ['LangGraph', 'LangChain', 'MCP', 'Pinecone', 'OpenRouter', 'LangSmith']],
    ['Product', ['TypeScript', 'Next.js', 'React', 'React Native', 'Redux Toolkit', 'Tailwind CSS']],
    ['Backend', ['Node & Express', 'FastAPI', 'PostgreSQL + PostGIS', 'MongoDB', 'Kafka', 'Socket.IO']],
    ['Cloud', ['Docker', 'Kubernetes', 'AWS', 'Google Cloud', 'Vercel', 'Render']],
  ];
  const colW = (W - 112) / 4;
  const body = backdrop(W, H, t, 'k', 0, 0) + cols.map(([h, items], i) => {
    const x = 56 + i * colW;
    return `<g>` +
      text(h, x, 92, 48, i === 0 ? 'italic' : 'serif', i === 0 ? t.accent : t.ink) +
      `<path d="M${x} 116H${x + colW - 30}" stroke="${i === 0 ? t.accent : t.line}" stroke-width="2"/>` +
      items.map((s, j) => text(s, x, 164 + j * 44, 22, 'medium', i === 0 ? t.ink : t.muted)).join('') + `</g>`;
  }).join('');
  return svg(W, H, 'Tech stack. ' + cols.map(([h, i]) => `${h}: ${i.join(', ')}.`).join(' '), BASE_CSS, body);
}

const out = new URL('../assets/', here);
mkdirSync(out, { recursive: true });
for (const [name, fn] of Object.entries({ hero, stayzy, jobpilot, vista, timeline, stack })) {
  for (const [mode, t] of Object.entries(THEMES)) {
    const s = fn(t);
    writeFileSync(new URL(`${name}-${mode}.svg`, out), s);
    console.log(`${name}-${mode}.svg ${(s.length / 1024).toFixed(0)} KB`);
  }
}
