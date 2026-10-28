
type Level = "debug" | "info" | "warn" | "error";

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function currentLevel(): Level {
  const raw = process.env.LOG_LEVEL?.toLowerCase();
  return raw === "debug" || raw === "info" || raw === "warn" || raw === "error"
    ? raw
    : "info";
}

// Tokens de GitHub (ghp_, gho_, ghu_, ghs_, ghr_, github_pat_) y cabeceras Bearer.
const TOKEN_PATTERN = /\b(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g;
const BEARER_PATTERN = /Bearer\s+\S+/gi;

/** Reemplaza cualquier token por [REDACTED] antes de escribir un log. */
export function redact(text: string): string {
  let result = text
    .replace(TOKEN_PATTERN, "[REDACTED]")
    .replace(BEARER_PATTERN, "Bearer [REDACTED]");
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    result = result.split(token).join("[REDACTED]");
  }
  return result;
}

/** Resume un error en una línea (nombre y mensaje), sin stack ni objetos anidados. */
function describeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function write(level: Level, message: string, error?: unknown): void {
  if (ORDER[level] < ORDER[currentLevel()]) return;
  const detail = error === undefined ? "" : ` | ${describeError(error)}`;
  // stderr: nunca stdout, que es el canal exclusivo del protocolo MCP.
  process.stderr.write(
    `${new Date().toISOString()} [${level.toUpperCase()}] ${redact(message + detail)}\n`,
  );
}

export const logger = {
  debug: (message: string) => write("debug", message),
  info: (message: string) => write("info", message),
  warn: (message: string, error?: unknown) => write("warn", message, error),
  error: (message: string, error?: unknown) => write("error", message, error),
};