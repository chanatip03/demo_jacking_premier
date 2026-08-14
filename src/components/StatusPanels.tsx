import Battery60Icon from "@mui/icons-material/Battery60";
import BatteryChargingFullIcon from "@mui/icons-material/BatteryChargingFull";
import SpeedIcon from "@mui/icons-material/Speed";
import RotateRightIcon from "@mui/icons-material/RotateRight";
import { BatteryData } from "@/core/interface/battery";
import { CurrentPOI } from "@/core/interface/poi";
import { SpeedData } from "@/core/interface/speed";
import {
  getBatteryColor,
  computeLinearSpeed,
  computeAngularVelocity,
} from "@/utils";

interface StatusPanelsProps {
  battery: BatteryData | null;
  currentPoi: CurrentPOI | null;
  speed: SpeedData | null;
}

export function StatusPanels({
  battery,
  currentPoi,
  speed,
}: Readonly<StatusPanelsProps>) {
  const batteryPercent =
    typeof battery?.soc === "number" ? Math.round(battery.soc) : null;

  const isCharging = !!battery?.is_charging;
  const batteryColor = getBatteryColor(batteryPercent);

  const linearSpeed =
    speed != null ? computeLinearSpeed(speed.vx, speed.vy) : null;

  const angularVelocity =
    speed != null ? computeAngularVelocity(speed.w) : null;

  const isMoving = !speed?.is_stop;
  const speedColor = isMoving ? "#10B981" : "#9CA3AF";

  return (
    <div className="grid w-full grid-cols-3 gap-3">
      {/* Position */}
      <section className="flex min-h-[9rem] flex-col justify-between rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-[0.75em] font-semibold uppercase tracking-wide text-gray-400">
          Position
        </p>

        {currentPoi ? (
          <>
            <p className="text-[2em] font-bold leading-tight">
              {currentPoi.POI || "-"}
            </p>

            <p className="font-mono text-[0.7em] text-gray-400">
              x:{currentPoi.x?.toFixed?.(2) ?? "-"}
              y:{currentPoi.y?.toFixed?.(2) ?? "-"}
              θ:{currentPoi.angle?.toFixed?.(0) ?? "-"}°
            </p>
          </>
        ) : (
          <p className="text-[0.8em] text-gray-400">No data</p>
        )}
      </section>

      {/* Speed */}
      <section className="flex min-h-[9rem] flex-col justify-between rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-[0.75em] font-semibold uppercase tracking-wide text-gray-400">
          Speed
        </p>

        <div className="flex flex-col gap-2">
          {/* Linear Speed */}
          <div className="flex items-center gap-3">
            <SpeedIcon style={{ color: speedColor, fontSize: "2.2em" }} />
            <div>
              <p className="text-[1.5em] font-bold leading-none">
                {linearSpeed != null ? linearSpeed.toFixed(2) : "0.00"}
                <span className="ml-1 text-[0.55em] font-normal text-gray-400">
                  m/s
                </span>
              </p>
              <p className="text-[0.7em] text-gray-400">
                vx:{speed?.vx?.toFixed(2) ?? "0.00"} vy:
                {speed?.vy?.toFixed(2) ?? "0.00"}
              </p>
            </div>
          </div>

          {/* Angular Velocity */}
          <div className="flex items-center gap-3">
            <RotateRightIcon
              style={{
                color: (angularVelocity ?? 0) !== 0 ? "#6366F1" : "#9CA3AF",
                fontSize: "2.2em",
                transform:
                  (angularVelocity ?? 0) < -0.5 ? "scaleX(-1)" : "none",
              }}
            />
            <div>
              <p className="text-[1.5em] font-bold leading-none">
                {angularVelocity != null
                  ? Math.abs(angularVelocity).toFixed(2)
                  : "0.00"}
                <span className="ml-1 text-[0.55em] font-normal text-gray-400">
                  rad/s
                </span>
              </p>
              <p className="text-[0.7em] text-gray-400">
                {(angularVelocity ?? 0) > 0.5
                  ? "↻ Right"
                  : (angularVelocity ?? 0) < -0.5
                    ? "↺ Left"
                    : "—"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Battery */}
      <section className="flex min-h-[9rem] flex-col gap-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-[0.75em] font-semibold uppercase tracking-wide text-gray-400">
          Battery
        </p>

        <div className="flex items-center justify-center gap-2">
          {isCharging ? (
            <BatteryChargingFullIcon
              style={{
                color: batteryColor,
                fontSize: "3.5em",
              }}
            />
          ) : (
            <Battery60Icon
              style={{
                color: batteryColor,
                fontSize: "3.5em",
              }}
            />
          )}

          <p
            className="text-[3em] font-bold leading-none"
            style={{ color: batteryColor }}
          >
            {batteryPercent ?? "-"}
            <span className="ml-1 text-[0.35em] font-normal">%</span>
          </p>
        </div>
      </section>
    </div>
  );
}
