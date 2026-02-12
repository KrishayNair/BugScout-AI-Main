"use client";

import { useEffect } from "react";

/**
 * Suppresses MetaMask extension errors that occur when the extension
 * tries to inject into the page but fails to connect.
 */
export function SuppressMetaMaskErrors() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      // Suppress MetaMask connection errors from the extension
      if (
        event.error?.message?.includes("Failed to connect to MetaMask") ||
        event.message?.includes("Failed to connect to MetaMask") ||
        event.filename?.includes("nkbihfbeogaeaoehlefnkodbefgpgknn") // MetaMask extension ID
      ) {
        event.preventDefault();
        return false;
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Suppress unhandled promise rejections from MetaMask
      if (
        typeof event.reason === "string" &&
        event.reason.includes("Failed to connect to MetaMask")
      ) {
        event.preventDefault();
        return false;
      }
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return null;
}
