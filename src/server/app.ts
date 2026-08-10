import { readFile, stat } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve } from "node:path";
import { createServer as createNetServer } from "node:net";
import { createCapabilityToken, isAllowedHost, isAllowedOrigin, verifyCapabilityToken } from "./security";
import { LIMITS, assertByteLimit } from "../shared/limits";
import type { ReviewService } from "./review-service";

const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
const MIME: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".map": "application/json" };

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store", "Content-Security-Policy": CSP, "X-Content-Type-Options": "nosniff" } });
}

function safeMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") return "Guide generation was cancelled.";
  return error instanceof Error ? error.message.replaceAll(/[\r\n]+/g, " ").slice(0, 500) : "The operation failed.";
}

async function requestBody(request: Request): Promise<unknown> {
  const length = Number(request.headers.get("content-length") || "0");
  if (length > LIMITS.requestBytes) throw new Error("Request body is too large.");
  const raw = await request.text();
  assertByteLimit(raw, LIMITS.requestBytes, "request_body");
  return raw ? JSON.parse(raw) : {};
}

async function staticResponse(dist: string, pathname: string): Promise<Response> {
  const requested = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
  let filePath = resolve(dist, requested);
  const rel = relative(dist, filePath);
  if (isAbsolute(rel) || rel.startsWith("..")) return new Response("Not found", { status: 404 });
  try {
    if (!(await stat(filePath)).isFile()) throw new Error();
  } catch {
    filePath = resolve(dist, "index.html");
  }
  const body = await readFile(filePath);
  return new Response(body, { headers: { "Content-Type": MIME[extname(filePath)] ?? "application/octet-stream", "Content-Security-Policy": CSP, "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Cache-Control": "no-store" } });
}

export interface RunningServer {
  url: string;
  origin: string;
  stop(): Promise<void>;
}

async function availableLoopbackPort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const reservation = createNetServer();
    reservation.unref();
    reservation.once("error", reject);
    reservation.listen(0, "127.0.0.1", () => {
      const address = reservation.address();
      if (!address || typeof address === "string") {
        reservation.close();
        reject(new Error("Could not reserve a loopback port."));
        return;
      }
      const port = address.port;
      reservation.close((error) => error ? reject(error) : resolvePort(port));
    });
  });
}

export async function startServer(options: { service: ReviewService; dist: string; token?: string }): Promise<RunningServer> {
  const token = options.token ?? createCapabilityToken();
  const port = await availableLoopbackPort();
  let expectedHost = "";
  let expectedOrigin = "";
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port,
    async fetch(request) {
      const url = new URL(request.url);
      if (!url.pathname.startsWith("/api/")) {
        if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
        return staticResponse(options.dist, url.pathname);
      }
      if (!isAllowedHost(request.headers.get("host"), expectedHost)) return json({ error: "Request host was rejected." }, 403);
      if (!verifyCapabilityToken(token, request.headers.get("x-guided-review-token"))) return json({ error: "Review capability is missing or invalid." }, 401);
      const stateChanging = request.method !== "GET" && request.method !== "HEAD";
      if (stateChanging && !isAllowedOrigin(request.headers.get("origin"), expectedOrigin)) return json({ error: "Request origin was rejected." }, 403);
      try {
        if (url.pathname === "/api/review" && request.method === "GET") return json(await options.service.load(url.searchParams.get("fixtureState") ?? undefined));
        if (url.pathname === "/api/review" && request.method === "PATCH") return json(await options.service.update(await requestBody(request)));
        if (url.pathname === "/api/feedback" && request.method === "GET") return json(await options.service.feedback());
        if (url.pathname === "/api/generate" && request.method === "POST") {
          const body = await requestBody(request) as Record<string, unknown>;
          if (Object.keys(body).some((key) => key !== "regenerate") || (body.regenerate !== undefined && typeof body.regenerate !== "boolean")) return json({ error: "Generation request is malformed." }, 400);
          return json(await options.service.generate(Boolean(body.regenerate)));
        }
        if (url.pathname === "/api/cancel" && request.method === "POST") {
          await requestBody(request);
          return json({ cancelled: options.service.cancel() });
        }
        if (["/api/review", "/api/feedback", "/api/generate", "/api/cancel"].includes(url.pathname)) return json({ error: "Method not allowed." }, 405);
        return json({ error: "Unknown API route." }, 404);
      } catch (error) {
        return json({ error: safeMessage(error) }, error instanceof SyntaxError ? 400 : 422);
      }
    },
  });
  expectedHost = `127.0.0.1:${server.port}`;
  expectedOrigin = `http://${expectedHost}`;
  return {
    origin: expectedOrigin,
    url: `${expectedOrigin}/#${token}`,
    stop: async () => { await server.stop(true); },
  };
}
