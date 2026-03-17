import type { BackgroundManager } from "../../features/background-agent"
import {
  clearCompactionAgentConfigCheckpoint,
  setCompactionAgentConfigCheckpoint,
} from "../../shared/compaction-agent-config-checkpoint"
import { log } from "../../shared/logger"
import { COMPACTION_CONTEXT_PROMPT } from "./compaction-context-prompt"
import { resolveSessionPromptConfig } from "./session-prompt-config-resolver"
import { finalizeTrackedAssistantMessage, shouldTreatAssistantPartAsOutput, trackAssistantOutput, type TailMonitorState } from "./tail-monitor"
import { resolveSessionID } from "./session-id"
import type { CompactionContextClient, CompactionContextInjector } from "./types"
import { createRecoveryLogic } from "./recovery"
import { getPriorityContext } from "../../hooks/notepad"
import { loadMemory } from "../../hooks/project-memory/storage"
import { formatForContext } from "../../hooks/project-memory/formatter"

export function createCompactionContextInjector(options?: {
  ctx?: CompactionContextClient
  backgroundManager?: BackgroundManager
}): CompactionContextInjector {
  const ctx = options?.ctx
  const backgroundManager = options?.backgroundManager
  const tailStates = new Map<string, TailMonitorState>()

  const getTailState = (sessionID: string): TailMonitorState => {
    const existing = tailStates.get(sessionID)
    if (existing) {
      return existing
    }

    const created: TailMonitorState = {
      currentHasOutput: false,
      consecutiveNoTextMessages: 0,
    }
    tailStates.set(sessionID, created)
    return created
  }

  const { recoverCheckpointedAgentConfig, maybeWarnAboutNoTextTail } = createRecoveryLogic(ctx, getTailState)

  const capture = async (sessionID: string): Promise<void> => {
    if (!ctx || !sessionID) {
      return
    }

    const promptConfig = await resolveSessionPromptConfig(ctx, sessionID)
    if (!promptConfig.agent && !promptConfig.model && !promptConfig.tools) {
      return
    }

    setCompactionAgentConfigCheckpoint(sessionID, promptConfig)
    log(`[compaction-context-injector] Captured agent checkpoint before compaction`, {
      sessionID,
      agent: promptConfig.agent,
      model: promptConfig.model,
      hasTools: !!promptConfig.tools,
    })
  }

  const inject = (sessionID?: string, workingDirectory?: string): string => {
    let prompt = COMPACTION_CONTEXT_PROMPT

    if (backgroundManager && sessionID) {
      const history = backgroundManager.taskHistory.formatForCompaction(sessionID)
      if (history) {
        prompt += `\n### Active/Recent Delegated Sessions\n${history}\n`
      }
    }

    // Add notepad priority context if available
    if (workingDirectory) {
      try {
        const priorityResult = getPriorityContext(workingDirectory)
        if (priorityResult.content && priorityResult.content.trim().length > 0) {
          prompt += `\n### Notepad Priority Context\n<notepad-priority>\n${priorityResult.content}\n</notepad-priority>\n`
        }
      } catch {
        // Notepad read failed - continue without it
      }

      // Add project memory context if available
      try {
        const memoryData = loadMemory(workingDirectory)
        if (memoryData && (memoryData.techStack.language || memoryData.frameworks.length > 0)) {
          const memoryContext = formatForContext(memoryData)
          if (memoryContext.trim().length > 0) {
            prompt += `\n### Project Memory\n${memoryContext}\n`
          }
        }
      } catch {
        // Project memory read failed - continue without it
      }
    }

    return prompt
  }

  const event = async ({ event }: { event: { type: string; properties?: unknown } }): Promise<void> => {
    const props = event.properties as Record<string, unknown> | undefined

    if (event.type === "session.deleted") {
      const sessionID = resolveSessionID(props)
      if (sessionID) {
        clearCompactionAgentConfigCheckpoint(sessionID)
        tailStates.delete(sessionID)
      }
      return
    }

    if (event.type === "session.idle") {
      const sessionID = resolveSessionID(props)
      if (!sessionID) {
        return
      }

      const noTextCount = finalizeTrackedAssistantMessage(getTailState(sessionID))
      if (noTextCount > 0) {
        await maybeWarnAboutNoTextTail(sessionID)
      }
      return
    }

    if (event.type === "session.compacted") {
      const sessionID = resolveSessionID(props)
      if (!sessionID) {
        return
      }

      const tailState = getTailState(sessionID)
      finalizeTrackedAssistantMessage(tailState)
      tailState.lastCompactedAt = Date.now()
      await maybeWarnAboutNoTextTail(sessionID)
      await recoverCheckpointedAgentConfig(sessionID, "session.compacted")
      return
    }

    if (event.type === "message.updated") {
      const info = props?.info as {
        id?: string
        role?: string
        sessionID?: string
      } | undefined

      if (!info?.sessionID || info.role !== "assistant" || !info.id) {
        return
      }

      const tailState = getTailState(info.sessionID)
      if (tailState.currentMessageID && tailState.currentMessageID !== info.id) {
        finalizeTrackedAssistantMessage(tailState)
        await maybeWarnAboutNoTextTail(info.sessionID)
      }

      if (tailState.currentMessageID !== info.id) {
        tailState.currentMessageID = info.id
        tailState.currentHasOutput = false
      }
      return
    }

    if (event.type === "message.part.delta") {
      const sessionID = props?.sessionID as string | undefined
      const messageID = props?.messageID as string | undefined
      const field = props?.field as string | undefined
      const delta = props?.delta as string | undefined

      if (!sessionID || field !== "text" || !delta?.trim()) {
        return
      }

      trackAssistantOutput(getTailState(sessionID), messageID)
      return
    }

    if (event.type === "message.part.updated") {
      const part = props?.part as {
        messageID?: string
        sessionID?: string
        type?: string
        text?: string
      } | undefined

      if (!part?.sessionID || !shouldTreatAssistantPartAsOutput(part)) {
        return
      }

      trackAssistantOutput(getTailState(part.sessionID), part.messageID)
    }
  }

  return { capture, inject, event }
}
