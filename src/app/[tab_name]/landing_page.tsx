"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlowNode, useRobot } from "../providers/robot.provider";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import StopIcon from "@mui/icons-material/Stop";
import BatteryChargingFullIcon from "@mui/icons-material/BatteryChargingFull";
import Battery60Icon from "@mui/icons-material/Battery60";
import SpeedIcon from "@mui/icons-material/Speed";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import CloseIcon from "@mui/icons-material/Close";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import SaveIcon from "@mui/icons-material/Save";
import PlaylistPlayIcon from "@mui/icons-material/PlaylistPlay";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import CodeIcon from "@mui/icons-material/Code";

interface LandingPageProps {
  tabName: string;
}

type LogKind = "sent" | "received" | "system" | "error";

interface LogEntry {
  id: number;
  time: string;
  kind: LogKind;
  text: string;
}

type QueueStatus = "current" | "pending";

interface QueueStep {
  key: string; // unique instance key (node id + counter, since the same node can be queued more than once)
  id: string; // node id
  poi: string;
  type: string;
  operation?: string;
  label: string; // the text that was sent when the first step of this job was queued
  jobId: string; // groups every step that belongs to the same button click ("job")
  isJobStart: boolean; // true for the first step of a job -> this is the step whose label gets sent over the websocket
}

type ButtonAction = {
  text: string;
  target: FlowNode;
};

// A named, saved copy of a task queue ("route") that can be added back into the active queue later.
interface SavedRoute {
  id: string;
  name: string;
  savedAt: number;
  steps: QueueStep[];
}

type WebsocketGroup = {
  websocket: string;
  sections: Array<{
    name: string;
    buttons: ButtonAction[];
  }>;
};

const STATUS = {
  connecting: {
    label: "Connecting",
    color: "#FFB454",
  },
  connected: {
    label: "Connected",
    color: "#34E5C4",
  },
  closed: {
    label: "Disconnected",
    color: "#6B7680",
  },
  error: {
    label: "Connection Error",
    color: "#FF5C5C",
  },
};

const LOG = {
  sent: "→ sent",
  received: "← received",
  system: "• system",
  error: "! error",
};

const CHAINABLE_TYPES = new Set(["next-robot-movement", "next-robot-jack"]);

const SPEED_MIN = 0;
const SPEED_MAX = 1.5;
const SPEED_STEP = 0.1;
const SPEED_DEFAULT = 1;

const QUEUE_STORAGE_KEY = "amr_task_queue_v1";
const ROUTES_STORAGE_KEY = "amr_saved_routes_v1";

// Every AMR/socket combination gets its own storage bucket, so switching the websocket endpoint
// (a different robot / environment) never mixes its queue or saved routes with another one's.
function storageKeyFor(
  base: string,
  tabName: string,
  socketUrl: string,
): string {
  return `${base}:${tabName || "no-tab"}:${socketUrl || "no-socket"}`;
}

function loadQueueFromStorage(tabName: string, socketUrl: string): QueueStep[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(
      storageKeyFor(QUEUE_STORAGE_KEY, tabName, socketUrl),
    );
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveQueueToStorage(
  tabName: string,
  socketUrl: string,
  queue: QueueStep[],
) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(
      storageKeyFor(QUEUE_STORAGE_KEY, tabName, socketUrl),
      JSON.stringify(queue),
    );
  } catch {
    // storage might be full or unavailable - fail silently, queue still works in-memory
  }
}

function loadRoutesFromStorage(
  tabName: string,
  socketUrl: string,
): SavedRoute[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(
      storageKeyFor(ROUTES_STORAGE_KEY, tabName, socketUrl),
    );
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRoutesToStorage(
  tabName: string,
  socketUrl: string,
  routes: SavedRoute[],
) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(
      storageKeyFor(ROUTES_STORAGE_KEY, tabName, socketUrl),
      JSON.stringify(routes),
    );
  } catch {
    // storage might be full or unavailable - fail silently, routes still work in-memory
  }
}

function traceChain(
  startNode: FlowNode,
  nodeMap: Map<string, FlowNode>,
): Omit<QueueStep, "key" | "label" | "jobId" | "isJobStart">[] {
  const steps: Omit<QueueStep, "key" | "label" | "jobId" | "isJobStart">[] = [];
  const visited = new Set<string>();

  let current: FlowNode | undefined = startNode;

  while (current?.type && CHAINABLE_TYPES.has(current.type)) {
    if (!current.id || visited.has(current.id)) break;
    visited.add(current.id);

    steps.push({
      id: current.id,
      poi: (current.poi as string) ?? "",
      type: current.type,
      operation: current.operation as string | undefined,
    });

    const nextId: string | undefined = current.wires?.[0]?.[0];
    current = nextId ? nodeMap.get(nextId) : undefined;
  }

  return steps;
}

