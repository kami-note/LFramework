import jwt from "jsonwebtoken";
import { z } from "zod";
import type { ITokenService, TokenPayload } from "../../application/ports/token-service.port";
import { logger } from "@lframework/shared";

/** Schema para validar o payload do JWT após decode (exp/iat vindos do jsonwebtoken). */
const jwtPayloadSchema = z.object({
  sub: z.string().min(1),
  email: z.string().optional(),
  role: z.string().optional(),
  exp: z.number(),
  iat: z.number(),
});

export interface JwtTokenServiceConfig {
  secret: string;
  expiresInSeconds: number;
}

/**
 * Adapter: implementação de ITokenService com JWT.
 */
export class JwtTokenService implements ITokenService {
  constructor(private readonly config: JwtTokenServiceConfig) {}

  sign(payload: Omit<TokenPayload, "iat" | "exp">): string {
    const { sub, email, role } = payload;
    return jwt.sign(
      { sub, email, role: role ?? "user" },
      this.config.secret,
      { expiresIn: this.config.expiresInSeconds, algorithm: "HS256" }
    );
  }

  verify(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.config.secret, {
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
        email: data.email ?? "",
        role: data.role ?? "user",
        iat: data.iat,
        exp: data.exp,
      };
    } catch (err) {
      logger.debug({ err }, "JWT verify failed");
      return null;
    }
  }
}
