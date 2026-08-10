import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import type { ButtonAction } from "../types";

interface RobotControlsProps {
  websocketGroups: Array<{
    websocket: string;
    sections: Array<{
      name: string;
      buttons: ButtonAction[];
    }>;
  }>;
  onButtonClick: (button: ButtonAction) => void;
}

export function RobotControls({
  websocketGroups,
  onButtonClick,
}: Readonly<RobotControlsProps>) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      {websocketGroups.map((group) => (
        <section
          key={group.websocket}
          className="flex flex-1 flex-col rounded-2xl border-t-4 border-blue-400 bg-white p-6 shadow-lg"
        >
          <h2 className="mb-5 text-2xl font-bold text-blue-700">
            {group.websocket}
          </h2>
          <div className="flex flex-wrap gap-6">
            {group.sections.map((section) => (
              <div key={section.name} className="mb-6 last:mb-0">
                <h3 className="mb-3 text-base font-semibold uppercase text-gray-500">
                  {section.name}
                </h3>

                <div className="flex flex-wrap gap-3">
                  {section.buttons.map((button) => (
                    <button
                      key={button.target.id}
                      onClick={() => onButtonClick(button)}
                      className="rounded-xl border border-blue-200 px-5 py-3 text-base hover:bg-blue-50"
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
