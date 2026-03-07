import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

import express from "express";
import swaggerUi from "swagger-ui-express";
import { mergeOpenApiSpecs, type OpenApiSpec } from "./merge-specs";

const port = parseInt(process.env.API_DOCS_PORT ?? "3003", 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error("API_DOCS_PORT must be a valid port (1-65535)");
  process.exit(1);
}
const identitySpecUrl = process.env.IDENTITY_SPEC_URL ?? "http://localhost:3001/api-docs.json";
const catalogSpecUrl = process.env.CATALOG_SPEC_URL ?? "http://localhost:3002/api-docs.json";

async function fetchSpec(url: string): Promise<OpenApiSpec> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return (await res.json()) as OpenApiSpec;
}

async function getMergedSpec(): Promise<object> {
  const [identitySpec, catalogSpec] = await Promise.all([
    fetchSpec(identitySpecUrl),
    fetchSpec(catalogSpecUrl),
  ]);
  return mergeOpenApiSpecs(identitySpec, catalogSpec);
}

const app = express();

app.use((_req, res, next) => {
  res.setHeader("X-Served-By", "api-docs");
  next();
});

app.get("/openapi.json", async (_req, res) => {
  try {
    const spec = await getMergedSpec();
    res.json(spec);
  } catch (err) {
    res.status(502).json({
      error: "Failed to merge specs",
      message: err instanceof Error ? err.message : String(err),
      hint: "Ensure identity and catalog services are running and IDENTITY_SPEC_URL / CATALOG_SPEC_URL are correct.",
    });
  }
});

app.use("/", swaggerUi.serve, swaggerUi.setup(null as unknown as object, {
  swaggerOptions: { url: "openapi.json" },
  customSiteTitle: "LFramework API",
}));

app.listen(port, () => {
  console.log(`API Docs (unified Swagger) at http://localhost:${port}`);
});
