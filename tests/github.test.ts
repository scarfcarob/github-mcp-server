import { describe, it, expect, vi } from "vitest";

import type { Octokit } from "@octokit/rest";

import type { GitHubOperations } from "../src/github/operations.js";

import { createGitHubOperations } from "../src/github/operations.js";

import { toAppError } from "../src/errors/index.js";

import { createIssueTool } from "../src/tools/create-issue.js";

import { createCommitTool } from "../src/tools/create-commit.js";

import { listRepositoriesTool } from "../src/tools/list-repositories.js";

import { createRepositoryTool } from "../src/tools/create-repository.js";

import { listIssuesTool } from "../src/tools/list-issues.js";


 

function fakeGitHub(overrides: Partial<GitHubOperations> = {}): GitHubOperations {

    return {

        listRepositories: vi.fn().mockResolvedValue([]),

        getRepository: vi.fn().mockResolvedValue({ full_name: "octocat/demo", default_branch: "main", has_issues: true }),

        createRepository: vi.fn().mockResolvedValue({ full_name: "octocat/nuevo-repo", owner: "octocat", name: "nuevo-repo", private: true, description: null, html_url: "https://github.com/octocat/nuevo-repo" }),
        
        listIssues: vi.fn().mockResolvedValue([]),
        
        createIssue: vi.fn().mockResolvedValue({ number: 1, title: "Bug", state: "open", html_url: "https://github.com/octocat/demo/issues/1", labels: [] }),

        createCommitWithFile: vi.fn().mockResolvedValue({ commit_sha: "abc", commit_url: "u", branch: "main", path: "a.md", file_url: "f" }),

        ...overrides,

    };

}





const errorDeGitHub = (status: number, headers: Record<string, string> = {}) =>

    toAppError({ status, message: "x", response: { headers, data: {} } }, { operation: "crear el issue", owner: "octocat", repo: "demo" });





const leer = (r: { content: Array<{ type: string; text?: string }> }) => JSON.parse(r.content[0]?.text ?? "{}");



describe("tool list_repositories", () => {

    it("caso feliz: devuelve los DTOs y la cantidad", async () => {

        const repos = [{ full_name: "octocat/demo", owner: "octocat", name: "demo", private: false, description: null, html_url: "https://github.com/octocat/demo" }];

        const tool = listRepositoriesTool(fakeGitHub({ listRepositories: vi.fn().mockResolvedValue(repos) }));

        const res = await tool.handler({ type: "public" });

        expect(res.isError).toBeUndefined();

        expect(leer(res)).toEqual({ count: 1, repositories: repos });

    });

});



describe("tool create_issue", () => {

    it("caso feliz: hace el preflight y después crea el issue", async () => {

        const github = fakeGitHub();

        const res = await createIssueTool(github).handler({ owner: "octocat", repo: "demo", title: "Bug en el login" });

        expect(github.getRepository).toHaveBeenCalledWith("octocat", "demo");

        expect(github.createIssue).toHaveBeenCalledOnce();

        expect(leer(res).issue.number).toBe(1);

    });



    it("input inválido: devuelve VALIDATION_ERROR y NO llama a GitHub", async () => {

        const github = fakeGitHub();

        const res = await createIssueTool(github).handler({ owner: "octocat", repo: "demo", title: "x" });

        expect(res.isError).toBe(true);

        expect(leer(res).code).toBe("VALIDATION_ERROR");

        expect(github.getRepository).not.toHaveBeenCalled();

        expect(github.createIssue).not.toHaveBeenCalled();

    });



    it("repo inexistente: el preflight corta con un mensaje claro y no se crea nada", async () => {

        const github = fakeGitHub({ getRepository: vi.fn().mockRejectedValue(errorDeGitHub(404)) });

        const res = await createIssueTool(github).handler({ owner: "octocat", repo: "demo", title: "Bug en el login" });

        expect(leer(res).message).toContain("no fue encontrado");

        expect(github.createIssue).not.toHaveBeenCalled();

    });



    it("token inválido (401): AUTH_ERROR con acción ADD_CREDENTIALS", async () => {

        const github = fakeGitHub({ getRepository: vi.fn().mockRejectedValue(errorDeGitHub(401)) });

        const res = await createIssueTool(github).handler({ owner: "octocat", repo: "demo", title: "Bug en el login" });

        expect(leer(res)).toMatchObject({ code: "AUTH_ERROR", action: "ADD_CREDENTIALS", retryable: false });

    });



    it("issues desactivados: no intenta crear y explica cómo activarlos", async () => {

        const github = fakeGitHub({ getRepository: vi.fn().mockResolvedValue({ full_name: "octocat/demo", default_branch: "main", has_issues: false }) });

        const res = await createIssueTool(github).handler({ owner: "octocat", repo: "demo", title: "Bug en el login" });

        expect(leer(res).hint).toContain("Settings");

        expect(github.createIssue).not.toHaveBeenCalled();

    });

});



