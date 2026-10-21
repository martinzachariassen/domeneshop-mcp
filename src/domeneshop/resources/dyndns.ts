import type { CallOptions, HttpTransport } from "../http.js";

export class DynDnsResource {
  constructor(private readonly transport: HttpTransport) {}

  /** Omitting myIp resolves it to the caller's apparent IP address instead. */
  async update(hostname: string, myIp?: string, call: CallOptions = {}): Promise<void> {
    await this.transport.request("GET", "/dyndns/update", {
      query: { hostname, myip: myIp },
      decodeJson: false,
      signal: call.signal,
    });
  }
}
