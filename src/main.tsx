import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "@fontsource-variable/bodoni-moda";
import "@fontsource-variable/bodoni-moda/opsz-italic.css";
import "./ui/styles/ds.css";
import "./ui/styles/desktop.css";
import App from "./ui/App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
