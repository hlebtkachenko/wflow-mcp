// End-to-end tests: the built server (dist/) talks to a fake wflow API over HTTP.
// Run with `npm test` (builds first). All data here is synthetic.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { startFake, ORG } from "./fake-wflow.mjs";
import { WflowClient } from "../dist/wflow-client.js";

const D = "11111111-1111-4111-8111-111111111111";
const F = "22222222-2222-4222-8222-222222222222";
const T = "33333333-3333-4333-8333-333333333333";
const U = "44444444-4444-4444-8444-444444444444";
const A = `/api/${ORG}`;

const RESPONSES = {
  [`GET ${A}/users`]: { items: [{ id: U, identity: { login: "user@example.com", firstName: "Jana", lastName: "Testová" }, hasFullAccess: true }], totalItems: 1, page: 1, pageSize: 20 },
  [`GET ${A}/roles`]: { items: [{ id: T, name: "Approver", description: "Synthetic role" }], totalItems: 1, page: 1 },
  [`GET ${A}/teams`]: { items: [{ id: T, name: "Finance", description: "Synthetic team", system: false }], totalItems: 1, page: 1 },
  [`GET ${A}/documents/types`]: { items: [{ id: T, name: "Received invoice", kind: "IncomingInvoice" }], totalItems: 1, page: 1 },
  [`GET ${A}/approvalstemplates`]: { items: [{ id: T, name: "Two-step", isEmpty: false }], totalItems: 1, page: 1 },
  [`GET ${A}/documents/toexport`]: [D],
  [`GET ${A}/documents/toextract`]: [D, F],
  [`GET ${A}/documents/tags`]: ["paid", "urgent"],
  [`PUT ${A}/documents`]: D,
  [`POST ${A}/roles`]: T,
};

let fake;
before(async () => {
  fake = await startFake((r) => {
    const key = `${r.method} ${r.path}`;
    if (key in RESPONSES) return { body: RESPONSES[key] };
    if (r.path.endsWith("/failing")) return { status: 500, body: { title: "Synthetic failure" } };
    return { status: r.method === "GET" ? 200 : 204, body: r.method === "GET" ? [] : undefined };
  });
});
after(() => fake?.close());

async function call(name, args = {}) {
  const from = fake.requests.length;
  const result = await fake.client.callTool({ name, arguments: args });
  return { result, text: result.content?.[0]?.text ?? "", reqs: fake.requests.slice(from) };
}

