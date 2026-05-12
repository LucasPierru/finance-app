import type { User } from "@finance-app/shared-types";

export interface AuthUser {
  id: User["id"];
  email: User["email"];
  name: string;
  dateOfBirth: User["birthDate"];
  phoneNumber: User["phone"];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface RegisterProfile {
  email: string;
  name: string;
  dateOfBirth: string;
  phoneNumber: string;
}