import type { ConnectionState } from "./providers/robot.provider";
import type { ConnectionStatusMeta } from "./types";

export const STATUS: Record<ConnectionState, ConnectionStatusMeta> = {
  connecting: { label: "Connecting", color: "#FFB454" },
  connected: { label: "Connected", color: "#34E5C4" },
  closed: { label: "Disconnected", color: "#6B7680" },
  error: { label: "Connection Error", color: "#FF5C5C" },
};

export const LOG = {
  sent: "→ sent",
  received: "← received",
  system: "• system",
  error: "! error",
};

export const ChaniableTypes = new Set([
  "next-robot-movement",
  "next-robot-jack",
]);

export const SPEED_MIN = 0;
export const SPEED_MAX = 1.5;
export const SPEED_STEP = 0.1;
export const SPEED_DEFAULT = 1;

export const QUEUE_STORAGE_KEY = "amr_task_queue_v1";
export const ROUTES_STORAGE_KEY = "amr_saved_routes_v1";
