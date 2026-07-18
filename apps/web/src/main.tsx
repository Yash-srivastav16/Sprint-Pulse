import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "./context/AuthContext";
import { ProjectProvider } from "./context/ProjectContext";
import { ThemeProvider } from "./hooks/useTheme";
import App from "./App";
import "./styles/globals.css";
import "./styles/global.css";

function preserveSemicoLabsAppParam() {
  const appId = new URLSearchParams(window.location.search).get("app");
  if (!appId) return;

  const withAppParam = (url?: string | URL | null): string | URL | undefined | null => {
    if (url == null) return url;

    const asString = url.toString();
    const next = new URL(asString, window.location.href);
    if (next.origin !== window.location.origin) return url;

    next.searchParams.set("app", appId);
    const routed = `${next.pathname}${next.search}${next.hash}`;
    return typeof url === "string" ? routed : new URL(routed, window.location.origin);
  };

  const pushState = window.history.pushState.bind(window.history);
  window.history.pushState = (data, unused, url) => pushState(data, unused, withAppParam(url));

  const replaceState = window.history.replaceState.bind(window.history);
  window.history.replaceState = (data, unused, url) => replaceState(data, unused, withAppParam(url));
}

preserveSemicoLabsAppParam();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <ProjectProvider>
            <App />
            <Toaster richColors closeButton position="top-right" />
          </ProjectProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);
