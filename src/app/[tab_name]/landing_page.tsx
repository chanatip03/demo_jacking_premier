"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRobot } from "../../providers/robot.provider";
import { FlowNode } from "@/core/interface/flow";
import { LogPanel } from "../../components/LogPanel";
import { RobotControls } from "../../components/RobotControls";
import { StatusPanels } from "../../components/StatusPanels";
import { TaskQueuePanel } from "../../components/TaskQueuePanel";
import { STATUS } from "@/core/types/status";
import { SPEED_DEFAULT } from "@/core/types/speed";
import { RobotMap } from "../../components/RobotMap";
import {
  buildWebsocketGroups,
  formatLogData,
  loadQueueFromStorage,
  loadRoutesFromStorage,
  saveQueueToStorage,
  saveRoutesToStorage,
  traceChain,
} from "@/utils";
import { LogEntry } from "@/core/interface/log";
import { QueueStep, SavedRoute } from "@/core/interface/queue";
import {
  JackSettingsModal,
  loadJackSettings,
} from "../../components/JackSettingsModal";

interface LandingPageProps {
  tabName: string;
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
    robotStatusLogs,
    rec_file,
    connectionEpoch,
  } = useRobot();

  const logEndRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);
  const queueKeyRef = useRef(0);
  const sentQueueKeysRef = useRef<Set<string>>(new Set());
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

  const parseArrivedPOI = (message: string) => {
    const match = message.match(/^Arrived At\s*:\s*(.+)$/i);

    return match?.[1]?.trim() ?? null;
  };

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
    sentQueueKeysRef.current.clear();
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
          kind: "received",
          text: `robot_status: ${formatLogData(entry.data)}`,
          time: new Date().toLocaleTimeString("en-GB", {
            hour12: false,
          }),
        };
      });

      return [...previous, ...receivedLogs].slice(-50);
    });

    // เช็คว่า robot เดินทางถึง POI ไหน
    newStatusLogs.forEach((entry) => {
      const message = entry.data;

      if (typeof message !== "string") return;

      const arrivedPOI = parseArrivedPOI(message);

      if (!arrivedPOI) return;

      setTaskQueue((previous) => {
        const currentStep = previous[0];

        if (!currentStep) return previous;

        if (currentStep.poi !== arrivedPOI) {
          return previous;
        }

        return previous.slice(1);
      });
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

  /** Sends a message in the standard envelope format */
  const sendMsg = useCallback(
    (topic: string, payload: Record<string, unknown> = {}) => {
      const envelope = { topic, payload };
      pushLog("sent", JSON.stringify(envelope));
      send(envelope);
    },
    [send],
  );

  const handleButtonClick = (button: { text: string; target: FlowNode }) => {
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
    sendMsg(label);
    const isPause = label === "pause";
    setIsPaused(isPause);
    setIsQueueRunning(!isPause && taskQueue.length > 0);
  };

  const handleCancelClick = () => {
    sendMsg("cancel");
    setTaskQueue([]);
    setIsPaused(false);
    setIsQueueRunning(false);
    sentQueueKeysRef.current.clear();
  };

  const handlePlayQueue = () => {
    if (taskQueue.length === 0) return;
    setIsPaused(false);
    setIsQueueRunning(true);
    pushLog("system", "Queue started");
  };

  const handleSpeedChange = (value: number) => {
    setSpeedValue(value);
    sendMsg("speed", { value });
  };

  const handleRemoveQueueItem = (key: string) => {
    setTaskQueue((previous) => previous.filter((item) => item.key !== key));
  };

  const handleClearQueue = () => {
    setTaskQueue([]);
    setIsQueueRunning(false);
    setIsPaused(false);
    sentQueueKeysRef.current.clear();
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

  const handleToggleRouteJson = (id: string) => {
    setExpandedRouteId((previous) => (previous === id ? null : id));
  };

  useEffect(() => {
    if (!isQueueRunning || isPaused) return;

    const head = taskQueue[0];

    if (!head) {
      setIsQueueRunning(false);
      return;
    }

    if (sentQueueKeysRef.current.has(head.key)) {
      return;
    }

    sentQueueKeysRef.current.add(head.key);

    // Jack steps: send with settings payload instead of plain topic
    const isJack =
      head.type === "next-robot-jack" ||
      head.label.toLowerCase().includes("jack");

    if (isJack) {
      const jackSettings = loadJackSettings();
      const isUnload = head.label.toLowerCase().includes("unload");
      const topic = isUnload ? "Jack Unload" : "Jack Load";
      const payload = isUnload
        ? (jackSettings.jackUnload as unknown as Record<string, unknown>)
        : (jackSettings.jackLoad as unknown as Record<string, unknown>);
      sendMsg(topic, payload);
    } else {
      sendMsg(head.label);
    }
  }, [taskQueue, isQueueRunning, isPaused, send, sendMsg]);

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-gray-50">
      <header className="flex items-center justify-between gap-2 border-b border-gray-200 bg-white px-4 py-2 shadow-sm">
        {/* Left: Jack Settings */}
        <JackSettingsModal recFiles={rec_file} />

        {/* Right: Connection controls */}
        <div className="flex items-center gap-2">
          <input
            value={socketUrl}
            onChange={(event) => setSocketUrl(event.target.value)}
            className="w-[14rem] min-w-0 rounded-lg border border-gray-300 px-2 py-1 text-[0.8em] shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="ws://host:port/path"
          />
          <button
            onClick={reconnect}
            type="button"
            className="rounded-lg bg-emerald-500 px-3 py-1 text-[0.8em] font-medium text-white hover:bg-emerald-600 active:scale-95 transition-transform"
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
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
        {/* LEFT COLUMN */}
        <div className="flex w-[42%] shrink-0 flex-col overflow-hidden">
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            <div className="flex items-start content-start">
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
              onClearQueue={handleClearQueue}
              onAddRouteToQueue={handleAddRouteToQueue}
              onToggleRouteJson={handleToggleRouteJson}
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
          <div className="flex min-w-0 flex-1 border-l border-gray-200">
            {/* Map */}
            <div className="flex min-w-0 flex-1 flex-col bg-white">
              {map?.name && (
                <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 px-3 py-1.5">
                  <span className="text-[0.75em] font-semibold uppercase tracking-wide text-gray-400">
                    Map
                  </span>
                  <span className="text-[0.75em] font-medium text-gray-600">
                    {map.name}
                  </span>
                </div>
              )}
              <RobotMap
                key={`${serverIP}-${connectionEpoch}`}
                serverIP={serverIP}
              />
            </div>

            <div className="flex h-full w-[14vw] min-w-[10rem] shrink-0 flex-col border-l border-gray-200 min-h-0 overflow-y-auto">
              <LogPanel logs={logs} logEndRef={logEndRef} />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
