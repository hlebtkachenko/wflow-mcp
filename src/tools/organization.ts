import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WflowClient } from "../wflow-client.js";
import { textResult, errorResult, fmtDate, orgParam, Annotations, savedText, pageParams, pageQuery, pageHeading } from "../utils.js";
import type {
  OrganizationEntity,
  OrganizationDomain,
  UserFull,
  Identity,
  Collection,
  RoleBase,
  TeamBase,
} from "../types.js";

// ---------------------------------------------------------------------------
// Organization
// ---------------------------------------------------------------------------

export function registerOrganizationTools(server: McpServer, client: WflowClient) {
  server.tool(
    "wf_organization",
    "Get organization details",
    {
      organization: orgParam,
    },
    Annotations.read,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const data = await client.get<OrganizationEntity>(`/api/${org}/organization`);
        const lines = [
          `# Organization: ${data.name ?? org}`,
          `- **ID** ${data.id}`,
          `- **URL part** ${data.organizationUrlPart ?? "—"}`,
          `- **Created** ${fmtDate(data.created)}`,
          `- **VAT country** ${data.vatCountry ?? "—"}`,
          `- **VAT non-payer** ${data.vatNonPayer ? "yes" : "no"}`,
        ];
        return textResult(lines.join("\n"));
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_my_organizations",
    "List organizations available to the current user",
    {},
    Annotations.read,
    async () => {
      try {
        const list = await client.get<OrganizationDomain[]>("/api/user/myorganizations");
        if (!list?.length) return textResult("No organizations found.");
        const lines = [`# My Organizations (${list.length})`];
        for (const o of list) {
          lines.push(`- **${o.name ?? "—"}** — \`${o.subdomain ?? "—"}\``);
        }
        return textResult(lines.join("\n"));
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_account",
    "Get current account information",
    {
      organization: orgParam,
    },
    Annotations.read,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const data = await client.get<Record<string, unknown>>(`/api/${org}/account`);
        return textResult(`# Account\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

function fmtUser(u: UserFull): string {
  const id = u.identity as Identity | undefined;
  const name = [id?.firstName, id?.lastName].filter(Boolean).join(" ") || "—";
  const email = id?.login ?? "—";
  const access = u.hasFullAccess ? "full" : "limited";
  return `- **${name}** (${email}) — id \`${u.id}\`, access: ${access}`;
}

export function registerUserTools(server: McpServer, client: WflowClient) {
  server.tool(
    "wf_users",
    "List users in the organization",
    {
      organization: orgParam,
      ...pageParams,
    },
    Annotations.read,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const data = await client.get<Collection<UserFull>>(`/api/${org}/users`, pageQuery(params));
        const list = data?.items ?? [];
        if (!list.length) return textResult("No users found.");
        const lines = [pageHeading("Users", data, list.length)];
        for (const u of list) lines.push(fmtUser(u));
        return textResult(lines.join("\n"));
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_user_info",
    "Get user details by ID",
    {
      organization: orgParam,
      userId: z.string().uuid().describe("User ID"),
    },
    Annotations.read,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const u = await client.get<UserFull>(`/api/${org}/users/${params.userId}`);
        const id = u.identity as Identity | undefined;
        const lines = [
          `# User: ${id?.firstName ?? ""} ${id?.lastName ?? ""}`.trim(),
          `- **ID** ${u.id}`,
          `- **Login** ${id?.login ?? "—"}`,
          `- **Full access** ${u.hasFullAccess ? "yes" : "no"}`,
          `- **Created** ${fmtDate(u.created)}`,
        ];
        return textResult(lines.join("\n"));
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_user_save",
    "Add a user to the organization or update an existing one, matched by login (e-mail). " +
      "roles, teams and documentTypes replace the user's current assignments when given.",
    {
      organization: orgParam,
      login: z.string().describe("User login (e-mail address)"),
      hasFullAccess: z.boolean().optional().describe("Grant full access"),
      roles: z.array(z.string().uuid()).optional().describe("Role IDs to assign (replaces current roles)"),
      teams: z.array(z.string().uuid()).optional().describe("Team IDs to assign (replaces current teams)"),
      documentTypes: z
        .array(z.object({
          id: z.string().uuid().describe("Document type ID"),
          permission: z.enum(["All", "OnlyAssigned", "FullAccess"]).optional().describe("Access to documents of this type"),
        }))
        .optional()
        .describe("Document type permissions (replaces current ones)"),
    },
    Annotations.replace,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const body: Record<string, unknown> = { login: params.login };
        if (params.hasFullAccess !== undefined) body.hasFullAccess = params.hasFullAccess;
        if (params.roles) body.roles = params.roles.map((id) => ({ id }));
        if (params.teams) body.teams = params.teams.map((id) => ({ id }));
        if (params.documentTypes) body.documentTypes = params.documentTypes;
        const result = await client.put<unknown>(`/api/${org}/users`, body);
        return textResult(savedText(`User ${params.login} saved.`, result));
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_user_delete",
    "Remove a user from the organization (careful!)",
    {
      organization: orgParam,
      userId: z.string().uuid().describe("User ID to remove"),
    },
    Annotations.destroy,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        await client.del(`/api/${org}/users/${params.userId}`);
        return textResult(`User \`${params.userId}\` removed.`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );
}

// ---------------------------------------------------------------------------
// Roles & Teams
// ---------------------------------------------------------------------------

export function registerRoleTeamTools(server: McpServer, client: WflowClient) {
  // --- Roles ---

  server.tool(
    "wf_roles",
    "List all roles in the organization",
    {
      organization: orgParam,
      ...pageParams,
    },
    Annotations.read,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const data = await client.get<Collection<RoleBase>>(`/api/${org}/roles`, pageQuery(params));
        const list = data?.items ?? [];
        if (!list.length) return textResult("No roles found.");
        const lines = [pageHeading("Roles", data, list.length)];
        for (const r of list) {
          lines.push(`- **${r.name ?? "—"}** — ${r.description ?? "no description"} (id \`${r.id}\`)`);
        }
        return textResult(lines.join("\n"));
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_role_create",
    "Create a new role",
    {
      organization: orgParam,
      name: z.string().describe("Role name"),
      description: z.string().optional().describe("Role description"),
    },
    Annotations.create,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const body: Record<string, string> = { name: params.name };
        if (params.description) body.description = params.description;
        const result = await client.post<unknown>(`/api/${org}/roles`, body);
        return textResult(savedText("Role created.", result));
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_role_update",
    "Update an existing role",
    {
      organization: orgParam,
      roleId: z.string().uuid().describe("Role ID"),
      name: z.string().optional().describe("New role name"),
      description: z.string().optional().describe("New role description"),
    },
    Annotations.update,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const body: Record<string, string> = {};
        if (params.name) body.name = params.name;
        if (params.description) body.description = params.description;
        await client.put(`/api/${org}/roles/${params.roleId}`, body);
        return textResult(`Role \`${params.roleId}\` updated.`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_role_delete",
    "Delete a role (careful!)",
    {
      organization: orgParam,
      roleId: z.string().uuid().describe("Role ID to delete"),
    },
    Annotations.destroy,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        await client.del(`/api/${org}/roles/${params.roleId}`);
        return textResult(`Role \`${params.roleId}\` deleted.`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  // --- Teams ---

  server.tool(
    "wf_teams",
    "List all teams in the organization",
    {
      organization: orgParam,
      ...pageParams,
    },
    Annotations.read,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const data = await client.get<Collection<TeamBase>>(`/api/${org}/teams`, pageQuery(params));
        const list = data?.items ?? [];
        if (!list.length) return textResult("No teams found.");
        const lines = [pageHeading("Teams", data, list.length)];
        for (const t of list) {
          const sys = t.system ? " [system]" : "";
          lines.push(`- **${t.name ?? "—"}**${sys} — ${t.description ?? "no description"} (id \`${t.id}\`)`);
        }
        return textResult(lines.join("\n"));
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_team_create",
    "Create a new team",
    {
      organization: orgParam,
      name: z.string().describe("Team name"),
      description: z.string().optional().describe("Team description"),
    },
    Annotations.create,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const body: Record<string, string> = { name: params.name };
        if (params.description) body.description = params.description;
        const result = await client.post<unknown>(`/api/${org}/teams`, body);
        return textResult(savedText("Team created.", result));
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_team_update",
    "Update an existing team",
    {
      organization: orgParam,
      teamId: z.string().uuid().describe("Team ID"),
      name: z.string().optional().describe("New team name"),
      description: z.string().optional().describe("New team description"),
    },
    Annotations.update,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const body: Record<string, string> = {};
        if (params.name) body.name = params.name;
        if (params.description) body.description = params.description;
        await client.put(`/api/${org}/teams/${params.teamId}`, body);
        return textResult(`Team \`${params.teamId}\` updated.`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_team_delete",
    "Delete a team (careful!)",
    {
      organization: orgParam,
      teamId: z.string().uuid().describe("Team ID to delete"),
    },
    Annotations.destroy,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        await client.del(`/api/${org}/teams/${params.teamId}`);
        return textResult(`Team \`${params.teamId}\` deleted.`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );
}