describe("tool create_commit", () => {

    it("si no se manda branch, usa la rama principal que devuelve el preflight", async () => {

        const github = fakeGitHub({ getRepository: vi.fn().mockResolvedValue({ full_name: "octocat/demo", default_branch: "master", has_issues: true }) });

        await createCommitTool(github).handler({ owner: "octocat", repo: "demo", path: "a.md", content: "hola", message: "Agrega a.md" });

        expect(github.createCommitWithFile).toHaveBeenCalledWith(expect.objectContaining({ branch: "master" }));

    });

});





describe("operations (wrapper de Octokit)", () => {

    const sinEsperas = { maxRetries: 3, baseDelayMs: 0, maxDelayMs: 0 };

    const rateLimit = { status: 403, message: "rate limit", response: { headers: { "x-ratelimit-remaining": "0" }, data: {} } };



    it("rate limit: reintenta y, si GitHub se recupera, devuelve el resultado", async () => {

        const listForAuthenticatedUser = vi.fn().mockRejectedValueOnce(rateLimit).mockResolvedValueOnce({ data: [] });

        const octokit = { rest: { repos: { listForAuthenticatedUser } } } as unknown as Octokit;

        const repos = await createGitHubOperations(octokit, sinEsperas).listRepositories({ type: "all", sort: "updated", per_page: 30 });

        expect(repos).toEqual([]);

        expect(listForAuthenticatedUser).toHaveBeenCalledTimes(2);

    });



    it("rate limit permanente: se rinde después de maxRetries (no hay loop infinito)", async () => {

        const listForAuthenticatedUser = vi.fn().mockRejectedValue(rateLimit);

        const octokit = { rest: { repos: { listForAuthenticatedUser } } } as unknown as Octokit;

        await expect(

            createGitHubOperations(octokit, sinEsperas).listRepositories({ type: "all", sort: "updated", per_page: 30 }),

        ).rejects.toMatchObject({ retryable: true, action: "WAIT_AND_RETRY" });

        expect(listForAuthenticatedUser).toHaveBeenCalledTimes(4); 

    });



    it("401: NO reintenta (reintentar no arregla un token inválido)", async () => {

        const get = vi.fn().mockRejectedValue({ status: 401, message: "Bad credentials", response: { headers: {}, data: {} } });

        const octokit = { rest: { repos: { get } } } as unknown as Octokit;

        await expect(createGitHubOperations(octokit, sinEsperas).getRepository("o", "r")).rejects.toMatchObject({ code: "AUTH_ERROR" });

        expect(get).toHaveBeenCalledTimes(1);

    });



    it("commit: ejecuta los 6 pasos en orden, con base_tree y force: false", async () => {

        const orden: string[] = [];

        const paso = (nombre: string, data: unknown) => vi.fn(async () => (orden.push(nombre), { data }));

        const git = {

            getRef: paso("getRef", { object: { sha: "base" } }),

            getCommit: paso("getCommit", { tree: { sha: "tree-base" } }),

            createBlob: paso("createBlob", { sha: "blob" }),

            createTree: paso("createTree", { sha: "tree-nuevo" }),

            createCommit: paso("createCommit", { sha: "commit-nuevo", html_url: "https://github.com/o/r/commit/commit-nuevo" }),

            updateRef: paso("updateRef", {}),

        };

        const octokit = { rest: { git } } as unknown as Octokit;

        const res = await createGitHubOperations(octokit, sinEsperas).createCommitWithFile({ owner: "o", repo: "r", branch: "main", path: "a.md", content: "hola", message: "m" });



        expect(orden).toEqual(["getRef", "getCommit", "createBlob", "createTree", "createCommit", "updateRef"]);

        expect(git.createTree).toHaveBeenCalledWith(expect.objectContaining({ owner: "o", repo: "r", base_tree: "tree-base" }));

        expect(git.updateRef).toHaveBeenCalledWith(expect.objectContaining({ sha: "commit-nuevo", force: false }));

        expect(res.commit_sha).toBe("commit-nuevo");

    });



    it("commit en una rama que no existe: corta en el paso 1 y no crea nada", async () => {

        const git = {

            getRef: vi.fn().mockRejectedValue({ status: 404, message: "Not Found", response: { headers: {}, data: {} } }),

            createBlob: vi.fn(),

        };

        const octokit = { rest: { git } } as unknown as Octokit;

        await expect(

            createGitHubOperations(octokit, sinEsperas).createCommitWithFile({ owner: "o", repo: "r", branch: "no-existe", path: "a.md", content: "x", message: "m" }),

        ).rejects.toMatchObject({ message: "La rama no-existe no existe en o/r." });

        expect(git.createBlob).not.toHaveBeenCalled();

    });

});


