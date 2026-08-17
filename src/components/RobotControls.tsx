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

export function RobotControls({
  websocketGroups,
  onButtonClick,
}: Readonly<RobotControlsProps>) {
  return (
    <div className="flex min-h-0 flex-col gap-4">
      {websocketGroups.map((group) => (
        <section
          key={group.websocket}
          className="shrink-0 rounded-2xl border-t-4 border-blue-400 bg-white p-4 shadow-lg"
        >
          <h2 className="mb-3 text-[1.2em] font-bold text-blue-700">
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

                <div className="flex flex-wrap gap-2">
                  {section.buttons.map((button) => (
                    <button
                      key={button.target.id}
                      type="button"
                      onClick={() => onButtonClick(button)}
                      className="rounded-xl border border-blue-200 px-3 py-2 text-[0.85em] hover:bg-blue-50"
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
