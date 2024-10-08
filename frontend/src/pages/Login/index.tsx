import React, { useEffect, useRef, useState } from "react";

import { VkResponse, VkService } from "../../utils/VkService";
import { useAuth } from "../../store/AuthContent";

import "./index.css";
import { useLocation, useNavigate } from "react-router-dom";

export const Login = () => {
  const [isVkOauth, setToggleVkOauth] = useState(true);
  const [vkResponse, setVkResponse] = useState<VkResponse>();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const queryParams = new URLSearchParams(location.search);
  // При авторизации другими методами, происходит редирект, с параметром payload
  const loginPayload = queryParams.get("payload");

  const { login } = useAuth();

  useEffect(() => {
    if (
      isVkOauth &&
      containerRef.current &&
      !containerRef.current.hasChildNodes()
    ) {
      const vkFrame = VkService.oneTapAuth(setVkResponse)?.getFrame();

      containerRef.current.appendChild(vkFrame as Node);
    }
  }, []);

  useEffect(() => {
    console.log("Login payload:", loginPayload);
    if (loginPayload?.length) {
      const oauthData = JSON.parse(loginPayload);
      // При авторизации другим способом vk отправляет ответ без payload
      setVkResponse({ payload: oauthData });
    }
  }, [loginPayload]);

  useEffect(() => {
    console.log(vkResponse);
    if (vkResponse) {
      login(vkResponse).then(() => {
        navigate("/");
      });
    }
  }, [vkResponse]);

  return (
    <div className="app">
      <header className="app-header">
        <div ref={containerRef} />
      </header>
    </div>
  );
};
