import Battery60Icon from "@mui/icons-material/Battery60";
import BatteryChargingFullIcon from "@mui/icons-material/BatteryChargingFull";
import SpeedIcon from "@mui/icons-material/Speed";
import type {
  BatteryData,
  CurrentPOI,
  SpeedData,
} from "../providers/robot.provider";
import { getBatteryColor } from "@/utils";

interface StatusPanelsProps {
  battery: BatteryData | null;
  currentPoi: CurrentPOI | null;
  speed: SpeedData | null;
}

export function StatusPanels({
  battery,
  currentPoi,
  speed,
}: StatusPanelsProps) {
  const batteryPercent =
    typeof battery?.soc === "number" ? Math.round(battery.soc) : null;
  const isCharging = !!battery?.is_charging;
  const batteryColor = getBatteryColor(batteryPercent);

  return (
    <div className="grid grid-cols-3 gap-3">
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Position
        </p>
        {currentPoi ? (
          <>
            <p className="text-2xl font-bold leading-tight">
              {currentPoi.POI || "-"}
            </p>
            <p className="font-mono text-xs text-gray-400">
              x:{currentPoi.x?.toFixed?.(2) ?? "-"} y:
              {currentPoi.y?.toFixed?.(2) ?? "-"} θ:
              {currentPoi.angle?.toFixed?.(0) ?? "-"}°
            </p>
          </>
        ) : (
          <p className="text-sm text-gray-400">No data</p>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Speed
        </p>
        <div className="flex items-center gap-2">
          <SpeedIcon
            style={{
              color: speed?.is_stop ? "#9CA3AF" : "#10B981",
              fontSize: 22,
            }}
          />
          <p className="text-2xl font-bold leading-tight">
            {speed?.vx?.toFixed?.(2) ?? "0.00"}
            <span className="ml-1 text-xs font-normal text-gray-400">m/s</span>
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Battery
        </p>
        <div className="flex items-center gap-2">
          {isCharging ? (
            <BatteryChargingFullIcon
              style={{ color: batteryColor, fontSize: 22 }}
            />
          ) : (
            <Battery60Icon style={{ color: batteryColor, fontSize: 22 }} />
          )}
          <p
            className="text-2xl font-bold leading-tight"
            style={{ color: batteryColor }}
          >
            {batteryPercent ?? "-"}%
          </p>
        </div>
      </section>
    </div>
  );
}
