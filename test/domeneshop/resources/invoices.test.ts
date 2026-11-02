import { describe, expect, it } from "vitest";
import { HttpTransport } from "#domeneshop/http.js";
import { InvoicesResource } from "#domeneshop/resources/invoices.js";
import { type Handler, sendJson, type TestServer, withTestServer } from "#testing/testServer.js";

function withResource(
  handler: Handler,
  run: (resource: InvoicesResource, server: TestServer) => Promise<void>,
): Promise<void> {
  return withTestServer(handler, (server) =>
    run(
      new InvoicesResource(new HttpTransport("token", "secret", { baseUrl: server.baseUrl })),
      server,
    ),
  );
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
