
import type { McpTool } from "../types.js";

import type { GitHubOperations } from "../github/operations.js";

import { CreateRepositorySchema, toJsonSchema } from "../schemas/index.js";

import { fromZodError, fail } from "../errors/index.js";


export function createRepositoryTool(github: GitHubOperations): McpTool {
    
    return {
        
        definition: {
            
            name: "create_repository",
            
            description:
                "Crea un repositorio NUEVO en la cuenta del usuario dueño del token. Requiere name (3 a 100 caracteres: letras, números, guiones y guiones bajos); " +
                "description es opcional y private es true por defecto (solo pasá false si el usuario pide expresamente que sea público). " +
                "Escribe en GitHub: el repositorio queda creado. Si el nombre ya existe, falla sin modificar nada. " +
                "No sirve para listar repos existentes (usá list_repositories), ni para crear issues o commits.",
            inputSchema: toJsonSchema(CreateRepositorySchema),
        },
        
        async handler(args) {
            
            const parsed = CreateRepositorySchema.safeParse(args);
            
            if (!parsed.success) return fail("create_repository", fromZodError(parsed.error));


            try {
                
                const repository = await github.createRepository(parsed.data);
                
                const data = { repository };
                
                return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], structuredContent: data };
            
            } catch (err) {
                
                return fail("create_repository", err);
            
            }
        
        },
    
    };

}