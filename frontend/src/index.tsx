import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import {
  ThemeProvider as MuiThemeProvider,
  createTheme,
} from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import * as serviceWorkerRegistration from "./serviceWorkerRegistration";
import reportWebVitals from "./reportWebVitals";
import { AppRouter } from "./router";
import { AuthProvider } from "./store/AuthContent";
import { PlatformProvider } from "./store/PlatformContext";
import { ThemeProvider, useTheme } from "./store/ThemeContext";

// Create MUI themes for dark and light modes
const createAppTheme = (mode: "light" | "dark") =>
  createTheme({
    palette: {
      mode,
    },
    typography: {
      fontFamily: [
        "-apple-system",
        "BlinkMacSystemFont",
        "Segoe UI",
        "Roboto",
        "Oxygen",
        "Ubuntu",
        "Cantarell",
        "Fira Sans",
        "Droid Sans",
        "Helvetica Neue",
        "sans-serif",
      ].join(","),
    },
  });

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
);

root.render(
  <React.StrictMode>
    <AuthProvider>
      <PlatformProvider>
        <ThemeProvider>
          <AppThemeWrapper />
        </ThemeProvider>
      </PlatformProvider>
    </AuthProvider>
  </React.StrictMode>,
);

// Wrapper component to use the theme context
function AppThemeWrapper() {
  const { theme } = useTheme();

  return (
    <MuiThemeProvider theme={createAppTheme(theme)}>
      <CssBaseline />
      <div className="app-container">
        <AppRouter />
      </div>
    </MuiThemeProvider>
  );
}

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://cra.link/PWA
serviceWorkerRegistration.unregister();

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
