import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

export interface RecordedRequest {
  method: string;
  url: string;
  authorization: string | undefined;
  userAgent: string | undefined;
  body: string;
}

export interface TestServer {
  baseUrl: string;
  requests: RecordedRequest[];
  close: () => Promise<void>;
}

export type Handler = (req: IncomingMessage, res: ServerResponse, body: string) => void;

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
        userAgent: req.headers["user-agent"],
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

/** Starts a test server for the duration of `run` and always closes it. */
export async function withTestServer<T>(
  handler: Handler,
  run: (server: TestServer) => Promise<T>,
): Promise<T> {
  const server = await startTestServer(handler);
  try {
    return await run(server);
  } finally {
    await server.close();
  }
}

/** Leaves every request hanging, so only a timeout or an abort can end it. */
export const neverRespond: Handler = () => undefined;

/** Drops the connection after the request arrived, as if the response got lost on the way back. */
export function dropConnection(req: IncomingMessage): void {
  req.socket.destroy();
}

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(text);
}
