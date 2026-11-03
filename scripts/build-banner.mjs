/**
 * Generates the animated README banners (`.github/assets/banner-{dark,light}.svg`)
 * from one template, so both themes stay in sync. Animation is pure CSS and the
 * fonts are subset and embedded as WOFF2, because GitHub serves the SVG through an
 * `<img>` tag, which blocks scripts and every external request.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import subsetFont from "subset-font";

const CYCLE_SECONDS = 23.5;
const CARD_WIDTH = 492;
const CARD_HEIGHT = 384;
const CHAR_WIDTH = 9;
const SCROLL_DISTANCE = 52;
const ACT_ONE_END = 14;
const ACT_TWO_END = 22;
const FADE_SECONDS = 0.5;

const THEMES = {
  dark: {
    background: "#151619",
    card: "#1b1c20",
    ink: "#e9ebef",
    soft: "#cfd1d5",
    muted: "#9b9ea5",
    line: "#2e3034",
    accent: "#a29aff",
    corner: "#968dfd",
    string: "#ec6d3d",
    gridOpacity: "0.45",
    glowOpacity: "0.28",
    shadowOpacity: "0.35",
  },
  light: {
    background: "#ebeff2",
    card: "#f3f5f7",
    ink: "#101214",
    soft: "#3b3d40",
    muted: "#5c6166",
    line: "#caced3",
    accent: "#4d4691",
    corner: "#968dfd",
    string: "#c94c18",
    gridOpacity: "0.7",
    glowOpacity: "0.28",
    shadowOpacity: "0.16",
  },
};

/** @typedef {typeof THEMES.dark} Theme */

/** @param {number} seconds */
const percent = (seconds) => Number(((seconds / CYCLE_SECONDS) * 100).toFixed(3));

/** @type {string[]} */
const animatedClasses = [];

/** @param {string} name @param {string} body */
const register = (name, body) => {
  animatedClasses.push(name);
  return body;
};

/** @param {string} name @param {number} at @param {number} until */
const appear = (name, at, until) => {
  const settled = at + 0.35;
  const gone = until + FADE_SECONDS;
  return register(
    name,
    `@keyframes ${name} {
        0%, ${percent(at)}% { opacity: 0; transform: translateY(4px); }
        ${percent(settled)}%, ${percent(until)}% { opacity: 1; transform: translateY(0); }
        ${percent(gone)}%, 100% { opacity: 0; transform: translateY(0); }
      }
      .${name} { animation: ${name} ${CYCLE_SECONDS}s ease-out infinite; }`,
  );
};

/** @param {string} name @param {number} start @param {number} finish @param {number} until @param {number} characters */
const typed = (name, start, finish, until, characters) => {
  const gone = until + FADE_SECONDS;
  return register(
    name,
    `@keyframes ${name} {
        0%, ${percent(start)}% { clip-path: inset(0 100% 0 0); opacity: 1; animation-timing-function: steps(${characters}, end); }
        ${percent(finish)}%, ${percent(until)}% { clip-path: inset(0 0 0 0); opacity: 1; animation-timing-function: ease-out; }
        ${percent(gone)}%, 100% { clip-path: inset(0 0 0 0); opacity: 0; }
      }
      .${name} { animation: ${name} ${CYCLE_SECONDS}s infinite; }`,
  );
};

/** @param {string} name @param {number} appearsAt @param {number} start @param {number} finish @param {number} until @param {number} characters */
const cursor = (name, appearsAt, start, finish, until, characters) => {
  const gone = until + FADE_SECONDS;
  const travelled = characters * CHAR_WIDTH;
  return register(
    name,
    `@keyframes ${name} {
        0%, ${percent(appearsAt)}% { transform: translateX(0); opacity: ${appearsAt > 0 ? 0 : 1}; }
        ${percent(appearsAt + 0.01)}%, ${percent(start)}% { transform: translateX(0); opacity: 1; animation-timing-function: steps(${characters}, end); }
        ${percent(finish)}%, ${percent(until)}% { transform: translateX(${travelled}px); opacity: 1; animation-timing-function: ease-out; }
        ${percent(gone)}%, 100% { transform: translateX(${travelled}px); opacity: 0; }
      }
      .${name} { animation: ${name} ${CYCLE_SECONDS}s infinite; }`,
  );
};

