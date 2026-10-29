
import { z } from "zod";

const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
const NEW_REPO_NAME_PATTERN = /^[A-Za-z0-9-]+$/;
const EXISTING_REPO_NAME_PATTERN = /^[A-Za-z0-9._-]+$/;
const BRANCH_PATTERN = /^[A-Za-z0-9._/-]+$/;

const owner = z
  .string({ error: "El propietario debe ser texto." })
  .regex(
    OWNER_PATTERN,
    "El propietario debe ser un usuario u organización de GitHub válido (letras, números y guiones, hasta 39 caracteres).",
  )
  .optional()
  .describe("Usuario u organización dueña del repositorio. Si no se indica, se usa la cuenta autenticada.");


const newRepoName = z
  .string({ error: "El nombre del repositorio es obligatorio y debe ser texto." })
  .min(3, "El nombre del repositorio debe tener al menos 3 caracteres.")
  .max(100, "El nombre del repositorio no puede superar los 100 caracteres.")
  .regex(
    NEW_REPO_NAME_PATTERN,
    "El nombre del repositorio solo puede contener letras, números y guiones (sin espacios ni otros símbolos).",
  )
  .describe("Nombre del nuevo repositorio: de 3 a 100 caracteres, solo letras, números y guiones, sin espacios.");


const existingRepoName = z
  .string({ error: "El nombre del repositorio es obligatorio y debe ser texto." })
  .min(1, "El nombre del repositorio no puede estar vacío.")
  .max(100, "El nombre del repositorio no puede superar los 100 caracteres.")
  .regex(
    EXISTING_REPO_NAME_PATTERN,
    "El nombre del repositorio solo puede contener letras, números, guiones, guiones bajos y puntos.",
  )
  .refine((name) => name !== "." && name !== "..", "El nombre del repositorio no es válido.")
  .describe("Nombre del repositorio existente, sin el usuario (por ejemplo: mi-proyecto).");

const limit = z
  .number({ error: "El límite debe ser un número." })
  .int("El límite debe ser un número entero.")
  .min(1, "El límite debe ser al menos 1.")
  .max(100, "El límite no puede superar 100.")
  .default(30)
  .describe("Cantidad máxima de resultados a devolver (de 1 a 100). Por defecto 30.");

export const createRepositoryInput = z.object({
  name: newRepoName,
  description: z
    .string({ error: "La descripción debe ser texto." })
    .max(350, "La descripción no puede superar los 350 caracteres.")
    .optional()
    .describe("Descripción breve del repositorio (opcional, hasta 350 caracteres)."),
  private: z
    .boolean({ error: "El campo private debe ser verdadero o falso." })
    .default(true)
    .describe(
      "true para repositorio privado, false para público. Por defecto es privado; usa false solo si el usuario pide explícitamente un repositorio público.",
    ),
});

export const createIssueInput = z.object({
  owner,
  repo: existingRepoName,
  title: z
    .string({ error: "El título del issue es obligatorio y debe ser texto." })
    .trim()
    .min(1, "El título del issue no puede estar vacío.")
    .max(256, "El título del issue no puede superar los 256 caracteres.")
    .describe("Título del issue (de 1 a 256 caracteres)."),
  body: z
    .string({ error: "El cuerpo del issue debe ser texto." })
    .max(65536, "El cuerpo del issue no puede superar los 65.536 caracteres.")
    .optional()
    .describe("Descripción detallada del issue (opcional, admite Markdown)."),
});

export const listRepositoriesInput = z.object({ limit });

export const listIssuesInput = z.object({ owner, repo: existingRepoName, limit });

export const createCommitInput = z.object({
  owner,
  repo: existingRepoName,
  path: z
    .string({ error: "La ruta del archivo es obligatoria y debe ser texto." })
    .min(1, "La ruta del archivo no puede estar vacía.")
    .max(1024, "La ruta del archivo no puede superar los 1024 caracteres.")
    .refine((p) => !p.startsWith("/"), "La ruta del archivo no puede empezar con «/».")
    .refine((p) => !p.includes("\\"), "La ruta del archivo debe usar «/» como separador.")
    .refine((p) => !p.split("/").some((part) => part === ".."), "La ruta del archivo no puede contener «..».")
    .refine(
      (p) => !p.includes("//") && !p.endsWith("/"),
      "La ruta del archivo no puede tener segmentos vacíos ni terminar en «/».",
    )
    .describe("Ruta del archivo dentro del repositorio, por ejemplo: docs/README.md."),
  content: z
    .string({ error: "El contenido del archivo debe ser texto." })
    .max(1_000_000, "El contenido del archivo no puede superar 1.000.000 de caracteres.")
    .describe("Contenido completo del archivo (texto). Reemplaza el contenido anterior si el archivo ya existe."),
  message: z
    .string({ error: "El mensaje del commit es obligatorio y debe ser texto." })
    .trim()
    .min(1, "El mensaje del commit no puede estar vacío.")
    .max(500, "El mensaje del commit no puede superar los 500 caracteres.")
    .describe("Mensaje del commit (de 1 a 500 caracteres)."),
  branch: z
    .string({ error: "La rama debe ser texto." })
    .min(1, "El nombre de la rama no puede estar vacío.")
    .max(255, "El nombre de la rama no puede superar los 255 caracteres.")
    .regex(BRANCH_PATTERN, "El nombre de la rama contiene caracteres no permitidos.")
    .refine((b) => !b.includes("..") && !b.startsWith("/") && !b.endsWith("/"), "El nombre de la rama no es válido.")
    .optional()
    .describe("Rama donde se hace el commit (opcional). Si no se indica, se usa la rama por defecto."),
});

export type CreateRepositoryInput = z.infer<typeof createRepositoryInput>;
export type CreateIssueInput = z.infer<typeof createIssueInput>;
export type ListRepositoriesInput = z.infer<typeof listRepositoriesInput>;
export type ListIssuesInput = z.infer<typeof listIssuesInput>;
export type CreateCommitInput = z.infer<typeof createCommitInput>;