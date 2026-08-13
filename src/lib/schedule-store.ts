import { DetailedReportItem, ScheduledTask } from './types';

// Persistence for Detailed Reports History with automatic deduplication
export function getStoredReports(): DetailedReportItem[] {
  if (typeof window === 'undefined') return [];
  const saved = localStorage.getItem('awp_detailed_reports');
  if (!saved) return [];
  try {
    const parsed: DetailedReportItem[] = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];

    // Deduplicate by unique key: id or (instanceName + phone + sentAt)
    const seen = new Set<string>();
    const cleaned: DetailedReportItem[] = [];

    for (const item of parsed) {
      if (!item) continue;
      const key = item.id ? String(item.id) : `${item.instanceName || 'inst'}_${item.phone}_${item.sentAt}`;
      if (!seen.has(key)) {
        seen.add(key);
        cleaned.push(item);
      }
    }

    // If cleaned list length is different from original (duplicates existed), persist cleaned list
    if (cleaned.length !== parsed.length) {
      localStorage.setItem('awp_detailed_reports', JSON.stringify(cleaned));
    }

    return cleaned;
  } catch {
    return [];
  }
}

export function addStoredReportItem(item: DetailedReportItem): void {
  if (typeof window === 'undefined' || !item) return;
  const current = getStoredReports();
  const itemKey = item.id ? String(item.id) : `${item.instanceName || 'inst'}_${item.phone}_${item.sentAt}`;

  // Check if exists
  const existingIndex = current.findIndex(
    (r) => (r.id && String(r.id) === itemKey) || `${r.instanceName || 'inst'}_${r.phone}_${r.sentAt}` === itemKey
  );

  let updated: DetailedReportItem[];
  if (existingIndex >= 0) {
    // Update existing item in place
    updated = [...current];
    updated[existingIndex] = { ...updated[existingIndex], ...item };
  } else {
    // Prepend new item
    updated = [item, ...current.slice(0, 999)]; // Limit to 1000 records
  }

  localStorage.setItem('awp_detailed_reports', JSON.stringify(updated));
}

export function addStoredReportItems(items: DetailedReportItem[]): void {
  if (typeof window === 'undefined' || !Array.isArray(items) || items.length === 0) return;
  const current = getStoredReports();

  const map = new Map<string, DetailedReportItem>();
  
  // First, index existing items
  for (const r of current) {
    const key = r.id ? String(r.id) : `${r.instanceName || 'inst'}_${r.phone}_${r.sentAt}`;
    map.set(key, r);
  }

  // Next, merge new/updated items
  for (const item of items) {
    if (!item) continue;
    const key = item.id ? String(item.id) : `${item.instanceName || 'inst'}_${item.phone}_${item.sentAt}`;
    const existing = map.get(key);
    if (existing) {
      map.set(key, { ...existing, ...item });
    } else {
      map.set(key, item);
    }
  }

  // Convert back to array (limit to 1000 items)
  const updated = Array.from(map.values()).slice(0, 1000);
  localStorage.setItem('awp_detailed_reports', JSON.stringify(updated));
}

export function saveStoredReports(reports: DetailedReportItem[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('awp_detailed_reports', JSON.stringify(reports.slice(0, 1000)));
}

export function deleteStoredReportItem(id: string): void {
  if (typeof window === 'undefined') return;
  const current = getStoredReports();
  const updated = current.filter((r) => r.id !== id);
  localStorage.setItem('awp_detailed_reports', JSON.stringify(updated));
}

export function deleteStoredReportItems(ids: string[]): void {
  if (typeof window === 'undefined') return;
  const idsSet = new Set(ids);
  const current = getStoredReports();
  const updated = current.filter((r) => !idsSet.has(r.id));
  localStorage.setItem('awp_detailed_reports', JSON.stringify(updated));
}

export function clearStoredReports(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('awp_detailed_reports');
}

// Persistence for Scheduled Tasks
export function getStoredScheduledTasks(): ScheduledTask[] {
  if (typeof window === 'undefined') return [];
  const saved = localStorage.getItem('awp_scheduled_tasks');
  if (!saved) return [];
  try {
    return JSON.parse(saved);
  } catch {
    return [];
  }
}

export function saveStoredScheduledTasks(tasks: ScheduledTask[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('awp_scheduled_tasks', JSON.stringify(tasks));
}

// Calculate Next Run time string for scheduled tasks
export function calculateNextRun(task: ScheduledTask): string {
  if (task.scheduleType === 'once') {
    return task.executeAt ? new Date(task.executeAt).toLocaleString('pt-BR') : 'Sem data definida';
  }

  const now = new Date();
  const interval = task.recurrenceInterval || 1;

  switch (task.recurrenceUnit) {
    case 'minutes':
      now.setMinutes(now.getMinutes() + interval);
      break;
    case 'hours':
      now.setHours(now.getHours() + interval);
      break;
    case 'days':
      now.setDate(now.getDate() + interval);
      break;
    case 'weeks':
      now.setDate(now.getDate() + interval * 7);
      break;
    case 'months':
      now.setMonth(now.getMonth() + interval);
      break;
    default:
      now.setHours(now.getHours() + 1);
  }

  return now.toLocaleString('pt-BR');
}
