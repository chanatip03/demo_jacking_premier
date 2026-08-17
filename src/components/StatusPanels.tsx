import Battery60Icon from "@mui/icons-material/Battery60";
import BatteryChargingFullIcon from "@mui/icons-material/BatteryChargingFull";
import { BatteryData } from "@/core/interface/battery";
import { CurrentPOI } from "@/core/interface/poi";
import { SpeedData } from "@/core/interface/speed";
import { getBatteryColor, computeLinearSpeed } from "@/utils";

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

  return (
    <section className="box-border w-full min-w-0 max-w-full overflow-hidden rounded-2xl border-t-4 border-blue-900 bg-white p-5 shadow-lg">
      <h2 className="mb-4 text-[1.2em] font-bold text-blue-900">Task Queue</h2>

      <div className="grid w-full min-w-0 max-w-full grid-cols-3 gap-3">
        {/* Position */}
        <section className="box-border min-w-0 max-w-full overflow-hidden rounded-xl border border-gray-200 bg-white p-4">
          <p className="mb-4 text-[0.75em] font-semibold uppercase tracking-wide text-gray-400">
            Position
          </p>

          {currentPoi ? (
            <>
              <div className="min-w-0 max-w-full overflow-hidden">
                <p
                  className="block max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[2em] font-bold leading-tight"
                  title={currentPoi.POI || "-"}
                >
                  {currentPoi.POI || "-"}
                </p>
              </div>

              <p className="mt-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[0.7em] text-gray-400">
                x:{currentPoi.x?.toFixed?.(2) ?? "-"} y:
                {currentPoi.y?.toFixed?.(2) ?? "-"}
              </p>
            </>
          ) : (
            <p className="text-[0.8em] text-gray-400">No data</p>
          )}
        </section>

        {/* Speed */}
        <section className="box-border min-w-0 max-w-full overflow-hidden rounded-xl border border-gray-200 bg-white p-4">
          <p className="mb-4 text-[0.75em] font-semibold uppercase tracking-wide text-gray-400">
            Speed
          </p>

          <div className="flex min-w-0 justify-center">
            <div className="min-w-0 max-w-full overflow-hidden">
              <p className="whitespace-nowrap pb-3 text-[1.5em] font-bold leading-none">
                {linearSpeed != null ? linearSpeed.toFixed(2) : "0.00"}
                <span className="ml-1 text-[0.55em] font-normal text-gray-400">
                  m/s
                </span>
              </p>

              <p className="whitespace-nowrap text-[0.7em] text-gray-400">
                {speed?.vx != null && speed?.vx > 0
                  ? `vx:${speed?.vx?.toFixed(2)}`
                  : "vx:0.00"}
                {speed?.vy != null && speed?.vy > 0
                  ? `vy:${speed?.vy?.toFixed(2)}`
                  : "vy:0.00"}
              </p>
            </div>
          </div>
        </section>

        {/* Battery */}
        <section className="box-border min-w-0 max-w-full overflow-hidden rounded-xl border border-gray-200 bg-white">
          <p className="mb-4 p-4 pb-0 text-[0.75em] font-semibold uppercase tracking-wide text-gray-400">
            Battery
          </p>

          <div className="flex min-w-0 items-center justify-center overflow-hidden">
            {isCharging ? (
              <BatteryChargingFullIcon
                style={{
                  color: batteryColor,
                  fontSize: "2.75em",
                  flexShrink: 0,
                }}
              />
            ) : (
              <Battery60Icon
                style={{
                  color: batteryColor,
                  fontSize: "2.75em",
                  flexShrink: 0,
                }}
              />
            )}

            <p
              className="min-w-0 whitespace-nowrap text-[2.75em] font-bold leading-none"
              style={{ color: batteryColor }}
            >
              {batteryPercent ?? "-"}
            </p>
          </div>
        </section>
      </div>
    </section>
  );
}
