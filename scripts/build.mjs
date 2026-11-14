// Generates the banner, footer and repository cards (light + dark) and
// rewrites the card grid in README.md between the cards markers.
// Usage: node scripts/build.mjs   (GITHUB_TOKEN is optional, raises the API rate limit)

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(await readFile(join(root, 'profile.config.json'), 'utf8'));

const FONT =
  "'Segoe UI', -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Yu Gothic UI', " +
  "'Microsoft YaHei', 'Noto Sans CJK JP', Helvetica, Arial, sans-serif";

const THEMES = {
  light: {
    bg: ['#fff0f6', '#f3eeff', '#e8f4ff'],
    cardBg: '#fffbfd',
    text: '#2d2640',
    muted: '#6e6585',
    blob: ['#ffb3d1', '#c9b6ff', '#a9d4ff'],
    blobOpacity: 0.55,
    branch: '#9b6b7c',
    petal: '#ffbcd6',
    petalEdge: '#f48fb8',
    flowerCore: '#e05592',
    sparkle: '#b18cff',
    pillBg: 0.12,
  },
  dark: {
    bg: ['#1d1630', '#221a3d', '#14213a'],
    cardBg: '#17141f',
    text: '#ece6f7',
    muted: '#a79fbf',
    blob: ['#ff6fae', '#8b6cff', '#3f8cff'],
    blobOpacity: 0.28,
    branch: '#7d5a72',
    petal: '#f9a8cf',
    petalEdge: '#ff7eb6',
    flowerCore: '#ffd1e6',
    sparkle: '#ffe7a3',
    pillBg: 0.16,
  },
};

// Each card gets one accent in turn: [light-mode strong, light-mode soft, dark-mode strong, dark-mode soft]
const ACCENTS = [
  ['#d6407f', '#ff9cc4', '#ff8fbf', '#7a2c55'],
  ['#7a56d6', '#c2acff', '#b59cff', '#4a3485'],
  ['#2f74d0', '#9cc8ff', '#86b8ff', '#28467a'],
  ['#0f8f84', '#8fe3d6', '#6fe0cf', '#1d5a55'],
];

const LANG_COLORS = {
  Dart: '#00B4AB',
  Rust: '#dea584',
  Python: '#3572A5',
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Kotlin: '#A97BFF',
  Swift: '#F05138',
};

const ICON_REPO =
  'M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.25.25 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z';
const ICON_STAR =
  'M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z';

const FALLING_PETAL = 'M0,-5 L-2,-8 C-7,-8 -9,-1 -7,4 C-5,8 5,8 7,4 C9,-1 7,-8 2,-8 Z';
const FLOWER_PETAL = 'M0 0 C -7 -6 -9 -16 -4 -21 L 0 -18 L 4 -21 C 9 -16 7 -6 0 0 Z';
const SPARKLE = 'M0 -10 C 1 -2 2 -1 10 0 C 2 1 1 2 0 10 C -1 2 -2 1 -10 0 C -2 -1 -1 -2 0 -10 Z';

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Seeded so that regenerating produces byte-identical decorations and the
// scheduled workflow only commits when repository data actually changed.
function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r1 = (n) => Math.round(n * 10) / 10;