describe("tool create_repository", () => {
    
    it("caso feliz: crea el repo (privado por defecto) y devuelve el DTO", async () => {
        
        const github = fakeGitHub();
        
        const res = await createRepositoryTool(github).handler({ name: "nuevo-repo", description: "Mi repo" });
        
        expect(github.createRepository).toHaveBeenCalledWith(expect.objectContaining({ name: "nuevo-repo", private: true }));
        
        expect(leer(res).repository.full_name).toBe("octocat/nuevo-repo");
    
    });
    
    
    it("nombre inválido: devuelve VALIDATION_ERROR y NO llama a GitHub", async () => {
        
        const github = fakeGitHub();
        
        const res = await createRepositoryTool(github).handler({ name: "mi proyecto" });
        
        expect(res.isError).toBe(true);
        
        expect(leer(res).code).toBe("VALIDATION_ERROR");
        
        expect(leer(res).message).toContain("name");
        
        expect(github.createRepository).not.toHaveBeenCalled();
    
    });
    
    
    it("nombre repetido (422): el error le dice al agente cómo seguir", async () => {
        
        const repetido = toAppError(
            
            { status: 422, message: "x", response: { headers: {}, data: { message: "Repository creation failed.", errors: [{ message: "name already exists on this account" }] } } },
            
            { operation: "crear el repositorio" },
        
        );
        
        const github = fakeGitHub({ createRepository: vi.fn().mockRejectedValue(repetido) });
        
        const res = await createRepositoryTool(github).handler({ name: "nuevo-repo" });
        
        expect(res.isError).toBe(true);
        
        expect(leer(res).code).toBe("GITHUB_API_ERROR");
    
    });

});


