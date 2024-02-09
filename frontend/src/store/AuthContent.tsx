import React, { createContext, useContext, useEffect, useState } from 'react';
import { VkResponse } from '../utils/VkService';
import { Api, TokenResponse } from '../utils/api';
import { useNavigate } from 'react-router-dom';

const login = async () => {
    console.log("Login not implemented");
}

const logout = () => {
    console.log("Login not implemented");
}

interface AuthContextProps {
    login: (data: VkResponse) => Promise<void>,
    logout: () => void,
    token: string | null;
}

const AuthContext = createContext<AuthContextProps>({
    login,
    logout,
    token: null
});

export function useAuth() {
  return useContext(AuthContext);
}

interface AuthProviderProps {
    children: React.ReactNode
}

const getToken = () => {
  return localStorage.getItem("accessToken");
}

export const AuthProvider: React.FC<AuthProviderProps> = ({
    children
}) => {
  const [token, setToken] = useState<string | null>(getToken());

  const login = async (data: VkResponse) => {
    const token = await Api.exchangeToken(data);
    localStorage.setItem("accessToken", token.access_token);

    setToken(getToken());
    return;
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
