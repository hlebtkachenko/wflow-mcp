import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WflowClient } from "../wflow-client.js";
import { textResult, errorResult, fmtDate } from "../utils.js";
import type {
  OrganizationEntity,
  UserFull,
  Identity,
  Role,
  Team,
} from "../types.js";

// ---------------------------------------------------------------------------
// Organization
// ---------------------------------------------------------------------------

export function registerOrganizationTools(server: McpServer, client: WflowClient) {
  server.tool(
    "wf_organization",
    "Get organization details",
    {
      organization: z.string().optional().describe("Organization workspace name (uses default if omitted)"),
    },
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
    async () => {
      try {
        const list = await client.get<OrganizationEntity[]>("/api/user/myorganizations");
        if (!list?.length) return textResult("No organizations found.");
        const lines = [`# My Organizations (${list.length})`];
        for (const o of list) {
          lines.push(`- **${o.name}** — \`${o.organizationUrlPart}\``);
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
      organization: z.string().optional().describe("Organization workspace name (uses default if omitted)"),
    },
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
  const email = id?.email ?? "—";
  const access = u.hasFullAccess ? "full" : "limited";
  return `- **${name}** (${email}) — id \`${u.id}\`, access: ${access}`;
}

export function registerUserTools(server: McpServer, client: WflowClient) {
  server.tool(
    "wf_users",
    "List users in the organization",
    {
      organization: z.string().optional().describe("Organization workspace name (uses default if omitted)"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const list = await client.get<UserFull[]>(`/api/${org}/users`);
        if (!list?.length) return textResult("No users found.");
        const lines = [`# Users (${list.length})`];
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
      organization: z.string().optional().describe("Organization workspace name (uses default if omitted)"),
      userId: z.string().uuid().describe("User ID"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const u = await client.get<UserFull>(`/api/${org}/users/${params.userId}`);
        const id = u.identity as Identity | undefined;
        const lines = [
          `# User: ${id?.firstName ?? ""} ${id?.lastName ?? ""}`.trim(),
          `- **ID** ${u.id}`,
          `- **Email** ${id?.email ?? "—"}`,
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
    "Create or update a user",
    {
      organization: z.string().optional().describe("Organization workspace name (uses default if omitted)"),
      userId: z.string().uuid().optional().describe("User ID (for update)"),
      email: z.string().optional().describe("User email"),
      firstName: z.string().optional().describe("First name"),
      lastName: z.string().optional().describe("Last name"),
      hasFullAccess: z.boolean().optional().describe("Grant full access"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const body: Record<string, unknown> = {};
        if (params.userId) body.id = params.userId;
        if (params.hasFullAccess !== undefined) body.hasFullAccess = params.hasFullAccess;
        const identity: Record<string, string> = {};
        if (params.email) identity.email = params.email;
        if (params.firstName) identity.firstName = params.firstName;
        if (params.lastName) identity.lastName = params.lastName;
        if (Object.keys(identity).length) body.identity = identity;
        const result = await client.put<UserFull>(`/api/${org}/users`, body);
        return textResult(`User saved. ID: ${result?.id ?? "—"}`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_user_delete",
    "Remove a user from the organization (careful!)",
    {
      organization: z.string().optional().describe("Organization workspace name (uses default if omitted)"),
      userId: z.string().uuid().describe("User ID to remove"),
    },
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
      organization: z.string().optional().describe("Organization workspace name (uses default if omitted)"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const list = await client.get<Role[]>(`/api/${org}/roles`);
        if (!list?.length) return textResult("No roles found.");
        const lines = [`# Roles (${list.length})`];
        for (const r of list) {
          const userCount = r.users?.length ?? 0;
          lines.push(`- **${r.name ?? "—"}** — ${r.description ?? "no description"} (${userCount} users)`);
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
      organization: z.string().optional().describe("Organization workspace name (uses default if omitted)"),
      name: z.string().describe("Role name"),
      description: z.string().optional().describe("Role description"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const body: Record<string, string> = { name: params.name };
        if (params.description) body.description = params.description;
        const result = await client.post<Role>(`/api/${org}/roles`, body);
        return textResult(`Role created. ID: ${result?.id ?? "—"}`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_role_update",
    "Update an existing role",
    {
      organization: z.string().optional().describe("Organization workspace name (uses default if omitted)"),
      roleId: z.string().uuid().describe("Role ID"),
      name: z.string().optional().describe("New role name"),
      description: z.string().optional().describe("New role description"),
    },
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
      organization: z.string().optional().describe("Organization workspace name (uses default if omitted)"),
      roleId: z.string().uuid().describe("Role ID to delete"),
    },
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
      organization: z.string().optional().describe("Organization workspace name (uses default if omitted)"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const list = await client.get<Team[]>(`/api/${org}/teams`);
        if (!list?.length) return textResult("No teams found.");
        const lines = [`# Teams (${list.length})`];
        for (const t of list) {
          const userCount = t.users?.length ?? 0;
          const sys = t.system ? " [system]" : "";
          lines.push(`- **${t.name ?? "—"}**${sys} — ${t.description ?? "no description"} (${userCount} users)`);
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
      organization: z.string().optional().describe("Organization workspace name (uses default if omitted)"),
      name: z.string().describe("Team name"),
      description: z.string().optional().describe("Team description"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const body: Record<string, string> = { name: params.name };
        if (params.description) body.description = params.description;
        const result = await client.post<Team>(`/api/${org}/teams`, body);
        return textResult(`Team created. ID: ${result?.id ?? "—"}`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_team_update",
    "Update an existing team",
    {
      organization: z.string().optional().describe("Organization workspace name (uses default if omitted)"),
      teamId: z.string().uuid().describe("Team ID"),
      name: z.string().optional().describe("New team name"),
      description: z.string().optional().describe("New team description"),
    },
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
      organization: z.string().optional().describe("Organization workspace name (uses default if omitted)"),
      teamId: z.string().uuid().describe("Team ID to delete"),
    },
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
