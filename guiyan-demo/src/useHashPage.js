import { useCallback, useEffect, useState } from "react";
export const userPages = [
  "home",
  "resources",
  "demands",
  "profile",
  "orders",
  "favorites",
  "messages",
  "ai",
  "topics",
];
export const privatePages = ["orders", "favorites", "messages", "ai"];
export function useHashPage(pages, fallback) {
  const key = pages.join("|");
  const read = useCallback(() => {
    const value = location.hash.slice(1);
    return key.split("|").includes(value) ? value : fallback;
  }, [key, fallback]);
  const [page, setPage] = useState(read);
  useEffect(() => {
    const changed = () => setPage(read());
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, [read]);
  const navigate = useCallback(
    (value) => {
      if (!key.split("|").includes(value)) return;
      setPage(value);
      const hash = value === fallback ? "" : "#" + value;
      if (location.hash !== hash) location.hash = hash;
    },
    [key, fallback],
  );
  return [page, navigate];
}
