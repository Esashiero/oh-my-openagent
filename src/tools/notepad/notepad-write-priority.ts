/**
 * Notepad Write Priority Tool
 *
 * Write to the Priority Context section - replaces existing content.
 */

import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { setPriorityContext, initNotepad } from "../../hooks/notepad"

export const notepad_write_priority: ToolDefinition = tool({
  description:
    "Write to the Priority Context section. This REPLACES the existing content. Keep under 500 chars - this is always loaded at session start.",
  args: {
    content: tool.schema.string().max(2000).describe("Content to write (recommend under 500 chars)"),
    workingDirectory: tool.schema.string().describe("Working directory"),
  },
  async execute(args) {
    try {
      const { content, workingDirectory } = args

      // Ensure notepad is initialized
      initNotepad(workingDirectory)

      setPriorityContext(workingDirectory, content)

      return `Successfully wrote to Priority Context (${content.length} chars)`
    } catch (error) {
      return `Error writing to Priority Context: ${error instanceof Error ? error.message : String(error)}`
    }
  },
})
