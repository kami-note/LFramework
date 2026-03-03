import jwt from "jsonwebtoken";
import type { ITokenService, TokenPayload } from "../../application/ports/token-service.port";

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
    return jwt.sign(
      payload,
      this.config.secret,
      { expiresIn: this.config.expiresInSeconds, algorithm: "HS256" }
    );
  }

  verify(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.config.secret, {
        algorithms: ["HS256"],
      }) as TokenPayload;
      return decoded;
    } catch {
      return null;
    }
  }
}
