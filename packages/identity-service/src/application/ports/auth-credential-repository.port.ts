/**
 * Port (driven): persistence of password credentials.
 * One credential per user (userId → passwordHash).
 */
export interface IAuthCredentialRepository {
  save(userId: string, passwordHash: string): Promise<void>;
  getPasswordHashByUserId(userId: string): Promise<string | null>;
}
