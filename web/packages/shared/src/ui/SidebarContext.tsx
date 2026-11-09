import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface SidebarContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

const STORAGE_KEY = 'sidebar-open';

export const SidebarProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? false : JSON.parse(stored);
  });

  const persist = useCallback((value: boolean) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
    persist(true);
  }, [persist]);

  const close = useCallback(() => {
    setIsOpen(false);
    persist(false);
  }, [persist]);

  const toggle = useCallback(() => {
    setIsOpen(prev => {
      const next = !prev;
      persist(next);
      return next;
    });
  }, [persist]);

  return (
    <SidebarContext.Provider value={{
      isOpen,
      open,
      close,
      toggle,
    }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = (): SidebarContextType => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};
