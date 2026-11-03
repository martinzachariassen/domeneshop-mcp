import { afterAll, describe, expect, it } from "vitest";
import { DomeneshopApiError, DomeneshopClient, RECORD_TYPES } from "#domeneshop/index.js";
import { errorStatuses, OPERATIONS, validateSchema } from "./openapi.js";
import {
  CREDIT_NOTE,
  DOMAIN_FULL,
  DOMAIN_MINIMAL,
  FORWARD_FULL,
  FORWARD_MINIMAL,
  INVOICE_FULL,
  INVOICE_MINIMAL,
  RECORDS,
  type SpecServer,
  SUCCESS,
  startSpecServer,
} from "./specServer.js";

const hit = new Set<string>();

async function withSpecServer<T>(
  run: (client: DomeneshopClient, server: SpecServer) => Promise<T>,
  override?: Parameters<typeof startSpecServer>[0],
): Promise<T> {
  const server = await startSpecServer(override);
  try {
    const client = new DomeneshopClient("token", "secret", {
      baseUrl: server.baseUrl,
      maxRetries: 0,
    });
    const result = await run(client, server);
    expect(server.violations).toEqual([]);
    return result;
  } finally {
    for (const key of server.hits) {
      hit.add(key);
    }
    await server.close();
  }
}

function withoutId<T extends { id: number }>(record: T): Omit<T, "id"> {
  const { id: _id, ...rest } = record;
  return rest;
}

/** Not in the spec server's forward list, so a 404 by host stays a 404 after the list fallback. */
const HOST_NOT_IN_LIST = "shop";

/** One call per spec operation, with the value the client should return. */
const CALLS: Record<string, [(client: DomeneshopClient) => Promise<unknown>, unknown]> = {
  "GET /domains": [(c) => c.domains.list(), [DOMAIN_FULL, DOMAIN_MINIMAL]],
  "GET /domains/{domainId}": [(c) => c.domains.get(1), DOMAIN_FULL],
  "GET /domains/{domainId}/dns": [(c) => c.dns.list(1), Object.values(RECORDS)],
  "POST /domains/{domainId}/dns": [(c) => c.dns.create(1, withoutId(RECORDS.A)), 1],
  "GET /domains/{domainId}/dns/{recordId}": [(c) => c.dns.get(1, 1), RECORDS.A],
  "PUT /domains/{domainId}/dns/{recordId}": [
    (c) => c.dns.update(1, 1, withoutId(RECORDS.A)),
    undefined,
  ],
  "DELETE /domains/{domainId}/dns/{recordId}": [(c) => c.dns.delete(1, 1), undefined],
  "GET /domains/{domainId}/forwards/": [(c) => c.forwards.list(1), [FORWARD_FULL, FORWARD_MINIMAL]],
  "POST /domains/{domainId}/forwards/": [(c) => c.forwards.create(1, FORWARD_FULL), FORWARD_FULL],
  "GET /domains/{domainId}/forwards/{host}": [
    (c) => c.forwards.get(1, HOST_NOT_IN_LIST),
    FORWARD_FULL,
  ],
  "PUT /domains/{domainId}/forwards/{host}": [
    (c) => c.forwards.update(1, HOST_NOT_IN_LIST, FORWARD_FULL),
    FORWARD_FULL,
  ],
  "DELETE /domains/{domainId}/forwards/{host}": [
    (c) => c.forwards.delete(1, HOST_NOT_IN_LIST),
    undefined,
  ],
  "GET /invoices": [(c) => c.invoices.list(), [INVOICE_FULL, INVOICE_MINIMAL, CREDIT_NOTE]],
  "GET /invoices/{invoiceId}": [(c) => c.invoices.get(1), INVOICE_FULL],
  "GET /dyndns/update": [(c) => c.dynDns.update("www.example.com"), undefined],
};

describe("example responses", () => {
  it.each<[string, unknown]>([
    ["Domain", DOMAIN_FULL],
    ["Domain", DOMAIN_MINIMAL],
    ["HTTPForward", FORWARD_FULL],
    ["HTTPForward", FORWARD_MINIMAL],
    ["Invoice", INVOICE_FULL],
    ["Invoice", INVOICE_MINIMAL],
    ["Invoice", CREDIT_NOTE],
    ...Object.values(RECORDS).map((record): [string, unknown] => ["DNSRecord", record]),
  ])("%s example %j is valid against the spec", (schema, example) => {
    expect(validateSchema(schema, example)).toEqual([]);
  });

  it("covers every record type the client supports", () => {
    expect(Object.keys(RECORDS).sort()).toEqual([...RECORD_TYPES].sort());
  });
});

