"use client";

import { useEffect, useEffectEvent, useId, useRef, type ReactNode } from "react";
import { Button } from "./vesko-ui";
import styles from "./vesko-ui.module.css";

export function Drawer({
  children,
  closeLabel = "Close",
  closeOnEscape = true,
  onClose,
  open,
  title,
}: {
  children: ReactNode;
  closeLabel?: string;
  closeOnEscape?: boolean;
  onClose: () => void;
  open: boolean;
  title: string;
}) {
  const drawerRef = useRef<HTMLElement>(null);
  const closeDrawer = useEffectEvent(onClose);
  const closeOnEscapeEnabled = useEffectEvent(() => closeOnEscape);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const drawer = drawerRef.current;
    if (!drawer) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const bodyOverflow = document.body.style.overflow;
    const focusableSelector = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "summary",
      '[tabindex]:not([tabindex="-1"])',
    ].join(",");
    const focusableElements = () =>
      Array.from(drawer.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => {
        if (element.closest('[hidden], [aria-hidden="true"]')) return false;
        const closedDetails = element.closest("details:not([open])");
        if (closedDetails && element !== closedDetails.querySelector(":scope > summary")) {
          return false;
        }
        const computed = window.getComputedStyle(element);
        return computed.display !== "none" && computed.visibility !== "hidden";
      });

    (focusableElements()[0] ?? drawer).focus();
    document.body.style.overflow = "hidden";

    const containFocus = (event: KeyboardEvent) => {
      if (event.key === "Escape" && closeOnEscapeEnabled()) {
        event.preventDefault();
        event.stopPropagation();
        closeDrawer();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusableElements();
      if (elements.length === 0) {
        event.preventDefault();
        drawer.focus();
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      const active = document.activeElement;
      if (!drawer.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", containFocus, true);
    return () => {
      document.removeEventListener("keydown", containFocus, true);
      document.body.style.overflow = bodyOverflow;
      if (trigger?.isConnected) trigger.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className={styles.drawerBackdrop} role="presentation">
      <aside
        aria-labelledby={titleId}
        aria-modal="true"
        className={styles.drawer}
        ref={drawerRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className={styles.drawerHeader}>
          <strong id={titleId}>{title}</strong>
          <Button onClick={onClose} variant="quiet">
            {closeLabel}
          </Button>
        </div>
        {children}
      </aside>
    </div>
  );
}
