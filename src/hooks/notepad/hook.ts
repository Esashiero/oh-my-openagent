/**
 * Notepad Hook
 *
 * Injects notepad priority context on session start
 */

import type { PluginInput } from "@opencode-ai/plugin";
import type { ContextCollector } from "../../features/context-injector";
import { getPriorityContext, formatNotepadContext } from "./index.js";

export function createNotepadHook(
  _ctx: PluginInput,
  collector?: ContextCollector
) {
  return {
    name: "notepad" as const,

    /**
     * On session.start:
     * Get priority context from notepad and inject into context
     */
    "session.start": async (event: {
      sessionID: string;
      workingDirectory: string;
    }): Promise<void> => {
      const { sessionID, workingDirectory } = event;

      try {
        const priorityResult = getPriorityContext(workingDirectory);
        
        if (priorityResult.content && priorityResult.content.trim().length > 0) {
          const context = formatNotepadContext(priorityResult.content);
          if (collector) {
            collector.register(sessionID, {
              id: "notepad-priority",
              source: "notepad",
              content: context,
              priority: "high", // Higher priority than project-memory
            });
          }
        }
      } catch (error) {
        // Log warning but don't crash
        console.warn(
          `[notepad] Failed to load priority context: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
  };
}
