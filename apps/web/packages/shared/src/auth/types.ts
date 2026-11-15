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
