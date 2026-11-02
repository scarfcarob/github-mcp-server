
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";




export interface McpTool {

    definition: {

        name: string;
        description: string;
        inputSchema: Record<string, unknown>;

    };

    handler: (args: unknown) => Promise<CallToolResult>;

}


 

export interface RepoDTO {

    full_name: string;

    owner: string;

    name: string;

    private: boolean;

    description: string | null;

    html_url: string;

}

export interface IssueDTO {

    number: number;
    title: string;
    state: string;
    html_url: string;
    labels: string[];

}

export interface CommitDTO {

    commit_sha: string;
    commit_url: string;
    branch: string;
    path: string;
    file_url: string;

}



export interface RepoInfo {

    full_name: string;
    default_branch: string;
    has_issues: boolean;

}