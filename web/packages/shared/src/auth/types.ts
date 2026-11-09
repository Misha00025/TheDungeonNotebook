export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

export interface WhoAmIResponse {
  id: number;
  type: string;
}

export interface UserProfile {
  id: number;
  nickname: string;
  visibleName: string;
  imageLink: string | null;
}

export interface CreateProfileRequest {
  nickname: string;
  visibleName: string;
  imageLink?: string;
}
