import React from "react";

import "./index.css";
import { useAuth } from "../../store/AuthContent";

export const HomePage = () => {
  const { token } = useAuth();
  const isAuth = !token;

  return (
    <div className="home-container">
      <h1>Welcome to The Dungeon Notebook</h1>
      <p>This is your personal digital dungeon journal.</p>
      <p>
        Create, edit, and share your dungeon adventures with friends and family.
      </p>
      <p>Stay updated with the latest dungeon lore, updates, and tips.</p>
      <p>Start exploring your dungeon now!</p>
      {isAuth ? (
        <p>
          <a href="/login">Login</a>
        </p>
      ) : undefined}
      <p>
        <a href="/groups">View your Groups</a>
      </p>
    </div>
  );
};
