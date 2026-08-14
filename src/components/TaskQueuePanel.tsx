import CloseIcon from "@mui/icons-material/Close";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import PlaylistPlayIcon from "@mui/icons-material/PlaylistPlay";
import CodeIcon from "@mui/icons-material/Code";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import StopIcon from "@mui/icons-material/Stop";
import type {
  SavedRoute,
  QueueStatus,
  QueueStep,
} from "@/core/interface/queue";

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
  onClearQueue: () => void;
  onAddRouteToQueue: (route: SavedRoute) => void;
  onToggleRouteJson: (id: string) => void;
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
  savedRoutes,
  expandedRouteId,
  onClearQueue,
  onAddRouteToQueue,
  onToggleRouteJson,
  onRemoveQueueItem,
  onPlayQueue,
  onControlClick,
  onCancelClick,
}: Readonly<TaskQueuePanelProps>) {
  const getStepStatus = (idx: number): QueueStatus =>
    idx === 0 ? "current" : "pending";

  return (
    <section className="flex shrink-0 flex-col gap-4 rounded-2xl border-t-4 border-amber-400 bg-white p-5 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h2 className="text-[1.5em] font-bold">Task Queue</h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[0.7em] font-semibold uppercase tracking-wide ${isQueueRunning
                ? "bg-emerald-100 text-emerald-700"
                : "bg-gray-100 text-gray-500"
                }`}
            >
              {isQueueRunning ? "Running" : "Idle"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {taskQueue.length > 0 && (
            <button
              type="button"
              onClick={onClearQueue}
              className="text-[1em] text-gray-400 hover:text-red-500"
            >
              Clear queue
            </button>
          )}
        </div>
      </div>

      {savedRoutes.length > 0 && (
        <div className="flex flex-col gap-2 border-b border-gray-100 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[0.7em] font-semibold uppercase text-gray-400">
              Saved Routes:
            </span>
            {savedRoutes.map((route) => (
              <div
                key={route.id}
                className="group flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 py-1 pl-3 pr-1 text-sm text-amber-700"
              >
                <button
                  type="button"
                  onClick={() => onAddRouteToQueue(route)}
                  className="flex items-center gap-1 text-[0.8em] hover:underline"
                  title={`Add "${route.name}" (${route.steps.length} steps) to the queue`}
                >
                  <PlaylistPlayIcon fontSize="small" />
                  {route.name}
                  <span className="text-amber-400">({route.steps.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleRouteJson(route.id)}
                  className={`flex h-5 w-5 items-center justify-center rounded-full hover:bg-amber-100 ${expandedRouteId === route.id
                    ? "text-amber-800"
                    : "text-amber-400"
                    }`}
                  aria-label={`View JSON for saved route ${route.name}`}
                >
                  <CodeIcon style={{ fontSize: 15 }} />
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
        <div className="flex flex-wrap gap-2">
          {taskQueue.map((item, idx) => {
            const status = getStepStatus(idx);

            return (
              <div
                key={item.key}
                className={`group relative min-w-[6rem] rounded-xl border px-3 py-3 font-mono text-[0.8em] transition-colors ${queueStatusStyle[status]}`}
                title={item.label}
              >
                <button
                  type="button"
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

      <div className="flex flex-col gap-3 border-t border-gray-100 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Play */}
          <button
            type="button"
            onClick={onPlayQueue}
            disabled={taskQueue.length === 0 || isQueueRunning}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-400 bg-emerald-500 px-3 py-1.5 text-[0.85em] text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
          >
            <PlayArrowIcon fontSize="small" /> Play
          </button>

          {/* Pause / Resume */}
          <button
            type="button"
            onClick={() => onControlClick(isPaused ? "resume" : "pause")}
            disabled={!isQueueRunning && !isPaused}
            className="flex items-center gap-1.5 rounded-xl border border-amber-400 bg-amber-50 px-3 py-1.5 text-[0.85em] text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400 transition-colors"
          >
            {isPaused ? (
              <><PlayArrowIcon fontSize="small" /> Resume</>
            ) : (
              <><PauseIcon fontSize="small" /> Pause</>
            )}
          </button>

          {/* Stop */}
          <button
            type="button"
            onClick={onCancelClick}
            className="flex items-center gap-1.5 rounded-xl border border-red-300 px-3 py-1.5 text-[0.85em] text-red-600 hover:bg-red-50 transition-colors"
          >
            <StopIcon fontSize="small" />
            Stop
          </button>
        </div>
      </div>
    </section>
  );
}
