import { useState, useCallback, useEffect, useRef } from 'react';
import type { UserProfile } from './types';
import { makeAuthenticatedRequest } from './api';
import { useAuth } from './AuthContext';

export const useProfile = (fetchOnMount = false) => {
  const { authenticated, userId } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileUserId, setProfileUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(fetchOnMount && authenticated && userId !== null);
  const [error, setError] = useState<string | null>(null);
  const [profileNotFound, setProfileNotFound] = useState(false);
  const requestId = useRef(0);

  const fetchProfile = useCallback(async (): Promise<void> => {
    if (!authenticated || userId === null) {
      setProfile(null);
      setProfileUserId(null);
      setProfileNotFound(false);
      setError(null);
      setLoading(false);
      return;
    }
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError(null);
    setProfileNotFound(false);
    try {
      const response = await makeAuthenticatedRequest(`/users/${userId}`);
      if (currentRequest !== requestId.current) return;
      if (response.status === 404) {
        setProfile(null);
        setProfileUserId(userId);
        setProfileNotFound(true);
        return;
      }
      if (!response.ok) throw new Error(`Failed to fetch profile: ${response.status}`);
      const data: UserProfile = await response.json();
      if (currentRequest === requestId.current) {
        setProfile(data);
        setProfileUserId(userId);
        setProfileNotFound(false);
      }
    } catch (reason) {
      if (currentRequest === requestId.current) setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [authenticated, userId]);

  useEffect(() => {
    requestId.current++;
    setProfile(null);
    setProfileUserId(null);
    setError(null);
    setProfileNotFound(false);
    setLoading(fetchOnMount && authenticated && userId !== null);
    if (fetchOnMount && authenticated && userId !== null) void fetchProfile();
  }, [authenticated, userId, fetchOnMount, fetchProfile]);

  const currentUserProfile = authenticated && profileUserId === userId ? profile : null;
  const currentUserNotFound = authenticated && profileUserId === userId && profileNotFound;
  return { profile: currentUserProfile, loading, error, profileNotFound: currentUserNotFound, fetchProfile };
};
