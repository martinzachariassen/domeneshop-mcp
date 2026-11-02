import { describe, expect, it } from "vitest";
import { resultText, withHarness } from "#testing/mcpHarness.js";
import { sendJson } from "#testing/testServer.js";

type Args = Record<string, unknown>;

const VALID: Record<string, Args> = {
  list_domains: {},
  get_domain: { domain_id: 42 },
  list_dns_records: { domain_id: 42 },
  get_dns_record: { domain_id: 42, record_id: 7 },
  create_dns_record: { domain_id: 42, host: "www", type: "A", data: "192.0.2.1" },
  update_dns_record: { domain_id: 42, record_id: 7, host: "www", type: "A", data: "192.0.2.1" },
  patch_dns_record: { domain_id: 42, record_id: 7 },
  upsert_dns_record: { domain_id: 42, host: "www", type: "A", data: "192.0.2.1" },
  delete_dns_record: { domain_id: 42, record_id: 7 },
  list_forwards: { domain_id: 42 },
  get_forward: { domain_id: 42, host: "www" },
  create_forward: { domain_id: 42, host: "www", url: "https://example.com" },
  update_forward: { domain_id: 42, host: "www", url: "https://example.com" },
  delete_forward: { domain_id: 42, host: "www" },
  list_invoices: {},
  get_invoice: { invoice_id: 1 },
  update_dyndns: { hostname: "home.example.com" },
};

const DOMAIN_TOOLS = Object.keys(VALID).filter((tool) => "domain_id" in (VALID[tool] ?? {}));
const RECORD_ID_TOOLS = Object.keys(VALID).filter((tool) => "record_id" in (VALID[tool] ?? {}));
const DNS_WRITE_TOOLS = ["create_dns_record", "update_dns_record", "upsert_dns_record"];
const FORWARD_HOST_TOOLS = ["get_forward", "create_forward", "update_forward", "delete_forward"];
const BAD_IDS: [string, unknown][] = [
  ["zero", 0],
  ["negative", -1],
  ["fractional", 1.5],
  ["a string", "42"],
  ["missing", undefined],
];

function withArg(tool: string, field: string, value: unknown): Args {
  const args = { ...VALID[tool] };
  if (value === undefined) {
    delete args[field];
  } else {
    args[field] = value;
  }
  return args;
}

/** [label, tool, args, fragment the error message must contain] */
type Case = [string, string, Args, string];

