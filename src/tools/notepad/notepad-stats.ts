/**
 * Notepad Stats Tool
 *
 * Get statistics about the notepad.
 */

import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { getNotepadStats, initNotepad } from "../../hooks/notepad"

export const notepad_stats: ToolDefinition = tool({
  description: "Get statistics about the notepad (size, entry count, oldest entry).",
  args: {
    workingDirectory: tool.schema.string().describe("Working directory"),
  },
  async execute(args) {
    try {
      const { workingDirectory } = args

      // Initialize notepad if it doesn't exist
      initNotepad(workingDirectory)

      const stats = getNotepadStats(workingDirectory)

      const lines = [
        "## Notepad Statistics",
        `- **Total Size:** ${stats.totalSize} bytes`,
        `- **Priority Context Size:** ${stats.prioritySize} bytes`,
        `- **Working Memory Entries:** ${stats.workingMemoryEntries}`,
        `- **Working Memory Size:** ${stats.workingMemorySize} bytes`,
        `- **MANUAL Entries:** ${stats.manualEntries}`,
        `- **MANUAL Size:** ${stats.manualSize} bytes`,
        `- **Oldest Entry:** ${stats.oldestEntry || "None"}`,
      ]

      return lines.join("\n")
    } catch (error) {
      return `Error getting notepad stats: ${error instanceof Error ? error.message : String(error)}`
    }
  },
})