const scroll = register(
  "scroll",
  `@keyframes scroll {
        0%, ${percent(8.6)}% { transform: translateY(0); }
        ${percent(9.1)}%, ${percent(ACT_ONE_END + FADE_SECONDS)}% { transform: translateY(-${SCROLL_DISTANCE}px); }
        ${percent(ACT_ONE_END + FADE_SECONDS + 0.1)}%, 100% { transform: translateY(0); }
      }
      .scroll { animation: scroll ${CYCLE_SECONDS}s ease-in-out infinite; }`,
);

/** @param {string} name @param {number} visibleFrom @param {number} visibleUntil */
const swap = (name, visibleFrom, visibleUntil) =>
  register(
    name,
    `@keyframes ${name} {
        0%, ${percent(visibleFrom)}% { opacity: ${visibleFrom === 0 ? 1 : 0}; }
        ${percent(visibleFrom + 0.3)}%, ${percent(visibleUntil)}% { opacity: 1; }
        ${percent(visibleUntil + 0.3)}%, 100% { opacity: ${visibleUntil >= CYCLE_SECONDS ? 1 : 0}; }
      }
      .${name} { animation: ${name} ${CYCLE_SECONDS}s linear infinite; }`,
  );

const statusConnected = swap("statusConnected", 0, ACT_ONE_END);
const statusReadOnly = swap("statusReadOnly", ACT_ONE_END + 0.5, ACT_TWO_END);

const ACT_ONE_PROMPT = "Set up email for example.no";
const ACT_TWO_PROMPT = "Delete the old A record for www";

const sequence = [
  scroll,
  statusConnected,
  statusReadOnly,
  typed("typeOne", 0.6, 2.4, ACT_ONE_END, ACT_ONE_PROMPT.length),
  cursor("cursorOne", 0, 0.6, 2.4, ACT_ONE_END, ACT_ONE_PROMPT.length),
  appear("listCall", 2.9, ACT_ONE_END),
  appear("listResult", 3.5, ACT_ONE_END),
  appear("mxCall", 4.7, ACT_ONE_END),
  appear("mxResult", 5.3, ACT_ONE_END),
  appear("spfCall", 6.5, ACT_ONE_END),
  appear("spfResult", 7.1, ACT_ONE_END),
  appear("dkimCall", 9.4, ACT_ONE_END),
  appear("dkimResult", 10, ACT_ONE_END),
  appear("done", 11.2, ACT_ONE_END),
  typed("typeTwo", 15.2, 17, ACT_TWO_END, ACT_TWO_PROMPT.length),
  cursor("cursorTwo", 14.9, 15.2, 17, ACT_TWO_END, ACT_TWO_PROMPT.length),
  appear("listCallTwo", 17.5, ACT_TWO_END),
  appear("listResultTwo", 18.1, ACT_TWO_END),
  appear("blocked", 19, ACT_TWO_END),
  appear("reply", 20.2, ACT_TWO_END),
].join("\n      ");

const ASSET_DIR = fileURLToPath(new URL("../.github/assets/", import.meta.url));
const require = createRequire(import.meta.url);

/** @param {string} specifier */
const readFont = (specifier) => readFileSync(require.resolve(specifier));

/** @param {{ family: string, weight: number, style: string, specifier: string, characters: string }} font */
const embedFont = async ({ family, weight, style, specifier, characters }) => {
  const subset = await subsetFont(readFont(specifier), characters, { targetFormat: "woff2" });
  return `@font-face { font-family: "${family}"; font-weight: ${weight}; font-style: ${style}; src: url(data:font/woff2;base64,${subset.toString("base64")}) format("woff2"); }`;
};

