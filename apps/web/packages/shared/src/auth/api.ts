import { getApiBase, joinApiUrl } from '../config';
import { LoginRequest, RegisterRequest, TokenResponse, UserProfile } from './types';
import tokenManager from './tokenManager';
import { UserSettingsResponse, UserSettingsValue } from './userSettings';

export const authAPI = {
  login: async (credentials: LoginRequest): Promise<TokenResponse> => {
    const API_BASE = getApiBase();
    const response = await fetch(joinApiUrl(API_BASE, '/auth/token'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'password',
        username: credentials.username,
        password: credentials.password,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error_description || 'Login failed');
    }

    return response.json();
  },

  refresh: async (refreshToken: string): Promise<TokenResponse> => {
    const API_BASE = getApiBase();
    const response = await fetch(joinApiUrl(API_BASE, '/auth/token'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error_description || 'Token refresh failed');
    }

    return response.json();
  },

  register: async (credentials: RegisterRequest): Promise<TokenResponse> => {
    const API_BASE = getApiBase();
    const response = await fetch(joinApiUrl(API_BASE, '/auth/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    if (response.status === 409) {
      throw new Error('Username already exists');
    }

    if (!response.ok) {
      throw new Error('Registration failed');
    }

    // After registration, log in automatically
    const loginResponse = await fetch(joinApiUrl(API_BASE, '/auth/token'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'password',
        username: credentials.username,
        password: credentials.password,
      }),
    });

    if (!loginResponse.ok) {
      throw new Error('Auto-login after registration failed');
    }

    return loginResponse.json();
  },
};

export const makeAuthenticatedRequest = async (
  endpoint: string,
  options: RequestInit = {},
  contentType: string | null = 'application/json'
): Promise<Response> => {
  const API_BASE = getApiBase();

  const token = await tokenManager.ensureToken();
  if (!token) {
    throw new Error('Session expired. Please login again.');
  }

  const authHeaders: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
  };

  const headers = contentType
    ? { 'Content-Type': contentType, ...options.headers as Record<string, string>, ...authHeaders }
    : { ...options.headers as Record<string, string>, ...authHeaders };

  const execute = (): Promise<Response> =>
    fetch(joinApiUrl(API_BASE, endpoint), { ...options, headers });

  let response = await execute();

  if (response.status === 401) {
    tokenManager.invalidateAccessToken();
    const newToken = await tokenManager.ensureToken();

    if (!newToken) {
      tokenManager.clear();
      throw new Error('Session expired. Please login again.');
    }

    authHeaders['Authorization'] = `Bearer ${newToken}`;
    const retryHeaders = contentType
      ? { 'Content-Type': contentType, ...options.headers as Record<string, string>, ...authHeaders }
      : { ...options.headers as Record<string, string>, ...authHeaders };

    Object.assign(headers, retryHeaders);

    response = await execute();
  }

  return response;
};

export const userAPI = {
  createProfile: async (profileData: { nickname: string, visibleName: string, imageLink?: string }): Promise<UserProfile> => {
    const response = await makeAuthenticatedRequest('/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(profileData),
    });

    if (response.status === 409) {
      throw new Error('Nickname already exists');
    }

    if (!response.ok) {
      throw new Error('Failed to create profile');
    }

    return response.json();
  },

  updateProfile: async (userId: number, profileData: { visibleName: string, imageLink?: string }): Promise<UserProfile> => {
    const response = await makeAuthenticatedRequest(`/users/${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(profileData),
    });

    if (!response.ok) {
      throw new Error('Failed to update profile');
    }

    return response.json();
  },
};

export const userSettingsAPI = {
  getSettings: async (userId: number, keys?: string[]): Promise<UserSettingsResponse> => {
    const query = new URLSearchParams();
    if (keys && keys.length > 0) query.set('keys', keys.join(','));
    const qs = query.toString();
    const endpoint = `/users/${userId}/settings${qs ? `?${qs}` : ''}`;
    const response = await makeAuthenticatedRequest(endpoint);
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error?.detail || 'Failed to fetch user settings');
    }
    return response.json();
  },

  updateSettings: async (userId: number, settings: Record<string, UserSettingsValue>): Promise<UserSettingsResponse> => {
    const response = await makeAuthenticatedRequest(`/users/${userId}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error?.detail || 'Failed to update user settings');
    }
    return response.json();
  },
};
