import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { AuthProvider, type AuthProviderProps } from "react-oidc-context";
import "./index.css";

// Configuración exacta vinculada a tu User Pool de Ohio
const cognitoAuthConfig: AuthProviderProps = {
  authority: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_IZeH6x7sM",
  client_id: "4pfpui5gm8026lfqdtpcdmth6r",
  redirect_uri: "http://localhost:5173",
  response_type: "code",
  scope: "email openid phone",
  onSigninCallback: () => {
    window.history.replaceState({}, document.title, window.location.pathname);
  },
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider {...cognitoAuthConfig}>
      <App />
    </AuthProvider>
  </React.StrictMode>,
);