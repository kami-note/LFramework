import * as argon2 from "argon2";
import type { IPasswordHasher } from "../../application/ports/password-hasher.port";

/**
 * Adapter: hash de senha com Argon2id (recomendado para novas aplicações).
 */
export class Argon2PasswordHasher implements IPasswordHasher {
  async hash(plainPassword: string): Promise<string> {
    return argon2.hash(plainPassword, { type: argon2.argon2id });
  }

  async verify(plainPassword: string, hash: string): Promise<boolean> {
    return argon2.verify(hash, plainPassword);
  }
}
