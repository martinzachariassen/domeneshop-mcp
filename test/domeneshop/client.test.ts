import { sendJson, startTestServer } from "#testing/testServer.js";
import { describe, expect, it } from "vitest";
import { DomeneshopClient } from "#domeneshop/client.js";

describe("DomeneshopClient", () => {
  it("wires every resource to the configured base URL", async () => {
    const server = await startTestServer((_req, res) => {
      sendJson(res, 200, []);
    });
    try {
      const client = new DomeneshopClient("token", "secret", { baseUrl: server.baseUrl });

      await client.domains.list();
      await client.dns.list(1);
      await client.forwards.list(1);
      await client.invoices.list();

      expect(server.requests.map((r) => r.url)).toEqual([
        "/domains",
        "/domains/1/dns",
        "/domains/1/forwards/",
        "/invoices",
      ]);
    } finally {
      await server.close();
    }
  });
});
