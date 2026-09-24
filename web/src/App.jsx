import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Register from "./pages/Register.jsx";
import Mail from "./pages/Mail.jsx";
import { getToken } from "./api/client.js";

function RequireAuth({ children }) {
  return getToken() ? children : <Navigate to="/register" replace />;
}

export default function App() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return null;

  return (
    <Routes>
      <Route path="/register" element={<Register />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <Mail />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
