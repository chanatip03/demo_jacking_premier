import type { QueueStep, SavedRoute } from "../types";
import { QUEUE_STORAGE_KEY, ROUTES_STORAGE_KEY } from "../constants";

const QUEUE_KEY = QUEUE_STORAGE_KEY;
const ROUTE_KEY = ROUTES_STORAGE_KEY;

export function storageKeyFor(
  base: string,
  tabName: string,
  socketUrl: string,
) {
  return `${base}:${tabName || "no-tab"}:${socketUrl || "no-socket"}`;
}

function loadStorage<T>(
  key: string,
  tabName: string,
  socketUrl: string,
  fallback: T,
): T {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = localStorage.getItem(storageKeyFor(key, tabName, socketUrl));
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveStorage<T>(
  key: string,
  tabName: string,
  socketUrl: string,
  value: T,
) {
  if (typeof window ==="undefined") return;

  try {
    localStorage.setItem(
      storageKeyFor(key, tabName, socketUrl),
      JSON.stringify(value),
    );
  } catch {}
}

export const loadQueueFromStorage = (
  tabName: string,
  socketUrl: string,
) => loadStorage<QueueStep[]>(QUEUE_KEY, tabName, socketUrl, []);

export const saveQueueToStorage = (
  tabName: string,
  socketUrl: string,
  queue: QueueStep[],
) => saveStorage(QUEUE_KEY, tabName, socketUrl, queue);

export const loadRoutesFromStorage = (
  tabName: string,
  socketUrl: string,
) => loadStorage<SavedRoute[]>(ROUTE_KEY, tabName, socketUrl, []);

export const saveRoutesToStorage = (
  tabName: string,
  socketUrl: string,
  routes: SavedRoute[],
) => saveStorage(ROUTE_KEY, tabName, socketUrl, routes);