describe("tool list_issues", () => {
    
    it("caso feliz: devuelve los issues y la cantidad", async () => {
        
        const issues = [{ number: 7, title: "Bug en el login", state: "open", html_url: "https://github.com/octocat/demo/issues/7", labels: ["bug"] }];
        
        const github = fakeGitHub({ listIssues: vi.fn().mockResolvedValue(issues) });
        
        const res = await listIssuesTool(github).handler({ owner: "octocat", repo: "demo" });
        
        expect(github.listIssues).toHaveBeenCalledWith({ owner: "octocat", repo: "demo", state: "open", per_page: 30 });
        
        expect(leer(res)).toEqual({ count: 1, issues });
    
    });
    
    
    it("repo inexistente (404): mensaje claro con el nombre del repo", async () => {
        
        const github = fakeGitHub({ listIssues: vi.fn().mockRejectedValue(errorDeGitHub(404)) });
        
        const res = await listIssuesTool(github).handler({ owner: "octocat", repo: "demo" });
        
        expect(res.isError).toBe(true);
        
        expect(leer(res).message).toContain("octocat/demo");
        
        expect(leer(res).message).toContain("no fue encontrado");
    
    });
    
    
    it("falta repo: VALIDATION_ERROR y NO llama a GitHub", async () => {
        
        const github = fakeGitHub();
        
        const res = await listIssuesTool(github).handler({ owner: "octocat" });
        
        expect(leer(res).code).toBe("VALIDATION_ERROR");
        
        expect(github.listIssues).not.toHaveBeenCalled();
    
    });

});



describe("operations: repositorios e issues (Octokit falso)", () => {
    
    const sinEsperas = { maxRetries: 3, baseDelayMs: 0, maxDelayMs: 0 };

    it("listIssues: pasa el state elegido a Octokit y descarta los pull requests", async () => {
        
        const listForRepo = vi.fn().mockResolvedValue({
            
            data: [
                
                { number: 1, title: "Issue real", state: "open", html_url: "u1", labels: [{ name: "bug" }, "docs"] },
                
                { number: 2, title: "Esto es un PR", state: "open", html_url: "u2", labels: [], pull_request: { url: "x" } },
            ]
            ,
        
        });
        
        const octokit = { rest: { issues: { listForRepo } } } as unknown as Octokit;
        
        const issues = await createGitHubOperations(octokit, sinEsperas).listIssues({ owner: "o", repo: "r", state: "all", per_page: 30 });
        
        expect(listForRepo).toHaveBeenCalledWith(expect.objectContaining({ state: "all" }));
        
        expect(issues).toEqual([{ number: 1, title: "Issue real", state: "open", html_url: "u1", labels: ["bug", "docs"] }]);
    
    });

    
    it("createRepository: traduce el 422 'already exists' a un mensaje en lenguaje natural", async () => {
        
        const createForAuthenticatedUser = vi.fn().mockRejectedValue({
            
            status: 422,
            
            message: "Repository creation failed.",
            
            response: { headers: {}, data: { message: "Repository creation failed.", errors: [{ message: "name already exists on this account" }] } },
        
        });
        
        const octokit = { rest: { repos: { createForAuthenticatedUser } } } as unknown as Octokit;
        
        await expect(
            
            createGitHubOperations(octokit, sinEsperas).createRepository({ name: "repetido", private: true }),
        
        ).rejects.toMatchObject({ message: "Ya existe un repositorio llamado repetido en tu cuenta." });
        
        expect(createForAuthenticatedUser).toHaveBeenCalledTimes(1); 
    
    });

    
    
    it("createRepository: un error de red NO se reintenta (podría duplicar el repo)", async () => {
        
        const createForAuthenticatedUser = vi.fn().mockRejectedValue({ status: 500, message: "fetch failed" });
        
        const octokit = { rest: { repos: { createForAuthenticatedUser } } } as unknown as Octokit;
        
        await expect(
            
            createGitHubOperations(octokit, sinEsperas).createRepository({ name: "nuevo-repo", private: true }),
        
        ).rejects.toMatchObject({ code: "NETWORK_ERROR" });
        
        expect(createForAuthenticatedUser).toHaveBeenCalledTimes(1);
    
    });

});
