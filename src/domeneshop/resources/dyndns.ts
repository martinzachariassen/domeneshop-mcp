import type { HttpTransport } from "../http.js";

export class DynDnsResource {
  constructor(private readonly transport: HttpTransport) {}

  /**
   * Updates the DNS record for hostname to point at myIp (or the caller's
   * apparent IP address if myIp is omitted), using Domeneshop's dynamic DNS
   * update protocol.
   */
  async update(hostname: string, myIp?: string): Promise<void> {
    await this.transport.request("GET", "/dyndns/update", {
      query: { hostname, myip: myIp },
      decodeJson: false,
    });
  }
}