const REJECTED: Case[] = [
  ...DOMAIN_TOOLS.flatMap((tool) =>
    BAD_IDS.map(
      ([label, value]): Case => [
        `domain_id ${label}`,
        tool,
        withArg(tool, "domain_id", value),
        "domain_id",
      ],
    ),
  ),
  ...RECORD_ID_TOOLS.flatMap((tool) =>
    BAD_IDS.map(
      ([label, value]): Case => [
        `record_id ${label}`,
        tool,
        withArg(tool, "record_id", value),
        "record_id",
      ],
    ),
  ),
  ...BAD_IDS.map(
    ([label, value]): Case => [
      `invoice_id ${label}`,
      "get_invoice",
      withArg("get_invoice", "invoice_id", value),
      "invoice_id",
    ],
  ),

  ...[...DNS_WRITE_TOOLS, ...FORWARD_HOST_TOOLS].flatMap((tool) => [
    ["host missing", tool, withArg(tool, "host", undefined), "host"] as Case,
    ["host empty", tool, withArg(tool, "host", ""), "host"] as Case,
    ["host blank", tool, withArg(tool, "host", "   "), "host"] as Case,
  ]),
  ...DNS_WRITE_TOOLS.flatMap((tool) => [
    ["type missing", tool, withArg(tool, "type", undefined), "type"] as Case,
    ["type unknown", tool, withArg(tool, "type", "SPF"), "type"] as Case,
    ["data missing", tool, withArg(tool, "data", undefined), "data"] as Case,
    ["data empty", tool, withArg(tool, "data", ""), "data"] as Case,
  ]),
  ["patch type unknown", "patch_dns_record", { ...VALID["patch_dns_record"], type: "SPF" }, "type"],
  ["patch host empty", "patch_dns_record", { ...VALID["patch_dns_record"], host: "" }, "host"],
  ["list type unknown", "list_dns_records", { domain_id: 42, type: "SPF" }, "type"],
  ["list status unknown", "list_invoices", { status: "overdue" }, "status"],
  ["filter not a string", "list_domains", { filter: 5 }, "filter"],

  ...(
    [
      ["ttl", 30],
      ["ttl", 604860],
      ["ttl", 90],
      ["priority", -1],
      ["priority", 65536],
      ["weight", -1],
      ["weight", 65536],
      ["port", -1],
      ["port", 65536],
      ["usage", -1],
      ["usage", 4],
      ["selector", 2],
      ["dtype", 3],
      ["alg", 256],
      ["digest", 256],
      ["flags", 256],
      ["tag", -1],
      ["tag", 65536],
      ["tag", ""],
      ["priority", 1.5],
    ] as const
  ).map(
    ([field, value]): Case => [
      `${field} ${String(value)}`,
      "create_dns_record",
      { ...VALID["create_dns_record"], [field]: value },
      field,
    ],
  ),

  [
    "MX without priority",
    "create_dns_record",
    { domain_id: 42, host: "@", type: "MX", data: "mx.example.com" },
    "MX records require priority; missing: priority",
  ],
  [
    "SRV without port",
    "create_dns_record",
    {
      domain_id: 42,
      host: "_sip._tcp",
      type: "SRV",
      data: "sip.example.com",
      priority: 10,
      weight: 5,
    },
    "missing: port",
  ],
  [
    "TLSA without dtype",
    "create_dns_record",
    { domain_id: 42, host: "_443._tcp", type: "TLSA", data: "ab", usage: 3, selector: 1 },
    "missing: dtype",
  ],
  [
    "DS without digest",
    "create_dns_record",
    { domain_id: 42, host: "@", type: "DS", data: "ab", tag: 1, alg: 13 },
    "missing: digest",
  ],
  [
    "CAA without flags",
    "create_dns_record",
    { domain_id: 42, host: "@", type: "CAA", data: "x", tag: "issue" },
    "missing: flags",
  ],
  [
    "DS with a string tag",
    "create_dns_record",
    { domain_id: 42, host: "@", type: "DS", data: "ab", tag: "1", alg: 13, digest: 2 },
    "DS records need tag as a number",
  ],
  [
    "CAA with a numeric tag",
    "create_dns_record",
    { domain_id: 42, host: "@", type: "CAA", data: "x", tag: 0, flags: 0 },
    "CAA records need tag as a string",
  ],
  [
    "A with a hostname",
    "create_dns_record",
    { ...VALID["create_dns_record"], data: "example.com" },
    "A records need an IPv4 address",
  ],
  [
    "A with IPv6",
    "update_dns_record",
    { ...VALID["update_dns_record"], data: "2001:db8::1" },
    "A records need an IPv4 address",
  ],

  ...["create_forward", "update_forward"].flatMap((tool) => [
    ["url missing", tool, withArg(tool, "url", undefined), "url"] as Case,
    ["url not a URL", tool, withArg(tool, "url", "not a url"), "url"] as Case,
    ["url mailto", tool, withArg(tool, "url", "mailto:a@example.com"), "url"] as Case,
    ["url without scheme", tool, withArg(tool, "url", "example.com"), "url"] as Case,
    ["url javascript", tool, withArg(tool, "url", "javascript:alert(1)"), "url"] as Case,
    ["frame not a boolean", tool, withArg(tool, "frame", "yes"), "frame"] as Case,
  ]),

  ["hostname missing", "update_dyndns", {}, "hostname"],
  ["hostname only commas", "update_dyndns", { hostname: " , ," }, "at least one hostname"],
  ...[
    "home example.com",
    "-bad-.example.com",
    "a..b.example.com",
    "under_score.example.com",
    `${"a".repeat(64)}.example.com`,
  ].map(
    (hostname): Case => [`hostname ${hostname}`, "update_dyndns", { hostname }, "valid hostnames"],
  ),
  [
    "one bad hostname in a list",
    "update_dyndns",
    { hostname: "ok.example.com,bad host" },
    "valid hostnames",
  ],
  [
    "myip not an IP",
    "update_dyndns",
    { hostname: "h.example.com", myip: "example.com" },
    "IPv4 or IPv6",
  ],
  [
    "myip with ten addresses",
    "update_dyndns",
    {
      hostname: "h.example.com",
      myip: Array.from({ length: 10 }, (_, i) => `192.0.2.${String(i)}`).join(","),
    },
    "up to 9",
  ],
];

