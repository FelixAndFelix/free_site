import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./App";
import { AuthProvider } from "./auth";
import { InstanceBanner } from "./InstanceBanner";
import { registerServiceWorker } from "./registerServiceWorker";
import "@fontsource-variable/geist";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <InstanceBanner />
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);

registerServiceWorker();
