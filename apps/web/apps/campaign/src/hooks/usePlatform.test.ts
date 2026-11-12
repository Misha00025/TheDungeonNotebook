import { renderHook, act } from '@testing-library/react';
import { usePlatform } from './usePlatform';

describe('usePlatform', () => {
  const originalInnerWidth = window.innerWidth;

  afterEach(() => {
    window.innerWidth = originalInnerWidth;
  });

  it('returns true when window width is less than breakpoint (default 768)', () => {
    window.innerWidth = 500;
    const { result } = renderHook(() => usePlatform());
    expect(result.current).toBe(true);
  });

  it('returns false when window width is greater than breakpoint (default 768)', () => {
    window.innerWidth = 1024;
    const { result } = renderHook(() => usePlatform());
    expect(result.current).toBe(false);
  });

  it('returns true when window width equals breakpoint', () => {
    window.innerWidth = 768;
    const { result } = renderHook(() => usePlatform());
    expect(result.current).toBe(true);
  });

  it('updates from false to true on resize', () => {
    window.innerWidth = 1024;
    const { result } = renderHook(() => usePlatform());

    act(() => {
      window.innerWidth = 500;
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toBe(true);
  });

  it('updates from true to false on resize', () => {
    window.innerWidth = 500;
    const { result } = renderHook(() => usePlatform());

    act(() => {
      window.innerWidth = 1024;
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toBe(false);
  });

  it('uses custom breakpoint', () => {
    window.innerWidth = 900;
    const { result } = renderHook(() => usePlatform(1024));
    expect(result.current).toBe(true);
  });

  it('removes event listener on unmount', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => usePlatform());
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });
});
