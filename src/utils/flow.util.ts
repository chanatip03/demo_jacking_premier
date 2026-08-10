import { ChaniableTypes } from "../constants"
import type { FlowNode } from "../providers/robot.provider";
import type {
  ButtonAction,
  QueueStep,
  WebsocketGroup,
} from "../types";

export function traceChain(
  startNode: FlowNode,
  nodeMap: Map<string, FlowNode>,
): Omit<QueueStep, "key" | "label" | "jobId" | "isJobStart">[] {
  const steps = [];
  const visited = new Set<string>();

  let current: FlowNode | undefined = startNode;

  while (current?.type && ChaniableTypes.has(current.type)) {
    if (!current.id || visited.has(current.id)) break;

    visited.add(current.id);

    steps.push({
      id: current.id,
      poi: (current.poi as string) ?? "",
      type: current.type,
      operation: current.operation as string | undefined,
    });

    current = current.wires?.[0]?.[0]
      ? nodeMap.get(current.wires[0][0])
      : undefined;
  }

  return steps;
}

export function buildWebsocketGroups(
  tabNodes: FlowNode[],
  nodeMap: Map<string, FlowNode>,
): WebsocketGroup[] {
  return tabNodes
    .filter((node) => node.type === "websocket in" && node.name === "Robot task")
    .map((websocket) => {
      const switches = (websocket.wires?.flat() ?? [])
        .map((id) => nodeMap.get(id))
        .filter((node): node is FlowNode => node?.type === "switch");

      return {
        websocket: websocket.name || "Websocket",
        sections: switches.map((switchNode) => ({
          name: switchNode.name || "Switch",
          buttons: (switchNode.rules ?? [])
            .map((rule, index): ButtonAction | null => {
              const target = switchNode.wires?.[index]?.[0]
                ? nodeMap.get(switchNode.wires[index][0])
                : undefined;

              return target && rule.v
                ? { text: rule.v, target }
                : null;
            })
            .filter(
              (button): button is ButtonAction =>
                button !== null,
            ),
        })),
      };
    });
}