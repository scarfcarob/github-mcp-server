import type { Octokit } from "@octokit/rest";

import { AppError, GitHubAPIError, toAppError, type ErrorContext } from "../errors/index.js";

import { withRetry, DEFAULT_RETRY, type RetryOptions } from "../utils/retry.js";

import type { CommitDTO, IssueDTO, RepoDTO, RepoInfo } from "../types.js";

import type { CreateIssueInput, ListRepositoriesInput } from "../schemas/index.js";





export interface GitHubOperations {

    listRepositories(input: ListRepositoriesInput): Promise<RepoDTO[]>;

    getRepository(owner: string, repo: string): Promise<RepoInfo>;

    createIssue(input: CreateIssueInput): Promise<IssueDTO>;   

    createCommitWithFile(input: CommitFileInput): Promise<CommitDTO>;

}



export interface CommitFileInput {

    owner: string;

    repo: string;

    branch: string;

    path: string;

    content: string;

    message: string;

}





const soloRateLimit = (err: AppError) => err.retryable && (err.status === 403 || err.status === 429);



export function createGitHubOperations(octokit: Octokit, retry: RetryOptions = DEFAULT_RETRY): GitHubOperations {

     

    function call<T>(ctx: ErrorContext, fn: () => Promise<T>, retryOn?: (err: AppError) => boolean): Promise<T> {

        return withRetry(fn, (raw) => toAppError(raw, ctx), retry, retryOn);

    }



    return {

        async listRepositories({ type, sort, per_page }) {

            const { data } = await call({ operation: "listar tus repositorios" }, () =>

                octokit.rest.repos.listForAuthenticatedUser({ type, sort, per_page }),

            );

            return data.map((r) => ({

                full_name: r.full_name,

                owner: r.owner.login,

                name: r.name,

                private: r.private,

                description: r.description,

                html_url: r.html_url,

            }));

        },



        async getRepository(owner, repo) {

            const { data } = await call({ operation: "consultar el repositorio", owner, repo }, () =>

                octokit.rest.repos.get({ owner, repo }),

            );

            return { full_name: data.full_name, default_branch: data.default_branch, has_issues: data.has_issues };

        },



        async createIssue({ owner, repo, title, body, labels }) {  

            const { data } = await call(

                { operation: "crear el issue", owner, repo },

                () => octokit.rest.issues.create({ owner, repo, title, ...(body ? { body } : {}), ...(labels ? { labels } : {}) }),

                soloRateLimit,  

            );

            return {

                number: data.number,

                title: data.title,

                state: data.state,

                html_url: data.html_url,

                labels: data.labels.map((l) => (typeof l === "string" ? l : (l.name ?? ""))),

            };

        },



        

        async createCommitWithFile({ owner, repo, branch, path, content, message }) {

            const ctx = { operation: "crear el commit", owner, repo, branch };



             

            let baseCommitSha: string;

            try {

                const { data: ref } = await call(ctx, () => octokit.rest.git.getRef({ owner, repo, ref: `heads/${branch}` }));

                baseCommitSha = ref.object.sha;

            } catch (err) {

                if (err instanceof AppError && err.status === 404) {

                    throw new GitHubAPIError(`La rama ${branch} no existe en ${owner}/${repo}.`, {

                        status: 404,

                        hint: "Usá una rama que exista, o no mandes branch para usar la rama principal del repo.",

                        details: { step: "1/6 getRef" },

                    });

                }

                throw err;

            }



             

            const { data: baseCommit } = await call(ctx, () =>

                octokit.rest.git.getCommit({ owner, repo, commit_sha: baseCommitSha }),

            );



            

            const { data: blob } = await call(

                ctx,

                () =>

                    octokit.rest.git.createBlob({

                        owner,

                        repo,

                        content: Buffer.from(content, "utf8").toString("base64"),

                        encoding: "base64",

                    }),

            );



            

            const { data: tree } = await call(

                ctx,

                () =>

                    octokit.rest.git.createTree({

                        owner,

                        repo,

                        base_tree: baseCommit.tree.sha,

                        tree: [{ path, mode: "100644", type: "blob", sha: blob.sha }],

                    }),

            );



            

            const { data: newCommit } = await call(

                ctx,

                () => octokit.rest.git.createCommit({ owner, repo, message, tree: tree.sha, parents: [baseCommitSha] }),

            );



            
            try {

                await call(

                    ctx,

                    () => octokit.rest.git.updateRef({ owner, repo, ref: `heads/${branch}`, sha: newCommit.sha, force: false }),

                    soloRateLimit,

                );

            } catch (err) {

                if (err instanceof AppError && err.status === 422) {

                    throw new GitHubAPIError(`La rama ${branch} cambió mientras se creaba el commit.`, {

                        status: 422,

                        hint: "Otra persona hizo un commit en esa rama. Volvé a ejecutar la tool: va a partir del commit nuevo.",

                        details: { step: "6/6 updateRef" },

                    });

                }

                throw err;

            }



            return {

                commit_sha: newCommit.sha,

                commit_url: newCommit.html_url,

                branch,

                path,

                file_url: `https://github.com/${owner}/${repo}/blob/${branch}/${path}`,

            };

        },

    };

}



