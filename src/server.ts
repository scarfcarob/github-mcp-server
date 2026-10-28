
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { logger } from "./utils/logging.js";

const server = new McpServer({ name: "github-mcp-server", version: "1.0.0" });

server.registerTool(
  "ping",
  {
    title: "Verificar conexión",
    description:
      "Comprueba que el servidor MCP está activo y responde. No accede a GitHub. " +
      "Usala solo cuando el usuario quiera verificar que el servidor funciona.",
  },
  async () => ({
    content: [{ type: "text", text: "pong: el servidor MCP está funcionando." }],
  }),
);

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
  logger.info("Servidor MCP iniciado (stdio)");
}

main().catch((error: unknown) => {
  logger.error("No se pudo iniciar el servidor", error);
  process.exit(1);
});