import { renderHook, act } from '@testing-library/react';
import { useUserManagement } from './useUserManagement';

describe('useUserManagement', () => {
  it('starts with default state', () => {
    const { result } = renderHook(() => useUserManagement());
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.success).toBeNull();
  });

  it('sets success on successful operation', async () => {
    const { result } = renderHook(() => useUserManagement());
    const operation = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      await result.current.executeOperation(operation, 'Success!');
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.success).toBe('Success!');
    expect(result.current.error).toBeNull();
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('sets error on failed operation with Error object', async () => {
    const { result } = renderHook(() => useUserManagement());

    await act(async () => {
      await result.current.executeOperation(
        () => Promise.reject(new Error('Something went wrong')),
        'msg'
      );
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('Something went wrong');
    expect(result.current.success).toBeNull();
  });

  it('sets error on failed operation with string rejection', async () => {
    const { result } = renderHook(() => useUserManagement());

    await act(async () => {
      await result.current.executeOperation(
        () => Promise.reject('Simple error string'),
        'msg'
      );
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('Operation failed');
  });

  it('sets loading to true during operation', async () => {
    const { result } = renderHook(() => useUserManagement());
    let resolvePromise!: () => void;
    const operation = () => new Promise<void>(resolve => { resolvePromise = resolve; });

    act(() => {
      result.current.executeOperation(operation, 'ok');
    });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolvePromise();
    });

    expect(result.current.loading).toBe(false);
  });

  it('clears error before starting operation', async () => {
    const { result } = renderHook(() => useUserManagement());

    // Set a previous error
    act(() => {
      result.current.setError('Previous error');
    });

    const operation = vi.fn().mockResolvedValue(undefined);
    await act(async () => {
      await result.current.executeOperation(operation, 'Success!');
    });

    expect(result.current.error).toBeNull();
  });

  it('allows manually setting error', () => {
    const { result } = renderHook(() => useUserManagement());
    act(() => result.current.setError('Manual error'));
    expect(result.current.error).toBe('Manual error');
  });

  it('allows manually clearing error', () => {
    const { result } = renderHook(() => useUserManagement());
    act(() => result.current.setError('test'));
    act(() => result.current.setError(null));
    expect(result.current.error).toBeNull();
  });

  it('allows manually setting success', () => {
    const { result } = renderHook(() => useUserManagement());
    act(() => result.current.setSuccess('Manual success'));
    expect(result.current.success).toBe('Manual success');
  });

  it('allows manually clearing success', () => {
    const { result } = renderHook(() => useUserManagement());
    act(() => result.current.setSuccess('test'));
    act(() => result.current.setSuccess(null));
    expect(result.current.success).toBeNull();
  });
});
