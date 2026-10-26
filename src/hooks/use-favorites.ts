import { useCallback, useEffect, useState } from "react";
import { favoritesRequest, normalizeSongUrl, type Favorite } from "@/lib/api";

const CACHE_KEY = "favoritesCache";

function readCache(): Favorite[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCache(favorites: Favorite[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(favorites));
  } catch {
    // storage unavailable
  }
}

/**
 * The shared favorites list, kept on the server so every device sees the same one.
 * Shows the last known list immediately and refreshes when the page regains focus
 * (so a song starred on the phone shows up on the computer).
 */
export function useFavorites() {
  const [favorites, setFavorites] = useState<Favorite[]>(readCache);

  const apply = useCallback((list: Favorite[]) => {
    setFavorites(list);
    writeCache(list);
  }, []);

  const refresh = useCallback(async () => {
    try {
      apply(await favoritesRequest({ action: "list" }));
    } catch (err) {
      console.error("Could not load favorites:", err);
    }
  }, [apply]);

  useEffect(() => {
    refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  const find = useCallback(
    (url: string | null) => (url ? favorites.find((f) => f.url === normalizeSongUrl(url)) : undefined),
    [favorites]
  );

  /** Optimistic: update the list right away, then sync with the server's answer. Throws on failure (list is restored). */
  const save = useCallback(
    async (favorite: Omit<Favorite, "savedAt">) => {
      const previous = favorites;
      const url = normalizeSongUrl(favorite.url);
      apply([{ ...favorite, url, savedAt: new Date().toISOString() }, ...favorites.filter((f) => f.url !== url)]);
      try {
        apply(await favoritesRequest({ action: "save", favorite: { ...favorite, url } }));
      } catch (err) {
        apply(previous);
        throw err;
      }
    },
    [favorites, apply]
  );

  const remove = useCallback(
    async (songUrl: string) => {
      const previous = favorites;
      const url = normalizeSongUrl(songUrl);
      apply(favorites.filter((f) => f.url !== url));
      try {
        apply(await favoritesRequest({ action: "remove", url }));
      } catch (err) {
        apply(previous);
        throw err;
      }
    },
    [favorites, apply]
  );

  return { favorites, find, save, remove, refresh };
}
