import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./assets/fa-wysiwyg.scss";
import "./lab/lab.scss";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
