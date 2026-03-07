import {
  extendZodWithOpenApi,
  OpenApiGeneratorV3,
  OpenAPIRegistry,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { registerSchema } from "./application/dtos/register.dto";
import { loginSchema } from "./application/dtos/login.dto";
import { createUserSchema } from "./application/dtos/create-user.dto";
import { userResponseDtoSchema } from "./application/dtos/user-response.dto";

extendZodWithOpenApi(z);

const ErrorSchema = z.object({ error: z.string(), message: z.string() }).openapi("Error");
const RegisterBodySchema = registerSchema.openapi("RegisterBody");
const LoginBodySchema = loginSchema.openapi("LoginBody");
const UserResponseSchema = userResponseDtoSchema.openapi("UserResponse");
const AuthResponseSchema = z
  .object({
    user: UserResponseSchema,
    accessToken: z.string(),
    expiresIn: z.string(),
  })
  .openapi("AuthResponse");
const CreateUserBodySchema = createUserSchema.openapi("CreateUserBody");
const OAuthQuerySchema = z.object({ code: z.string(), state: z.string() });

const registry = new OpenAPIRegistry();

registry.registerPath({
  method: "post",
  path: "/api/auth/register",
  summary: "Registrar usuário",
  tags: ["Auth"],
  request: {
    body: {
      content: { "application/json": { schema: RegisterBodySchema } },
    },
  },
  responses: {
    201: {
      description: "Usuário criado",
      content: { "application/json": { schema: AuthResponseSchema } },
    },
    400: { description: "Validação", content: { "application/json": { schema: ErrorSchema } } },
    409: { description: "Email já existe", content: { "application/json": { schema: ErrorSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/login",
  summary: "Login",
  tags: ["Auth"],
  request: {
    body: {
      content: { "application/json": { schema: LoginBodySchema } },
    },
  },
  responses: {
    200: {
      description: "OK",
      content: { "application/json": { schema: AuthResponseSchema } },
    },
    400: { description: "Validação", content: { "application/json": { schema: ErrorSchema } } },
    401: {
      description: "Credenciais inválidas",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/auth/me",
  summary: "Usuário atual (JWT)",
  tags: ["Auth"],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "OK",
      content: { "application/json": { schema: UserResponseSchema } },
    },
    401: {
      description: "Não autenticado",
      content: { "application/json": { schema: ErrorSchema } },
    },
    404: {
      description: "Usuário não encontrado",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/auth/google",
  summary: "Redirect para login Google (OAuth)",
  tags: ["Auth"],
  responses: { 302: { description: "Redirect para provedor" } },
});

registry.registerPath({
  method: "get",
  path: "/api/auth/google/callback",
  summary: "Callback OAuth Google (query: code, state)",
  tags: ["Auth"],
  request: { query: OAuthQuerySchema },
  responses: { 302: { description: "Redirect com token ou erro" } },
});

registry.registerPath({
  method: "get",
  path: "/api/auth/github",
  summary: "Redirect para login GitHub (OAuth)",
  tags: ["Auth"],
  responses: { 302: { description: "Redirect para provedor" } },
});

registry.registerPath({
  method: "get",
  path: "/api/auth/github/callback",
  summary: "Callback OAuth GitHub (query: code, state)",
  tags: ["Auth"],
  request: { query: OAuthQuerySchema },
  responses: { 302: { description: "Redirect com token ou erro" } },
});

registry.registerPath({
  method: "post",
  path: "/api/users",
  summary: "Criar usuário (admin)",
  tags: ["Users"],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: CreateUserBodySchema } },
    },
  },
  responses: {
    201: {
      description: "Criado",
      content: { "application/json": { schema: UserResponseSchema } },
    },
    400: { description: "Validação", content: { "application/json": { schema: ErrorSchema } } },
    401: {
      description: "Não autenticado",
      content: { "application/json": { schema: ErrorSchema } },
    },
    403: {
      description: "Sem permissão (admin)",
      content: { "application/json": { schema: ErrorSchema } },
    },
    409: { description: "Email já existe", content: { "application/json": { schema: ErrorSchema } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/users/{id}",
  summary: "Buscar usuário por ID",
  tags: ["Users"],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: {
    200: {
      description: "OK",
      content: { "application/json": { schema: UserResponseSchema } },
    },
    401: {
      description: "Não autenticado",
      content: { "application/json": { schema: ErrorSchema } },
    },
    404: {
      description: "Não encontrado",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

/**
 * Gera a spec OpenAPI 3 a partir dos schemas Zod (fonte única de verdade).
 * serverUrl: base do serviço (ex.: http://localhost:3001 ou http://localhost/identity quando atrás do nginx).
 */
export function createIdentityOpenApi(serverUrl: string): object {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  const doc = generator.generateDocument({
    openapi: "3.0.3",
    info: {
      title: "Identity Service API",
      version: "1.0.0",
      description: "Autenticação, registro e gestão de usuários.",
    },
    servers: [{ url: serverUrl }],
  });

  const docObj = doc as { components?: { securitySchemes?: object } };
  if (docObj.components) {
    docObj.components.securitySchemes = {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Token obtido em POST /api/auth/login ou /api/auth/register",
      },
    };
  }
  return doc;
}
