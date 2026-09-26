import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./theme/ThemeContext.jsx";
import { I18nProvider } from "./i18n/I18nContext.jsx";
import Register from "./pages/Register.jsx";
import Login from "./pages/Login.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import Mail from "./pages/Mail.jsx";
import { getToken } from "./api/client.js";

function RequireAuth({ children }) {
  return getToken() ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return null;

  return (
    <ThemeProvider>
      <I18nProvider>
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route
            path="/*"
            element={
              <RequireAuth>
                <Mail />
              </RequireAuth>
            }
          />
        </Routes>
      </I18nProvider>
    </ThemeProvider>
  );
}