function buildWebsocketGroups(
  tabNodes: FlowNode[],
  nodeMap: Map<string, FlowNode>,
): WebsocketGroup[] {
  return tabNodes
    .filter(
      (node) => node.type === "websocket in" && node.name === "Robot task",
    )
    .map((websocket) => {
      const switches = (websocket.wires?.flat() ?? [])
        .map((id) => nodeMap.get(id))
        .filter((node): node is FlowNode => node?.type === "switch");

      return {
        websocket: websocket.name || "Websocket",
        sections: switches.map((switchNode) => ({
          name: switchNode.name || "Switch",
          buttons: (switchNode.rules ?? [])
            .map((rule, index): ButtonAction | null => {
              const targetId = switchNode.wires?.[index]?.[0];
              const target = targetId ? nodeMap.get(targetId) : undefined;

              return target && rule.v ? { text: rule.v, target } : null;
            })
            .filter((button): button is ButtonAction => button !== null),
        })),
      };
    });
}

function getBatteryColor(percent: number | null): string {
  if (percent === null) return "#6B7680";
  if (percent <= 20) return "#FF5C5C";
  if (percent <= 50) return "#FFB454";
  return "#34E5C4";
}

function formatLogData(data: unknown): string {
  if (typeof data === "string") return data;

  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
}

