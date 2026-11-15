import type { UserProfile } from './types';
import type { AuthenticatedRequest } from './bffClient';
import { UserSettingsResponse, UserSettingsValue } from './userSettings';

let authenticatedRequest: AuthenticatedRequest | null = null;
export function setAuthenticatedRequest(handler: AuthenticatedRequest | null): void { authenticatedRequest = handler; }
export const makeAuthenticatedRequest: AuthenticatedRequest = async (endpoint, options = {}, contentType = 'application/json') => {
  if (!authenticatedRequest) throw new Error('Authenticated request transport is not initialized by the Hub');
  return authenticatedRequest(endpoint, options, contentType);
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
