export interface OAuthCallbackUserDto {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  isNewUser: boolean;
}

export interface OAuthCallbackResponseDto {
  user: OAuthCallbackUserDto;
  accessToken: string;
  expiresIn: string;
}
