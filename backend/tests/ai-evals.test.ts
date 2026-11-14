import { COMMAND_EVAL_CASES, EXPECTED_TOOL_KEYS } from './evals/command-prompts';

/**
 * Dataset validation always runs in CI (free, deterministic).
 * Live LLM accuracy is opt-in: RUN_LIVE_AI_EVALS=1 (costs tokens).
 */

describe('AI command eval dataset', () => {
  it('has at least 50 messy real-world prompts', () => {
    expect(COMMAND_EVAL_CASES.length).toBeGreaterThanOrEqual(50);
  });

  it('covers every registered tool key at least once', () => {
    expect(EXPECTED_TOOL_KEYS).toHaveLength(16);
    const covered = new Set(
      COMMAND_EVAL_CASES.map((c) => c.expectedTool).filter((k): k is string => Boolean(k))
    );
    for (const key of EXPECTED_TOOL_KEYS) {
      expect(covered.has(key)).toBe(true);
    }
  });

  it('includes at least 4 ambiguity cases that must clarify', () => {
    expect(COMMAND_EVAL_CASES.filter((c) => c.ambiguous).length).toBeGreaterThanOrEqual(4);
  });

  it('includes English, Kiswahili and Swanglish prompts', () => {
    for (const language of ['en', 'sw', 'swanglish'] as const) {
      expect(COMMAND_EVAL_CASES.some((c) => c.language === language)).toBe(true);
    }
  });

  it('includes safety cases that must not select a tool', () => {
    const noTool = COMMAND_EVAL_CASES.filter((c) => c.expectedTool === null);
    expect(noTool.length).toBeGreaterThanOrEqual(4);
    expect(noTool.some((c) => /passkey/i.test(c.text))).toBe(true);
    expect(noTool.some((c) => /refund|cancel/i.test(c.text))).toBe(true);
  });

  it('never expects an unknown tool key', () => {
    for (const c of COMMAND_EVAL_CASES) {
      if (c.expectedTool) expect(EXPECTED_TOOL_KEYS).toContain(c.expectedTool);
    }
  });
});

const runLive = process.env.RUN_LIVE_AI_EVALS === '1';

(runLive ? describe : describe.skip)('AI command live tool selection (RUN_LIVE_AI_EVALS=1)', () => {
  it('selects the expected tool for every prompt', async () => {
    const { selectCommandPlan } = await import('@/integrations/openai');
    const { toLlmToolSpecs, toolsForRole } = await import('@/ai/tools');
    const tools = toLlmToolSpecs(toolsForRole('owner'));

    const failures: Array<{ text: string; expected: string | null; got: string | null }> = [];
    for (const testCase of COMMAND_EVAL_CASES) {
      const result = await selectCommandPlan(testCase.text, tools, { role: 'owner' });
      const firstAction = result.actions[0]?.action ?? null;
      if (firstAction !== testCase.expectedTool) {
        failures.push({ text: testCase.text, expected: testCase.expectedTool, got: firstAction });
      }
    }
    expect(failures).toEqual([]);
  }, 300_000);
});