// Exact request per tool and mode: [tool, args, method, path, query, body]
// body: undefined = no body, array/object = exact JSON body.
const CASES = [
  ["wf_documents", { query: "q", sort: "issueDate", page: 2, pageSize: 5 }, "GET", `${A}/documents`, { page: "2", pageSize: "5", query: "q", sort: "issueDate" }],
  ["wf_document", { documentId: D }, "GET", `${A}/documents/${D}`],
  ["wf_document_save", { id: D, number: "FV-1", issueDate: "2026-01-15", totalAmount: 121, partnerIC: "12345678", externalId: "X1", ignoreLock: true, setAsFilled: false },
    "PUT", `${A}/documents`, { externalId: "X1", ignoreLock: "true", setAsFilled: "false" }, { id: D, number: "FV-1", issueDate: "2026-01-15", totalAmount: 121, partnerIC: "12345678" }],
  ["wf_document_delete", { documentId: D }, "DELETE", `${A}/documents/${D}`],
  ["wf_document_metadata", { documentId: D }, "GET", `${A}/documents/${D}/metadata`],
  ["wf_document_metadata", { documentId: D, action: "set", metadata: '{"k":"v"}' }, "PUT", `${A}/documents/${D}/metadata`, {}, '{"k":"v"}'],
  ["wf_document_lock", { documentId: D, lock: true }, "PUT", `${A}/documents/${D}/lock/true`],
  ["wf_document_events", { documentId: D }, "GET", `${A}/documents/${D}/events`],
  ["wf_document_export", { format: "isdoc", filter: '{"search":"x"}', parameters: "p", markAsExported: true },
    "POST", `${A}/documents/export/isdoc`, { parameters: "p", markAsExported: "true" }, { search: "x" }],
  ["wf_documents_queue", { queue: "export", typeId: T }, "GET", `${A}/documents/toexport`, { typeId: T }],
  ["wf_documents_queue", { queue: "extract" }, "GET", `${A}/documents/toextract`],
  ["wf_document_task", { documentId: D, taskType: "erp" }, "POST", `${A}/documents/${D}/task/erp`],
  ["wf_document_task", { documentId: D, taskType: "erp", action: "processed", success: true, message: "ok" },
    "PUT", `${A}/documents/${D}/task/erp/processed`, { success: "true", message: "ok" }],
  ["wf_document_files", { documentId: D }, "GET", `${A}/documents/${D}/files`],
  ["wf_document_file_delete", { fileId: F }, "DELETE", `${A}/documents/files/${F}`],
  ["wf_document_file_stamp", { documentId: D, fileId: F }, "PUT", `${A}/documents/${D}/files/${F}/stamp`],
  ["wf_document_approvals", { documentId: D }, "GET", `${A}/documents/${D}/approvals`],
  ["wf_document_approval_set", { documentId: D, templateId: T }, "PUT", `${A}/documents/${D}/approvals/set/${T}`],
  ["wf_document_approval_clear", { documentId: D }, "DELETE", `${A}/documents/${D}/approvals`],
  ["wf_document_comments", { documentId: D }, "GET", `${A}/documents/${D}/comments`],
  ["wf_document_links", { documentId: D }, "GET", `${A}/documents/${D}/links`],
  ["wf_document_links", { documentId: D, action: "add", linkedDocumentId: F }, "PUT", `${A}/documents/${D}/links/${F}`],
  ["wf_document_links", { documentId: D, action: "remove", linkedDocumentId: F }, "DELETE", `${A}/documents/${D}/links/${F}`],
  ["wf_document_payments", { documentId: D, payments: '[{"date":"2026-01-15","info":"x","amount":10}]' },
    "PUT", `${A}/documents/${D}/payments`, {}, [{ date: "2026-01-15", info: "x", amount: 10 }]],
  ["wf_document_rights", { documentId: D }, "GET", `${A}/documents/${D}/rights`],
  ["wf_document_rights", { documentId: D, action: "set", rights: `[{"id":"${T}"}]` }, "PUT", `${A}/documents/${D}/rights`, {}, [{ id: T }]],
  ["wf_document_tags", {}, "GET", `${A}/documents/tags`],
  ["wf_document_tags", { documentId: D }, "GET", `${A}/documents/${D}/tags`],
  ["wf_document_tag_set", { documentId: D, tag: "paid" }, "PUT", `${A}/documents/${D}/tags/paid`],
  ["wf_document_tag_set", { documentId: D, tag: "paid", action: "remove" }, "DELETE", `${A}/documents/${D}/tags/paid`],
  ["wf_doc_property_definitions", {}, "GET", `${A}/documents/properties/definitions`],
  ["wf_doc_property_definition_save", { id: "p1", name: "Cost centre", type: "text", order: 1, show: true, editable: false },
    "PUT", `${A}/documents/properties/definition`, {}, { name: "Cost centre", type: "text", id: "p1", order: 1, show: true, editable: false }],
  ["wf_doc_property_definition_delete", { definitionId: "p1" }, "DELETE", `${A}/documents/properties/definition/p1`],
  ["wf_document_properties", { documentId: D }, "GET", `${A}/documents/${D}/properties`],
  ["wf_document_properties", { documentId: D, action: "set", properties: '[{"id":"p1","value":"A"}]' }, "PUT", `${A}/documents/${D}/properties`, {}, [{ id: "p1", value: "A" }]],
  ["wf_document_property_delete", { documentId: D, propertyId: "p1" }, "DELETE", `${A}/documents/${D}/properties/p1`],
  ["wf_file_property_definitions", {}, "GET", `${A}/storage/files/properties/definitions`],
  ["wf_file_property_definition_save", { name: "Owner", type: "text" }, "PUT", `${A}/storage/files/properties/definition`, {}, { name: "Owner", type: "text" }],
  ["wf_file_property_definition_delete", { definitionId: "p1" }, "DELETE", `${A}/storage/files/properties/definition/p1`],
  ["wf_file_properties", { fileId: F }, "GET", `${A}/storage/files/${F}/properties`],
  ["wf_file_properties", { fileId: F, action: "set", properties: '[{"id":"p1","value":"A"}]' }, "PUT", `${A}/storage/files/${F}/properties`, {}, [{ id: "p1", value: "A" }]],
  ["wf_file_property_delete", { fileId: F, propertyId: "p1" }, "DELETE", `${A}/storage/files/${F}/properties/p1`],
  ["wf_storage_files", { query: "q", page: 1, pageSize: 10 }, "GET", `${A}/storage/files`, { page: "1", pageSize: "10", query: "q" }],
  ["wf_storage_file", { fileId: F }, "GET", `${A}/storage/files/${F}`],
  ["wf_storage_file_delete", { fileId: F }, "DELETE", `${A}/storage/files/${F}`],
  ["wf_storage_file_lock", { fileId: F, lock: false }, "PUT", `${A}/storage/files/${F}/lock/false`],
  ["wf_storage_file_move", { fileId: F, folderId: T }, "PUT", `${A}/storage/files/${F}/move`, { folderId: T }],
  ["wf_storage_file_rename", { fileId: F, name: "new.pdf" }, "PUT", `${A}/storage/files/${F}/rename`, { name: "new.pdf" }],
  ["wf_storage_file_restore", { fileId: F, folderId: T }, "PUT", `${A}/storage/files/${F}/restore`, { folderId: T }],
  ["wf_storage_folders", {}, "GET", `${A}/storage/folders/children`],
  ["wf_storage_folders", { folderId: T }, "GET", `${A}/storage/folders/${T}`],
  ["wf_storage_folder_create", { name: "Inbox", parentId: T }, "PUT", `${A}/storage/folders`, {}, { name: "Inbox", parentId: T }],
  ["wf_storage_folder_delete", { folderId: T }, "DELETE", `${A}/storage/folders/${T}`],
  ["wf_storage_file_approvals", { fileId: F }, "GET", `${A}/storage/files/${F}/approvals`],
  ["wf_storage_file_approvals", { fileId: F, action: "set", templateId: T }, "PUT", `${A}/storage/files/${F}/approvals/set/${T}`],
  ["wf_storage_file_approvals", { fileId: F, action: "clear" }, "DELETE", `${A}/storage/files/${F}/approvals`],
  ["wf_storage_rights", { type: "file", id: F }, "GET", `${A}/storage/files/${F}/rights`],
  ["wf_storage_rights", { type: "folder", id: T, action: "set", rights: `[{"id":"${T}"}]` }, "PUT", `${A}/storage/folders/${T}/rights`, {}, [{ id: T }]],
  ["wf_registers", { registerType: "partners", query: "q" }, "GET", `${A}/registers/partners`, { query: "q" }],
  ["wf_register_save", { registerType: "projects", items: '[{"code":"P1"}]' }, "PUT", `${A}/registers/projects`, {}, [{ code: "P1" }]],
  ["wf_register_update", { registerType: "projects", items: '[{"code":"P1"}]' }, "PATCH", `${A}/registers/projects`, {}, [{ code: "P1" }]],
  ["wf_organization", {}, "GET", `${A}/organization`],
  ["wf_my_organizations", {}, "GET", "/api/user/myorganizations"],
  ["wf_account", {}, "GET", `${A}/account`],
  ["wf_users", { page: 2, pageSize: 5, search: "jana" }, "GET", `${A}/users`, { page: "2", pageSize: "5", search: "jana" }],
  ["wf_user_info", { userId: U }, "GET", `${A}/users/${U}`],
  ["wf_user_save", { login: "user@example.com", hasFullAccess: false, roles: [T], teams: [T], documentTypes: [{ id: T, permission: "All" }] },
    "PUT", `${A}/users`, {}, { login: "user@example.com", hasFullAccess: false, roles: [{ id: T }], teams: [{ id: T }], documentTypes: [{ id: T, permission: "All" }] }],
  ["wf_user_delete", { userId: U }, "DELETE", `${A}/users/${U}`],
  ["wf_roles", {}, "GET", `${A}/roles`],
  ["wf_role_create", { name: "Approver", description: "d" }, "POST", `${A}/roles`, {}, { name: "Approver", description: "d" }],
  ["wf_role_update", { roleId: T, name: "Approver" }, "PUT", `${A}/roles/${T}`, {}, { name: "Approver" }],
  ["wf_role_delete", { roleId: T }, "DELETE", `${A}/roles/${T}`],
  ["wf_teams", {}, "GET", `${A}/teams`],
  ["wf_team_create", { name: "Finance" }, "POST", `${A}/teams`, {}, { name: "Finance" }],
  ["wf_team_update", { teamId: T, description: "d" }, "PUT", `${A}/teams/${T}`, {}, { description: "d" }],
  ["wf_team_delete", { teamId: T }, "DELETE", `${A}/teams/${T}`],
  ["wf_document_types", {}, "GET", `${A}/documents/types`],
  ["wf_document_type_save", { id: T, name: "Invoice", kind: "IncomingInvoice", invoiceType: "TaxInvoice" },
    "PUT", `${A}/documents/types`, {}, { name: "Invoice", id: T, kind: "IncomingInvoice", invoiceType: "TaxInvoice" }],
  ["wf_document_type_delete", { typeId: T }, "DELETE", `${A}/documents/types/typeid:guid`, { typeId: T }],
  ["wf_approval_templates", {}, "GET", `${A}/approvalstemplates`],
  ["wf_approval_template_info", { templateId: T }, "GET", `${A}/approvalstemplates/${T}`],
  ["wf_approval_template_save", { id: T, name: "Two-step", teams: `[{"teamId":"${T}","level":1}]` },
    "PUT", `${A}/approvalstemplates`, {}, { name: "Two-step", id: T, teams: [{ teamId: T, level: 1 }] }],
  ["wf_approval_template_delete", { templateId: T }, "DELETE", `${A}/approvalstemplates/${T}`],
  ["wf_webhooks", {}, "GET", `${A}/webhookregistrations`],
  ["wf_webhook_save", { webHookUri: "https://example.com/hook", actions: ["DocumentCreated"] },
    "PUT", `${A}/webhookregistrations`, {}, { webHookUri: "https://example.com/hook", actions: ["DocumentCreated"] }],
  ["wf_webhook_delete", { registrationId: T }, "DELETE", `${A}/webhookregistrations/${T}`],
  ["wf_integration_allow", {}, "PUT", `${A}/integrations/allow`],
  ["wf_integration_api_client", {}, "POST", `${A}/integrations/apiclient`],
  ["wf_api_raw", { method: "GET", path: `${A}/documents/${D}` }, "GET", `${A}/documents/${D}`],
];

