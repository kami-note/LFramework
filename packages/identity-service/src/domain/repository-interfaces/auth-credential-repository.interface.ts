/**
 * Porta (Repository): persistência de credenciais de senha.
 * Uma credencial por usuário (userId → passwordHash).
 */
export interface IAuthCredentialRepository {
  save(userId: string, passwordHash: string): Promise<void>;
  getPasswordHashByUserId(userId: string): Promise<string | null>;
}
