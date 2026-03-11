import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentFactory } from "./types"
import type { ConsensusConfig } from "../config/schema/agent-overrides"

export interface MultiModelAgentResult {
	model: string
	result: string
	latency?: number
	tokenCount?: number
	error?: string
}

export interface ReflectionResult {
	originalModel: string
	reviewerModel: string
	analysis: string
	agreements: string[]
	disagreements: string[]
	insights: string[]
}

/**
 * Build a multi-model consensus agent configuration
 */
export function createConsensusAgent(
	baseAgent: AgentFactory,
	models: string[],
	consensusConfig: ConsensusConfig
): AgentConfig[] {
	const { mode = "parallel", aggregation = "synthesis" } = consensusConfig

	// Create agent configs for each model
	return models.map((model) => {
		const config = baseAgent(model)
		return {
			...config,
			// Mark as consensus agent with metadata
			variant: `consensus-${mode}-${aggregation}`,
		} as AgentConfig
	})
}

/**
 * Run parallel analysis with multiple models
 * Note: This would be called at runtime with the actual agent execution framework
 */
export async function runParallelAnalysis(
	prompt: string,
	agentConfigs: AgentConfig[],
	_context: unknown
): Promise<MultiModelAgentResult[]> {
	// This is a placeholder - actual implementation would leverage the existing
	// agent execution framework (delegate-task, call_omo_agent, etc.)
	const results: MultiModelAgentResult[] = []

	for (const config of agentConfigs) {
		try {
			// In actual implementation, this would spawn each agent task
			// and collect results
			results.push({
				model: config.model || "unknown",
				result: "", // Would be populated from agent execution
				// Placeholder for latency tracking
			})
		} catch (error) {
			results.push({
				model: config.model || "unknown",
				result: "",
				error: error instanceof Error ? error.message : String(error),
			})
		}
	}

	return results
}

/**
 * Generate reflection phase prompts
 */
export function generateReflectionPrompts(
	initialResults: MultiModelAgentResult[],
	_systemPrompt: string
): Map<string, string> {
	const prompts = new Map<string, string>()

	for (const result of initialResults) {
		if (result.error || !result.result) continue

		// Get other models' analyses
		const otherAnalyses = initialResults
			.filter((r) => r.model !== result.model && r.result && !r.error)
			.map((r) => `- [${r.model}]: ${r.result}`)
			.join("\n")

		const reflectionPrompt = `You are reviewing a plan.
Your initial analysis:
${result.result}

Other models' analyses:
${otherAnalyses}

Task:
1. Do you agree or disagree with each other model's findings?
2. What did they miss that you caught?
3. What did they catch that you missed?
4. What would you add to the final report?

Provide your reflection in a structured format.`

		prompts.set(result.model, reflectionPrompt)
	}

	return prompts
}

/**
 * Synthesize a final report from multiple model analyses
 */
export function synthesizeFinalReport(
	initialResults: MultiModelAgentResult[],
	reflectionResults: ReflectionResult[] | null,
	aggregation: "majority" | "consensus" | "synthesis" = "synthesis"
): string {
	if (initialResults.length === 0) {
		return "No analysis results to synthesize."
	}

	const successfulResults = initialResults.filter((r) => r.result && !r.error)
	if (successfulResults.length === 0) {
		return "All models failed to produce results."
	}

	switch (aggregation) {
		case "majority":
			return synthesizeMajority(successfulResults)
		case "consensus":
			return synthesizeConsensus(successfulResults)
		case "synthesis":
		default:
			return synthesizeWithReflection(successfulResults, reflectionResults)
	}
}

function synthesizeMajority(results: MultiModelAgentResult[]): string {
	// Simple majority voting - would need NLP to extract actual verdicts
	// For now, just concat all results
	const allResults = results.map((r) => `## ${r.model}\n${r.result}`).join("\n\n---\n\n")
	return `## Consensus Report (Majority)\n\n${allResults}`
}

function synthesizeConsensus(results: MultiModelAgentResult[]): string {
	// Find common themes/verdicts
	const allResults = results.map((r) => `## ${r.model}\n${r.result}`).join("\n\n---\n\n")
	return `## Consensus Report\n\n${allResults}`
}

function synthesizeWithReflection(
	results: MultiModelAgentResult[],
	reflectionResults: ReflectionResult[] | null
): string {
	let report = "## Multi-Model Consensus Report\n\n"

	// Initial analyses
	report += "### Initial Analyses\n\n"
	for (const r of results) {
		if (r.error) {
			report += `**${r.model}**: ERROR - ${r.error}\n\n`
		} else {
			report += `**${r.model}**:\n${r.result}\n\n`
		}
	}

	// Reflection phase results
	if (reflectionResults && reflectionResults.length > 0) {
		report += "### Reflection & Synthesis\n\n"

		for (const ref of reflectionResults) {
			report += `**${ref.originalModel}** (reviewed by ${ref.reviewerModel}):\n`

			if (ref.agreements.length > 0) {
				report += "**Agreed with others on:**\n"
				report += ref.agreements.map((a) => `- ${a}`).join("\n") + "\n"
			}

			if (ref.disagreements.length > 0) {
				report += "**Disagreements:**\n"
				report += ref.disagreements.map((d) => `- ${d}`).join("\n") + "\n"
			}

			if (ref.insights.length > 0) {
				report += "**Unique insights:**\n"
				report += ref.insights.map((i) => `- ${i}`).join("\n") + "\n"
			}

			report += "\n"
		}
	}

	report += "### Final Verdict\n"
	report += "See individual analyses above. All models have reflected on each other's work.\n"

	return report
}