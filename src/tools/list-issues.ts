
import type { McpTool } from "../types.js";

import type { GitHubOperations } from "../github/operations.js";

import { ListIssuesSchema, toJsonSchema } from "../schemas/index.js";

import { fromZodError, fail } from "../errors/index.js";



export function listIssuesTool(github: GitHubOperations): McpTool {
    
    return {
        
        definition: {
            
            name: "list_issues",
            
            description:
                "Lista los issues de un repositorio específico (número, título, estado, link y labels). " +
                "Requiere owner y repo; state elige open (por defecto, solo abiertos), closed o all. " +
                "Si no sabés el owner o el nombre exacto del repo, usá list_repositories primero. " +
                "Solo lectura. No incluye pull requests y no sirve para crear issues (usá create_issue).",
            inputSchema: toJsonSchema(ListIssuesSchema),
        
        },
        
        
        async handler(args) {
            
            const parsed = ListIssuesSchema.safeParse(args);
            
            if (!parsed.success) return fail("list_issues", fromZodError(parsed.error));

            try {
                const issues = await github.listIssues(parsed.data);
            
                const data = { count: issues.length, issues };
                
                return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], structuredContent: data };
            
            } catch (err) {
                
                return fail("list_issues", err);
            
            }
        
        },
    
    };

}