/**
 * Notepad Write Manual Tool
 *
 * Add an entry to MANUAL section - never auto-pruned.
 */

import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { addManualEntry, initNotepad } from "../../hooks/notepad"

export const notepad_write_manual: ToolDefinition = tool({
  description: "Add an entry to the MANUAL section. Content in this section is never auto-pruned.",
  args: {
    content: tool.schema.string().max(4000).describe("Content to add as a new entry"),
    workingDirectory: tool.schema.string().describe("Working directory"),
  },
  async execute(args) {
    try {
      const { content, workingDirectory } = args

      // Ensure notepad is initialized
      initNotepad(workingDirectory)

      const success = addManualEntry(workingDirectory, content)

      if (!success) {
        return "Failed to add entry to MANUAL section. Check file permissions."
      }

      return `Successfully added entry to MANUAL section (${content.length} chars)`
    } catch (error) {
      return `Error writing to MANUAL: ${error instanceof Error ? error.message : String(error)}`
    }
  },
})
