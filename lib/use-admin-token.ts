"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

const STORAGE_KEY = "crm_admin_token";
const CHANGE_EVENT = "crm-admin-token-change";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function writeCookie(value: string) {
  if (value) {
    document.cookie = `${STORAGE_KEY}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
  } else {
    document.cookie = `${STORAGE_KEY}=; path=/; max-age=0`;
  }
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function getSnapshot(): string {
  return localStorage.getItem(STORAGE_KEY) ?? "";
}

function getServerSnapshot(): string {
  return "";
}

/**
 * Shared admin-token state for client components.
 *
 * Persists the token to localStorage (so token inputs stay filled across
 * visits and stay in sync between panels) and mirrors it into a cookie so
 * that server routes can authorize writes coming from components that don't
 * set the x-admin-token header.
 */
export function useAdminToken(): [string, (value: string) => void] {
  const token = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Keep the cookie in sync with the stored token (e.g. tokens saved to
  // localStorage before the cookie mechanism existed).
  useEffect(() => {
    writeCookie(token);
  }, [token]);

  const update = useCallback((value: string) => {
    if (value) {
      localStorage.setItem(STORAGE_KEY, value);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    writeCookie(value);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return [token, update];
}