function charWidth(ch) {
  if (/[⺀-￿]/.test(ch)) return 1;
  if (/[iljI.,:;'|!]/.test(ch)) return 0.3;
  if (/[ frt\-()]/.test(ch)) return 0.38;
  if (/[mwMW@]/.test(ch)) return 0.85;
  if (/[A-Z]/.test(ch)) return 0.66;
  return 0.56;
}
const textWidth = (s, size) => [...s].reduce((w, c) => w + charWidth(c), 0) * size;

function wrap(text, size, maxWidth, maxLines) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (textWidth(next, size) <= maxWidth || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    let last = lines[maxLines - 1];
    while (textWidth(`${last}…`, size) > maxWidth) last = last.replace(/\s*\S+$/, '');
    lines.splice(maxLines, Infinity);
    lines[maxLines - 1] = `${last}…`;
  }
  return lines;
}

const fmtCount = (n) => (n >= 1000 ? `${r1(n / 1000)}k` : String(n));

function flower(x, y, scale, t, rotate = 0) {
  const petals = [0, 72, 144, 216, 288]
    .map((a) => `<path d="${FLOWER_PETAL}" transform="rotate(${a})"/>`)
    .join('');
  return (
    `<g transform="translate(${x} ${y}) rotate(${rotate}) scale(${scale})">` +
    `<g fill="${t.petal}" stroke="${t.petalEdge}" stroke-width="1">${petals}</g>` +
    `<circle r="4" fill="${t.flowerCore}"/>` +
    [0, 72, 144, 216, 288]
      .map((a) => {
        const rad = ((a - 90) * Math.PI) / 180;
        return `<circle cx="${r1(Math.cos(rad) * 7)}" cy="${r1(Math.sin(rad) * 7)}" r="1.2" fill="${t.flowerCore}"/>`;
      })
      .join('') +
    `</g>`
  );
}

const MOTION_CSS = `
.sway{animation:sway 4s ease-in-out infinite alternate}
.fall{transform-box:fill-box;transform-origin:center;animation:fallA linear infinite}
.fall.b{animation-name:fallB}.fall.c{animation-name:fallC}
.tw{transform-box:fill-box;transform-origin:center;animation:tw 3s ease-in-out infinite}
@keyframes sway{from{transform:translateX(-14px)}to{transform:translateX(14px)}}
@keyframes fallA{0%{transform:translate(0,-30px) rotate(0);opacity:0}8%{opacity:.95}88%{opacity:.95}100%{transform:translate(60px,var(--h)) rotate(320deg);opacity:0}}
@keyframes fallB{0%{transform:translate(0,-30px) rotate(40deg);opacity:0}8%{opacity:.9}88%{opacity:.9}100%{transform:translate(-50px,var(--h)) rotate(-260deg);opacity:0}}
@keyframes fallC{0%{transform:translate(0,-30px) rotate(-20deg) scale(.8);opacity:0}8%{opacity:.85}88%{opacity:.85}100%{transform:translate(20px,var(--h)) rotate(200deg) scale(.8);opacity:0}}
@keyframes tw{0%,100%{transform:scale(.5);opacity:.25}50%{transform:scale(1);opacity:1}}
@media (prefers-reduced-motion: reduce){*{animation:none!important}}`;

function fallingPetals(t, count, width, height, seed) {
  const rand = rng(seed);
  let out = '';
  for (let i = 0; i < count; i++) {
    const x = r1(rand() * width);
    const dur = r1(9 + rand() * 9);
    const delay = r1(-rand() * dur);
    const scale = r1(0.7 + rand() * 0.8);
    const variant = ['', ' b', ' c'][i % 3];
    out +=
      `<g transform="translate(${x} 0)"><g class="sway" style="animation-delay:${r1(-rand() * 4)}s">` +
      `<g class="fall${variant}" style="--h:${height + 40}px;animation-duration:${dur}s;animation-delay:${delay}s">` +
      `<path d="${FALLING_PETAL}" transform="scale(${scale})" fill="${t.petal}" stroke="${t.petalEdge}" stroke-width=".8"/>` +
      `</g></g></g>`;
  }
  return out;
}

function sparkles(t, points) {
  return points
    .map(
      ([x, y, s, d]) =>
        `<g transform="translate(${x} ${y}) scale(${s})"><path class="tw" style="animation-delay:${d}s" d="${SPARKLE}" fill="${t.sparkle}"/></g>`,
    )
    .join('');
}

function backdrop(t, w, h, id) {
  return `
  <defs>
    <linearGradient id="${id}bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${t.bg[0]}"/><stop offset=".55" stop-color="${t.bg[1]}"/><stop offset="1" stop-color="${t.bg[2]}"/>
    </linearGradient>
    <filter id="${id}blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="45"/></filter>
    <clipPath id="${id}clip"><rect width="${w}" height="${h}" rx="22"/></clipPath>
  </defs>`;
}

function banner(mode) {
  const t = THEMES[mode];
  const W = 1200;
  const H = 330;
  const titleGrad =
    mode === 'light' ? ['#e0478c', '#9161e8', '#3b82e0'] : ['#ff9ccb', '#c3a8ff', '#8ec5ff'];
  const branchFlowers = [
    [1150, 34, 1.15, 10],
    [1088, 52, 0.95, -20],
    [1018, 86, 1.3, 35],
    [957, 122, 0.9, 5],
    [898, 150, 1.05, -15],
    [1062, 178, 1.0, 25],
    [988, 44, 0.75, 0],
    [1118, 102, 0.7, 45],
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="normalllll — Flutter × Rust">
  <title>normalllll</title>
  <style>${MOTION_CSS}
  text{font-family:${FONT}}</style>
  ${backdrop(t, W, H, 'b')}
  <defs>
    <linearGradient id="title" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${titleGrad[0]}"/><stop offset=".5" stop-color="${titleGrad[1]}"/><stop offset="1" stop-color="${titleGrad[2]}"/>
    </linearGradient>
  </defs>
  <g clip-path="url(#bclip)">
    <rect width="${W}" height="${H}" fill="url(#bbg)"/>
    <g filter="url(#bblur)" opacity="${t.blobOpacity}">
      <circle cx="160" cy="60" r="150" fill="${t.blob[0]}"/>
      <circle cx="620" cy="320" r="170" fill="${t.blob[1]}"/>
      <circle cx="1080" cy="120" r="160" fill="${t.blob[2]}"/>
    </g>
    ${sparkles(t, [
      [70, 52, 0.9, 0],
      [520, 70, 0.6, 1.2],
      [700, 120, 1.0, 0.5],
      [780, 262, 0.7, 2.1],
      [455, 280, 0.55, 1.6],
      [1160, 268, 0.8, 0.8],
      [860, 60, 0.5, 2.6],
    ])}
    <g fill="none" stroke="${t.branch}" stroke-linecap="round">
      <path d="M1215 18 C1125 38 1045 68 962 118 C922 142 892 158 850 166" stroke-width="7"/>
      <path d="M1045 72 C1036 108 1042 146 1062 180" stroke-width="4"/>
      <path d="M962 118 C952 88 962 62 988 44" stroke-width="3.5"/>
      <path d="M1100 54 C1110 72 1116 88 1118 102" stroke-width="3"/>
    </g>
    ${branchFlowers.map(([x, y, s, rot]) => flower(x, y, s, t, rot)).join('\n    ')}
    <g fill="${t.petalEdge}"><circle cx="872" cy="162" r="4"/><circle cx="1050" cy="150" r="3.5"/><circle cx="1180" cy="26" r="4"/></g>
    ${fallingPetals(t, 16, W, H, 7)}
    <text x="88" y="112" font-size="18" letter-spacing="5" fill="${t.muted}">ようこそ ✦ WELCOME</text>
    <text x="84" y="190" font-size="78" font-weight="800" fill="url(#title)" letter-spacing="1">normalllll</text>
    <text x="88" y="236" font-size="22" font-weight="600" fill="${t.text}">Flutter × Rust · anime art tools · voice &amp; AI toys</text>
    <text x="88" y="276" font-size="16" fill="${t.muted}">Just a passerby in your life ˖ ✿ ˖</text>
  </g>
</svg>
`;
}

function footer(mode) {
  const t = THEMES[mode];
  const W = 1200;
  const H = 140;
  const waveA = mode === 'light' ? ['#ffc2dc', '#d9c9ff'] : ['#5b2a4a', '#3b2d6b'];
  const waveB = mode === 'light' ? ['#ffe0ed', '#e3f0ff'] : ['#3a2240', '#1f2a4a'];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="thanks for visiting">
  <title>thanks for visiting</title>
  <style>${MOTION_CSS}
  text{font-family:${FONT}}
  .wave{animation:wave 9s ease-in-out infinite alternate}
  .wave.b{animation-duration:12s;animation-direction:alternate-reverse}
  @keyframes wave{from{transform:translateX(-40px)}to{transform:translateX(0)}}</style>
  <defs>
    <linearGradient id="wa" x1="0" x2="1"><stop offset="0" stop-color="${waveA[0]}"/><stop offset="1" stop-color="${waveA[1]}"/></linearGradient>
    <linearGradient id="wb" x1="0" x2="1"><stop offset="0" stop-color="${waveB[0]}"/><stop offset="1" stop-color="${waveB[1]}"/></linearGradient>
    <clipPath id="fclip"><rect width="${W}" height="${H}" rx="22"/></clipPath>
  </defs>
  <g clip-path="url(#fclip)">
    ${fallingPetals(t, 8, W, H - 40, 21)}
    <path class="wave b" fill="url(#wb)" d="M0 92 C140 62 280 62 420 88 S700 120 840 92 S1100 60 1240 84 L1240 140 L0 140 Z"/>
    <path class="wave" fill="url(#wa)" d="M0 108 C160 86 300 128 460 112 S760 84 920 106 S1140 128 1240 104 L1240 140 L0 140 Z"/>
    <text x="600" y="58" text-anchor="middle" font-size="18" fill="${t.muted}" letter-spacing="2">thanks for visiting ✿ またね～</text>
  </g>
</svg>
`;
}

function about(mode) {
  const t = THEMES[mode];
  const lines = config.about || [];
  const W = 760;
  const top = 46;
  const step = 36;
  const H = top + (lines.length - 1) * step + 40;
  const accent = (i) => {
    const [ls, lsoft, ds, dsoft] = ACCENTS[i % ACCENTS.length];
    return mode === 'light' ? [ls, lsoft] : [ds, dsoft];
  };
  const [edgeA, edgeB] = accent(0);
  const rows = lines
    .map((line, i) => {
      const [strong, soft] = accent(i);
      const y = top + i * step;
      return (
        flower(44, y - 6, 0.48, { ...t, petal: soft, petalEdge: strong, flowerCore: strong }, i * 23) +
        `<text x="70" y="${y}" font-size="17" fill="${t.text}">${esc(line)}</text>`
      );
    })
    .join('\n  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(lines.join(' · '))}">
  <title>about</title>
  <style>text{font-family:${FONT}}</style>
  <defs>
    <linearGradient id="edge" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${edgeA}" stop-opacity=".7"/><stop offset="1" stop-color="${edgeB}" stop-opacity=".45"/></linearGradient>
    <filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="30"/></filter>
    <clipPath id="clip"><rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="18"/></clipPath>
  </defs>
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="18" fill="${t.cardBg}"/>
  <g clip-path="url(#clip)">
    <circle cx="${W - 60}" cy="20" r="110" fill="${accent(1)[1]}" opacity="${mode === 'light' ? 0.4 : 0.45}" filter="url(#blur)"/>
    <circle cx="${W - 200}" cy="${H}" r="90" fill="${accent(0)[1]}" opacity="${mode === 'light' ? 0.3 : 0.35}" filter="url(#blur)"/>
    ${sparkles(t, [
      [W - 70, 50, 0.8, 0],
      [W - 130, H - 40, 0.5, 1.4],
      [W - 40, H - 60, 0.6, 2.2],
    ])}
  </g>
  <style>${MOTION_CSS}</style>
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="18" fill="none" stroke="url(#edge)" stroke-width="1.5"/>
  ${rows}
</svg>
`;
}

function card(repo, entry, mode, index) {
  const t = THEMES[mode];
  const [ls, lsoft, ds, dsoft] = ACCENTS[index % ACCENTS.length];
  const strong = mode === 'light' ? ls : ds;
  const soft = mode === 'light' ? lsoft : dsoft;
  const W = 420;
  const H = 140;
  const description = entry.description || repo.description || 'No description yet.';
  const lines = wrap(description, 13.5, W - 48, 2);
  const lang = repo.language;
  const langColor = LANG_COLORS[lang] || t.muted;

  let x = 24;
  let meta = '';
  if (lang) {
    meta += `<circle cx="${x + 5}" cy="113" r="5.5" fill="${langColor}"/>`;
    meta += `<text x="${x + 16}" y="117.5" font-size="12.5" fill="${t.muted}">${esc(lang)}</text>`;
    x += 16 + textWidth(lang, 12.5) + 18;
  }
  meta += `<path d="${ICON_STAR}" transform="translate(${r1(x)} 105) scale(.95)" fill="${t.muted}"/>`;
  meta += `<text x="${r1(x + 20)}" y="117.5" font-size="12.5" fill="${t.muted}">${fmtCount(repo.stargazers_count)}</text>`;

  let tagX = W - 22;
  const tags = [...(entry.tags || [])].reverse().map((tag) => {
    const w = r1(textWidth(tag, 11) + 18);
    tagX -= w;
    const g =
      `<rect x="${r1(tagX)}" y="102" width="${w}" height="21" rx="10.5" fill="${strong}" fill-opacity="${t.pillBg}"/>` +
      `<text x="${r1(tagX + w / 2)}" y="116.5" font-size="11" text-anchor="middle" fill="${strong}">${esc(tag)}</text>`;
    tagX -= 6;
    return g;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(repo.name)}: ${esc(description)}">
  <title>${esc(repo.name)}</title>
  <style>text{font-family:${FONT}}</style>
  <defs>
    <linearGradient id="edge" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${strong}" stop-opacity=".75"/><stop offset="1" stop-color="${soft}" stop-opacity=".5"/></linearGradient>
    <filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="22"/></filter>
    <clipPath id="clip"><rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="16"/></clipPath>
  </defs>
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="16" fill="${t.cardBg}"/>
  <g clip-path="url(#clip)">
    <circle cx="${W - 30}" cy="10" r="70" fill="${soft}" opacity="${mode === 'light' ? 0.45 : 0.5}" filter="url(#blur)"/>
    <g opacity=".85">${flower(W - 34, 32, 0.62, { ...t, petal: soft, petalEdge: strong, flowerCore: strong }, index * 17)}</g>
  </g>
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="16" fill="none" stroke="url(#edge)" stroke-width="1.5"/>
  <path d="${ICON_REPO}" transform="translate(24 21)" fill="${strong}"/>
  <text x="48" y="34" font-size="16.5" font-weight="700" fill="${strong}">${esc(repo.name)}</text>
  ${lines.map((l, i) => `<text x="24" y="${62 + i * 20}" font-size="13.5" fill="${t.text}">${esc(l)}</text>`).join('\n  ')}
  ${meta}
  ${tags.join('')}
</svg>
`;
}

function cardGrid(entries) {
  const cell = ({ repo }) =>
    `<a href="https://github.com/${config.user}/${repo}"><picture>` +
    `<source media="(prefers-color-scheme: dark)" srcset="assets/cards/${repo}-dark.svg">` +
    `<img src="assets/cards/${repo}-light.svg" alt="${repo}" width="49%">` +
    `</picture></a>`;
  const rows = [];
  for (let i = 0; i < entries.length; i += 2) rows.push(entries.slice(i, i + 2).map(cell).join('\n'));
  return `<p align="center">\n${rows.join('\n<br>\n')}\n</p>`;
}

async function fetchRepos() {
  // REPOS_FILE: a saved copy of the repos API response, for building without network access.
  if (process.env.REPOS_FILE) {
    return new Map(JSON.parse(await readFile(process.env.REPOS_FILE, 'utf8')).map((r) => [r.name, r]));
  }
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'profile-card-builder' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com/users/${config.user}/repos?per_page=100&type=owner`, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  return new Map((await res.json()).map((r) => [r.name, r]));
}

const repos = await fetchRepos();
const assets = join(root, 'assets');
await mkdir(join(assets, 'cards'), { recursive: true });

for (const mode of ['light', 'dark']) {
  await writeFile(join(assets, `banner-${mode}.svg`), banner(mode));
  await writeFile(join(assets, `footer-${mode}.svg`), footer(mode));
  await writeFile(join(assets, `about-${mode}.svg`), about(mode));
}

const shown = [];
for (const entry of config.cards) {
  const repo = repos.get(entry.repo);
  if (!repo) {
    console.warn(`skipped ${entry.repo}: not found among public repositories`);
    continue;
  }
  const index = shown.length;
  for (const mode of ['light', 'dark']) {
    await writeFile(join(assets, 'cards', `${entry.repo}-${mode}.svg`), card(repo, entry, mode, index));
  }
  shown.push(entry);
}

const readmePath = join(root, 'README.md');
const readme = await readFile(readmePath, 'utf8');
const marker = /(<!-- cards:start -->)[\s\S]*?(<!-- cards:end -->)/;
if (!marker.test(readme)) throw new Error('README.md is missing the cards:start / cards:end markers');
await writeFile(readmePath, readme.replace(marker, `$1\n${cardGrid(shown)}\n$2`));

console.log(`built banner, footer and ${shown.length} cards`);
