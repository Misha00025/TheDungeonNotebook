import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";

type Platform = "desktop" | "touch";

interface PlatformProviderProps {
  children: React.ReactNode;
}

interface PlatformProviderContext {
  platform: Platform;
}

const PlatformContext = createContext<PlatformProviderContext>({
  platform: "desktop",
});

export const usePlatform = () => useContext(PlatformContext);

export const PlatformProvider: React.FC<PlatformProviderProps> = ({
  children,
}) => {
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  const handleResize = () => {
    setWindowWidth(window.innerWidth);
  };

  React.useEffect(() => {
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  React.useEffect(() => {
    setPlatform(windowWidth <= 768 ? "touch" : "desktop");
  }, [windowWidth]);

  return (
    <PlatformContext.Provider value={{ platform }}>
      {children}
    </PlatformContext.Provider>
  );
};
