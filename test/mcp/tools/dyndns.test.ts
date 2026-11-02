import { describe, expect, it } from "vitest";
import { resultText, withHarness } from "#testing/mcpHarness.js";

describe("dynamic DNS tools", () => {
  it("updates a dynamic DNS hostname with an explicit IP", async () => {
    await withHarness(
      (_req, res) => {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("good");
      },
      async (harness) => {
        const result = await harness.client.callTool({
          name: "update_dyndns",
          arguments: { hostname: "home.example.com", myip: "1.2.3.4" },
        });

        expect(result.isError).not.toBe(true);
        expect(resultText(result)).toContain("updated");
        const request = harness.apiServer.requests[0];
        expect(request?.url).toBe("/dyndns/update?hostname=home.example.com&myip=1.2.3.4");
      },
    );
  });

  it("omits myip when not provided, letting Domeneshop infer the caller's IP", async () => {
    await withHarness(
      (_req, res) => {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("good");
      },
      async (harness) => {
        const result = await harness.client.callTool({
          name: "update_dyndns",
          arguments: { hostname: "home.example.com" },
        });

        expect(result.isError).not.toBe(true);
        expect(harness.apiServer.requests[0]?.url).toBe("/dyndns/update?hostname=home.example.com");
      },
    );
  });

  it("accepts a comma-separated IPv4 and IPv6 list", async () => {
    await withHarness(
      (_req, res) => {
        res.writeHead(204);
        res.end();
      },
      async (harness) => {
        const result = await harness.client.callTool({
          name: "update_dyndns",
          arguments: { hostname: "home.example.com", myip: "192.0.2.1,2001:db8::1" },
        });

        expect(result.isError).not.toBe(true);
        expect(harness.apiServer.requests[0]?.url).toBe(
          "/dyndns/update?hostname=home.example.com&myip=192.0.2.1%2C2001%3Adb8%3A%3A1",
        );
      },
    );
  });

  it("updates several comma-separated hostnames in one call", async () => {
    await withHarness(
      (_req, res) => {
        res.writeHead(204);
        res.end();
      },
      async (harness) => {
        const result = await harness.client.callTool({
          name: "update_dyndns",
          arguments: { hostname: "home.example.com,vpn.example.com", myip: "192.0.2.1" },
        });

        expect(result.isError).not.toBe(true);
        expect(harness.apiServer.requests[0]?.url).toBe(
          "/dyndns/update?hostname=home.example.com%2Cvpn.example.com&myip=192.0.2.1",
        );
      },
    );
  });

  it("strips whitespace around commas in hostname and myip lists", async () => {
    await withHarness(
      (_req, res) => {
        res.writeHead(204);
        res.end();
      },
      async (harness) => {
        const result = await harness.client.callTool({
          name: "update_dyndns",
          arguments: { hostname: " a.example.com, b.example.com ", myip: "192.0.2.1, 2001:db8::1" },
        });

        expect(result.isError).not.toBe(true);
        expect(harness.apiServer.requests[0]?.url).toBe(
          "/dyndns/update?hostname=a.example.com%2Cb.example.com&myip=192.0.2.1%2C2001%3Adb8%3A%3A1",
        );
      },
    );
  });

  it("treats an empty myip as omitted", async () => {
    await withHarness(
      (_req, res) => {
        res.writeHead(204);
        res.end();
      },
      async (harness) => {
        const result = await harness.client.callTool({
          name: "update_dyndns",
          arguments: { hostname: "home.example.com", myip: "" },
        });

        expect(result.isError).not.toBe(true);
        expect(resultText(result)).toContain("caller's apparent IP");
        expect(harness.apiServer.requests[0]?.url).toBe("/dyndns/update?hostname=home.example.com");
      },
    );
  });
});
