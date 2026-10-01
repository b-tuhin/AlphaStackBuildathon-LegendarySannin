/**
 * src/config/assets.js
 * Single source of truth for every image used by Bharat Chat.
 * Images may only be referenced through getAsset(id) or the ASSETS map.
 * To swap an image run: npm run assets:lock -- --reason "description"
 */

export const ASSETS = [
  {
    id: "login-desktop",
    url: "/assets/login-desktop.png",
    kind: "login-desktop",
    objectPosition: "left center",
    fit: "cover",
    overlay: null,
    alt: "loginBg",
  },
  {
    id: "login-mobile",
    url: "/assets/login-mobile.png",
    kind: "login-mobile",
    objectPosition: "center top",
    fit: "cover",
    overlay: null,
    alt: "loginBg",
  },
  {
    id: "error-desktop",
    url: "/assets/error-desktop.png",
    kind: "error-desktop",
    objectPosition: "left center",
    fit: "cover",
    overlay: null,
    alt: "errorScene",
  },
  {
    id: "error-mobile",
    url: "/assets/error-mobile.png",
    kind: "error-mobile",
    objectPosition: "center top",
    fit: "cover",
    overlay: null,
    alt: "errorScene",
  },
  {
    id: "avatar-boy",
    url: "/assets/avatar-boy.png",
    kind: "avatar",
    objectPosition: "center",
    fit: "cover",
    overlay: null,
    alt: "defaultAvatar",
  },
  {
    id: "avatar-girl",
    url: "/assets/avatar-girl.png",
    kind: "avatar",
    objectPosition: "center",
    fit: "cover",
    overlay: null,
    alt: "defaultAvatar",
  },
  {
    id: "wallpaper-doodle-dark",
    url: "/assets/wallpaper-doodle-dark.png",
    kind: "wallpaper",
    objectPosition: "center",
    fit: "cover",
    overlay: null,
    alt: "chatWallpaper",
  },
  {
    id: "wallpaper-doodle-light",
    url: "/assets/wallpaper-doodle-light.png",
    kind: "wallpaper",
    objectPosition: "center",
    fit: "cover",
    overlay: null,
    alt: "chatWallpaper",
  },
  {
    id: "logo-mark",
    url: "/assets/logo-mark.png",
    kind: "logo",
    objectPosition: "center",
    fit: "contain",
    overlay: null,
    alt: "logoAlt",
  },
  {
    id: "logo-mark-dark",
    url: "/assets/logo-mark-dark.png",
    kind: "logo",
    objectPosition: "center",
    fit: "contain",
    overlay: null,
    alt: "logoAlt",
  },
];

/** Lookup by id; throws if not found. */
export function getAsset(id) {
  const asset = ASSETS.find((a) => a.id === id);
  if (!asset) throw new Error(`[assets] Unknown asset id: "${id}"`);
  return asset;
}

/**
 * Inject CSS custom properties for login images so CSS rules can reference
 * them without hard-coding paths.  Call once at app startup.
 */
export function injectLoginCssVars() {
  const root = document.documentElement;
  root.style.setProperty(
    "--img-login-desktop",
    `url("${getAsset("login-desktop").url}")`
  );
  root.style.setProperty(
    "--img-login-mobile",
    `url("${getAsset("login-mobile").url}")`
  );
}
