import { sendJson, startTestServer, type TestServer } from "#testing/testServer.js";
import { describe, expect, it } from "vitest";
import { HttpTransport } from "../http.js";
import { InvoicesResource } from "./invoices.js";

async function withResource(
  handler: Parameters<typeof startTestServer>[0],
  run: (resource: InvoicesResource, server: TestServer) => Promise<void>,
): Promise<void> {
  const server = await startTestServer(handler);
  try {
    const transport = new HttpTransport("token", "secret", server.baseUrl);
    await run(new InvoicesResource(transport), server);
  } finally {
    await server.close();
  }
}

describe("InvoicesResource", () => {
  it("lists invoices without a status filter", async () => {
    await withResource(
      (_req, res) => {
        sendJson(res, 200, []);
      },
      async (invoices, server) => {
        await invoices.list();
        expect(server.requests[0]?.url).toBe("/invoices");
      },
    );
  });

  it("passes status as a query parameter", async () => {
    await withResource(
      (_req, res) => {
        sendJson(res, 200, []);
      },
      async (invoices, server) => {
        await invoices.list("unpaid");
        expect(server.requests[0]?.url).toBe("/invoices?status=unpaid");
      },
    );
  });

  it("gets a single invoice", async () => {
    await withResource(
      (_req, res) => {
        sendJson(res, 200, { id: 99, status: "paid" });
      },
      async (invoices, server) => {
        const invoice = await invoices.get(99);
        expect(invoice).toEqual({ id: 99, status: "paid" });
        expect(server.requests[0]?.url).toBe("/invoices/99");
      },
    );
  });
});
