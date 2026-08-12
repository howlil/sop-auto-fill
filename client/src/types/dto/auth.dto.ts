export interface ApiSuccessResponse<T> {
  message: string;
  success: boolean;
  data: T;
}

export interface PublicUserData {
  userId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface GoogleLoginRequestDto {
  credential: string;
}

export type AuthApiResponse = ApiSuccessResponse<PublicUserData>;
