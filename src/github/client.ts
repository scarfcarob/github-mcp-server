import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import dotenv from "dotenv";
import { Octokit } from "@octokit/rest";






const raizDelProyecto = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

dotenv.config({ path: resolve(raizDelProyecto, ".env"), quiet: true });



export function createOctokit(): Octokit {

    return new Octokit({

        auth: process.env.GITHUB_TOKEN,

        userAgent: "github-mcp-server/1.0.0",

    });

} 