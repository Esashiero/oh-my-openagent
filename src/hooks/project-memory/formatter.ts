/**
 * Project Memory Formatter
 *
 * Formats project memory data for context injection.
 */

import type {
  ProjectMemoryData,
  TechStackInfo,
  FrameworkInfo,
} from "./types.js";

/**
 * Format project memory as markdown for context injection
 * Uses <project-memory> XML tags
 */
export function formatForContext(data: ProjectMemoryData): string {
  const lines: string[] = [];

  // Open project-memory tag
  lines.push("<project-memory>");
  lines.push("");

  // User directives (high priority first)
  if (data.directives.length > 0) {
    lines.push("## Directives");
    lines.push("");

    // Sort: high priority first
    const sortedDirectives = [...data.directives].sort((a, b) => {
      if (a.priority === "high" && b.priority !== "high") return -1;
      if (a.priority !== "high" && b.priority === "high") return 1;
      return 0;
    });

    for (const directive of sortedDirectives) {
      const priorityTag = directive.priority === "high" ? "[HIGH] " : "";
      lines.push(`- ${priorityTag}${directive.directive}`);
      if (directive.context) {
        lines.push(`  - Context: ${directive.context}`);
      }
    }
    lines.push("");
  }

  // Tech Stack
  const techStackFormatted = formatTechStack(data.techStack);
  if (techStackFormatted) {
    lines.push("## Tech Stack");
    lines.push("");
    lines.push(techStackFormatted);
    lines.push("");
  }

  // Frameworks
  const frameworksFormatted = formatFrameworks(data.frameworks);
  if (frameworksFormatted) {
    lines.push("## Frameworks");
    lines.push("");
    lines.push(frameworksFormatted);
    lines.push("");
  }

  // Build & Test Commands
  if (data.buildCommands.length > 0 || data.testCommands.length > 0) {
    lines.push("## Commands");
    lines.push("");

    if (data.buildCommands.length > 0) {
      lines.push("**Build:**");
      for (const cmd of data.buildCommands) {
        lines.push(`\`${cmd}\``);
      }
      lines.push("");
    }

    if (data.testCommands.length > 0) {
      lines.push("**Test:**");
      for (const cmd of data.testCommands) {
        lines.push(`\`${cmd}\``);
      }
      lines.push("");
    }
  }

  // Main Directories
  if (data.mainDirectories.length > 0) {
    lines.push("## Key Directories");
    lines.push("");
    for (const dir of data.mainDirectories) {
      lines.push(`- \`${dir}\``);
    }
    lines.push("");
  }

  // Custom Notes
  if (data.notes.length > 0) {
    lines.push("## Notes");
    lines.push("");

    // Group by category
    const byCategory = new Map<string, typeof data.notes>();
    for (const note of data.notes) {
      const existing = byCategory.get(note.category) || [];
      existing.push(note);
      byCategory.set(note.category, existing);
    }

    for (const [category, notes] of byCategory) {
      lines.push(`**${category}:**`);
      for (const note of notes) {
        lines.push(`- ${note.content}`);
      }
      lines.push("");
    }
  }

  // Close project-memory tag
  lines.push("</project-memory>");

  return lines.join("\n");
}

/**
 * Format tech stack summary
 */
export function formatTechStack(techStack: TechStackInfo): string {
  const parts: string[] = [];

  if (techStack.language) {
    parts.push(`Language: \`${techStack.language}\``);
  }

  if (techStack.packageManager) {
    parts.push(`Package Manager: \`${techStack.packageManager}\``);
  }

  if (techStack.runtime) {
    parts.push(`Runtime: \`${techStack.runtime}\``);
  }

  return parts.join(" | ");
}

/**
 * Format framework list
 */
export function formatFrameworks(frameworks: FrameworkInfo[]): string {
  if (frameworks.length === 0) {
    return "";
  }

  // Group by category
  const byCategory = new Map<string, FrameworkInfo[]>();
  for (const fw of frameworks) {
    const existing = byCategory.get(fw.category) || [];
    existing.push(fw);
    byCategory.set(fw.category, existing);
  }

  const lines: string[] = [];

  // Priority order: fullstack, frontend, backend, testing, build
  const priority = ["fullstack", "frontend", "backend", "testing", "build"];

  for (const category of priority) {
    const fws = byCategory.get(category);
    if (fws && fws.length > 0) {
      const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1);
      lines.push(`**${categoryLabel}:** ${fws.map((f) => f.name).join(", ")}`);
    }
  }

  // Add any categories not in priority list
  for (const [category, fws] of byCategory) {
    if (!priority.includes(category)) {
      lines.push(`**${category}:** ${fws.map((f) => f.name).join(", ")}`);
    }
  }

  return lines.join("\n");
}
