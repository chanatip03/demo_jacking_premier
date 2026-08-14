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

export interface SavedRoute {
  id: string;
  name: string;
  savedAt: number;
  steps: QueueStep[];
}

