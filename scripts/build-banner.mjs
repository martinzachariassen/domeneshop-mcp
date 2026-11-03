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

const CARD_X = 680;
const CARD_WIDTH = 528;
const CARD_HEIGHT = 392;
const CARD_INNER_RIGHT = CARD_WIDTH - 22;
const CARD_BOX_WIDTH = CARD_WIDTH - 44;
const FEED_FONT_SIZE = 17;
const CHAR_WIDTH = FEED_FONT_SIZE * 0.6;
const CURSOR_HEIGHT = 20;

const PROMPT_ONE_Y = 84;
const PROMPT_TWO_Y = 484;
const SCROLL_A = 56;
const SCROLL_B = PROMPT_TWO_Y - PROMPT_ONE_Y;

const CHAR_SECONDS = 0.05;
const WORD_PAUSE_SECONDS = 0.1;
const FADE_SECONDS = 0.5;
const THINKING_SECONDS = 0.4;
const RESULT_SECONDS = 0.5;
const NEXT_CALL_SECONDS = 0.6;

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
/** @typedef {{ time: number, chars: number }} Waypoint */
/** @typedef {{ waypoints: Waypoint[], finish: number, length: number }} Typing */

const ACT_ONE_PROMPT = "Set up email for example.no";
const ACT_TWO_PROMPT = "Delete the old A record for www";

/**
 * Splits a prompt into words typed at a steady pace with short, slightly
 * varying pauses between them, so the typing looks like a person's.
 * @param {string} prompt
 * @param {number} start
 * @returns {Typing}
 */
const typingFor = (prompt, start) => {
  const words = prompt.split(" ");
  /** @type {Waypoint[]} */
  const waypoints = [{ time: start, chars: 0 }];
  let time = start;
  let chars = 0;
  words.forEach((word, index) => {
    const text = index === 0 ? word : ` ${word}`;
    chars += text.length;
    time += text.length * CHAR_SECONDS;
    waypoints.push({ time, chars });
    if (index < words.length - 1) {
      time += WORD_PAUSE_SECONDS + (index % 3) * 0.06;
      waypoints.push({ time, chars });
    }
  });
  return { waypoints, finish: time, length: prompt.length };
};

const typingOne = typingFor(ACT_ONE_PROMPT, 0.4);

const listCallAt = typingOne.finish + THINKING_SECONDS;
const listResultAt = listCallAt + RESULT_SECONDS;
const mxCallAt = listResultAt + NEXT_CALL_SECONDS;
const mxResultAt = mxCallAt + RESULT_SECONDS;
const spfCallAt = mxResultAt + NEXT_CALL_SECONDS;
const spfResultAt = spfCallAt + RESULT_SECONDS;
const scrollAStart = spfResultAt + 0.5;
const scrollAEnd = scrollAStart + 0.4;
const dkimCallAt = scrollAEnd + 0.2;
const dkimResultAt = dkimCallAt + RESULT_SECONDS;
const doneAt = dkimResultAt + 0.6;
const ACT_ONE_END = doneAt + 2.4;
const scrollBEnd = ACT_ONE_END + 0.9;

const typingTwo = typingFor(ACT_TWO_PROMPT, scrollBEnd);

const listCallTwoAt = typingTwo.finish + THINKING_SECONDS;
const listResultTwoAt = listCallTwoAt + RESULT_SECONDS;
const blockedAt = listResultTwoAt + 0.7;
const replyAt = blockedAt + 1;
const ACT_TWO_END = replyAt + 2;
const RESET_AT = ACT_TWO_END + FADE_SECONDS + 0.1;
const CYCLE_SECONDS = RESET_AT + 0.5;

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
const appear = (name, at, until) =>
  register(
    name,
    `@keyframes ${name} {
        0%, ${percent(at)}% { opacity: 0; transform: translateY(4px); }
        ${percent(at + 0.35)}%, ${percent(until)}% { opacity: 1; transform: translateY(0); }
        ${percent(until + FADE_SECONDS)}%, 100% { opacity: 0; transform: translateY(0); }
      }
      .${name} { animation: ${name} ${CYCLE_SECONDS}s ease-out infinite; }`,
  );

/**
 * One keyframe per waypoint; each word is revealed in per-character steps and
 * the pauses between words hold still.
 * @param {Typing} typing
 * @param {(chars: number) => string} valueAt
 */
