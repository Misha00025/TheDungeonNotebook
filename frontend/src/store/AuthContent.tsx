import React, { createContext, useContext, useEffect, useState } from "react";
import { VkResponse } from "../utils/VkService";
import { AuthService } from "../utils/api/authService";
import { STORAGE_KEYS } from "../utils/api/config";
import { useNavigate } from "react-router-dom";

interface AuthContextProps {
  login: (data: VkResponse) => Promise<void>;
  logout: () => void;
  token: string | null;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextProps>({
  login: async () => {
    console.log("Login not implemented");
  },
  logout: () => {
    console.log("Logout not implemented");
  },
  token: null,
  isAuthenticated: false,
});

export function useAuth() {
  return useContext(AuthContext);
}

interface AuthProviderProps {
  children: React.ReactNode;
}

// Get token from environment variable
const HARDCODED_TOKEN = process.env.REACT_APP_AUTH_TOKEN || "";

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // Set hardcoded token in localStorage on mount if available
  useEffect(() => {
    if (HARDCODED_TOKEN) {
      console.log("Setting hardcoded token in localStorage");
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, HARDCODED_TOKEN);
    }
  }, []);

  // Direct check of localStorage
  console.log(
    "Direct localStorage check:",
    localStorage.getItem("accessToken"),
  );
  console.log("STORAGE_KEYS.ACCESS_TOKEN:", STORAGE_KEYS.ACCESS_TOKEN);

  // Get token through AuthService
  const storedToken = AuthService.getToken() || HARDCODED_TOKEN;
  console.log("AuthService.getToken() or hardcoded:", storedToken);

  // Initialize state
  const [token, setToken] = useState<string | null>(storedToken);
  const [isAuthenticated, setIsAuthenticated] =
    useState<boolean>(!!storedToken);

  console.log("Initial token state:", token);
  console.log("Initial isAuthenticated state:", isAuthenticated);

  // Add effect to monitor localStorage changes
  useEffect(() => {
    const checkToken = () => {
      const currentToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      console.log("Storage event - current token:", currentToken);
      if (currentToken !== token) {
        console.log("Token changed, updating state");
        setToken(currentToken);
        setIsAuthenticated(!!currentToken);
      }
    };

    // Check on mount
    checkToken();

    // Listen for storage events (in case token is set in another tab)
    window.addEventListener("storage", checkToken);

    return () => {
      window.removeEventListener("storage", checkToken);
    };
  }, [token]);

  const login = async (data: VkResponse) => {
    try {
      const token = await AuthService.exchangeToken(data);
      setToken(token);
      setIsAuthenticated(true);
    } catch (error) {
      console.error("Authentication error:", error);
      setToken(null);
      setIsAuthenticated(false);
    }
  };

  const logout = () => {
    AuthService.logout();
    setToken(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ token, login, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
};
