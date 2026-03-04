/**
 * User subset in auth responses (login pode omitir createdAt).
 */
export interface AuthUserDto {
  id: string;
  email: string;
  name: string;
  createdAt?: string;
}

export interface AuthResponseDto {
  user: AuthUserDto;
  accessToken: string;
  expiresIn: string;
}
