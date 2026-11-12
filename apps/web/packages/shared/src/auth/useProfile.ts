// src/hooks/useProfile.ts
import { useState, useCallback, useEffect } from 'react';
import { WhoAmIResponse, UserProfile } from './types';
import { makeAuthenticatedRequest } from './api';

export const useProfile = (fetchOnMount: boolean = false) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(fetchOnMount);
  const [error, setError] = useState<string | null>(null);
  const [profileNotFound, setProfileNotFound] = useState(false);

  const fetchProfile = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    setProfileNotFound(false);

    try {
      // Первый запрос: whoami
      const whoamiResponse = await makeAuthenticatedRequest('/whoami');

      if (whoamiResponse.status === 401) {
        throw new Error('Session expired. Please login again.');
      }

      if (!whoamiResponse.ok) {
        throw new Error('Failed to fetch user info');
      }

      const whoamiData: WhoAmIResponse = await whoamiResponse.json();

      // Второй запрос: данные пользователя
      const profileResponse = await makeAuthenticatedRequest(`/users/${whoamiData.id}`);

      if (profileResponse.status === 404) {
        setProfileNotFound(true);
        return;
      }

      if (profileResponse.status === 401) {
        throw new Error('Session expired. Please login again.');
      }

      if (!profileResponse.ok) {
        throw new Error('Failed to fetch profile');
      }

      const profileData: UserProfile = await profileResponse.json();
      setProfile(profileData);
      setProfileNotFound(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (fetchOnMount) {
      fetchProfile();
    }
  }, [fetchOnMount, fetchProfile]);

  return { profile, loading, error, profileNotFound, fetchProfile };
};
