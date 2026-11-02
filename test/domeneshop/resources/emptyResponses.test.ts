import { describe, expect, it } from "vitest";
import { DomeneshopClient } from "#domeneshop/index.js";
import { startTestServer } from "#testing/testServer.js";

async function withEmptyBodies(run: (client: DomeneshopClient) => Promise<void>): Promise<void> {
  const server = await startTestServer((_req, res) => {
    res.writeHead(200);
    res.end();
  });
  try {
    await run(new DomeneshopClient("token", "secret", { baseUrl: server.baseUrl }));
  } finally {
    await server.close();
  }
}

describe("responses with an empty body", () => {
  it("become an empty list for list endpoints", async () => {
    await withEmptyBodies(async (client) => {
      await expect(client.domains.list()).resolves.toEqual([]);
      await expect(client.dns.list(1)).resolves.toEqual([]);
      await expect(client.forwards.list(1)).resolves.toEqual([]);
      await expect(client.invoices.list()).resolves.toEqual([]);
    });
  });

  it.each<[string, (client: DomeneshopClient) => Promise<unknown>]>([
    ["domain", (c) => c.domains.get(1)],
    ["DNS record", (c) => c.dns.get(1, 1)],
    ["created DNS record", (c) => c.dns.create(1, { host: "@", type: "TXT", data: "x" })],
    ["forward", (c) => c.forwards.get(1, "www")],
    [
      "updated forward",
      (c) => c.forwards.update(1, "www", { host: "www", url: "https://x.no", frame: false }),
    ],
    ["invoice", (c) => c.invoices.get(1)],
  ])("fail clearly for a single %s", async (what, call) => {
    await withEmptyBodies(async (client) => {
      await expect(call(client)).rejects.toThrow(`domeneshop: empty response for ${what}`);
    });
  });
});
