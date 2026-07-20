import type { IncomingMessage, ServerResponse } from "node:http";
import type { FetchHandler } from "./handler.js";

const readBody = (req: IncomingMessage): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });

const toRequest = async (req: IncomingMessage): Promise<Request> => {
  const host = req.headers.host ?? "localhost";
  const proto = (req.headers["x-forwarded-proto"] as string | undefined) ?? "http";
  const url = `${proto}://${host}${req.url ?? "/"}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const body = hasBody ? new Uint8Array(await readBody(req)) : undefined;
  return new Request(url, { method: req.method, headers, body });
};

const writeResponse = async (res: ServerResponse, response: Response): Promise<void> => {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  res.writeHead(response.status, headers);
  res.end(response.body ? Buffer.from(await response.arrayBuffer()) : undefined);
};

/**
 * Adapt a fetch handler into a `node:http` request listener, so the exact same
 * endpoint runs on a plain Node server, Express, etc.
 *
 * @example
 * import { createServer } from "node:http";
 * createServer(createNodeListener(handler)).listen(3000);
 */
export const createNodeListener =
  (handler: FetchHandler) =>
  async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const request = await toRequest(req);
    const response = await handler(request);
    await writeResponse(res, response);
  };
