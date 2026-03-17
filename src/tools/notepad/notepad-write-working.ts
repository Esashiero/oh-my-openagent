/**
 * Notepad Write Working Tool
 *
 * Add an entry to Working Memory section with timestamp.
 */

import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { addWorkingMemoryEntry, initNotepad } from "../../hooks/notepad"

export const notepad_write_working: ToolDefinition = tool({
  description: "Add an entry to Working Memory section. Entries are timestamped and auto-pruned after 7 days.",
  args: {
    content: tool.schema.string().max(4000).describe("Content to add as a new entry"),
    workingDirectory: tool.schema.string().describe("Working directory"),
  },
  async execute(args) {
    try {
      const { content, workingDirectory } = args

      // Ensure notepad is initialized
      initNotepad(workingDirectory)

      const success = addWorkingMemoryEntry(workingDirectory, content)

      if (!success) {
        return "Failed to add entry to Working Memory. Check file permissions."
      }

      return `Successfully added entry to Working Memory (${content.length} chars)`
    } catch (error) {
      return `Error writing to Working Memory: ${error instanceof Error ? error.message : String(error)}`
    }
  },
})