export default function LandingPage({ tabName }: Readonly<LandingPageProps>) {
  const {
    flow,
    connected,
    send,
    reconnect,
    current_poi,
    socketUrl,
    setSocketUrl,
    battery,
    map,
    speed,
    rec_file,
    robotStatusLogs,
  } = useRobot();

  const logEndRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);
  const lastRobotStatusLogIdRef = useRef(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const queueKeyRef = useRef(0);

  // Task queue is scoped to this tab + socket combination, and hydrated whenever either changes.
  const [taskQueue, setTaskQueue] = useState<QueueStep[]>([]);

  // The queue only sends anything over the websocket while isQueueRunning is true (Play pressed).
  const [isQueueRunning, setIsQueueRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Tracks which jobs have already had their command sent, so a re-render / dequeue never re-sends the same job.
  const sentJobIdsRef = useRef<Set<string>>(new Set());

  // Named saved routes - also scoped to this tab + socket combination.
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [isSavingRoute, setIsSavingRoute] = useState(false);
  const [routeNameDraft, setRouteNameDraft] = useState("");
  const [expandedRouteId, setExpandedRouteId] = useState<string | null>(null);

  // Volume-style speed control - kept purely on the UI side and sent as {topic:"speed", speed} whenever it changes (scale 0 - 1.5)
  const [speedValue, setSpeedValue] = useState(SPEED_DEFAULT);

  const pushLog = (kind: LogKind, text: string) => {
    idRef.current++;

    setLogs((prev) => [
      ...prev.slice(-50),
      {
        id: idRef.current,
        kind,
        text,
        time: new Date().toLocaleTimeString("en-GB", {
          hour12: false,
        }),
      },
    ]);
  };

  useEffect(() => {
    logEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [logs]);

  // Whenever the tab or the connected socket changes, switch to whichever queue and saved
  // routes belong to that combination - each robot/socket keeps its own, isolated task queue.
  useEffect(() => {
    setTaskQueue(loadQueueFromStorage(tabName, socketUrl));
    setSavedRoutes(loadRoutesFromStorage(tabName, socketUrl));
    setIsQueueRunning(false);
    setIsPaused(false);
    sentJobIdsRef.current.clear();
  }, [tabName, socketUrl]);

  // Persist the task queue to localStorage every time it changes.
  useEffect(() => {
    saveQueueToStorage(tabName, socketUrl, taskQueue);
  }, [taskQueue, tabName, socketUrl]);

  // Persist saved routes to localStorage every time they change.
  useEffect(() => {
    saveRoutesToStorage(tabName, socketUrl, savedRoutes);
  }, [savedRoutes, tabName, socketUrl]);

  useEffect(() => {
    const newStatusLogs = robotStatusLogs.filter(
      (entry) => entry.id > lastRobotStatusLogIdRef.current,
    );

    if (newStatusLogs.length === 0) return;

    lastRobotStatusLogIdRef.current =
      newStatusLogs[newStatusLogs.length - 1].id;

    setLogs((previous) => {
      const receivedLogs = newStatusLogs.map((entry) => {
        idRef.current += 1;

        return {
          id: idRef.current,
          kind: "received" as const,
          text: `robot_status: ${formatLogData(entry.data)}`,
          time: new Date().toLocaleTimeString("en-GB", {
            hour12: false,
          }),
        };
      });

      return [...previous, ...receivedLogs].slice(-50);
    });
  }, [robotStatusLogs]);

  const currentTab = useMemo(() => {
    return flow.find((node) => node.type === "tab" && node.label === tabName);
  }, [flow, tabName]);

  const tabNodes = useMemo(() => {
    if (!currentTab?.id) return [];
    return flow.filter((n) => n.z === currentTab.id);
  }, [flow, currentTab]);

  const nodeMap = useMemo(() => {
    return new Map(tabNodes.map((n) => [n.id as string, n]));
  }, [tabNodes]);

  const websocketGroups = useMemo(
    () => (currentTab?.id ? buildWebsocketGroups(tabNodes, nodeMap) : []),
    [currentTab, tabNodes, nodeMap],
  );

  const statusMeta = STATUS[connected];

  // Clicking a task button no longer sends anything immediately - it only adds a job to the queue.
  // The job's chain of movement/jack steps is traced purely for progress tracking; the actual
  // websocket message is sent later, once this job reaches the front of the queue.
  const handleButtonClick = (button: ButtonAction) => {
    const chain = traceChain(button.target, nodeMap);
    const jobId = `job-${queueKeyRef.current++}`;

    const steps: QueueStep[] =
      chain.length > 0
        ? chain.map((step, idx) => ({
            ...step,
            key: `${jobId}-${step.id}-${idx}`,
            jobId,
            label: button.text,
            isJobStart: idx === 0,
          }))
        : [
            {
              key: `${jobId}-manual`,
              id: (button.target.id as string) ?? jobId,
              poi: (button.target.poi as string) ?? "",
              type: (button.target.type as string) ?? "manual",
              operation: button.target.operation as string | undefined,
              jobId,
              label: button.text,
              isJobStart: true,
            },
          ];

    pushLog("system", `Queued: ${button.text}`);
    setTaskQueue((prev) => [...prev, ...steps]);
  };

  // Play / Pause / Resume / Cancel controls sent straight to the websocket (not queued).
  const handleControlClick = (label: string) => {
    pushLog("sent", label);
    send(label);

    if (label === "pause") {
      setIsPaused(true);
      setIsQueueRunning(false);
    }

    if (label === "resume") {
      setIsPaused(false);
      if (taskQueue.length > 0) setIsQueueRunning(true);
    }
  };

  const handleCancelClick = () => {
    pushLog("sent", "cancel");
    send("cancel");
    setIsPaused(false);
    setIsQueueRunning(false);
  };

  // Starts the queue - only from this point on will jobs actually be sent over the websocket.
  const handlePlayQueue = () => {
    if (taskQueue.length === 0) return;
    setIsPaused(false);
    setIsQueueRunning(true);
    pushLog("system", "Queue started");
  };

  // Rec file (saved route) button - sent straight to the websocket, same as before.
  const handleRecFileClick = (file: string) => {
    pushLog("sent", `shelf=${file}`);
    send(`shelf=${file}`);
  };

  // Volume-style speed slider -> sent as { topic: "speed", speed } (scale 0 - 1.5)
  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setSpeedValue(value);
    pushLog("sent", `speed=${value.toFixed(1)}`);
    send(`speed=${value}`);
  };

  // Manually remove a single step from the queue (X button).
  const handleRemoveQueueItem = (key: string) => {
    setTaskQueue((prev) => prev.filter((item) => item.key !== key));
  };

  // Clear the entire queue and stop it from running.
  const handleClearQueue = () => {
    setTaskQueue([]);
    setIsQueueRunning(false);
    setIsPaused(false);
    sentJobIdsRef.current.clear();
  };

  // Save the current queue as a new named route in the saved-routes list.
  const handleSaveRoute = () => {
    const name = routeNameDraft.trim();
    if (!name || taskQueue.length === 0) return;

    const route: SavedRoute = {
      id: `route-${Date.now()}`,
      name,
      savedAt: Date.now(),
      steps: taskQueue,
    };

    setSavedRoutes((prev) => [...prev, route]);
    setRouteNameDraft("");
    setIsSavingRoute(false);
    pushLog("system", `Saved route: ${name}`);
  };

  // Add a saved route onto the end of the active task queue, exactly as it was saved.
  // This appends rather than replaces, so multiple saved routes can be queued up back to back.
  // Job ids and keys are regenerated so the added route never collides with anything already queued/sent.
  const handleAddRouteToQueue = (route: SavedRoute) => {
    const jobIdMap = new Map<string, string>();

    const remapped: QueueStep[] = route.steps.map((step) => {
      let newJobId = jobIdMap.get(step.jobId);
      if (!newJobId) {
        newJobId = `job-${queueKeyRef.current++}`;
        jobIdMap.set(step.jobId, newJobId);
      }

      return {
        ...step,
        jobId: newJobId,
        key: `${newJobId}-${step.id}-${queueKeyRef.current}`,
      };
    });

    setTaskQueue((prev) => [...prev, ...remapped]);
    pushLog("system", `Added route to queue: ${route.name}`);
  };

  // Delete a saved route from the saved-routes list (does not touch the active queue).
  const handleDeleteRoute = (id: string) => {
    setSavedRoutes((prev) => prev.filter((route) => route.id !== id));
    setExpandedRouteId((prev) => (prev === id ? null : prev));
  };

  // Toggle the raw saved JSON preview for a route.
  const handleToggleRouteJson = (id: string) => {
    setExpandedRouteId((prev) => (prev === id ? null : id));
  };

  // Whenever the head of the queue is a fresh, unsent job AND the queue is running,
  // this is the moment the job's command actually gets sent over the websocket -
  // i.e. sending happens when the queue *reaches* the task, not when it was clicked.
  useEffect(() => {
    if (!isQueueRunning) return;

    const head = taskQueue[0];
    if (!head) return;
    if (!head.isJobStart) return;
    if (sentJobIdsRef.current.has(head.jobId)) return;

    sentJobIdsRef.current.add(head.jobId);
    pushLog("sent", head.label);
    send(head.label);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskQueue, isQueueRunning, send]);

  // As the robot reports its current POI, pop completed steps off the front of the queue.
  // A step counts as completed once the robot's current_poi matches that step's target POI.
  useEffect(() => {
    if (!current_poi?.POI) return;

    setTaskQueue((prev) => {
      if (prev.length === 0) return prev;

      // Find the step matching where the robot currently is, searching from the front of the queue
      // so that duplicate POIs further back in the queue are never matched by mistake.
      const idx = prev.findIndex((item) => item.poi === current_poi.POI);

      // Not found -> nothing to remove yet.
      if (idx === -1) return prev;

      // Remove everything up to and including the matched step - it has now been reached/completed.
      return prev.slice(idx + 1);
    });
  }, [current_poi]);

  // The head of the queue (index 0) is always the step currently in progress.
  const getStepStatus = (idx: number): QueueStatus => {
    return idx === 0 ? "current" : "pending";
  };

  const queueStatusStyle: Record<QueueStatus, string> = {
    current: "border-amber-400 bg-amber-50 text-amber-800 shadow-md",
    pending: "border-gray-200 bg-gray-50 text-gray-400",
  };

  const logLine = (log: LogEntry) =>
    `[${log.time}] ${LOG[log.kind]} ${log.text}`;

  const batteryPercent =
    typeof battery?.soc === "number" ? Math.round(battery.soc) : null;
  const isCharging = !!battery?.is_charging;
  const batteryColor = getBatteryColor(batteryPercent);

  const recFiles = rec_file ?? [];

  return (
    <main className="flex h-screen flex-col overflow-hidden px-4 py-6 md:px-10 md:py-8">
      <div className="mx-auto flex h-full w-full max-w-[2000px] flex-1 flex-col min-h-0">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[#232B33] pb-6">
          <div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">
              AMR Controller
            </h1>
            <p className="text-base text-gray-500">{tabName}</p>
          </div>

          <div className="flex items-center gap-3">
            <input
              value={socketUrl}
              onChange={(e) => setSocketUrl(e.target.value)}
              className="min-w-55 max-w-100 flex-1 rounded-md border px-3 py-2 text-base shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-900"
              placeholder="Secure WebSocket endpoint"
            />

            <button
              onClick={reconnect}
              className="rounded-lg bg-green-500 px-4 py-2 text-base text-white"
            >
              Connect
            </button>

            <span
              className="h-3 w-3 rounded-full"
              style={{ background: statusMeta.color }}
            />
            <p
              className="text-base font-medium"
              style={{ color: statusMeta.color }}
            >
              {statusMeta.label}
            </p>
          </div>
        </header>

        {/* Robot Status (3/4) | Live Log (1/4) - always fills the remaining height */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-[3fr_1fr]">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-6">
            {/* Top row: current position + speed + battery */}
            <div className="grid shrink-0 grid-cols-1 gap-6 sm:grid-cols-3">
              {/* Current position */}
              <section className="rounded-2xl border-t-4 border-sky-400 bg-white p-6 shadow-lg">
                {map?.name && (
                  <span className="block text-sm font-medium text-gray-400">
                    Map: {map.name}
                  </span>
                )}
                <p className="mb-3 text-xl font-semibold uppercase text-sky-600">
                  Current Position
                </p>

                {current_poi ? (
                  <div className="flex flex-col gap-3">
                    <div>
                      <p className="text-4xl font-bold">
                        {current_poi.POI || "-"}
                      </p>
                      <p className="text-sm text-gray-400">
                        Last POI: {current_poi.LPOI || "-"}
                      </p>
                    </div>

                    <div className="flex flex-row gap-4 font-mono text-sm text-gray-500">
                      <div>x: {current_poi.x?.toFixed?.(2) ?? "-"}</div>
                      <div>y: {current_poi.y?.toFixed?.(2) ?? "-"}</div>
                      <div>θ: {current_poi.angle?.toFixed?.(1) ?? "-"}°</div>
                    </div>
                  </div>
                ) : (
                  <p className="text-lg text-gray-400">No position data yet</p>
                )}
              </section>

              {/* Speed */}
              <section className="rounded-2xl border-t-4 border-violet-400 bg-white p-6 shadow-lg">
                <h2 className="mb-3 text-xl font-semibold uppercase text-violet-600">
                  Speed
                </h2>

                {speed ? (
                  <div className="flex items-center gap-4">
                    <SpeedIcon
                      style={{
                        color: speed.is_stop ? "#6B7680" : "#34E5C4",
                        fontSize: 40,
                      }}
                    />

                    <div>
                      <p className="text-4xl font-bold">
                        {speed.vx?.toFixed?.(2) ?? "0.00"}{" "}
                        <span className="text-lg font-normal text-gray-400">
                          m/s
                        </span>
                      </p>
                      <p className="flex items-center gap-1 text-sm text-gray-400">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{
                            background: speed.is_stop ? "#6B7680" : "#34E5C4",
                          }}
                        />
                        {speed.is_stop ? "Stopped" : "Moving"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-lg text-gray-400">No speed data yet</p>
                )}
              </section>

              {/* Battery */}
              <section className="rounded-2xl border-t-4 border-emerald-400 bg-white p-6 shadow-lg">
                <h2 className="mb-3 text-xl font-semibold uppercase text-emerald-600">
                  Battery
                </h2>

                {batteryPercent !== null ? (
                  <div className="flex items-center gap-4">
                    {isCharging ? (
                      <BatteryChargingFullIcon
                        style={{ color: batteryColor, fontSize: 40 }}
                      />
                    ) : (
                      <Battery60Icon
                        style={{ color: batteryColor, fontSize: 40 }}
                      />
                    )}

                    <div>
                      <p
                        className="text-4xl font-bold"
                        style={{ color: batteryColor }}
                      >
                        {batteryPercent}%
                      </p>
                      <p className="flex items-center gap-1 text-sm text-gray-400">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{
                            background: isCharging ? "#34E5C4" : "#6B7680",
                          }}
                        />
                        {isCharging ? "Charging" : "Not charging"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-lg text-gray-400">No battery data yet</p>
                )}
              </section>
            </div>

            {/* Task Queue */}
            <section className="flex shrink-0 flex-col gap-5 rounded-2xl border-t-4 border-amber-400 bg-white p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold">Task Queue</h2>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                        isQueueRunning
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {isQueueRunning ? "Running" : "Idle"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {taskQueue.length > 0 && !isSavingRoute && (
                    <button
                      onClick={() => setIsSavingRoute(true)}
                      className="flex items-center gap-1 text-sm text-amber-600 hover:text-amber-700"
                    >
                      <SaveIcon fontSize="small" />
                      Save route
                    </button>
                  )}
                  {taskQueue.length > 0 && (
                    <button
                      onClick={handleClearQueue}
                      className="text-sm text-gray-400 hover:text-red-500"
                    >
                      Clear queue
                    </button>
                  )}
                </div>
              </div>

              {/* Inline "save current queue as a named route" form */}
              {isSavingRoute && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <input
                    autoFocus
                    value={routeNameDraft}
                    onChange={(e) => setRouteNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveRoute();
                      if (e.key === "Escape") {
                        setIsSavingRoute(false);
                        setRouteNameDraft("");
                      }
                    }}
                    placeholder="Route name (e.g. Morning restock route)"
                    className="min-w-50 flex-1 rounded-lg border border-amber-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                  <button
                    onClick={handleSaveRoute}
                    disabled={!routeNameDraft.trim()}
                    className="rounded-lg bg-amber-500 px-3 py-2 text-sm text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setIsSavingRoute(false);
                      setRouteNameDraft("");
                    }}
                    className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-amber-100"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Saved routes - add a previously saved route onto the queue, view its JSON, or delete it */}
              {savedRoutes.length > 0 && (
                <div className="flex flex-col gap-3 border-b border-gray-100 pb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold uppercase text-gray-400">
                      Saved Routes:
                    </span>
                    {savedRoutes.map((route) => (
                      <div
                        key={route.id}
                        className="group flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 py-1 pl-3 pr-1 text-sm text-amber-700"
                      >
                        <button
                          onClick={() => handleAddRouteToQueue(route)}
                          className="flex items-center gap-1 hover:underline"
                          title={`Add "${route.name}" (${route.steps.length} steps) to the queue`}
                        >
                          <PlaylistPlayIcon fontSize="small" />
                          {route.name}
                          <span className="text-amber-400">
                            ({route.steps.length})
                          </span>
                        </button>
                        <button
                          onClick={() => handleToggleRouteJson(route.id)}
                          className={`flex h-5 w-5 items-center justify-center rounded-full hover:bg-amber-100 ${
                            expandedRouteId === route.id
                              ? "text-amber-800"
                              : "text-amber-400"
                          }`}
                          aria-label={`View JSON for saved route ${route.name}`}
                        >
                          <CodeIcon style={{ fontSize: 15 }} />
                        </button>
                        <button
                          onClick={() => handleDeleteRoute(route.id)}
                          className="flex h-5 w-5 items-center justify-center rounded-full text-amber-400 hover:bg-red-100 hover:text-red-500"
                          aria-label={`Delete saved route ${route.name}`}
                        >
                          <DeleteOutlineOutlinedIcon style={{ fontSize: 15 }} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Raw saved JSON for the expanded route, if any */}
                  {expandedRouteId &&
                    (() => {
                      const route = savedRoutes.find(
                        (r) => r.id === expandedRouteId,
                      );
                      if (!route) return null;

                      return (
                        <pre className="max-h-48 overflow-auto rounded-lg bg-neutral-900 p-3 font-mono text-xs text-emerald-300">
                          {JSON.stringify(route.steps, null, 2)}
                        </pre>
                      );
                    })()}
                </div>
              )}

              {/* Queued task cards */}
              {taskQueue.length === 0 ? (
                <p className="flex items-center gap-2 text-base text-gray-400">
                  <PlaylistAddIcon fontSize="small" />
                  No tasks in queue - click a task button below to add one
                </p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {taskQueue.map((item, idx) => {
                    const status = getStepStatus(idx);

                    return (
                      <div
                        key={item.key}
                        className={`group relative min-w-35 rounded-xl border px-5 py-4 font-mono text-base transition-colors ${queueStatusStyle[status]}`}
                        title={item.label}
                      >
                        <button
                          onClick={() => handleRemoveQueueItem(item.key)}
                          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 opacity-0 shadow transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                          aria-label="Remove from queue"
                        >
                          <CloseIcon style={{ fontSize: 16 }} />
                        </button>

                        <div className="font-semibold">
                          {item.poi || item.operation || item.type}
                        </div>
                        {item.operation && (
                          <div className="text-sm opacity-70">
                            {item.operation}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Bottom row: speed slider (volume-style) + play / pause / stop controls */}
              <div className="flex flex-col gap-4 border-t border-gray-100 pt-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex min-w-30 max-w-75 flex-row">
                    <input
                      type="range"
                      min={SPEED_MIN}
                      max={SPEED_MAX}
                      step={SPEED_STEP}
                      value={speedValue}
                      onChange={handleSpeedChange}
                      className="h-2  flex-1 cursor-pointer accent-emerald-500 w-full"
                    />

                    <span className="w-12 shrink-0 text-right font-mono text-base text-gray-500">
                      {speedValue.toFixed(1)}
                    </span>
                  </div>

                  {!isQueueRunning ? (
                    <button
                      onClick={handlePlayQueue}
                      disabled={taskQueue.length === 0}
                      className="flex items-center gap-2 rounded-xl border border-emerald-400 bg-emerald-500 px-4 py-2 text-base text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-200 disabled:text-gray-400"
                    >
                      <PlayArrowIcon /> Play
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        handleControlClick(isPaused ? "resume" : "pause")
                      }
                      className="flex items-center gap-2 rounded-xl border border-amber-400 bg-amber-50 px-4 py-2 text-base text-amber-700 hover:bg-amber-100"
                    >
                      {isPaused ? (
                        <>
                          <PlayArrowIcon /> Resume
                        </>
                      ) : (
                        <>
                          <PauseIcon /> Pause
                        </>
                      )}
                    </button>
                  )}

                  <button
                    onClick={handleCancelClick}
                    className="flex items-center gap-2 rounded-xl border border-red-300 px-4 py-2 text-base text-red-600 hover:bg-red-50"
                  >
                    <StopIcon />
                    Stop
                  </button>
                </div>
              </div>
            </section>

            {/* Robot Task controls (2) | Saved Routes / Rec File (1) - fills all remaining space */}
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="flex min-h-0 flex-1 flex-col gap-6 lg:col-span-2">
                {websocketGroups.map((group) => (
                  <section
                    key={group.websocket}
                    className="flex flex-1 flex-col rounded-2xl border-t-4 border-blue-400 bg-white p-6 shadow-lg"
                  >
                    <h2 className="mb-5 text-2xl font-bold text-blue-700">
                      {group.websocket}
                    </h2>
                    <div className="flex flex-wrap gap-6">
                      {group.sections.map((section) => (
                        <div key={section.name} className="mb-6 last:mb-0">
                          <h3 className="mb-3 text-base font-semibold uppercase text-gray-500">
                            {section.name}
                          </h3>

                          <div className="flex flex-wrap gap-3">
                            {section.buttons.map((btn) => (
                              <button
                                key={btn?.target.id}
                                onClick={() => handleButtonClick(btn)}
                                className="rounded-xl border border-blue-200 px-5 py-3 text-base hover:bg-blue-50"
                              >
                                {btn?.text}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>

              <section className="flex min-h-0 flex-col rounded-2xl border-t-4 border-indigo-400 bg-white p-6 shadow-lg lg:col-span-1">
                <h3 className="mb-3 flex items-center gap-2 text-base font-semibold uppercase text-indigo-600">
                  <FolderOpenIcon fontSize="small" />
                  Saved Routes (Rec File)
                </h3>

                {recFiles.length === 0 ? (
                  <p className="text-base text-gray-400">No saved routes yet</p>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {recFiles.map((file) => (
                      <button
                        key={file}
                        onClick={() => handleRecFileClick(file)}
                        className="rounded-xl border border-indigo-200 px-5 py-3 text-base hover:bg-indigo-50"
                      >
                        {file}
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>

          {/* Log: right-hand 1/4 column, always full height */}
          <section className="flex min-h-0 flex-col rounded-2xl border-t-4 border-teal-400 border bg-black text-white shadow-lg">
            <div className="flex items-center justify-between border-b border-neutral-700 px-4 py-3">
              <span className="font-mono text-sm uppercase tracking-[0.3em]">
                Log
              </span>
              <span className="font-mono text-sm">{logs.length} Records</span>
            </div>
            <div className="hidden flex-1 space-y-1 overflow-y-scroll px-4 py-3 font-mono text-sm lg:block">
              {logs.length === 0 ? (
                <p className="text-neutral-500">Waiting...</p>
              ) : (
                logs.map((log) => <div key={log.id}>{logLine(log)}</div>)
              )}
              <div ref={logEndRef} />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