test("every tool sends the exact request", async () => {
  const tools = (await fake.client.listTools()).tools.map((t) => t.name);
  const covered = new Set([...CASES.map((c) => c[0]), "wf_document_with_files"]);
  assert.deepEqual(tools.filter((t) => !covered.has(t)), [], "tools without a request test");
  for (const [name, args, method, path, query = {}, body] of CASES) {
    const { result, reqs } = await call(name, args);
    const label = `${name} ${JSON.stringify(args)}`;
    assert.ok(!result.isError, `${label}: ${result.content?.[0]?.text}`);
    assert.equal(reqs.length, 1, label);
    assert.equal(reqs[0].method, method, label);
    assert.equal(reqs[0].path, path, label);
    assert.deepEqual(reqs[0].query, query, label);
    assert.deepEqual(reqs[0].body, body, label);
  }
});

// Finding 1: collection endpoints return {items: [...]}, queues return plain arrays of IDs.
test("list tools read collection items and plain ID arrays", async () => {
  for (const [name, needle] of [["wf_users", "Jana Testová"], ["wf_roles", "Approver"], ["wf_teams", "Finance"], ["wf_document_types", "Received invoice"], ["wf_approval_templates", "Two-step"]]) {
    const { text } = await call(name);
    assert.match(text, new RegExp(needle), name);
    assert.doesNotMatch(text, /users\)/, `${name} must not print a user count the API does not return`);
  }
  assert.match((await call("wf_documents_queue", { queue: "extract" })).text, new RegExp(`${D}[\\s\\S]*${F}`));
  assert.match((await call("wf_document_tags")).text, /- paid\n- urgent/);
});

