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
    <div className="grid w-full grid-cols-3 gap-3">
      {/* Position */}
      <section className="flex  flex-col rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-[0.75em] font-semibold uppercase tracking-wide text-gray-400 pb-4">
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
            </p>
          </>
        ) : (
          <p className="text-[0.8em] text-gray-400">No data</p>
        )}
      </section>

      {/* Speed */}
      <section className="flex flex-col rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-[0.75em] font-semibold uppercase tracking-wide text-gray-400 pb-4">
          Speed
        </p>

        <div className="flex flex-col gap-2">
          {/* Linear Speed */}
          <div className="flex  flex-col items-center gap-3">
            <div>
              <p className="text-[1.5em] font-bold leading-none pb-3">
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
        </div>
      </section>

      {/* Battery */}
      <section className="flex flex-col rounded-xl border border-gray-200 bg-white">
        <p className="text-[0.75em] font-semibold uppercase tracking-wide text-gray-400 p-4 pb-4">
          Battery
        </p>

        <div className="flex flex-rows justify-center">
          {isCharging ? (
            <BatteryChargingFullIcon
              style={{
                color: batteryColor,
                fontSize: "2.75em",
              }}
            />
          ) : (
            <Battery60Icon
              style={{
                color: batteryColor,
                fontSize: "2.75em",
              }}
            />
          )}

          <p
            className="text-[2.75em] font-bold leading-none"
            style={{ color: batteryColor }}
          >
            {batteryPercent ?? "-"}
          </p>
        </div>
      </section>
    </div>
  );
}
