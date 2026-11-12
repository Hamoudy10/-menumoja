import { readTools } from './read.tools';
import { writeTools } from './write.tools';
import type { CommandRole, Tool } from './types';

/**
 * The single registry shared by the read and write layers. The LLM only ever
 * receives tools the caller's role is allowed to use, and the server re-checks
 * that authorization before executing anything.
 */

export const ALL_TOOLS: Tool[] = [...readTools, ...writeTools];

const TOOL_MAP = new Map(ALL_TOOLS.map((tool) => [tool.key, tool]));

export function getTool(key: string): Tool | undefined {
  return TOOL_MAP.get(key);
}

export function normalizeRole(role: unknown): string {
  return String(role ?? '').trim().toLowerCase();
}

export function isToolAllowed(role: unknown, tool: Tool): boolean {
  const normalized = normalizeRole(role);
  return tool.roles.includes(normalized as CommandRole);
}

export function toolsForRole(role: unknown): Tool[] {
  return ALL_TOOLS.filter((tool) => isToolAllowed(role, tool));
}

export interface LlmToolSpec {
  key: string;
  label: string;
  description: string;
  jsonSchema: Record<string, unknown>;
}

export function toLlmToolSpecs(tools: Tool[]): LlmToolSpec[] {
  return tools.map((tool) => ({
    key: tool.key,
    label: tool.label,
    description: tool.description,
    jsonSchema: tool.jsonSchema,
  }));
}

export const TOOL_KEYS = ALL_TOOLS.map((t) => t.key);

export default { ALL_TOOLS, getTool, toolsForRole, isToolAllowed, toLlmToolSpecs, normalizeRole };
