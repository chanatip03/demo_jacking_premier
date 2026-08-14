export interface RobotStatusLog {
  id: number;
  data: string;
}

export interface LogEntry {
  id: number;
  time: string;
  kind: "sent" | "received" | "system" | "error";
  text: string;
}