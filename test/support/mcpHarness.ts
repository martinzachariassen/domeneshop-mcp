import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { DomeneshopClient } from "#domeneshop/index.js";
import { type CreateServerOptions, createServer } from "#mcp/server.js";
import { type Handler, startTestServer, type TestServer } from "./testServer.js";

export interface Harness {
  client: Client;
  apiServer: TestServer;
  close: () => Promise<void>;
}

export async function connect(
  handler: Handler,
  options: CreateServerOptions = {},
): Promise<Harness> {
  return connectTo(await startTestServer(handler), options);
}

export async function connectTo(
  apiServer: TestServer,
  options: CreateServerOptions = {},
): Promise<Harness> {
  const domeneshopClient = new DomeneshopClient("token", "secret", { baseUrl: apiServer.baseUrl });
  const server = createServer(domeneshopClient, options);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "1.0.0" });

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return {
    client,
    apiServer,
    close: async () => {
      await client.close();
      await apiServer.close();
    },
  };
}

/** Connects a harness for the duration of `run` and always closes it. */
export async function withHarness<T>(
  handler: Handler,
  run: (harness: Harness) => Promise<T>,
  options: CreateServerOptions = {},
): Promise<T> {
  const harness = await connect(handler, options);
  try {
    return await run(harness);
  } finally {
    await harness.close();
  }
}

export async function listToolsByName(client: Client): Promise<Map<string, Tool>> {
  const { tools } = await client.listTools();
  return new Map(tools.map((tool) => [tool.name, tool]));
}

export function schemaProperties(tool: Tool): Record<string, { enum?: unknown[] }> {
  const schema = tool.inputSchema as { properties?: Record<string, { enum?: unknown[] }> };
  return schema.properties ?? {};
}

/** Tolerant of the compatibility result shape, unlike a direct `.content` read. */
export function resultText(result: unknown): string {
  const content =
    typeof result === "object" && result !== null && "content" in result
      ? result.content
      : undefined;
  if (!Array.isArray(content)) {
    return "";
  }
  return (content as unknown[])
    .filter((c): c is { type: "text"; text: string } => {
      return typeof c === "object" && c !== null && "type" in c && c.type === "text";
    })
    .map((c) => c.text)
    .join("");
}
