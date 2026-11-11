import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "./state";
import App from "./App";
import { ErrorBoundary, performanceMonitor } from "./ErrorBoundary";
import "./styles.css";
import "./marketplace.css";
import "./review.css";
import "./extensions.css";
import "./performance.css";
import "./select.css";
import "./stability.css";

// 启动性能监控
if (import.meta.env.PROD) {
  performanceMonitor();
}

// Keep old bookmarks working without maintaining another product surface.
if (location.pathname.startsWith("/mini"))
  history.replaceState(null, "", "/h5");

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Provider>
        <App />
      </Provider>
    </ErrorBoundary>
  </React.StrictMode>,
);
