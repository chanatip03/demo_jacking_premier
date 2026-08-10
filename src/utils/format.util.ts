export function getBatteryColor(percent: number | null): string {
  if (percent === null) return "#6B7680";
  if (percent <= 20) return "#FF5C5C";
  if (percent <= 50) return "#FFB454";
  return "#34E5C4";
}

export function formatLogData(data: unknown): string {
  if (typeof data === "string") return data;

  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
}