const typingKeyframes = ({ waypoints }, valueAt) =>
  waypoints
    .map((waypoint, index) => {
      const next = waypoints[index + 1];
      const steps = next ? next.chars - waypoint.chars : 0;
      const timing = steps > 0 ? `steps(${steps}, end)` : "linear";
      return `${percent(waypoint.time)}% { ${valueAt(waypoint.chars)} animation-timing-function: ${timing}; }`;
    })
    .join("\n        ");

/** @param {string} name @param {Typing} typing @param {number} until */
const typed = (name, typing, until) => {
  const hidden = "clip-path: inset(0 100% 0 0); opacity: 1;";
  const shown = "clip-path: inset(0 0 0 0); opacity: 1;";
  return register(
    name,
    `@keyframes ${name} {
        0% { ${hidden} }
        ${typingKeyframes(typing, (chars) => `clip-path: inset(0 ${((1 - chars / typing.length) * 100).toFixed(2)}% 0 0); opacity: 1;`)}
        ${percent(until)}% { ${shown} }
        ${percent(until + FADE_SECONDS)}%, 100% { clip-path: inset(0 0 0 0); opacity: 0; }
      }
      .${name} { animation: ${name} ${CYCLE_SECONDS}s infinite; }`,
  );
};

/** @param {string} name @param {number} appearsAt @param {Typing} typing @param {number} until */
const cursor = (name, appearsAt, typing, until) => {
  const travelled = typing.length * CHAR_WIDTH;
  const initialOpacity = appearsAt > 0 ? 0 : 1;
  return register(
    name,
    `@keyframes ${name} {
        0%, ${percent(appearsAt)}% { transform: translateX(0); opacity: ${initialOpacity}; }
        ${typingKeyframes(typing, (chars) => `transform: translateX(${chars * CHAR_WIDTH}px); opacity: 1;`)}
        ${percent(until)}% { transform: translateX(${travelled}px); opacity: 1; }
        ${percent(until + FADE_SECONDS)}%, 100% { transform: translateX(${travelled}px); opacity: 0; }
      }
      .${name} { animation: ${name} ${CYCLE_SECONDS}s infinite; }`,
  );
};

const scroll = register(
  "scroll",
  `@keyframes scroll {
        0%, ${percent(scrollAStart)}% { transform: translateY(0); }
        ${percent(scrollAEnd)}%, ${percent(ACT_ONE_END)}% { transform: translateY(-${SCROLL_A}px); }
        ${percent(scrollBEnd)}%, ${percent(RESET_AT - 0.01)}% { transform: translateY(-${SCROLL_B}px); }
        ${percent(RESET_AT)}%, 100% { transform: translateY(0); }
      }
      .scroll { animation: scroll ${CYCLE_SECONDS}s ease-in-out infinite; }`,
);

const statusSwapAt = ACT_ONE_END + 0.3;

const statusConnected = register(
  "statusConnected",
  `@keyframes statusConnected {
        0%, ${percent(statusSwapAt)}% { opacity: 1; }
        ${percent(statusSwapAt + 0.2)}%, ${percent(RESET_AT)}% { opacity: 0; }
        100% { opacity: 1; }
      }
      .statusConnected { animation: statusConnected ${CYCLE_SECONDS}s linear infinite; }`,
);

const statusReadOnly = register(
  "statusReadOnly",
  `@keyframes statusReadOnly {
        0%, ${percent(statusSwapAt + 0.2)}% { opacity: 0; }
        ${percent(statusSwapAt + 0.5)}%, ${percent(ACT_TWO_END)}% { opacity: 1; }
        ${percent(ACT_TWO_END + FADE_SECONDS)}%, 100% { opacity: 0; }
      }
      .statusReadOnly { animation: statusReadOnly ${CYCLE_SECONDS}s linear infinite; }`,
);

