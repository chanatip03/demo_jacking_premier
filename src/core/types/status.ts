export type connectionStates = "connecting" | "connected" | "closed" | "error";

export const STATUS: Record<
  connectionStates,
  { label: string; color: string }
> = {
  connecting: { label: "Connecting", color: "#FFB454" },
  connected: { label: "Connected", color: "#34E5C4" },
  closed: { label: "Disconnected", color: "#6B7680" },
  error: { label: "Connection Error", color: "#FF5C5C" },
};