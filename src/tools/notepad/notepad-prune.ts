/**
 * Notepad Prune Tool
 *
 * Prune Working Memory entries older than N days.
 */

import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { pruneWorkingMemory } from "../../hooks/notepad"
import { DEFAULT_NOTEPAD_CONFIG } from "../../hooks/notepad/constants"

export const notepad_prune: ToolDefinition = tool({
  description: "Prune Working Memory entries older than N days (default: 7 days).",
  args: {
    daysOld: tool.schema
      .number()
      .min(1)
      .max(365)
      .optional()
      .describe("Remove entries older than this many days (default: 7)"),
    workingDirectory: tool.schema.string().describe("Working directory"),
  },
  async execute(args) {
    try {
      const { daysOld = DEFAULT_NOTEPAD_CONFIG.workingMemoryDays, workingDirectory } = args

      const result = pruneWorkingMemory(workingDirectory, daysOld)

      return `## Prune Results\n\n- Pruned: ${result.pruned} entries\n- Remaining: ${result.remaining} entries\n- Threshold: ${daysOld} days`
    } catch (error) {
      return `Error pruning notepad: ${error instanceof Error ? error.message : String(error)}`
    }
  },
})
