/**
 * Porta: hash e verificação de senha.
 * Permite trocar algoritmo (argon2, bcrypt) sem alterar casos de uso.
 */
export interface IPasswordHasher {
  hash(plainPassword: string): Promise<string>;
  verify(plainPassword: string, hash: string): Promise<boolean>;
}
