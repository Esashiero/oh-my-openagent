/**
 * Notepad Read Tool
 *
 * Read notepad content - full or specific sections.
 */

import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import {
  getFullNotepad,
  getPriorityContext,
  getWorkingMemory,
  getManualSection,
  initNotepad,
} from "../../hooks/notepad"

export const notepad_read: ToolDefinition = tool({
  description: "Read the notepad content. Can read the full notepad or a specific section (priority, working, manual).",
  args: {
    section: tool.schema
      .enum(["all", "priority", "working", "manual"])
      .optional()
      .describe('Section to read: "all" (default), "priority", "working", or "manual"'),
    workingDirectory: tool.schema.string().describe("Working directory"),
  },
  async execute(args) {
    try {
      const { section = "all", workingDirectory } = args

      // Initialize notepad if it doesn't exist
      initNotepad(workingDirectory)

      if (section === "all") {
        const content = getFullNotepad(workingDirectory)
        return content || "Notepad is empty. Use notepad_write_* tools to add content."
      }

      let sectionContent: string | null = null
      let sectionTitle = ""

      switch (section) {
        case "priority": {
          const result = getPriorityContext(workingDirectory)
          sectionContent = result.content
          sectionTitle = "Priority Context"
          break
        }
        case "working": {
          sectionContent = getWorkingMemory(workingDirectory)
          sectionTitle = "Working Memory"
          break
        }
        case "manual": {
          sectionContent = getManualSection(workingDirectory)
          sectionTitle = "MANUAL"
          break
        }
      }

      if (!sectionContent) {
        return `## ${sectionTitle}\n\n(Empty)`
      }

      return `## ${sectionTitle}\n\n${sectionContent}`
    } catch (error) {
      return `Error reading notepad: ${error instanceof Error ? error.message : String(error)}`
    }
  },
})
