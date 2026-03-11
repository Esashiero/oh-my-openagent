import type { DelegateTaskArgs, ToolContextWithMetadata, DelegateTaskToolOptions } from "./types"
import type { ExecutorContext, ParentContext } from "./executor-types"
import type { ConsensusConfig } from "../../config/schema/agent-overrides"
import type { AvailableCategory, AvailableSkill } from "../../agents/dynamic-agent-prompt-builder"
import { log } from "../../shared/logger"
import { buildSystemContent } from "./prompt-builder"
import { normalizeModelFormat } from "../../shared/model-format-normalizer"

export async function executeConsensusTask(
  args: DelegateTaskArgs,
  ctx: ToolContextWithMetadata,
  options: DelegateTaskToolOptions,
  parentContext: ParentContext,
  agentToUse: string,
  consensusConfig: ConsensusConfig,
  _skillContent: string | undefined,
  _skillContents: string[],
  _availableCategories: AvailableCategory[],
  _availableSkills: AvailableSkill[]
): Promise<string> {
  const { client } = options
  const models = consensusConfig.models ?? []

  log("[consensus-task] Starting consensus execution", {
    agent: agentToUse,
    models,
    mode: consensusConfig.mode,
  })

  if (!args.prompt) {
    return "Error: No prompt provided for consensus task"
  }

  // Return a message indicating consensus execution
  // The actual parallel execution would go here
  const systemContent = buildSystemContent({
    skillContent: undefined,
    skillContents: [],
    categoryPromptAppend: undefined,
    agentName: agentToUse,
    maxPromptTokens: undefined,
    model: undefined,
    availableCategories: [],
    availableSkills: [],
  })

  return `## Consensus Execution Started

Agent: ${agentToUse}
Models configured: ${models.join(", ")}
Mode: ${consensusConfig.mode ?? "parallel"}
Aggregation: ${consensusConfig.aggregation ?? "synthesis"}

System prompt: ${(systemContent ?? "").substring(0, 200)}...

Prompt: ${args.prompt.substring(0, 300)}...

Note: Full consensus execution with parallel model spawning, reflection phase, and result synthesis is not yet implemented.
This is a stub to verify the consensus config is being read correctly.

To implement full consensus:
1. Create parallel sync sessions for each model
2. Send prompt to each session with model override
3. Poll all sessions for completion
4. If reflection enabled, generate reflection prompts and run second round
5. Synthesize results using the aggregation strategy`
}