import { describe, it, expect } from "vitest";

import { CreateCommitSchema, CreateIssueSchema, CreateRepositorySchema, ListIssuesSchema, ListRepositoriesSchema, toJsonSchema } from "../src/schemas/index.js";







describe("ListRepositoriesSchema", () => {

    it("acepta un input vacío y aplica los defaults", () => {

        const res = ListRepositoriesSchema.safeParse({});

        expect(res.success).toBe(true);

        expect(res.data).toEqual({ type: "all", sort: "updated", per_page: 30 });

    });



    it("rechaza un type que no está en el enum", () => {

        const res = ListRepositoriesSchema.safeParse({ type: "visible" });

        expect(res.success).toBe(false);

        expect(res.error?.issues[0]?.path).toEqual(["type"]);

        expect(res.error?.issues[0]?.code).toBe("invalid_value");

    });



    it("rechaza per_page mayor a 100", () => {

        const res = ListRepositoriesSchema.safeParse({ per_page: 500 });

        expect(res.success).toBe(false);

        expect(res.error?.issues[0]?.path).toEqual(["per_page"]);

    });

});



describe("CreateIssueSchema", () => {

    it("acepta el input mínimo (owner, repo y title)", () => {

        const res = CreateIssueSchema.safeParse({ owner: "octocat", repo: "Hello-World", title: "Bug en el login" });

        expect(res.success).toBe(true);

    });



    it("rechaza un título de menos de 3 caracteres", () => {

        const res = CreateIssueSchema.safeParse({ owner: "octocat", repo: "Hello-World", title: "x" });

        expect(res.success).toBe(false);

        expect(res.error?.issues[0]?.path).toEqual(["title"]);

        expect(res.error?.issues[0]?.code).toBe("too_small");

    });



    it("rechaza si falta owner", () => {

        const res = CreateIssueSchema.safeParse({ repo: "Hello-World", title: "Bug en el login" });

        expect(res.success).toBe(false);

        expect(res.error?.issues.some((i) => i.path[0] === "owner")).toBe(true);

    });

});



describe("CreateCommitSchema", () => {

    const base = { owner: "octocat", repo: "Hello-World", content: "hola", message: "Agrega notas" };



    it("acepta un path relativo y branch opcional", () => {

        expect(CreateCommitSchema.safeParse({ ...base, path: "docs/notas.md" }).success).toBe(true);

    });



    it("rechaza un path que empieza con /", () => {

        const res = CreateCommitSchema.safeParse({ ...base, path: "/notas.md" });

        expect(res.success).toBe(false);

        expect(res.error?.issues[0]?.path).toEqual(["path"]);

    });



    it("rechaza un path con ..", () => {

        expect(CreateCommitSchema.safeParse({ ...base, path: "../secreto.txt" }).success).toBe(false);

    });

});



describe("JSON Schema que ve el LLM", () => {

    it("expone las propiedades y los campos requeridos (no queda vacío)", () => {

        const json = toJsonSchema(CreateIssueSchema);

        expect(json.type).toBe("object");

        expect(json.required).toEqual(["owner", "repo", "title"]);

        expect(Object.keys(json.properties as object)).toContain("labels");

    });

});

describe("CreateRepositorySchema", () => {
    
    it("acepta un nombre válido y aplica los defaults (privado)", () => {
        
        const res = CreateRepositorySchema.safeParse({ name: "mi-proyecto-2026" });
        
        expect(res.success).toBe(true);
        
        expect(res.data?.private).toBe(true);
    
    });
    
    
    it("rechaza un nombre de menos de 3 caracteres", () => {
        
        const res = CreateRepositorySchema.safeParse({ name: "ab" });
        
        expect(res.success).toBe(false);
        
        expect(res.error?.issues[0]?.path).toEqual(["name"]);
        
        expect(res.error?.issues[0]?.code).toBe("too_small");
    
    });
    
    
    it("rechaza un nombre de más de 100 caracteres", () => {
        
        const res = CreateRepositorySchema.safeParse({ name: "a".repeat(101) });
        
        expect(res.success).toBe(false);
        
        expect(res.error?.issues[0]?.code).toBe("too_big");
    
    });
    
    
    it("acepta letras, números, guiones y guiones bajos", () => {
        
        for (const name of ["mi-proyecto", "mi_proyecto", "Repo_2026-v2"]) {
            
            expect(CreateRepositorySchema.safeParse({ name }).success, name).toBe(true);
        
        }
    
    });
    
    
    it("rechaza espacios y símbolos que no son letras, números, guiones o guiones bajos", () => {
        
        for (const name of ["mi proyecto", "mi.proyecto", "proyecto!", "repo/nombre"]) {
            
            const res = CreateRepositorySchema.safeParse({ name });
            
            expect(res.success, name).toBe(false);
            
            expect(res.error?.issues[0]?.path).toEqual(["name"]);
        
        }
    
    });
    
    
    it("rechaza una descripción de más de 350 caracteres", () => {
        
        const res = CreateRepositorySchema.safeParse({ name: "abc", description: "x".repeat(351) });
        
        expect(res.success).toBe(false);
        
        expect(res.error?.issues[0]?.path).toEqual(["description"]);
    
    });

});


describe("ListIssuesSchema", () => {
    
    it("acepta owner y repo y aplica el default de per_page", () => {
        
        const res = ListIssuesSchema.safeParse({ owner: "octocat", repo: "Hello-World" });
        
        expect(res.success).toBe(true);
        
        expect(res.data?.per_page).toBe(30);
    
    });
    
    
    it("state vale open por defecto y acepta closed y all", () => {
        
        expect(ListIssuesSchema.safeParse({ owner: "o", repo: "r" }).data?.state).toBe("open");
        
        for (const state of ["open", "closed", "all"]) {
            
            expect(ListIssuesSchema.safeParse({ owner: "o", repo: "r", state }).success, state).toBe(true);
        
        }
    
    });
    
    
    it("rechaza un state fuera del enum", () => {
        
        const res = ListIssuesSchema.safeParse({ owner: "o", repo: "r", state: "everything" });
        
        expect(res.success).toBe(false);
        
        expect(res.error?.issues[0]?.path).toEqual(["state"]);
    
    });
    
    
    it("rechaza si falta repo", () => {
        
        const res = ListIssuesSchema.safeParse({ owner: "octocat" });
        
        expect(res.success).toBe(false);
        
        expect(res.error?.issues.some((i) => i.path[0] === "repo")).toBe(true);
    
    });

});
