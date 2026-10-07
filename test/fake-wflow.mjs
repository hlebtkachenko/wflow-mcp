// Fake wflow API and OAuth endpoint for the tests and the contract check. Records every API request.
import http from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export const ORG = "acme";
const AUTH_PATH = "/connect/auth";

export async function startFake(responder = () => undefined) {
  const requests = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks);
      const url = new URL(req.url, "http://fake");
      if (url.pathname === AUTH_PATH) {
        res.writeHead(200, { "Content-Type": "application/json" })
          .end(JSON.stringify({ access_token: "synthetic", token_type: "Bearer", expires_in: 3600 }));
        return;
      }
      const contentType = req.headers["content-type"] ?? "";
      let body;
      if (raw.length && contentType.startsWith("application/json")) body = JSON.parse(raw.toString());
      else if (raw.length) body = raw.toString("latin1");
      const rec = { method: req.method, path: decodeURIComponent(url.pathname), query: Object.fromEntries(url.searchParams), contentType, body };
      requests.push(rec);
      const r = responder(rec) ?? { status: 200 };
      const payload = r.body === undefined ? "" : JSON.stringify(r.body);
      res.writeHead(r.status ?? 200, payload ? { "Content-Type": "application/json" } : {}).end(payload);
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const client = new Client({ name: "test", version: "0" });
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: ["dist/index.js"],
    env: {
      WFLOW_CLIENT_ID: "synthetic-id",
      WFLOW_CLIENT_SECRET: "synthetic-value",
      WFLOW_ORGANIZATION: ORG,
      WFLOW_API_URL: base,
      WFLOW_TOKEN_URL: base + AUTH_PATH,
      WFLOW_CACHE_TTL: "0",
    },
  }));
  return {
    client,
    requests,
    async close() {
      await client.close();
      server.close();
    },
  };
}
