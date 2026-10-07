// Validates the HTTP request every tool sends against wflow's published OpenAPI spec.
// Calls each tool with sample arguments (all fields, required fields only, every mode) against a
// fake wflow API, then checks: path + method exist, query params are declared, the JSON body
// validates against the requestBody schema, multipart uploads use the declared form fields.
// Usage: npm run check:contract   (the spec is cached in .spec-cache/)
import fs from "node:fs";
import path from "node:path";
import Ajv from "ajv";
import { startFake } from "../test/fake-wflow.mjs";

const SPEC_URL = "https://api.wflow.com/swagger/v1/swagger.json";
const CACHE = path.resolve(".spec-cache");
const SKIP = new Set(["wf_api_raw"]);
const UUID = "33333333-3333-4333-8333-333333333333";
const MODE_KEYS = ["action", "queue", "type", "lock"];

// JSON-string params: a minimal value of the shape the endpoint expects.
const JSON_SAMPLES = {
  payments: '[{"date":"2026-01-15","info":"X1","amount":1}]',
  filter: '{"search":"X1","sort":"X1","validationType":["Duplicity"]}',
  rights: `[{"id":"${UUID}"}]`,
  properties: '[{"id":"X1","value":"X1"}]',
  teams: `[{"teamId":"${UUID}","level":1}]`,
  items: "[]", // register item schemas differ per register; the tool passes the array through unchanged
};