const sequence = [
  scroll,
  statusConnected,
  statusReadOnly,
  typed("typeOne", typingOne, ACT_ONE_END),
  cursor("cursorOne", 0, typingOne, ACT_ONE_END),
  appear("listCall", listCallAt, ACT_ONE_END),
  appear("listResult", listResultAt, ACT_ONE_END),
  appear("mxCall", mxCallAt, ACT_ONE_END),
  appear("mxResult", mxResultAt, ACT_ONE_END),
  appear("spfCall", spfCallAt, ACT_ONE_END),
  appear("spfResult", spfResultAt, ACT_ONE_END),
  appear("dkimCall", dkimCallAt, ACT_ONE_END),
  appear("dkimResult", dkimResultAt, ACT_ONE_END),
  appear("done", doneAt, ACT_ONE_END),
  appear("promptTwo", typingTwo.waypoints[0]?.time ?? scrollBEnd, ACT_TWO_END),
  typed("typeTwo", typingTwo, ACT_TWO_END),
  cursor("cursorTwo", scrollBEnd - 0.1, typingTwo, ACT_TWO_END),
  appear("listCallTwo", listCallTwoAt, ACT_TWO_END),
  appear("listResultTwo", listResultTwoAt, ACT_TWO_END),
  appear("blocked", blockedAt, ACT_TWO_END),
  appear("reply", replyAt, ACT_TWO_END),
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
const CHIP_FONT_SIZE = 13;
const CHIP_SPACING = 1.6;
const CHIP_PADDING = 14;
const CHIP_GAP = 10;
const CHIP_HEIGHT = 30;

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
      return `<g transform="translate(${x.toFixed(1)} 566)">
    <rect width="${width.toFixed(1)}" height="${CHIP_HEIGHT}" rx="4" fill="none" stroke="${stroke}" stroke-width="1.5"/>
    <text x="${(width / 2 + CHIP_SPACING / 2).toFixed(1)}" y="20" text-anchor="middle" class="mono" font-size="${CHIP_FONT_SIZE}" letter-spacing="${CHIP_SPACING}" fill="${fill}">${label}</text>
  </g>`;
    })
    .reverse()
    .join("\n  ");
};

/** @param {Theme} t @param {{ name: string, args: string, y: number }} call */
const toolCall = (t, { name, args, y }) =>
  `<rect x="22" y="${y - 10}" width="9" height="9" fill="${t.accent}"/>
        <text x="42" y="${y}"><tspan fill="${t.accent}" font-weight="700">${name}</tspan><tspan fill="${t.muted}">${args}</tspan></text>`;

/** @param {Theme} t @param {number} y @param {string} seconds */
const timing = (t, y, seconds) =>
  `<text x="${CARD_INNER_RIGHT}" y="${y}" text-anchor="end" fill="${t.muted}">${seconds}s <tspan fill="${t.accent}">✓</tspan></text>`;