// Finding 2: comment add/delete endpoints are not in the spec.
test("comment write tools are not registered", async () => {
  const tools = (await fake.client.listTools()).tools.map((t) => t.name);
  assert.ok(!tools.includes("wf_document_comment_add"));
  assert.ok(!tools.includes("wf_document_comment_delete"));
});

// Finding 3: multipart upload with typeId and invoiceType as query params.
test("document with files is sent as multipart uploadedFiles", async () => {
  const { result, reqs } = await call("wf_document_with_files", {
    files: [{ fileName: "invoice.pdf", contentBase64: Buffer.from("%PDF-1.4 synthetic").toString("base64"), contentType: "application/pdf" }],
    typeId: T,
    invoiceType: "TaxInvoice",
  });
  assert.ok(!result.isError, JSON.stringify(result));
  const [r] = reqs;
  assert.equal(r.method, "POST");
  assert.equal(r.path, `${A}/documents/withfiles`);
  assert.deepEqual(r.query, { typeId: T, invoiceType: "TaxInvoice" });
  assert.match(r.contentType, /^multipart\/form-data; boundary=/);
  assert.match(r.body, /name="uploadedFiles"; filename="invoice.pdf"/);
  assert.match(r.body, /%PDF-1.4 synthetic/);
});

// Finding 4: move/rename take query params and no body.
test("storage move and rename send query params only", async () => {
  for (const [name, args, q] of [["wf_storage_file_move", { fileId: F, folderId: T }, { folderId: T }], ["wf_storage_file_rename", { fileId: F, name: "a.pdf" }, { name: "a.pdf" }]]) {
    const { reqs } = await call(name, args);
    assert.deepEqual(reqs[0].query, q, name);
    assert.equal(reqs[0].body, undefined, name);
  }
});

