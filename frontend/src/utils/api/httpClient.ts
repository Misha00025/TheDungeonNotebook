import { ApiError, ApiResponse } from "./types";
import { API_BASE_URL, REQUEST_TIMEOUT, STORAGE_KEYS } from "./config";

interface RequestOptions extends RequestInit {
  requiresAuth?: boolean;
  timeout?: number;
}

/**
 * HTTP client for making API requests
 */
export class HttpClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  // Hardcoded token for debugging
  private HARDCODED_TOKEN =
    "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhY2Nlc3NfaWQiOiA4MzQyOTQ3MCwgImF1dGhfdHlwZSI6ICJ1c2VyIiwgImV4cCI6IDE3NDE5ODAzMDZ9.MgMGYOD3pKS3VoTCvXqbOsiw2cYLcK4F2T5Eb44bhZw";

  /**
   * Get the stored authentication token
   */
  private getAuthToken(): string | null {
    // Try to get from localStorage first
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    console.log("HttpClient - getAuthToken from localStorage:", token);

    // Fall back to hardcoded token
    if (!token) {
      console.log("HttpClient - Using hardcoded token");
      return this.HARDCODED_TOKEN;
    }

    return token;
  }

  /**
   * Add authentication headers to request if required
   */
  private addAuthHeader(
    headers: HeadersInit = {},
    requiresAuth: boolean,
  ): HeadersInit {
    if (requiresAuth) {
      const token = this.getAuthToken();
      if (!token) {
        throw new Error("Authentication required but no token found");
      }
      return {
        ...headers,
        token,
      };
    }
    return headers;
  }

  /**
   * Create a timeout promise that rejects after specified milliseconds
   */
  private createTimeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Request timed out after ${ms}ms`));
      }, ms);
    });
  }

  /**
   * Format the URL with query parameters
   */
  private formatUrl(endpoint: string, params?: Record<string, string>): string {
    const url = `${this.baseUrl}${endpoint}`;

    if (!params) {
      return url;
    }

    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      queryParams.append(key, value);
    });

    return `${url}?${queryParams.toString()}`;
  }

  /**
   * Process the API response
   */
  private async processResponse<T>(
    response: Response,
  ): Promise<ApiResponse<T>> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        message: "Unknown error occurred",
      }));

      const error: ApiError = {
        code: response.status,
        message: errorData.message || `Error: ${response.statusText}`,
      };

      return { error };
    }

    try {
      const data = await response.json();
      return { data: data as T };
    } catch (error) {
      return {
        error: {
          code: 0,
          message: "Failed to parse response data",
        },
      };
    }
  }

  /**
   * Make an HTTP request
   */
  private async request<T>(
    endpoint: string,
    options: RequestOptions = {},
    params?: Record<string, string>,
  ): Promise<ApiResponse<T>> {
    const {
      requiresAuth = true,
      timeout = REQUEST_TIMEOUT,
      ...fetchOptions
    } = options;

    try {
      const headers = this.addAuthHeader(fetchOptions.headers, requiresAuth);
      const url = this.formatUrl(endpoint, params);

      const fetchPromise = fetch(url, {
        ...fetchOptions,
        headers,
      });

      const timeoutPromise = this.createTimeoutPromise(timeout);
      const response = await Promise.race([fetchPromise, timeoutPromise]);

      return await this.processResponse<T>(response);
    } catch (error) {
      return {
        error: {
          code: 0,
          message:
            error instanceof Error ? error.message : "Unknown error occurred",
        },
      };
    }
  }

  /**
   * Make a GET request
   */
  async get<T>(
    endpoint: string,
    params?: Record<string, string>,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(
      endpoint,
      {
        method: "GET",
        ...options,
      },
      params,
    );
  }

  /**
   * Make a POST request
   */
  async post<T>(
    endpoint: string,
    data?: any,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });
  }

  /**
   * Make a PUT request
   */
  async put<T>(
    endpoint: string,
    data?: any,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });
  }

  /**
   * Make a DELETE request
   */
  async delete<T>(
    endpoint: string,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "DELETE",
      ...options,
    });
  }
}

// Export a singleton instance
export const httpClient = new HttpClient();
