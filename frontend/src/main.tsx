import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 2800,
          style: {
            background: "#1f1410",
            color: "#fff8f1",
            borderRadius: "12px",
            fontWeight: 500,
            padding: "12px 18px",
          },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
);