// Finding 5: UserUpdate allows only login, hasFullAccess, roles, teams, documentTypes.
test("user save sends only UserUpdate fields", async () => {
  const { reqs } = await call("wf_user_save", { login: "user@example.com", roles: [T] });
  assert.deepEqual(Object.keys(reqs[0].body).sort(), ["login", "roles"]);
  assert.deepEqual(reqs[0].body.roles, [{ id: T }]);
});

// Finding 6: delete goes to the literal spec path with typeId as query param.
test("document type delete uses the spec path", async () => {
  const { reqs } = await call("wf_document_type_delete", { typeId: T });
  assert.equal(reqs[0].path, `${A}/documents/types/typeid:guid`);
  assert.deepEqual(reqs[0].query, { typeId: T });
});

// Finding 7: tools that overwrite or have remove/clear modes are marked destructive.
test("overwriting and removing tools carry destructiveHint", async () => {
  const tools = Object.fromEntries((await fake.client.listTools()).tools.map((t) => [t.name, t.annotations ?? {}]));
  for (const name of ["wf_register_save", "wf_document_links", "wf_storage_file_approvals", "wf_document_tag_set", "wf_document_rights", "wf_storage_rights", "wf_api_raw"]) {
    assert.equal(tools[name].destructiveHint, true, name);
  }
  assert.equal(tools.wf_api_raw.openWorldHint, true);
  for (const [name, a] of Object.entries(tools)) {
    assert.ok(a.readOnlyHint === true || typeof a.destructiveHint === "boolean", `${name} needs explicit annotations`);
  }
});

