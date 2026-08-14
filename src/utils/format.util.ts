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

/**
 * คำนวณความเร็วเชิงเส้น (m/s) จาก vx, vy
 * speed = √(vx² + vy²)
 */
export function computeLinearSpeed(vx: number, vy: number): number {
 const speed = Math.sqrt(vx * vx + vy * vy);
  return Number(speed.toFixed(2))
}

/**
 * คำนวณความเร็วเชิงมุม (rad/s) จาก w
 * ค่าติดลบ = หมุนซ้าย, ค่าบวก = หมุนขวา
 */
export function computeAngularVelocity(w: number): number {
  return w;
}
