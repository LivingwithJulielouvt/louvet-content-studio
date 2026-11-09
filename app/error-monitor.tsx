"use client";
// Envoie les erreurs du navigateur au studio (/api/monitor), qui les transmet à Sentry si c'est configuré.
// 5 rapports maximum par page, sans aucune donnée saisie par l'utilisateur (seulement le message et la pile).
import { useEffect } from "react";
export default function ErrorMonitor() {
  useEffect(() => {
    let sent = 0;
    const send = (message: string, stack?: string) => {
      if (sent >= 5 || !message) return;
      sent++;
      try {
        const body = JSON.stringify({ message: message.slice(0, 500), stack: (stack || "").slice(0, 4000), path: location.pathname });
        if (navigator.sendBeacon) navigator.sendBeacon("/api/monitor", new Blob([body], { type: "application/json" }));
        else fetch("/api/monitor", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
      } catch {}
    };
    const onError = (e: ErrorEvent) => send(e.message, e.error?.stack);
    const onRejection = (e: PromiseRejectionEvent) => send(String(e.reason?.message || e.reason || "Unhandled rejection"), e.reason?.stack);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
