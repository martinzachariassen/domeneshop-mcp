import { describe, expect, it } from "vitest";
import { HttpTransport } from "#domeneshop/http.js";
import { DynDnsResource } from "#domeneshop/resources/dyndns.js";
import { withTestServer } from "#testing/testServer.js";

describe("DynDnsResource", () => {
  it("sends hostname and myip as query parameters", async () => {
    await withTestServer(
      (_req, res) => {
        res.writeHead(200);
        res.end("good");
      },
      async (server) => {
        const transport = new HttpTransport("token", "secret", { baseUrl: server.baseUrl });
        await new DynDnsResource(transport).update("host.example.com", "203.0.113.5");
        expect(server.requests[0]?.url).toBe(
          "/dyndns/update?hostname=host.example.com&myip=203.0.113.5",
        );
      },
    );
  });

  it("omits myip when not given", async () => {
    await withTestServer(
      (_req, res) => {
        res.writeHead(200);
        res.end("good");
      },
      async (server) => {
        const transport = new HttpTransport("token", "secret", { baseUrl: server.baseUrl });
        await new DynDnsResource(transport).update("host.example.com");
        expect(server.requests[0]?.url).toBe("/dyndns/update?hostname=host.example.com");
      },
    );
  });
});
