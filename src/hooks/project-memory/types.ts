/**
 * Project Memory Type Definitions
 *
 * Schema version: 1.0.0
 * Ported from oh-my-claudecode with adaptations for Bun/Zod v4
 */

export interface ProjectMemoryData {
  version: string;
  lastScanned: number;
  projectRoot: string;
  techStack: TechStackInfo;
  buildCommands: string[];
  testCommands: string[];
  mainDirectories: string[];
  frameworks: FrameworkInfo[];
  notes: ProjectNote[];
  directives: ProjectDirective[];
}

export interface TechStackInfo {
  language: string | null;
  packageManager: string | null;
  runtime: string | null;
}

export interface FrameworkInfo {
  name: string;
  category: "frontend" | "backend" | "fullstack" | "testing" | "build";
}

export interface ProjectNote {
  category: string;
  content: string;
  timestamp: string;
}

export interface ProjectDirective {
  directive: string;
  context?: string;
  priority: "high" | "normal";
}

export interface DetectionResult {
  techStack: TechStackInfo;
  frameworks: FrameworkInfo[];
  buildCommands: string[];
  testCommands: string[];
  mainDirectories: string[];
}

export interface ConfigPattern {
  file: string;
  indicates: {
    language?: string;
    packageManager?: string;
    framework?: string;
  };
}

export const DEFAULT_PROJECT_MEMORY: ProjectMemoryData = {
  version: "1.0.0",
  lastScanned: 0,
  projectRoot: "",
  techStack: {
    language: null,
    packageManager: null,
    runtime: null,
  },
  buildCommands: [],
  testCommands: [],
  mainDirectories: [],
  frameworks: [],
  notes: [],
  directives: [],
};