async function loadSpec() {
  const file = path.join(CACHE, "swagger.json");
  if (!fs.existsSync(file)) {
    fs.mkdirSync(CACHE, { recursive: true });
    const resp = await fetch(SPEC_URL);
    if (!resp.ok) throw new Error(`Cannot download the spec: HTTP ${resp.status}`);
    fs.writeFileSync(file, Buffer.from(await resp.arrayBuffer()));
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function sample(schema, key = "") {
  if (key in JSON_SAMPLES && schema.type === "string") return JSON_SAMPLES[key];
  if (key === "contentBase64") return Buffer.from("%PDF-1.4 synthetic").toString("base64");
  if (key === "webHookUri") return "https://example.com/hook";
  if (key === "path") return "/api/acme/documents";
  if (schema.enum) return schema.enum[0];
  if (schema.anyOf) return sample(schema.anyOf[0], key);
  switch (schema.type) {
    case "string":
      if (schema.format === "uuid") return UUID;
      if (/date/i.test(key)) return "2026-01-15";
      return "X1";
    case "number": case "integer": return Math.max(1, schema.minimum ?? 1);
    case "boolean": return true;
    case "array": return [sample(schema.items)];
    case "object": return Object.fromEntries(Object.entries(schema.properties ?? {}).map(([k, v]) => [k, sample(v, k)]));
    default: return "X1";
  }
}

function requiredOnly(schema, value) {
  if (schema?.type !== "object" || !value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([k]) => schema.required?.includes(k))
    .map(([k, v]) => [k, requiredOnly(schema.properties[k], v)]));
}

function variants(tool) {
  const props = tool.inputSchema.properties ?? {};
  const { organization, ...full } = sample(tool.inputSchema); // the default organization is used
  const req = requiredOnly(tool.inputSchema, full);
  const modes = MODE_KEYS.filter((k) => props[k]?.enum || props[k]?.type === "boolean")
    .map((k) => [k, props[k].enum ?? [true, false]]);
  let combos = [{}];
  for (const [k, values] of modes) combos = combos.flatMap((c) => values.map((v) => ({ ...c, [k]: v })));
  return combos.flatMap((c) => [["full", { ...full, ...c }], ["required", { ...req, ...c }]]);
}

const spec = await loadSpec();
const ajv = new Ajv({ strict: false, allErrors: true });
const date = /^\d{4}-\d{2}-\d{2}([T ][\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/;
ajv.addFormat("uuid", /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
ajv.addFormat("date-time", date); // the API accepts a plain date for DateTime fields
for (const f of ["int32", "int64", "double", "float", "binary", "byte", "uri", "email"]) ajv.addFormat(f, true);
// Point $refs at the spec document; drop OpenAPI's `nullable` where there is no `type` (Ajv rejects it).
const refs = (s) => JSON.parse(JSON.stringify(s).replaceAll('"#/components/', '"spec#/components/'), (k, v) => {
  if (v && typeof v === "object" && v.nullable && !v.type && !v.$ref) delete v.nullable;
  return v;
});
ajv.addSchema({ $id: "spec", components: refs(spec.components) });

const routes = Object.entries(spec.paths).map(([p, ops]) => ({
  p,
  ops,
  re: new RegExp("^" + p.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\{[^}]+\}/g, "[^/]+") + "$"),
})).sort((a, b) => (a.p.match(/\{/g)?.length ?? 0) - (b.p.match(/\{/g)?.length ?? 0)); // literal segments win
const validators = new Map();

function check(req) {
  const errors = [];
  const route = routes.find((r) => r.re.test(req.path) && r.ops[req.method.toLowerCase()]);
  if (!route) return [`${req.method} ${req.path} is not in the spec`];
  const op = route.ops[req.method.toLowerCase()];
  const declared = new Set((op.parameters ?? []).filter((p) => p.in === "query").map((p) => p.name));
  for (const q of Object.keys(req.query)) if (!declared.has(q)) errors.push(`query param '${q}' is not declared`);
  const content = op.requestBody?.content ?? {};
  if (req.body === undefined) return errors;
  if (req.contentType.startsWith("multipart/form-data")) {
    const schema = content["multipart/form-data"]?.schema;
    if (!schema) return [...errors, "multipart body but the operation takes none"];
    for (const [, field] of req.body.matchAll(/; name="([^"]+)"/g)) {
      if (!schema.properties?.[field]) errors.push(`multipart field '${field}' is not declared`);
    }
    return errors;
  }
  const schema = content["application/json"]?.schema;
  if (!schema) return [...errors, content["multipart/form-data"] ? "JSON body but the operation expects multipart/form-data" : "body sent but the operation takes none"];
  const key = `${req.method} ${route.p}`;
  if (!validators.has(key)) validators.set(key, ajv.compile(refs(schema)));
  const validate = validators.get(key);
  if (!validate(req.body)) {
    for (const e of validate.errors) errors.push(`body${e.instancePath} ${e.message}${e.params?.additionalProperty ? ` '${e.params.additionalProperty}'` : ""}`);
  }
  return errors;
}

const fake = await startFake((r) => (r.method === "GET" ? { body: [] } : { status: 204 }));
let failed = 0;
let checked = 0;
const { tools } = await fake.client.listTools();
for (const tool of tools) {
  if (SKIP.has(tool.name)) continue;
  const seen = new Set();
  for (const [kind, args] of variants(tool)) {
    const label = `${tool.name} ${JSON.stringify(Object.fromEntries(MODE_KEYS.filter((k) => k in args).map((k) => [k, args[k]])))} (${kind})`;
    const from = fake.requests.length;
    const result = await fake.client.callTool({ name: tool.name, arguments: args });
    const reqs = fake.requests.slice(from);
    if (!reqs.length) {
      console.log(`SKIP ${label}: no request sent (${result.content?.[0]?.text?.split("\n")[0]})`);
      continue;
    }
    for (const req of reqs) {
      const sig = JSON.stringify([req.method, req.path, req.query, req.body]);
      if (seen.has(sig)) continue;
      seen.add(sig);
      checked++;
      const errors = check(req);
      if (errors.length) {
        failed++;
        console.log(`FAIL ${label} ${req.method} ${req.path}\n     ${errors.join("\n     ")}`);
      } else {
        console.log(`ok   ${label} ${req.method} ${req.path}`);
      }
    }
  }
}

await fake.close();
console.log(failed ? `\n${failed} of ${checked} request(s) violate the spec.` : `\nAll ${checked} requests match the spec.`);
process.exit(failed ? 1 : 0);