describe("client requests match the spec", () => {
  it.each(Object.keys(CALLS))("%s", async (key) => {
    const [call, expected] = CALLS[key] ?? [];
    await withSpecServer(async (client, server) => {
      await expect(call?.(client)).resolves.toEqual(expected);
      expect([...server.hits]).toEqual([key]);
    });
  });

  it.each(Object.keys(RECORDS) as (keyof typeof RECORDS)[])(
    "creates and replaces a %s record with a body the spec accepts",
    async (type) => {
      await withSpecServer(async (client) => {
        await client.dns.create(1, withoutId(RECORDS[type]));
        await client.dns.update(1, RECORDS[type].id, withoutId(RECORDS[type]));
      });
    },
  );

  it("sends every documented query parameter", async () => {
    await withSpecServer(async (client, server) => {
      await client.domains.list(".no");
      await client.dns.list(1, { host: "www", type: "A" });
      await client.invoices.list("unpaid");
      await client.dynDns.update("example.com,www.example.com", "192.0.2.1,2001:db8::1");

      expect(server.requests.map((r) => r.url)).toEqual([
        "/domains?domain=.no",
        "/domains/1/dns?host=www&type=A",
        "/invoices?status=unpaid",
        "/dyndns/update?hostname=example.com%2Cwww.example.com&myip=192.0.2.1%2C2001%3Adb8%3A%3A1",
      ]);
    });
  });

  it("leaves out empty optional query parameters", async () => {
    await withSpecServer(async (client, server) => {
      await client.domains.list("");
      await client.dns.list(1, { host: "", type: "" });
      await client.invoices.list("");
      await client.dynDns.update("www.example.com", "");

      expect(server.requests.map((r) => r.url)).toEqual([
        "/domains",
        "/domains/1/dns",
        "/invoices",
        "/dyndns/update?hostname=www.example.com",
      ]);
    });
  });

  it("encodes the root host '@' and other hosts safely in forward paths", async () => {
    await withSpecServer(async (client, server) => {
      await client.forwards.get(1, "@");
      await client.forwards.get(1, "a/b");
      expect(server.requests.map((r) => r.url)).toEqual([
        "/domains/1/forwards/%40",
        "/domains/1/forwards/a%2Fb",
      ]);
    });
  });

  it("returns the sent forward when a forward update answers 204, as the live API does", async () => {
    await withSpecServer(
      async (client) => {
        await expect(client.forwards.update(1, "www", FORWARD_FULL)).resolves.toEqual(FORWARD_FULL);
      },
      (key) => (key.startsWith("PUT") ? { status: 204 } : undefined),
    );
  });

  it("falls back to the sent forward when the 201 carries no Location", async () => {
    await withSpecServer(
      async (client) => {
        await expect(client.forwards.create(1, FORWARD_MINIMAL as never)).resolves.toEqual(
          FORWARD_MINIMAL,
        );
      },
      (key) => (key.startsWith("POST") ? { status: 201 } : undefined),
    );
  });
});

describe("documented error responses", () => {
  const cases = Object.keys(CALLS).flatMap((key) =>
    errorStatuses(key).map((status) => [key, status] as const),
  );

  it("exist for the operations the spec documents them for", () => {
    expect(cases.length).toBeGreaterThan(10);
  });

  it.each(cases)("%s -> %d becomes a DomeneshopApiError", async (key, status) => {
    const [call] = CALLS[key] ?? [];
    await withSpecServer(
      async (client) => {
        const error: unknown = await call?.(client).catch((e: unknown) => e);
        expect(error).toBeInstanceOf(DomeneshopApiError);
        expect(error).toMatchObject({ statusCode: status });
        expect((error as DomeneshopApiError).hint).toBeTruthy();
      },
      (k) => (k === key ? { status } : undefined),
    );
  });
});

afterAll(() => {
  const documented = new Set(Object.keys(SUCCESS));
  expect(new Set(OPERATIONS)).toEqual(documented);
  expect([...hit].sort()).toEqual([...OPERATIONS].sort());
});