const CHIPS = [
  { label: "READ-ONLY MODE", highlighted: true },
  { label: "ALLOW / DENY LISTS", highlighted: false },
  { label: "VALIDATED INPUT", highlighted: false },
  { label: "17 TOOLS · STDIO", highlighted: false },
];
const CHIP_FONT_SIZE = 12;
const CHIP_SPACING = 2;
const CHIP_PADDING = 14;
const CHIP_GAP = 10;

/** @param {string} label */
const chipWidth = (label) =>
  label.length * (CHIP_FONT_SIZE * 0.6 + CHIP_SPACING) + CHIP_PADDING * 2;

/** @param {Theme} t */
const renderChips = (t) => {
  let right = 1208;
  return [...CHIPS]
    .reverse()
    .map(({ label, highlighted }) => {
      const width = chipWidth(label);
      right -= width;
      const x = right;
      right -= CHIP_GAP;
      const stroke = highlighted ? t.accent : t.line;
      const fill = highlighted ? t.accent : t.soft;
      return `<g transform="translate(${x.toFixed(1)} 568)">
    <rect width="${width.toFixed(1)}" height="28" rx="4" fill="none" stroke="${stroke}" stroke-width="1.5"/>
    <text x="${(width / 2 + 1).toFixed(1)}" y="19" text-anchor="middle" class="mono" font-size="${CHIP_FONT_SIZE}" letter-spacing="${CHIP_SPACING}" fill="${fill}">${label}</text>
  </g>`;
    })
    .reverse()
    .join("\n  ");
};

/** @param {Theme} t @param {{ name: string, args: string, y: number }} call */
const toolCall = (t, { name, args, y }) =>
  `<rect x="22" y="${y - 9}" width="8" height="8" fill="${t.accent}"/>
        <text x="42" y="${y}"><tspan fill="${t.accent}" font-weight="700">${name}</tspan><tspan fill="${t.muted}">${args}</tspan></text>`;

/** @param {Theme} t @param {number} y @param {string} seconds */
const timing = (t, y, seconds) =>
  `<text x="470" y="${y}" text-anchor="end" fill="${t.muted}">${seconds}s <tspan fill="${t.accent}">✓</tspan></text>`;