/** @param {Theme} t @param {number} y */
const cursorBlock = (t, y) =>
  `<rect class="blink" x="42" y="${y - 15}" width="${CHAR_WIDTH}" height="${CURSOR_HEIGHT}" fill="${t.accent}"/>`;

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
        .scroll { transform: translateY(-${SCROLL_A}px); }
        .actTwo, .statusReadOnly, .cursorOne { display: none; }
      }
    </style>
  </defs>

  <rect width="1280" height="640" fill="${t.background}"/>
  <rect width="1280" height="640" fill="url(#grid)"/>
  <rect width="1280" height="640" fill="url(#grid-major)"/>
  <ellipse cx="${CARD_X + CARD_WIDTH / 2}" cy="336" rx="450" ry="320" fill="url(#glow)"/>

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
    <text x="103" y="21" text-anchor="middle" class="mono" font-size="13" letter-spacing="2.6" fill="${t.soft}">OPEN SOURCE · MIT</text>
  </g>

  <text x="72" y="196" class="mono" font-size="16" letter-spacing="4.5" fill="${t.soft}">MCP SERVER<tspan fill="${t.accent}" dx="10">/</tspan><tspan dx="10">DOMENESHOP API</tspan></text>
  <text x="66" y="306" class="display" font-size="106" font-weight="500" letter-spacing="-1.5" fill="${t.ink}">Domeneshop</text>
  <text x="66" y="406" class="display" font-size="106" font-weight="500" letter-spacing="-1.5" fill="${t.ink}">MCP</text>
  <text class="mono" font-size="21" fill="${t.soft}">
    <tspan x="72" y="468">Domains, DNS, HTTP forwards, dynamic DNS</tspan>
    <tspan x="72" dy="32">and invoices — from any AI assistant.</tspan>
  </text>

  <g transform="translate(${CARD_X} 140)" class="mono" font-size="${FEED_FONT_SIZE}">
    <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="4" fill="${t.card}" stroke="${t.ink}" stroke-width="1.5" filter="url(#shadow)"/>
    <text x="22" y="30" font-size="13" letter-spacing="2.4" fill="${t.muted}">ASSISTANT SESSION</text>
    <text x="${CARD_INNER_RIGHT}" y="30" text-anchor="end" font-size="13" letter-spacing="2.4" fill="${t.accent}" class="statusConnected"><tspan class="live">●</tspan> CONNECTED</text>
    <text x="${CARD_INNER_RIGHT}" y="30" text-anchor="end" font-size="13" letter-spacing="2.4" fill="${t.string}" class="statusReadOnly" opacity="0"><tspan class="live">●</tspan> READ-ONLY · 8 TOOLS</text>
    <line x1="0" y1="46" x2="${CARD_WIDTH}" y2="46" stroke="${t.ink}" stroke-width="1.5"/>

    <g clip-path="url(#feed-clip)">
      <g class="scroll">
        <text x="22" y="${PROMPT_ONE_Y}" fill="${t.muted}">&gt;</text>
        <text x="42" y="${PROMPT_ONE_Y}" fill="${t.ink}" class="typeOne">${ACT_ONE_PROMPT}</text>
        <g class="cursorOne">${cursorBlock(t, PROMPT_ONE_Y)}</g>

        <g class="listCall">${toolCall(t, { name: "list_dns_records", args: " domain_id=1337", y: 130 })}</g>
        <g class="listResult"><text x="42" y="156" fill="${t.muted}">└ 6 records · no MX, no SPF</text>${timing(t, 130, "0.3")}</g>

        <g class="mxCall">${toolCall(t, { name: "upsert_dns_record", args: "", y: 200 })}</g>
        <g class="mxResult"><text x="42" y="226" xml:space="preserve"><tspan fill="${t.muted}">MX  </tspan><tspan fill="${t.string}">@ → mail.example.no</tspan><tspan fill="${t.muted}"> prio </tspan><tspan fill="${t.string}">10</tspan></text>${timing(t, 200, "0.4")}</g>

        <g class="spfCall">${toolCall(t, { name: "upsert_dns_record", args: "", y: 270 })}</g>
        <g class="spfResult"><text x="42" y="296" xml:space="preserve"><tspan fill="${t.muted}">TXT </tspan><tspan fill="${t.string}">@ "v=spf1 mx ~all"</tspan></text>${timing(t, 270, "0.4")}</g>

        <g class="dkimCall">${toolCall(t, { name: "upsert_dns_record", args: "", y: 340 })}</g>
        <g class="dkimResult"><text x="42" y="366" xml:space="preserve"><tspan fill="${t.muted}">TXT </tspan><tspan fill="${t.string}">mail._domainkey "v=DKIM1; p=MIIB…"</tspan></text>${timing(t, 340, "0.5")}</g>

        <g class="done">
          <rect x="22" y="392" width="${CARD_BOX_WIDTH}" height="38" rx="4" fill="none" stroke="${t.accent}" stroke-width="1.5"/>
          <text x="38" y="417" fill="${t.accent}">✓ example.no can receive mail · 3 records</text>
        </g>

        <g class="actTwo">
          <text x="22" y="${PROMPT_TWO_Y}" fill="${t.muted}" class="promptTwo">&gt;</text>
          <text x="42" y="${PROMPT_TWO_Y}" fill="${t.ink}" class="typeTwo">${ACT_TWO_PROMPT}</text>
          <g class="cursorTwo">${cursorBlock(t, PROMPT_TWO_Y)}</g>

          <g class="listCallTwo">${toolCall(t, { name: "list_dns_records", args: " domain_id=1337", y: 530 })}</g>
          <g class="listResultTwo"><text x="42" y="556" fill="${t.muted}">└ 1 record · www A 198.51.100.4</text>${timing(t, 530, "0.3")}</g>

          <g class="blocked">
            <rect x="22" y="584" width="${CARD_BOX_WIDTH}" height="66" rx="4" fill="none" stroke="${t.string}" stroke-width="1.5"/>
            <text x="38" y="610" fill="${t.string}" font-weight="700">✕ delete_dns_record is not available</text>
            <text x="38" y="634" fill="${t.muted}">read-only mode hides every write tool</text>
          </g>

          <g class="reply">
            <text x="22" y="684" fill="${t.ink}">I can look, but not change anything here.</text>
            <text x="22" y="708" fill="${t.muted}">Unset DOMENESHOP_READ_ONLY to allow edits.</text>
          </g>
        </g>
      </g>
    </g>
  </g>

  <line x1="72" y1="556" x2="1208" y2="556" stroke="${t.line}" stroke-width="1.5"/>
  <text x="72" y="587" class="mono" font-size="15" letter-spacing="3" fill="${t.ink}">NPX DOMENESHOP-MCP</text>
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