// Finding 8: a timed-out write is not repeated; reads still retry.
test("timeouts retry reads but never writes", async () => {
  const timeout = () => Object.assign(new Error("timed out"), { name: "TimeoutError" });
  const realFetch = globalThis.fetch;
  let apiCalls = 0;
  globalThis.fetch = async (url) => {
    if (String(url).includes("/connect/")) return new Response(JSON.stringify({ access_token: "synthetic", expires_in: 3600 }));
    apiCalls++;
    throw timeout();
  };
  try {
    const c = new WflowClient({ clientId: "a", clientSecret: "b", baseUrl: "http://192.0.2.1", tokenUrl: "http://192.0.2.1/connect/auth", maxRetries: 1, cacheTtl: 0 });
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      apiCalls = 0;
      await assert.rejects(c.request(method, "/api/acme/roles", {}), /Outcome unknown/, method);
      assert.equal(apiCalls, 1, `${method} must not be retried`);
    }
    apiCalls = 0;
    await assert.rejects(c.request("GET", "/api/acme/roles"), /timed out/);
    assert.equal(apiCalls, 2, "GET is retried");
  } finally {
    globalThis.fetch = realFetch;
  }
});

// Finding 9: README lists exactly the registered tools with correct counts.
test("README tool tables match the registered tools", async () => {
  const readme = fs.readFileSync("README.md", "utf8");
  const tools = (await fake.client.listTools()).tools.map((t) => t.name).sort();
  const listed = [...readme.matchAll(/^\| `(wf_\w+)` \|/gm)].map((m) => m[1]).sort();
  assert.deepEqual(listed, tools);
  assert.match(readme, new RegExp(`\\b${tools.length} tools\\b`));
  for (const m of readme.matchAll(/^### .+ \((\d+) tools?\)\n\n\|[^\n]+\n\|[^\n]+\n((?:\| `wf_[^\n]+\n)+)/gm)) {
    assert.equal(m[2].trim().split("\n").length, Number(m[1]), m[0].split("\n")[0]);
  }
});

// Finding 10: JSON-string params document their shape; export exposes the spec's query params.
test("JSON-string params describe their shape", async () => {
  const tools = Object.fromEntries((await fake.client.listTools()).tools.map((t) => [t.name, t.inputSchema.properties]));
  assert.match(tools.wf_document_payments.payments.description, /date.*info.*amount/);
  assert.match(tools.wf_document_export.filter.description, /filters.*propertyFilters.*validationType/s);
  assert.ok(tools.wf_document_export.parameters && tools.wf_document_export.markAsExported);
});

// Finding 11: empty responses and string IDs both produce a sensible message.
test("write results handle 204 and string IDs", async () => {
  assert.equal((await call("wf_team_create", { name: "Finance" })).text, "Team created.");
  assert.equal((await call("wf_role_create", { name: "Approver" })).text, `Role created. ID: ${T}`);
  assert.equal((await call("wf_document_save", { number: "FV-2" })).text, `Document created. ID: ${D}`);
});

test("HTTP errors reach the model as isError", async () => {
  const { result } = await call("wf_api_raw", { method: "GET", path: `${A}/failing` });
  assert.ok(result.isError);
  assert.match(result.content[0].text, /500: Synthetic failure/);
});
