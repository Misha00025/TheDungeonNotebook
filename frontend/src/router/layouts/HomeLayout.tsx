import { useEffect } from "react";
import { SideBar } from "../../components/SideBar";

import { useNavigate, useOutlet } from "react-router-dom";
import { useAuth } from "../../store/AuthContent";
import { HomePage } from "../../pages/Home";

export const HomeLayout = () => {
  const { token } = useAuth();
  const navigate = useNavigate();

  const haveToken = token !== null && token !== undefined;

  useEffect(() => {
    if (!haveToken) {
      navigate("/login");
    }
  }, [token]);

  if (!haveToken) {
    navigate("/login");
    return <>token not found login redirect</>;
  }

  const outlet = useOutlet();

  return (
    <>
      <main className="app-container">
        <SideBar />
        {outlet || <HomePage />}
      </main>
    </>
  );
};
