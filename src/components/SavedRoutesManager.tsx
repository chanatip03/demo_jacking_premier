import CodeIcon from "@mui/icons-material/Code";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import PlaylistPlayIcon from "@mui/icons-material/PlaylistPlay";
import RouteIcon from "@mui/icons-material/Route";
import type { SavedRoute } from "../types";

interface SavedRoutesManagerProps {
  savedRoutes: SavedRoute[];
  expandedRouteId: string | null;
  onAddRouteToQueue: (route: SavedRoute) => void;
  onToggleRouteJson: (id: string) => void;
  onDeleteRoute: (id: string) => void;
}

export function SavedRoutesManager({
  savedRoutes,
  expandedRouteId,
  onAddRouteToQueue,
  onToggleRouteJson,
  onDeleteRoute,
}: Readonly<SavedRoutesManagerProps>) {
  if (savedRoutes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-200 py-16 text-center text-gray-400">
        <RouteIcon />
        <p className="text-sm">
          No saved routes yet — build a queue on the Dashboard and use{" "}
          <span className="font-medium text-gray-500">Save</span> to store it
          here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {savedRoutes.map((route) => (
        <div
          key={route.id}
          className="rounded-xl border border-gray-200 bg-white p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-gray-800">{route.name}</p>
              <p className="text-xs text-gray-400">
                {route.steps.length} steps · saved{" "}
                {new Date(route.savedAt).toLocaleDateString()}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onAddRouteToQueue(route)}
                className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
              >
                <PlaylistPlayIcon style={{ fontSize: 16 }} />
                Add to queue
              </button>
              <button
                onClick={() => onToggleRouteJson(route.id)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 ${
                  expandedRouteId === route.id
                    ? "text-blue-600"
                    : "text-gray-400"
                }`}
              >
                <CodeIcon style={{ fontSize: 18 }} />
              </button>
              <button
                onClick={() => onDeleteRoute(route.id)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500"
              >
                <DeleteOutlineOutlinedIcon style={{ fontSize: 18 }} />
              </button>
            </div>
          </div>

          {expandedRouteId === route.id && (
            <pre className="mt-3 max-h-56 overflow-auto rounded-lg bg-neutral-900 p-3 font-mono text-xs text-emerald-300">
              {JSON.stringify(route.steps, null, 2)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
