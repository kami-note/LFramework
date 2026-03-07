/**
 * Mescla duas specs OpenAPI 3 em uma única, prefixando schemas para evitar colisões.
 * Mantém dois servers (Identity e Catalog) para o "Try it out" do Swagger.
 */

export interface OpenApiSpec {
  openapi: string;
  info: { title: string; version: string; description?: string };
  servers?: Array<{ url: string; description?: string }>;
  components?: {
    schemas?: Record<string, unknown>;
    securitySchemes?: Record<string, unknown>;
  };
  paths?: Record<string, unknown>;
}

const REF_PREFIX = "#/components/schemas/";

function prefixRefsInValue(value: unknown, prefix: string, schemaKeys: string[]): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    for (const key of schemaKeys) {
      if (value === REF_PREFIX + key) return REF_PREFIX + prefix + key;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => prefixRefsInValue(item, prefix, schemaKeys));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = k === "$ref" && typeof v === "string" && v.startsWith(REF_PREFIX)
        ? schemaKeys.reduce((s, key) => s.replace(REF_PREFIX + key, REF_PREFIX + prefix + key), v)
        : prefixRefsInValue(v, prefix, schemaKeys);
    }
    return out;
  }
  return value;
}

function prefixSpec(spec: OpenApiSpec, prefix: string): OpenApiSpec {
  const schemas = spec.components?.schemas ?? {};
  const schemaKeys = Object.keys(schemas);
  if (schemaKeys.length === 0) return spec;

  const prefixedSchemas: Record<string, unknown> = {};
  for (const key of schemaKeys) {
    const value = prefixRefsInValue(schemas[key], prefix, schemaKeys);
    prefixedSchemas[prefix + key] = value;
  }

  const pathValues = spec.paths ? prefixRefsInValue(spec.paths, prefix, schemaKeys) : undefined;
  return {
    ...spec,
    components: {
      ...spec.components,
      schemas: prefixedSchemas,
    },
    paths: pathValues as Record<string, unknown> | undefined,
  };
}

export function mergeOpenApiSpecs(identitySpec: OpenApiSpec, catalogSpec: OpenApiSpec): OpenApiSpec {
  const identity = prefixSpec(identitySpec, "Identity_");
  const catalog = prefixSpec(catalogSpec, "Catalog_");

  const identityServers = identity.servers ?? [];
  const catalogServers = catalog.servers ?? [];
  const mergedServers = [
    ...identityServers.map((s) => ({ ...s, description: s.description ?? "Identity Service" })),
    ...catalogServers.map((s) => ({ ...s, description: s.description ?? "Catalog Service" })),
  ];

  return {
    openapi: "3.0.3",
    info: {
      title: "LFramework API",
      version: "1.0.0",
      description: "Documentação unificada: Identity Service (auth, usuários) e Catalog Service (itens). Use o menu «Servers» para alternar o backend nas requisições.",
    },
    servers: mergedServers,
    components: {
      securitySchemes: identity.components?.securitySchemes ?? catalog.components?.securitySchemes ?? {},
      schemas: {
        ...identity.components?.schemas,
        ...catalog.components?.schemas,
      },
    },
    paths: {
      ...identity.paths,
      ...catalog.paths,
    },
  };
}
