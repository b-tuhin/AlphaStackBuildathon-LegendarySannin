import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./theme/tokens.css";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

// Remove the splash screen after React has had a chance to paint.
// requestAnimationFrame fires after the next paint; we wait one more frame
// to be sure #root has content before starting the fade.
function removeSplash() {
  const splash = document.getElementById("splash");
  if (!splash) return;
  splash.style.pointerEvents = "none";
  splash.style.opacity = "0";
  // Hard-remove at 600ms in case transitionend never fires.
  const hardRemove = setTimeout(() => splash.remove(), 400);
  splash.addEventListener("transitionend", () => {
    clearTimeout(hardRemove);
    splash.remove();
  }, { once: true });
}

// Defer until after first paint so #root has rendered content.
let splashDone = false;
function finishSplash() {
  if (splashDone) return;
  splashDone = true;
  try { sessionStorage.setItem("bharat_splash_seen", "1"); } catch (e) {}
  removeSplash();
}
let splashSeen = false;
try { splashSeen = !!sessionStorage.getItem("bharat_splash_seen"); } catch (e) {}
const splashMinMs = splashSeen ? 600 : 3500;
const splashStartedAt = window.__splashStart || Date.now();
function whenRendered(cb) {
  const root = document.getElementById("root");
  const tick = () => {
    if (root && root.childElementCount > 0) cb();
    else setTimeout(tick, 50);
  };
  tick();
}
whenRendered(() => {
  const go = () => {
    const wait = Math.max(0, splashMinMs - (Date.now() - splashStartedAt));
    setTimeout(finishSplash, wait);
  };
  const pollWp = () => { if (window.__wpReady) go(); else setTimeout(pollWp, 50); };
  pollWp();
});
// Safety: remove the splash after 8 s even if React never rendered.
setTimeout(finishSplash, 8000);
