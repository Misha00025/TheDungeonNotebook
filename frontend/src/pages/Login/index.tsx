import React, { useEffect, useRef, useState } from "react";
import { VkResponse, VkService } from "../../utils/VkService";
import { useAuth } from "../../store/AuthContent";
import { useLocation, useNavigate } from "react-router-dom";
import "./index.css";

export const Login = () => {
  const [vkResponse, setVkResponse] = useState<VkResponse>();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();

  // Get payload from URL if redirected from external auth
  const queryParams = new URLSearchParams(location.search);
  const loginPayload = queryParams.get("payload");

  // Initialize VK auth frame
  useEffect(() => {
    if (containerRef.current && !containerRef.current.hasChildNodes()) {
      const vkFrame = VkService.oneTapAuth(setVkResponse)?.getFrame();
      if (vkFrame) {
        containerRef.current.appendChild(vkFrame as Node);
      }
    }
  }, []);

  // Handle external auth payload
  useEffect(() => {
    if (loginPayload?.length) {
      try {
        const oauthData = JSON.parse(loginPayload);
        setVkResponse({ payload: oauthData });
      } catch (error) {
        console.error("Failed to parse login payload:", error);
      }
    }
  }, [loginPayload]);

  // Process authentication
  useEffect(() => {
    if (vkResponse) {
      login(vkResponse)
        .then(() => {
          navigate("/");
        })
        .catch((error) => {
          console.error("Login failed:", error);
        });
    }
  }, [vkResponse, login, navigate]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="app">
      <header className="app-header">
        <div ref={containerRef} />
      </header>
    </div>
  );
};
