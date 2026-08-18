import { EvolutionConfig } from './types';

export const DEFAULT_CONFIG: EvolutionConfig = {
  baseUrl: 'https://vps.exemplo.com:8084',
  apiKey: 'SUA_EVOLUTION_API_KEY',
  instanceName: 'allwhatspy_instancia',
};

export function getStoredConfig(): EvolutionConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;
  const saved = sessionStorage.getItem('awp_evolution_config');
  if (!saved) return DEFAULT_CONFIG;
  try {
    return JSON.parse(saved);
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveStoredConfig(config: EvolutionConfig): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('awp_evolution_config');
  sessionStorage.setItem('awp_evolution_config', JSON.stringify(config));
}

// Spin-tax parser helper: converts "{Olá|Oi|Tudo bem}" to random choice
export function parseSpintax(text: string): string {
  const spintaxRegex = /\{([^{}]+)\}/g;
  return text.replace(spintaxRegex, (match, choices) => {
    const options = choices.split('|');
    return options[Math.floor(Math.random() * options.length)].trim();
  });
}

// Contact phone formatter helper: ensures DDI + DDD format
export function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  // If user enters 11999998888 (brazil without DDI), append 55
  if (cleaned.length === 10 || cleaned.length === 11) {
    cleaned = '55' + cleaned;
  }
  return cleaned;
}
