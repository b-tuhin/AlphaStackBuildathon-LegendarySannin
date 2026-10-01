import React, { useEffect, useRef, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "./theme/ThemeContext.jsx";
import { I18nProvider } from "./i18n/I18nContext.jsx";
import Register from "./pages/Register.jsx";
import Login from "./pages/Login.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import Mail from "./pages/Mail.jsx";
import Settings from "./pages/Settings.jsx";
import NotFound from "./pages/NotFound.jsx";
import { getToken } from "./api/client.js";

function RequireAuth({ children }) {
  return getToken() ? children : <Navigate to="/login" replace />;
}

// Pages are grouped so moving *within* a group (e.g. /settings → /settings/profile)
// doesn't replay the transition, and moving between groups feels like going deeper / back.
const pageKey = (pathname) => (pathname.startsWith("/settings") ? "settings" : pathname.startsWith("/login") || pathname.startsWith("/register") || pathname.startsWith("/forgot-password") ? "auth" : "mail");
const pageDepth = (key) => (key === "settings" ? 1 : 0);

const EXIT_MS = 170;

/**
 * Renders <Routes> for the *previous* location while it plays an exit animation, then
 * swaps to the new location and plays the enter animation. Driven by timers (not
 * animationend) so it can never get stuck, e.g. with reduced-motion enabled.
 */
function AnimatedRoutes() {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [stage, setStage] = useState("idle"); // "idle" | "exit" | "enter"
  const [direction, setDirection] = useState("none");
  const timers = useRef([]);

  useEffect(() => {
    const nextKey = pageKey(location.pathname);
    const currentKey = pageKey(displayLocation.pathname);

    if (nextKey === currentKey) {
      // Same page group: just keep the router in sync, no animation
      if (location !== displayLocation) setDisplayLocation(location);
      return undefined;
    }

    const delta = pageDepth(nextKey) - pageDepth(currentKey);
    setDirection(delta > 0 ? "forward" : delta < 0 ? "back" : "none");
    setStage("exit");

    const swap = setTimeout(() => {
      setDisplayLocation(location);
      setStage("enter");
      window.scrollTo(0, 0);
      const done = setTimeout(() => setStage("idle"), 320);
      timers.current.push(done);
    }, EXIT_MS);
    timers.current.push(swap);

    return () => {
      clearTimeout(swap);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  return (
    <div className="page-viewport">
      <div
        className={`page-shell${stage === "exit" ? " page-shell--exit" : stage === "enter" ? " page-shell--enter" : ""}`}
        data-dir={direction}
      >
        <Routes location={displayLocation}>
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route
            path="/settings"
            element={
              <RequireAuth>
                <Settings />
              </RequireAuth>
            }
          />
          <Route
            path="/settings/profile"
            element={
              <RequireAuth>
                <Settings />
              </RequireAuth>
            }
          />
          <Route path="/404" element={<NotFound />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <Mail />
              </RequireAuth>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return null;

  return (
    <ThemeProvider>
      <I18nProvider>
        <AnimatedRoutes />
      </I18nProvider>
    </ThemeProvider>
  );
}