/** @param {Theme} t @param {string} fontFaces */
const render = (
  t,
  fontFaces,
) => `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="640" viewBox="0 0 1280 640" role="img" aria-labelledby="banner-title">
  <title id="banner-title">domeneshop-mcp — MCP server for Domeneshop domains, DNS, HTTP forwards, dynamic DNS and invoices</title>
  <defs>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M40 0 H0 V40" fill="none" stroke="${t.line}" stroke-width="1" stroke-opacity="${t.gridOpacity}"/>
    </pattern>
    <pattern id="grid-major" width="160" height="160" patternUnits="userSpaceOnUse">
      <path d="M160 0 H0 V160" fill="none" stroke="${t.line}" stroke-width="1"/>
    </pattern>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${t.accent}" stop-opacity="${t.glowOpacity}"/>
      <stop offset="1" stop-color="${t.accent}" stop-opacity="0"/>
    </radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="${t.accent}" flood-opacity="${t.shadowOpacity}"/>
    </filter>
    <clipPath id="feed-clip"><rect x="0" y="47" width="${CARD_WIDTH}" height="${CARD_HEIGHT - 47}"/></clipPath>
    <style>
      ${fontFaces}
      .mono { font-family: "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
      .display { font-family: Newsreader, Georgia, "Times New Roman", serif; font-style: italic; }
      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
      @keyframes blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
      .live { animation: pulse 2s ease-in-out infinite; }
      .blink { animation: blink 1.1s steps(1, end) infinite; }
      ${sequence}
      @media (prefers-reduced-motion: reduce) {
        .live, .blink, ${animatedClasses.map((name) => `.${name}`).join(", ")} { animation: none; }
        .scroll { transform: translateY(-${SCROLL_DISTANCE}px); }
        .actTwo, .statusReadOnly, .cursorOne { display: none; }
      }
    </style>
  </defs>

  <rect width="1280" height="640" fill="${t.background}"/>
  <rect width="1280" height="640" fill="url(#grid)"/>
  <rect width="1280" height="640" fill="url(#grid-major)"/>
  <ellipse cx="962" cy="332" rx="440" ry="310" fill="url(#glow)"/>

  <g fill="none" stroke="${t.corner}" stroke-width="2">
    <path d="M24 48 V24 H48"/><path d="M1232 24 H1256 V48"/>
    <path d="M24 592 V616 H48"/><path d="M1232 616 H1256 V592"/>
  </g>

  <g transform="translate(72 56)">
    <rect width="44" height="44" rx="9" fill="${t.ink}"/>
    <text x="22" y="31" text-anchor="middle" class="mono" font-size="28" font-weight="700" fill="${t.background}">@</text>
    <text x="60" y="31" class="mono" font-size="24" font-weight="700" letter-spacing="-0.5" fill="${t.ink}">domeneshop<tspan fill="${t.accent}">-</tspan>mcp</text>
    <text x="272" y="31" class="mono" font-size="14" fill="${t.muted}">by mlz.</text>
  </g>
  <g transform="translate(1004 62)">
    <rect width="204" height="32" rx="4" fill="${t.background}" stroke="${t.line}" stroke-width="1.5"/>
    <text x="103" y="21" text-anchor="middle" class="mono" font-size="12" letter-spacing="2.6" fill="${t.soft}">OPEN SOURCE · MIT</text>
  </g>

  <text x="72" y="196" class="mono" font-size="15" letter-spacing="4.5" fill="${t.soft}">MCP SERVER<tspan fill="${t.accent}" dx="10">/</tspan><tspan dx="10">DOMENESHOP API</tspan></text>
  <text x="66" y="306" class="display" font-size="106" font-weight="500" letter-spacing="-1.5" fill="${t.ink}">Domeneshop</text>
  <text x="66" y="406" class="display" font-size="106" font-weight="500" letter-spacing="-1.5" fill="${t.ink}">MCP</text>
  <text class="mono" font-size="19" fill="${t.soft}">
    <tspan x="72" y="468">Domains, DNS, HTTP forwards, dynamic DNS</tspan>
    <tspan x="72" dy="30">and invoices — from any AI assistant.</tspan>
  </text>

  <g transform="translate(716 140)" class="mono" font-size="15">
    <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="4" fill="${t.card}" stroke="${t.ink}" stroke-width="1.5" filter="url(#shadow)"/>
    <text x="22" y="30" font-size="12" letter-spacing="2.4" fill="${t.muted}">ASSISTANT SESSION</text>
    <text x="470" y="30" text-anchor="end" font-size="12" letter-spacing="2.4" fill="${t.accent}" class="statusConnected"><tspan class="live">●</tspan> CONNECTED</text>
    <text x="470" y="30" text-anchor="end" font-size="12" letter-spacing="2.4" fill="${t.string}" class="statusReadOnly" opacity="0"><tspan class="live">●</tspan> READ-ONLY · 8 TOOLS</text>
    <line x1="0" y1="46" x2="${CARD_WIDTH}" y2="46" stroke="${t.ink}" stroke-width="1.5"/>

    <g clip-path="url(#feed-clip)">
      <g class="scroll">
        <text x="22" y="84" fill="${t.muted}">&gt;</text>
        <text x="42" y="84" fill="${t.ink}" class="typeOne">${ACT_ONE_PROMPT}</text>
        <g class="cursorOne"><rect class="blink" x="42" y="71" width="${CHAR_WIDTH}" height="17" fill="${t.accent}"/></g>

        <g class="listCall">${toolCall(t, { name: "list_dns_records", args: " domain_id=1337", y: 124 })}</g>
        <g class="listResult"><text x="42" y="148" fill="${t.muted}">└ 6 records · no MX, no SPF</text>${timing(t, 124, "0.3")}</g>

        <g class="mxCall">${toolCall(t, { name: "upsert_dns_record", args: "", y: 188 })}</g>
        <g class="mxResult"><text x="42" y="212" xml:space="preserve"><tspan fill="${t.muted}">MX  </tspan><tspan fill="${t.string}">@ → mail.example.no</tspan><tspan fill="${t.muted}"> prio </tspan><tspan fill="${t.string}">10</tspan></text>${timing(t, 188, "0.4")}</g>

        <g class="spfCall">${toolCall(t, { name: "upsert_dns_record", args: "", y: 252 })}</g>
        <g class="spfResult"><text x="42" y="276" xml:space="preserve"><tspan fill="${t.muted}">TXT </tspan><tspan fill="${t.string}">@ "v=spf1 mx ~all"</tspan></text>${timing(t, 252, "0.4")}</g>

        <g class="dkimCall">${toolCall(t, { name: "upsert_dns_record", args: "", y: 316 })}</g>
        <g class="dkimResult"><text x="42" y="340" xml:space="preserve"><tspan fill="${t.muted}">TXT </tspan><tspan fill="${t.string}">mail._domainkey "v=DKIM1; p=MIIB…"</tspan></text>${timing(t, 316, "0.5")}</g>

        <g class="done">
          <rect x="22" y="362" width="448" height="36" rx="4" fill="none" stroke="${t.accent}" stroke-width="1.5"/>
          <text x="36" y="385" fill="${t.accent}">✓ example.no can receive mail · 3 records</text>
        </g>
      </g>

      <g class="actTwo">
        <text x="42" y="84" fill="${t.ink}" class="typeTwo">${ACT_TWO_PROMPT}</text>
        <g class="cursorTwo"><rect class="blink" x="42" y="71" width="${CHAR_WIDTH}" height="17" fill="${t.accent}"/></g>

        <g class="listCallTwo">${toolCall(t, { name: "list_dns_records", args: " domain_id=1337 host=www", y: 124 })}</g>
        <g class="listResultTwo"><text x="42" y="148" fill="${t.muted}">└ 1 record · www A 198.51.100.4</text>${timing(t, 124, "0.3")}</g>

        <g class="blocked">
          <rect x="22" y="180" width="448" height="62" rx="4" fill="none" stroke="${t.string}" stroke-width="1.5"/>
          <text x="36" y="205" fill="${t.string}" font-weight="700">✕ delete_dns_record is not available</text>
          <text x="36" y="227" fill="${t.muted}">read-only mode hides every write tool</text>
        </g>

        <g class="reply">
          <text x="22" y="276" fill="${t.ink}">I can look, but not change anything here.</text>
          <text x="22" y="298" fill="${t.muted}">Unset DOMENESHOP_READ_ONLY to allow edits.</text>
        </g>
      </g>
    </g>
  </g>

  <line x1="72" y1="556" x2="1208" y2="556" stroke="${t.line}" stroke-width="1.5"/>
  <text x="72" y="587" class="mono" font-size="14" letter-spacing="3" fill="${t.ink}">NPX DOMENESHOP-MCP</text>
  ${renderChips(t)}
</svg>
`;

/** @param {string} svg */
const visibleText = (svg) =>
  svg
    .replace(/<style>[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]*>/g, "")
    .replaceAll("&gt;", ">")
    .replaceAll("&lt;", "<")
    .replaceAll("&amp;", "&");

const PLEX_FONTS = [
  {
    weight: 400,
    specifier: "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2",
  },
  {
    weight: 700,
    specifier: "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-700-normal.woff2",
  },
];
const NEWSREADER = "@fontsource/newsreader/files/newsreader-latin-500-italic.woff2";

for (const [name, theme] of Object.entries(THEMES)) {
  const characters = [...new Set(visibleText(render(theme, "")))].join("");
  const fontFaces = (
    await Promise.all([
      ...PLEX_FONTS.map(({ weight, specifier }) =>
        embedFont({ family: "IBM Plex Mono", weight, style: "normal", specifier, characters }),
      ),
      embedFont({
        family: "Newsreader",
        weight: 500,
        style: "italic",
        specifier: NEWSREADER,
        characters: "DomeneshopMCP",
      }),
    ])
  ).join("\n      ");
  writeFileSync(`${ASSET_DIR}banner-${name}.svg`, render(theme, fontFaces));
}
