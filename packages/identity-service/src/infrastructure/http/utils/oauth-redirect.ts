import { Response } from "express";
import { randomBytes } from "crypto";
import type { IOAuthProvider } from "../../../application/ports/oauth-provider.port";
import type { ICacheService } from "../../../application/ports/cache.port";

const OAUTH_STATE_TTL_SECONDS = 600; // 10 min
export const OAUTH_STATE_PREFIX = "oauth_state:";

/**
 * Gera state aleatório, grava no cache, monta redirectUri e redireciona para a URL de autorização do provedor.
 */
export async function performOAuthRedirect(
  provider: IOAuthProvider,
  basePath: string,
  res: Response,
  cache: ICacheService,
  baseUrl: string
): Promise<void> {
  const state = randomBytes(16).toString("hex");
  await cache.set(OAUTH_STATE_PREFIX + state, "1", OAUTH_STATE_TTL_SECONDS);
  const redirectUri = `${baseUrl}/api/auth/${basePath}/callback`;
  const url = provider.getAuthorizationUrl(redirectUri, state);
  res.redirect(url);
}
