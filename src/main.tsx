import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "react-oidc-context";

const cognitoAuthConfig = {
  authority: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_9racJkKX7",
  client_id: "36t79mt3ivfrbvffanqadjg1dt",
  // Detecta automáticamente Vercel o localhost y agrega la barra final
  redirect_uri: window.location.origin + "/",
  response_type: "code",
  scope: "email openid phone",
  onSigninCallback: () => {
    // Limpia los parámetros ?code= y ?state= de la URL tras iniciar sesión
    window.history.replaceState({}, document.title, window.location.pathname);
  },
};

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("No se encontró el elemento root en el DOM.");
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <AuthProvider {...cognitoAuthConfig}>
      <App />
    </AuthProvider>
  </React.StrictMode>
);