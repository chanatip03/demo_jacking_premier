"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRobot } from "../../providers/robot.provider";
import { LogPanel } from "../../components/LogPanel";
import { RobotControls } from "../../components/RobotControls";
import { StatusPanels } from "../../components/StatusPanels";
import { TaskQueuePanel } from "../../components/TaskQueuePanel";
import { STATUS, SPEED_DEFAULT } from "../../constants";
import { RobotMap } from "../../components/RobotMap";
import type {
  ButtonAction,
  LogEntry,
  QueueStep,
  SavedRoute,
} from "../../types";
import {
  buildWebsocketGroups,
  formatLogData,
  loadQueueFromStorage,
  loadRoutesFromStorage,
  saveQueueToStorage,
  saveRoutesToStorage,
  traceChain,
} from "@/utils";

interface LandingPageProps {
  tabName: string;
}

export default function LandingPage({ tabName }: Readonly<LandingPageProps>) {
  const {
    flow,
    connected,
    noderedOnline,
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
  const queueKeyRef = useRef(0);
  const sentJobIdsRef = useRef<Set<string>>(new Set());
  const lastRobotStatusLogIdRef = useRef(0);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [taskQueue, setTaskQueue] = useState<QueueStep[]>([]);
  const [isQueueRunning, setIsQueueRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [isSavingRoute, setIsSavingRoute] = useState(false);
  const [routeNameDraft, setRouteNameDraft] = useState("");
  const [expandedRouteId, setExpandedRouteId] = useState<string | null>(null);
  const [speedValue, setSpeedValue] = useState(SPEED_DEFAULT);

  const serverIP = socketUrl
    .replace(/^wss?:\/\//, "")
    .split("/")[0]
    .split(":")[0];

  const pushLog = (kind: LogEntry["kind"], text: string) => {
    idRef.current += 1;
    setLogs((previous) => [
      ...previous.slice(-50),
      {
        id: idRef.current,
        kind,
        text,
        time: new Date().toLocaleTimeString("en-GB", { hour12: false }),
      },
    ]);
  };

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    setTaskQueue(loadQueueFromStorage(tabName, socketUrl));
    setSavedRoutes(loadRoutesFromStorage(tabName, socketUrl));
    setIsQueueRunning(false);
    setIsPaused(false);
    sentJobIdsRef.current.clear();
  }, [tabName, socketUrl]);

  useEffect(() => {
    saveQueueToStorage(tabName, socketUrl, taskQueue);
  }, [taskQueue, tabName, socketUrl]);

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
      const receivedLogs: LogEntry[] = newStatusLogs.map((entry) => {
        idRef.current += 1;

        return {
          id: idRef.current,
          kind: "received" as const,
          text: `robot_status: ${formatLogData(entry.data)}`,
          time: new Date().toLocaleTimeString("en-GB", { hour12: false }),
        };
      });

      return [...previous, ...receivedLogs].slice(-50);
    });
  }, [robotStatusLogs]);

  const currentTab = useMemo(
    () => flow.find((node) => node.type === "tab" && node.label === tabName),
    [flow, tabName],
  );

  const tabNodes = useMemo(
    () =>
      currentTab?.id ? flow.filter((node) => node.z === currentTab.id) : [],
    [currentTab, flow],
  );

  const nodeMap = useMemo(
    () => new Map(tabNodes.map((node) => [String(node.id), node])),
    [tabNodes],
  );

  const websocketGroups = useMemo(
    () => (currentTab?.id ? buildWebsocketGroups(tabNodes, nodeMap) : []),
    [currentTab, tabNodes, nodeMap],
  );

  const statusMeta = STATUS[connected];
  const recFiles = rec_file ?? [];

  const handleButtonClick = (button: ButtonAction) => {
    const chain = traceChain(button.target, nodeMap);
    const jobId = `job-${queueKeyRef.current++}`;

    const steps: QueueStep[] =
      chain.length > 0
        ? chain.map((step, index) => ({
            ...step,
            key: `${jobId}-${step.id}-${index}`,
            jobId,
            label: button.text,
            isJobStart: index === 0,
          }))
        : [
            {
              key: `${jobId}-manual`,
              id: String(button.target.id ?? jobId),
              poi: String(button.target.poi ?? ""),
              type: String(button.target.type ?? "manual"),
              operation: button.target.operation as string | undefined,
              jobId,
              label: button.text,
              isJobStart: true,
            },
          ];

    pushLog("system", `Queued: ${button.text}`);
    setTaskQueue((previous) => [...previous, ...steps]);
  };

  const handleControlClick = (label: "pause" | "resume") => {
    pushLog("sent", label);
    send(label);
    const isPause = label === "pause";
    setIsPaused(isPause);
    setIsQueueRunning(!isPause && taskQueue.length > 0);
  };

  const handleCancelClick = () => {
    pushLog("sent", "cancel");
    send("cancel");
    setIsPaused(false);
    setIsQueueRunning(false);
  };

  const handlePlayQueue = () => {
    if (taskQueue.length === 0) return;
    setIsPaused(false);
    setIsQueueRunning(true);
    pushLog("system", "Queue started");
  };

  const handleSpeedChange = (value: number) => {
    setSpeedValue(value);
    pushLog("sent", `speed=${value.toFixed(1)}`);
    send(`speed=${value}`);
  };

  const handleRemoveQueueItem = (key: string) => {
    setTaskQueue((previous) => previous.filter((item) => item.key !== key));
  };

  const handleClearQueue = () => {
    setTaskQueue([]);
    setIsQueueRunning(false);
    setIsPaused(false);
    sentJobIdsRef.current.clear();
  };

  const handleSaveRoute = () => {
    const name = routeNameDraft.trim();
    if (!name || taskQueue.length === 0) return;

    const route: SavedRoute = {
      id: `route-${Date.now()}`,
      name,
      savedAt: Date.now(),
      steps: taskQueue,
    };

    setSavedRoutes((previous) => [...previous, route]);
    setRouteNameDraft("");
    setIsSavingRoute(false);
    pushLog("system", `Saved route: ${name}`);
  };

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

    setTaskQueue((previous) => [...previous, ...remapped]);
    pushLog("system", `Added route to queue: ${route.name}`);
  };

  const handleDeleteRoute = (id: string) => {
    setSavedRoutes((previous) => previous.filter((route) => route.id !== id));
    setExpandedRouteId((previous) => (previous === id ? null : previous));
  };

  const handleToggleRouteJson = (id: string) => {
    setExpandedRouteId((previous) => (previous === id ? null : id));
  };

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

  useEffect(() => {
    if (!current_poi?.POI) return;

    setTaskQueue((previous) => {
      if (previous.length === 0) return previous;

      const idx = previous.findIndex((item) => item.poi === current_poi.POI);
      if (idx === -1) return previous;

      return previous.slice(idx + 1);
    });
  }, [current_poi]);

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-gray-50">
      {/* ── Header ───────────────────────────────────────────────── */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-6 py-3 shadow-sm">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-bold tracking-tight">AMR Controller</h1>
          <span className="text-sm text-gray-400">{tabName}</span>
        </div>

        <div className="flex items-center gap-2">
          <input
            value={socketUrl}
            onChange={(event) => setSocketUrl(event.target.value)}
            className="w-72 rounded-lg border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="ws://host:port/path"
          />
          <button
            onClick={reconnect}
            className="rounded-lg bg-emerald-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 active:scale-95 transition-transform"
          >
            Connect
          </button>
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: statusMeta.color }}
          />
          <span
            className="text-sm font-medium"
            style={{ color: statusMeta.color }}
          >
            {statusMeta.label}
          </span>

          {/* Separator */}
          <span className="text-gray-300">|</span>

          {/* Node-RED status */}
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: noderedOnline ? "#10b981" : "#94a3b8" }}
          />
          <span
            className="text-sm font-medium"
            style={{ color: noderedOnline ? "#10b981" : "#94a3b8" }}
          >
            Node-RED {noderedOnline ? "online" : "offline"}
          </span>
        </div>
      </header>

      {/* ── Two-column body ──────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 gap-6 overflow-hidden">
        {/* LEFT COLUMN — scrollable controls + pinned log */}
        <div className="flex max-w-[800px] flex-1 flex-col overflow-hidden">
          {/* scrollable area */}
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            {/* Status pills — min-height equal to queue panel */}
            <div className="min-h-[200px] flex items-start content-start">
              <StatusPanels
                battery={battery}
                currentPoi={current_poi}
                speed={speed}
              />
            </div>

            {/* Task queue */}
            <TaskQueuePanel
              taskQueue={taskQueue}
              isQueueRunning={isQueueRunning}
              isPaused={isPaused}
              isSavingRoute={isSavingRoute}
              routeNameDraft={routeNameDraft}
              savedRoutes={savedRoutes}
              expandedRouteId={expandedRouteId}
              speedValue={speedValue}
              onSpeedChange={handleSpeedChange}
              onToggleSaveRoute={() => setIsSavingRoute(true)}
              onRouteNameChange={setRouteNameDraft}
              onSaveRoute={handleSaveRoute}
              onCancelSaveRoute={() => {
                setIsSavingRoute(false);
                setRouteNameDraft("");
              }}
              onClearQueue={handleClearQueue}
              onAddRouteToQueue={handleAddRouteToQueue}
              onToggleRouteJson={handleToggleRouteJson}
              onDeleteRoute={handleDeleteRoute}
              onRemoveQueueItem={handleRemoveQueueItem}
              onPlayQueue={handlePlayQueue}
              onControlClick={handleControlClick}
              onCancelClick={handleCancelClick}
            />

            {/* Robot control buttons */}
            <RobotControls
              websocketGroups={websocketGroups}
              onButtonClick={handleButtonClick}
            />
          </div>
        </div>

        {/* RIGHT COLUMN — map + log side by side */}
        {serverIP && (
          <div className="flex w-[60%] shrink-0 border-l border-gray-200">
            {/* Map */}
            <div className="flex min-w-0 flex-1 flex-col bg-white">
              {map?.name && (
                <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 px-4 py-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Map
                  </span>
                  <span className="text-xs font-medium text-gray-600">
                    {map.name}
                  </span>
                </div>
              )}
              <RobotMap serverIP={serverIP} />
            </div>

            <div className="flex w-72 shrink-0 flex-col border-l border-gray-200 min-h-screen overflow-y-scroll">
              <LogPanel logs={logs} logEndRef={logEndRef} />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
