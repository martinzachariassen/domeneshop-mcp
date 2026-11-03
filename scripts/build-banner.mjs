/**
 * Generates the animated README banners (`.github/assets/banner-{dark,light}.svg`)
 * from one template, so both themes stay in sync. Animation is pure CSS so it
 * also plays when GitHub serves the SVG through an `<img>` tag, which blocks scripts.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const CYCLE_SECONDS = 14;

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
  },
};

const STEPS = [
  { name: "prompt", at: 3 },
  { name: "list", at: 19 },
  { name: "listResult", at: 23 },
  { name: "mx", at: 32 },
  { name: "mxArgs", at: 35 },
  { name: "spf", at: 45 },
  { name: "spfArgs", at: 48 },
  { name: "done", at: 58 },
];

const keyframes = STEPS.map(({ name, at }) => {
  const settled = at + 2;
  return `@keyframes ${name} {
        0%, ${at}% { opacity: 0; transform: translateY(5px); }
        ${settled}%, 93% { opacity: 1; transform: translateY(0); }
        97%, 100% { opacity: 0; transform: translateY(0); }
      }
      .${name} { animation: ${name} ${CYCLE_SECONDS}s ease-out infinite; }`;
}).join("\n      ");

const typing = `@keyframes typing {
        0%, 3% { clip-path: inset(0 100% 0 0); opacity: 1; }
        13%, 93% { clip-path: inset(0 0 0 0); opacity: 1; }
        97%, 100% { clip-path: inset(0 100% 0 0); opacity: 1; }
      }
      .typing { animation: typing ${CYCLE_SECONDS}s steps(27, end) infinite; }`;

const ASSET_DIR = fileURLToPath(new URL("../.github/assets/", import.meta.url));

/** @param {typeof THEMES.dark} t */
const render = (
  t,
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
      <stop offset="0" stop-color="${t.accent}" stop-opacity="0.28"/>
      <stop offset="1" stop-color="${t.accent}" stop-opacity="0"/>
    </radialGradient>
    <style>
      .mono { font-family: "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
      .display { font-family: Newsreader, Georgia, "Times New Roman", serif; font-style: italic; }
      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
      .live { animation: pulse 2s ease-in-out infinite; }
      ${typing}
      ${keyframes}
      @media (prefers-reduced-motion: reduce) {
        .typing, .live, ${STEPS.map((s) => `.${s.name}`).join(", ")} { animation: none; opacity: 1; clip-path: none; transform: none; }
      }
    </style>
  </defs>

  <rect width="1280" height="640" fill="${t.background}"/>
  <rect width="1280" height="640" fill="url(#grid)"/>
  <rect width="1280" height="640" fill="url(#grid-major)"/>
  <ellipse cx="978" cy="332" rx="420" ry="300" fill="url(#glow)"/>

  <g fill="none" stroke="${t.corner}" stroke-width="2">
    <path d="M24 48 V24 H48"/><path d="M1232 24 H1256 V48"/>
    <path d="M24 592 V616 H48"/><path d="M1232 616 H1256 V592"/>
  </g>

  <g transform="translate(72 56)">
    <g transform="scale(1.375)">
      <rect x="1" y="1" width="30" height="30" rx="6" fill="${t.ink}"/>
      <polygon points="7,25 7,7 11.5,7 16,18.5 20.5,7 25,7 25,25" fill="${t.background}"/>
    </g>
    <text x="60" y="31" class="mono" font-size="28" font-weight="700" letter-spacing="-0.8" fill="${t.ink}">mlz<tspan fill="${t.accent}">.</tspan></text>
  </g>
  <g transform="translate(1004 62)">
    <rect width="204" height="32" rx="4" fill="${t.background}" stroke="${t.line}" stroke-width="1.5"/>
    <text x="103" y="21" text-anchor="middle" class="mono" font-size="12" letter-spacing="2.6" fill="${t.soft}">OPEN SOURCE · MIT</text>
  </g>

  <text x="72" y="196" class="mono" font-size="14" letter-spacing="4.5" fill="${t.soft}">MCP SERVER<tspan fill="${t.accent}" dx="10">/</tspan><tspan dx="10">DOMENESHOP API</tspan></text>
  <text x="66" y="306" class="display" font-size="106" font-weight="500" letter-spacing="-1.5" fill="${t.ink}">Domeneshop</text>
  <text x="66" y="406" class="display" font-size="106" font-weight="500" letter-spacing="-1.5" fill="${t.ink}">MCP</text>
  <text class="mono" font-size="17" fill="${t.soft}">
    <tspan x="72" y="468">Domains, DNS, HTTP forwards, dynamic DNS</tspan>
    <tspan x="72" dy="28">and invoices — from any AI assistant.</tspan>
  </text>

  <g transform="translate(748 150)" class="mono">
    <rect width="460" height="364" rx="4" fill="${t.card}" stroke="${t.ink}" stroke-width="1.5"/>
    <text x="22" y="30" font-size="11" letter-spacing="2.4" fill="${t.muted}">ASSISTANT SESSION</text>
    <text x="438" y="30" text-anchor="end" font-size="11" letter-spacing="2.4" fill="${t.accent}"><tspan class="live">●</tspan> CONNECTED</text>
    <line x1="0" y1="46" x2="460" y2="46" stroke="${t.ink}" stroke-width="1.5"/>

    <g font-size="14">
      <text x="22" y="84" fill="${t.muted}">&gt;</text>
      <text x="42" y="84" fill="${t.ink}" class="typing">Set up email for example.no</text>

      <g class="list">
        <rect x="22" y="115" width="8" height="8" fill="${t.accent}"/>
        <text x="42" y="124"><tspan fill="${t.accent}" font-weight="700">list_dns_records</tspan><tspan fill="${t.muted}"> domain_id=1337</tspan></text>
      </g>
      <text x="42" y="148" fill="${t.muted}" class="listResult">└ 6 records · no MX, no SPF</text>

      <g class="mx">
        <rect x="22" y="179" width="8" height="8" fill="${t.accent}"/>
        <text x="42" y="188" fill="${t.accent}" font-weight="700">upsert_dns_record</text>
      </g>
      <text x="42" y="212" class="mxArgs" xml:space="preserve"><tspan fill="${t.muted}">MX  </tspan><tspan fill="${t.string}">@ → mail.example.no</tspan><tspan fill="${t.muted}"> prio </tspan><tspan fill="${t.string}">10</tspan></text>

      <g class="spf">
        <rect x="22" y="243" width="8" height="8" fill="${t.accent}"/>
        <text x="42" y="252" fill="${t.accent}" font-weight="700">upsert_dns_record</text>
      </g>
      <text x="42" y="276" class="spfArgs" xml:space="preserve"><tspan fill="${t.muted}">TXT </tspan><tspan fill="${t.string}">@ "v=spf1 mx ~all"</tspan></text>

      <g class="done">
        <rect x="22" y="310" width="416" height="34" rx="4" fill="none" stroke="${t.accent}" stroke-width="1.5"/>
        <text x="36" y="332" fill="${t.accent}">✓ example.no can receive mail · 2 records</text>
      </g>
    </g>
  </g>

  <line x1="72" y1="556" x2="1208" y2="556" stroke="${t.line}" stroke-width="1.5"/>
  <text x="72" y="592" class="mono" font-size="14" letter-spacing="3" fill="${t.ink}">NPX DOMENESHOP-MCP</text>
  <rect x="842" y="583" width="9" height="9" fill="${t.accent}"/>
  <text x="1208" y="592" text-anchor="end" class="mono" font-size="13" letter-spacing="2.6" fill="${t.soft}">17 TOOLS · STDIO · READ-ONLY MODE</text>
</svg>
`;

for (const [name, theme] of Object.entries(THEMES)) {
  writeFileSync(`${ASSET_DIR}banner-${name}.svg`, render(theme));
}
