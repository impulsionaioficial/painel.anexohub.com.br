export interface LogItem {
  id: string;
  timestamp: string;
  type: 'success' | 'info' | 'error' | 'warning';
  category: string;
  message: string;
}

const STORAGE_KEY = 'allwhatspy_evolution_logs_history_v1';

export function getStoredLogsHistory(): LogItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredLogsHistory(logs: LogItem[]) {
  if (typeof window === 'undefined') return;
  try {
    // Keep max 200 items in persistent storage
    const trimmed = logs.slice(0, 200);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Ignore storage quota
  }
}

export function addStoredLogItem(item: LogItem) {
  const current = getStoredLogsHistory();
  // Avoid duplicate ID
  if (current.some((l) => l.id === item.id)) return;
  const updated = [item, ...current].slice(0, 200);
  saveStoredLogsHistory(updated);
}
