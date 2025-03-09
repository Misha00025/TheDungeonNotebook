import { VkResponse } from "../VkService";
import { ENDPOINTS, STORAGE_KEYS } from "./config";
import { httpClient } from "./httpClient";
import { TokenResponse } from "./types";

/**
 * Authentication service for handling user authentication
 */
export class AuthService {
  /**
   * Exchange VK OAuth token for application token
   * @param authData VK authentication response
   * @returns Application token
   */
  static async exchangeToken(authData: VkResponse): Promise<string> {
    const response = await httpClient.post<TokenResponse>(
      ENDPOINTS.AUTH,
      authData,
      { requiresAuth: false },
    );

    if (response.error) {
      console.error("Authentication error:", response.error);
      throw new Error(response.error.message);
    }

    if (!response.data?.access_token) {
      throw new Error("No access token received");
    }

    // Store token in localStorage
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, response.data.access_token);

    return response.data.access_token;
  }

  /**
   * Get the current authentication token
   * @returns The current token or null if not authenticated
   */
  static getToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  }

  /**
   * Check if the user is authenticated
   * @returns True if authenticated, false otherwise
   */
  static isAuthenticated(): boolean {
    return !!this.getToken();
  }

  /**
   * Log out the current user
   */
  static logout(): void {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  }
}
