import jwt from "jsonwebtoken";
import { z } from "zod";
import type { ITokenVerifier, TokenVerifierPayload } from "./token-verifier.port";
import { logger } from "../logger";

const jwtPayloadSchema = z.object({
  sub: z.string().min(1),
  email: z.string().optional(),
  role: z.string().optional(),
  exp: z.number().optional(),
  iat: z.number().optional(),
});

const MIN_SECRET_LENGTH = 32;

/**
 * Implementação de ITokenVerifier usando JWT HS256.
 * Use em microserviços que apenas validam token (ex.: catalog); o identity-service
 * continua usando JwtTokenService (sign + verify) para emitir e validar.
 */
export class JwtTokenVerifier implements ITokenVerifier {
  constructor(private readonly secret: string) {
    if (!secret || typeof secret !== "string") {
      throw new Error("JWT secret must be a non-empty string for HS256 signing");
    }
    if (secret.length < MIN_SECRET_LENGTH) {
      throw new Error(
        `JWT secret must be at least ${MIN_SECRET_LENGTH} characters for HS256 (got ${secret.length})`
      );
    }
  }

  verify(token: string): TokenVerifierPayload | null {
    try {
      const decoded = jwt.verify(token, this.secret, {
        algorithms: ["HS256"],
      });
      const result = jwtPayloadSchema.safeParse(decoded);
      if (!result.success) {
        logger.debug({ err: result.error.flatten() }, "JWT payload validation failed");
        return null;
      }
      const data = result.data;
      return {
        sub: data.sub,
        email: data.email,
        role: data.role,
      };
    } catch (err) {
      logger.debug({ err }, "JWT verify failed");
      return null;
    }
  }
}
