import { startTestServer } from "#testing/testServer.js";
import { describe, expect, it } from "vitest";
import { HttpTransport } from "../http.js";
import { DynDnsResource } from "./dyndns.js";

describe("DynDnsResource", () => {
  it("sends hostname and myip as query parameters", async () => {
    const server = await startTestServer((_req, res) => {
      res.writeHead(200);
      res.end("good");
    });
    try {
      const transport = new HttpTransport("token", "secret", server.baseUrl);
      await new DynDnsResource(transport).update("host.example.com", "203.0.113.5");
      expect(server.requests[0]?.url).toBe(
        "/dyndns/update?hostname=host.example.com&myip=203.0.113.5",
      );
    } finally {
      await server.close();
    }
  });

  it("omits myip when not given", async () => {
    const server = await startTestServer((_req, res) => {
      res.writeHead(200);
      res.end("good");
    });
    try {
      const transport = new HttpTransport("token", "secret", server.baseUrl);
      await new DynDnsResource(transport).update("host.example.com");
      expect(server.requests[0]?.url).toBe("/dyndns/update?hostname=host.example.com");
    } finally {
      await server.close();
    }
  });
});
