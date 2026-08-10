import type { FlowNode } from "./providers/robot.provider";

export type LogKind = "sent" | "received" | "system" | "error";

export interface LogEntry {
  id: number;
  time: string;
  kind: LogKind;
  text: string;
}

export type QueueStatus = "current" | "pending";

export interface QueueStep {
  key: string;
  id: string;
  poi: string;
  type: string;
  operation?: string;
  label: string;
  jobId: string;
  isJobStart: boolean;
}

export interface ButtonAction {
  text: string;
  target: FlowNode;
}

export interface SavedRoute {
  id: string;
  name: string;
  savedAt: number;
  steps: QueueStep[];
}

export interface WebsocketGroup {
  websocket: string;
  sections: Array<{
    name: string;
    buttons: ButtonAction[];
  }>;
}

export interface ConnectionStatusMeta {
  label: string;
  color: string;
}

export type TabView = "dashboard" | "queue" | "setting";  