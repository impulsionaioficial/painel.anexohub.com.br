import { CampaignRestConfig } from './types';

export const DEFAULT_CAMPAIGN_REST: CampaignRestConfig = {
  enabled: false,
  everyMessages: 50,
  durationSeconds: 300,
};

export function normalizeCampaignRest(config?: Partial<CampaignRestConfig> | null): CampaignRestConfig {
  return {
    enabled: config?.enabled === true,
    everyMessages: Math.max(1, Math.min(10_000, Math.floor(Number(config?.everyMessages) || DEFAULT_CAMPAIGN_REST.everyMessages))),
    durationSeconds: Math.max(1, Math.min(86_400, Math.floor(Number(config?.durationSeconds) || DEFAULT_CAMPAIGN_REST.durationSeconds))),
  };
}

export function normalizeCampaignDelay(minDelay: unknown, maxDelay: unknown): { minDelay: number; maxDelay: number } {
  const safeMin = Math.max(2, Math.min(3_600, Math.floor(Number(minDelay) || 10)));
  const safeMax = Math.max(safeMin, Math.min(3_600, Math.floor(Number(maxDelay) || 25)));
  return { minDelay: safeMin, maxDelay: safeMax };
}
