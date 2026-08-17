import { FlowNode } from "@/core/interface/flow";

interface RobotControlsProps {
  websocketGroups: Array<{
    websocket: string;
    sections: Array<{
      name: string;
      buttons: { text: string; target: FlowNode }[];
    }>;
  }>;
  onButtonClick: (button: { text: string; target: FlowNode }) => void;
}

function getButtonClass(text: string) {
  const name = text.toLowerCase();

  if (name.includes("charge")) {
    return "bg-green-500 text-white hover:bg-green-600";
  } else if (name.includes("unload")) {
    return "bg-orange-500 text-white hover:bg-orange-600";
  } else if (name.includes("load")) {
    return "bg-blue-500 text-white hover:bg-blue-600";
  }

  return "bg-blue-900 text-white hover:bg-blue-600";
}

export function RobotControls({
  websocketGroups,
  onButtonClick,
}: Readonly<RobotControlsProps>) {
  return (
    <div className="flex min-h-0 flex-col gap-4">
      {websocketGroups.map((group) => (
        <section
          key={group.websocket}
          className="shrink-0 rounded-2xl border-t-4 border-blue-900 bg-white p-4 shadow-lg"
        >
          <h2 className="mb-3 text-[1.2em] font-bold text-blue-900">
            {group.websocket}
          </h2>

          <div className="flex flex-wrap gap-4">
            {group.sections.map((section, sectionIdx) => (
              <div
                key={`${group.websocket}-${sectionIdx}`}
                className="mb-4 min-w-0 last:mb-0"
              >
                <h3 className="mb-2 text-[0.75em] font-semibold uppercase text-gray-500">
                  {section.name}
                </h3>

                <div className="grid grid-cols-3 gap-2 justify-items-center justify-center">
                  {section.buttons.map((button) => (
                    <button
                      key={button.target.id}
                      type="button"
                      onClick={() => onButtonClick(button)}
                      className={`rounded-xl px-4 py-2 text-[0.85em] font-semibold transition-colors ${getButtonClass(
                        button.text,
                      )}`}
                    >
                      {button.text}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
