import { useState } from 'react';

export const useUserManagement = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const executeOperation = async (
    operation: () => Promise<void>,
    successMessage: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      await operation();
      setSuccess(successMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    success,
    setError,
    setSuccess,
    executeOperation
  };
};