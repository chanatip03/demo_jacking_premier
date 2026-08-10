import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import PlaylistPlayIcon from "@mui/icons-material/PlaylistPlay";
import SaveIcon from "@mui/icons-material/Save";
import CodeIcon from "@mui/icons-material/Code";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import StopIcon from "@mui/icons-material/Stop";
import type { SavedRoute, QueueStatus, QueueStep } from "../types";

interface TaskQueuePanelProps {
  taskQueue: QueueStep[];
  isQueueRunning: boolean;
  isPaused: boolean;
  isSavingRoute: boolean;
  routeNameDraft: string;
  savedRoutes: SavedRoute[];
  expandedRouteId: string | null;
  speedValue: number;
  onSpeedChange: (value: number) => void;
  onToggleSaveRoute: () => void;
  onRouteNameChange: (value: string) => void;
  onSaveRoute: () => void;
  onCancelSaveRoute: () => void;
  onClearQueue: () => void;
  onAddRouteToQueue: (route: SavedRoute) => void;
  onToggleRouteJson: (id: string) => void;
  onDeleteRoute: (id: string) => void;
  onRemoveQueueItem: (key: string) => void;
  onPlayQueue: () => void;
  onControlClick: (action: "pause" | "resume") => void;
  onCancelClick: () => void;
}

const queueStatusStyle: Record<QueueStatus, string> = {
  current: "border-amber-400 bg-amber-50 text-amber-800 shadow-md",
  pending: "border-gray-200 bg-gray-50 text-gray-400",
};

export function TaskQueuePanel({
  taskQueue,
  isQueueRunning,
  isPaused,
  isSavingRoute,
  routeNameDraft,
  savedRoutes,
  expandedRouteId,
  speedValue,
  onSpeedChange,
  onToggleSaveRoute,
  onRouteNameChange,
  onSaveRoute,
  onCancelSaveRoute,
  onClearQueue,
  onAddRouteToQueue,
  onToggleRouteJson,
  onDeleteRoute,
  onRemoveQueueItem,
  onPlayQueue,
  onControlClick,
  onCancelClick,
}: TaskQueuePanelProps) {
  const getStepStatus = (idx: number): QueueStatus =>
    idx === 0 ? "current" : "pending";

  return (
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
              onClick={onToggleSaveRoute}
              className="flex items-center gap-1 text-sm text-amber-600 hover:text-amber-700"
            >
              <SaveIcon fontSize="small" />
              Save route
            </button>
          )}
          {taskQueue.length > 0 && (
            <button
              onClick={onClearQueue}
              className="text-sm text-gray-400 hover:text-red-500"
            >
              Clear queue
            </button>
          )}
        </div>
      </div>

      {isSavingRoute && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <input
            autoFocus
            value={routeNameDraft}
            onChange={(event) => onRouteNameChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSaveRoute();
              if (event.key === "Escape") onCancelSaveRoute();
            }}
            placeholder="Route name (e.g. Morning restock route)"
            className="min-w-50 flex-1 rounded-lg border border-amber-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
          <button
            onClick={onSaveRoute}
            disabled={!routeNameDraft.trim()}
            className="rounded-lg bg-amber-500 px-3 py-2 text-sm text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            Save
          </button>
          <button
            onClick={onCancelSaveRoute}
            className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-amber-100"
          >
            Cancel
          </button>
        </div>
      )}

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
                  onClick={() => onAddRouteToQueue(route)}
                  className="flex items-center gap-1 hover:underline"
                  title={`Add "${route.name}" (${route.steps.length} steps) to the queue`}
                >
                  <PlaylistPlayIcon fontSize="small" />
                  {route.name}
                  <span className="text-amber-400">({route.steps.length})</span>
                </button>
                <button
                  onClick={() => onToggleRouteJson(route.id)}
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
                  onClick={() => onDeleteRoute(route.id)}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-amber-400 hover:bg-red-100 hover:text-red-500"
                  aria-label={`Delete saved route ${route.name}`}
                >
                  <DeleteOutlineOutlinedIcon style={{ fontSize: 15 }} />
                </button>
              </div>
            ))}
          </div>

          {expandedRouteId &&
            (() => {
              const route = savedRoutes.find(
                (item) => item.id === expandedRouteId,
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
                  onClick={() => onRemoveQueueItem(item.key)}
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 opacity-0 shadow transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                  aria-label="Remove from queue"
                >
                  <CloseIcon style={{ fontSize: 16 }} />
                </button>

                <div className="font-semibold">
                  {item.poi || item.operation || item.type}
                </div>
                {item.operation && (
                  <div className="text-sm opacity-70">{item.operation}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-4 border-t border-gray-100 pt-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-30 max-w-75 flex-row">
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.1}
              value={speedValue}
              onChange={(event) => onSpeedChange(Number(event.target.value))}
              className="h-2 flex-1 cursor-pointer accent-emerald-500 w-full"
            />

            <span className="w-12 shrink-0 text-right font-mono text-base text-gray-500">
              {speedValue.toFixed(1)}
            </span>
          </div>

          {!isQueueRunning ? (
            <button
              onClick={onPlayQueue}
              disabled={taskQueue.length === 0}
              className="flex items-center gap-2 rounded-xl border border-emerald-400 bg-emerald-500 px-4 py-2 text-base text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-200 disabled:text-gray-400"
            >
              <PlayArrowIcon /> Play
            </button>
          ) : (
            <button
              onClick={() => onControlClick(isPaused ? "resume" : "pause")}
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
            onClick={onCancelClick}
            className="flex items-center gap-2 rounded-xl border border-red-300 px-4 py-2 text-base text-red-600 hover:bg-red-50"
          >
            <StopIcon />
            Stop
          </button>
        </div>
      </div>
    </section>
  );
}
