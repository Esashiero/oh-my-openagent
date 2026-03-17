/**
 * Notepad Tools
 *
 * MCP tools for reading and writing notepad sections.
 */

import type { ToolDefinition } from "@opencode-ai/plugin"

import { notepad_read } from "./notepad-read"
import { notepad_write_priority } from "./notepad-write-priority"
import { notepad_write_working } from "./notepad-write-working"
import { notepad_write_manual } from "./notepad-write-manual"
import { notepad_prune } from "./notepad-prune"
import { notepad_stats } from "./notepad-stats"

export { notepad_read } from "./notepad-read"
export { notepad_write_priority } from "./notepad-write-priority"
export { notepad_write_working } from "./notepad-write-working"
export { notepad_write_manual } from "./notepad-write-manual"
export { notepad_prune } from "./notepad-prune"
export { notepad_stats } from "./notepad-stats"

/**
 * Notepad tools as a Record (key = tool name)
 */
export const notepadTools: Record<string, ToolDefinition> = {
  notepad_read,
  notepad_write_priority,
  notepad_write_working,
  notepad_write_manual,
  notepad_prune,
  notepad_stats,
}
