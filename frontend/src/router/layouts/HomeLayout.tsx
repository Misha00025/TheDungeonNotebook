import { useEffect, useState } from "react";
import { SideBar } from "../../components/SideBar";

import { useNavigate, useOutlet } from "react-router-dom";
import { useAuth } from "../../store/AuthContent";
import { STORAGE_KEYS } from "../../utils/api/config";
import { HomePage } from "../../pages/Home";

export const HomeLayout = () => {
  const { token, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [directTokenCheck, setDirectTokenCheck] = useState<string | null>(null);

  // Check token directly from localStorage as a fallback
  useEffect(() => {
    try {
      const localToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      console.log("HomeLayout - Direct localStorage check:", localToken);
      console.log("HomeLayout - localStorage keys:", Object.keys(localStorage));

      // Log all localStorage items for debugging
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          console.log(`localStorage[${key}] =`, localStorage.getItem(key));
        }
      }

      setDirectTokenCheck(localToken);

      // If we have a token in localStorage but not in context, force a reload
      if (localToken && !token) {
        console.log(
          "HomeLayout - Token found in localStorage but not in context, updating state",
        );
      }
    } catch (error) {
      console.error("HomeLayout - Error checking localStorage:", error);
    }
  }, [token]);

  // Always consider authenticated for debugging
  const haveToken = true;

  useEffect(() => {
    console.log("HomeLayout - Token state:", {
      contextToken: token,
      directToken: directTokenCheck,
      isAuthenticated,
    });

    // Skip redirect for debugging
    setIsLoading(false);
  }, [token, directTokenCheck, isAuthenticated]);

  const outlet = useOutlet();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!haveToken) {
    return <div>Redirecting to login...</div>;
  }

  return (
    <>
      <main className="app-container">
        <SideBar />
        {outlet || <HomePage />}
      </main>
    </>
  );
};
