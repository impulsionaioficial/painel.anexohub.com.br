import { TypingSimulationConfig } from './types';

export const MAX_MESSAGE_PARTS = 10;
export const DEFAULT_TYPING_SIMULATION: TypingSimulationConfig = {
  enabled: true,
  minDelayMs: 1_500,
  maxDelayMs: 3_500,
};

/** `/n` cria outra mensagem; quebras de linha normais continuam no mesmo balão. */
export function splitMessageSequence(message: string): string[] {
  return String(message || '')
    .split(/\/n(?![a-z0-9_])/gi)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function normalizeTypingSimulation(
  config?: Partial<TypingSimulationConfig> | null
): TypingSimulationConfig {
  const enabled = config?.enabled !== false;
  const minDelayMs = Math.max(500, Math.min(15_000, Number(config?.minDelayMs) || DEFAULT_TYPING_SIMULATION.minDelayMs));
  const maxDelayMs = Math.max(minDelayMs, Math.min(20_000, Number(config?.maxDelayMs) || DEFAULT_TYPING_SIMULATION.maxDelayMs));
  return { enabled, minDelayMs, maxDelayMs };
}

export function randomTypingDelay(config?: Partial<TypingSimulationConfig> | null): number | undefined {
  const normalized = normalizeTypingSimulation(config);
  if (!normalized.enabled) return undefined;
  return Math.floor(Math.random() * (normalized.maxDelayMs - normalized.minDelayMs + 1)) + normalized.minDelayMs;
}
