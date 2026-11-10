import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "./state";
import App from "./App";
import "./styles.css";
import "./marketplace.css";
import "./review.css";
// Keep old bookmarks working without maintaining another product surface.
if (location.pathname.startsWith("/mini"))
  history.replaceState(null, "", "/h5");
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Provider>
      <App />
    </Provider>
  </React.StrictMode>,
);
