export interface AuthUser {
  id: string;
  email: string;
  name: string;
  dateOfBirth: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface RegisterProfile {
  email: string;
  name: string;
  dateOfBirth: string;
  phoneNumber?: string | null;
}