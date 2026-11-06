import { Server } from "@modelcontextprotocol/sdk/server/index.js";

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import type { McpTool } from "./types.js";

import { ValidationError, fail } from "./errors/index.js";

import { logger } from "./utils/logging.js";

import { createOctokit } from "./github/client.js";

import { createGitHubOperations } from "./github/operations.js";

import { listRepositoriesTool } from "./tools/list-repositories.js";

import { createIssueTool } from "./tools/create-issue.js";

import { createCommitTool } from "./tools/create-commit.js";

import { createRepositoryTool } from "./tools/create-repository.js";

import { listIssuesTool } from "./tools/list-issues.js";






const SERVER_INFO = { name: "github-mcp-server", version: "1.0.0" };





const github = createGitHubOperations(createOctokit());





const tools: McpTool[] = [

    listRepositoriesTool(github),

    createIssueTool(github),

    createCommitTool(github),

    createRepositoryTool(github),

    listIssuesTool(github),

];





const server = new Server(SERVER_INFO, { capabilities: { tools: {} } });



 

server.setRequestHandler(ListToolsRequestSchema, async () => ({

    tools: tools.map((t) => t.definition),

}));





server.setRequestHandler(CallToolRequestSchema, async (request) => {

    const { name, arguments: args } = request.params;

    logger.info("tool llamada", { tool: name, args: resumirArgs(args) });



    const tool = tools.find((t) => t.definition.name === name);

    if (!tool) {

        return fail(name, new ValidationError(`La tool ${name} no existe. Tools disponibles: ${tools.map((t) => t.definition.name).join(", ")}.`));

    }

    return tool.handler(args ?? {});

});



 

function resumirArgs(args: unknown): unknown {

    if (!args || typeof args !== "object") return args;

    return Object.fromEntries(

        Object.entries(args).map(([k, v]) => [k, typeof v === "string" && v.length > 80 ? v.slice(0, 80) + "…" : v]),

    );

}





async function main() {

    if (!process.env.GITHUB_TOKEN) {

        logger.warn("GITHUB_TOKEN no está configurado: las tools van a responder AUTH_ERROR. Revisá el archivo .env");

    }

    await server.connect(new StdioServerTransport());

    logger.info("server iniciado", { ...SERVER_INFO, tools: tools.map((t) => t.definition.name) });

}



main().catch((err) => {

    logger.error("el server no pudo iniciar", { message: err instanceof Error ? err.message : String(err) });

    process.exit(1);

});