describe("input validation", () => {
  it("covers every tool", () => {
    const tested = new Set(REJECTED.map(([, tool]) => tool));
    expect(Object.keys(VALID).filter((tool) => !tested.has(tool))).toEqual([]);
  });

  it.each(REJECTED)(
    "rejects %s on %s before calling the API",
    async (_label, tool, args, fragment) => {
      await withHarness(
        (_req, res) => {
          res.writeHead(500);
          res.end();
        },
        async (harness) => {
          const result = await harness.client.callTool({ name: tool, arguments: args });

          expect(result.isError).toBe(true);
          expect(resultText(result)).toContain(fragment);
          expect(harness.apiServer.requests).toHaveLength(0);
        },
      );
    },
  );

  it.each([
    ["patch_dns_record", { data: "2001:db8::1" }, "A records need an IPv4 address"],
    ["patch_dns_record", { type: "AAAA" }, "AAAA records need an IPv6 address"],
    ["patch_dns_record", { type: "MX" }, "missing: priority"],
    ["upsert_dns_record", { data: "example.com" }, "A records need an IPv4 address"],
    ["upsert_dns_record", { type: "AAAA" }, "AAAA records need an IPv6 address"],
  ])("validates the merged record on %s %j without writing", async (tool, extra, fragment) => {
    const existing = { id: 7, host: "www", type: "A", data: "192.0.2.1", ttl: 3600 };
    await withHarness(
      (req, res) => {
        sendJson(res, 200, req.url?.includes("/dns/7") ? existing : [existing]);
      },
      async (harness) => {
        const result = await harness.client.callTool({
          name: tool,
          arguments: { ...VALID[tool], ...extra },
        });

        expect(result.isError).toBe(true);
        expect(resultText(result)).toContain(fragment);
        expect(harness.apiServer.requests.every((r) => r.method === "GET")).toBe(true);
      },
    );
  });

  it.each<[string, string, Args]>([
    ["ttl at the minimum", "create_dns_record", { ttl: 60 }],
    ["ttl at the maximum", "create_dns_record", { ttl: 604800 }],
    [
      "SRV at the field limits",
      "create_dns_record",
      {
        host: "_sip._tcp",
        type: "SRV",
        data: "sip.example.com",
        priority: 0,
        weight: 65535,
        port: 65535,
      },
    ],
    [
      "TLSA at the field limits",
      "create_dns_record",
      { host: "_443._tcp", type: "TLSA", data: "ab", usage: 3, selector: 1, dtype: 2 },
    ],
    [
      "DS at the field limits",
      "create_dns_record",
      { host: "@", type: "DS", data: "ab", tag: 65535, alg: 255, digest: 255 },
    ],
    [
      "CAA with a critical flag",
      "create_dns_record",
      { host: "@", type: "CAA", data: "letsencrypt.org", tag: "issue", flags: 128 },
    ],
    ["AAAA with IPv6", "create_dns_record", { type: "AAAA", data: "2001:db8::1" }],
    ["the '@' root host", "create_forward", { host: "@" }],
    ["frame true", "create_forward", { frame: true }],
    ["http URL", "update_forward", { url: "http://example.com/path?q=1" }],
    ["ftp URL, which the spec allows", "create_forward", { url: "ftp://ftp.example.com/pub" }],
    [
      "nine IPs",
      "update_dyndns",
      { myip: Array.from({ length: 9 }, (_, i) => `192.0.2.${String(i)}`).join(",") },
    ],
    ["empty myip", "update_dyndns", { myip: "" }],
    ["empty type filter", "list_dns_records", { type: "" }],
    ["empty status filter", "list_invoices", { status: "" }],
  ])("accepts %s", async (_label, tool, extra) => {
    await withHarness(
      (req, res) => {
        if (req.method === "POST" && req.url?.includes("/dns")) {
          sendJson(res, 201, { id: 1 });
        } else if (req.method === "GET" && req.url?.includes("/dyndns")) {
          res.writeHead(204);
          res.end();
        } else if (req.method === "GET" && req.url?.includes("/dns/")) {
          sendJson(res, 200, { id: 1, host: "@", type: "A", data: "192.0.2.1" });
        } else if (req.method === "POST") {
          res.writeHead(201, { Location: "/domains/42/forwards/www" });
          res.end();
        } else if (req.method === "PUT") {
          sendJson(res, 200, { host: "www", url: "http://example.com", frame: false });
        } else {
          sendJson(res, 200, []);
        }
      },
      async (harness) => {
        const result = await harness.client.callTool({
          name: tool,
          arguments: { ...VALID[tool], ...extra },
        });

        expect(resultText(result)).not.toMatch(/validation|invalid/i);
        expect(result.isError).not.toBe(true);
        expect(harness.apiServer.requests.length).toBeGreaterThan(0);
        expect(harness.apiServer.requests[0]?.url).not.toMatch(/[?&](type|status|myip)=(&|$)/);
      },
    );
  });

  it("sends dyndns hostnames as ASCII without a trailing dot", async () => {
    await withHarness(
      (_req, res) => {
        res.writeHead(204);
        res.end();
      },
      async (harness) => {
        const result = await harness.client.callTool({
          name: "update_dyndns",
          arguments: { hostname: "home.example.com., blåbær.no" },
        });

        expect(result.isError).not.toBe(true);
        const url = new URL(harness.apiServer.requests[0]?.url ?? "", "http://x");
        expect(url.searchParams.get("hostname")).toBe("home.example.com,xn--blbr-roah.no");
      },
    );
  });
});
