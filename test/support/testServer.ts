import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

export interface RecordedRequest {
  method: string;
  url: string;
  authorization: string | undefined;
  body: string;
}

export interface TestServer {
  baseUrl: string;
  requests: RecordedRequest[];
  close: () => Promise<void>;
}

export type Handler = (req: IncomingMessage, res: ServerResponse, body: string) => void;

/** Starts a local HTTP server for driving DomeneshopClient tests without network calls. */
export async function startTestServer(handler: Handler): Promise<TestServer> {
  const requests: RecordedRequest[] = [];

  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf-8");
      requests.push({
        method: req.method ?? "",
        url: req.url ?? "",
        authorization: req.headers.authorization,
        body,
      });
      handler(req, res, body);
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("test server did not bind to a TCP address");
  }

  return {
    baseUrl: `http://127.0.0.1:${String(address.port)}`,
    requests,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      }),
  };
}

/** Sends a JSON response. */
export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(text);
}
