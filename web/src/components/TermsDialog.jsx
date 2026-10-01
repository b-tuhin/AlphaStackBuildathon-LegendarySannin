import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../i18n/I18nContext.jsx";

const SECTIONS = [1, 2, 3, 4, 5, 6];
const FOCUSABLE = 'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

export default function TermsDialog({ open, onClose }) {
  const { t } = useI18n();
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    if (closeRef.current) closeRef.current.focus();
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const items = dialogRef.current.querySelectorAll(FOCUSABLE);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!dialogRef.current.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (previous && previous.focus) previous.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="terms-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="terms-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-dialog-title"
        ref={dialogRef}
      >
        <div className="terms-handle" aria-hidden="true" />
        <h2 id="terms-dialog-title" className="terms-title">{t("termsTitle")}</h2>
        <div className="terms-body" tabIndex={0}>
          {SECTIONS.map((n) => (
            <section key={n} className="terms-section">
              <h3>{t("termsS" + n + "Title")}</h3>
              <p>{t("termsS" + n + "Body")}</p>
            </section>
          ))}
        </div>
        <button type="button" ref={closeRef} className="terms-close" onClick={onClose}>
          {t("termsClose")}
        </button>
      </div>
    </div>,
    document.body
  );
}
