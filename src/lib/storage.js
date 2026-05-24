import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchRemoteState, upsertRemoteState } from './api';

export function readJson(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key, value) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function usePersistentState(key, fallback) {
  const [value, rawSetValue] = useState(() => readJson(key, fallback));
  const [hydrated, setHydrated] = useState(false);
  const dirtyRef = useRef(false);

  const setValue = useCallback((next) => {
    dirtyRef.current = true;
    rawSetValue(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setHydrated(false);
    dirtyRef.current = false;
    fetchRemoteState(key)
      .then((remote) => {
        if (cancelled || remote?.value === undefined || dirtyRef.current) return;
        rawSetValue(remote.value);
        writeJson(key, remote.value);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    writeJson(key, value);
    const timer = setTimeout(() => {
      upsertRemoteState(key, value).catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [hydrated, key, value]);

  return [value, setValue];
}

export function dayStamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
