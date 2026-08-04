import { DetailedReportItem, ScheduledTask } from './types';

// Persistence for Detailed Reports History
export function getStoredReports(): DetailedReportItem[] {
  if (typeof window === 'undefined') return [];
  const saved = localStorage.getItem('awp_detailed_reports');
  if (!saved) return [];
  try {
    return JSON.parse(saved);
  } catch {
    return [];
  }
}

export function addStoredReportItem(item: DetailedReportItem): void {
  if (typeof window === 'undefined') return;
  const current = getStoredReports();
  const updated = [item, ...current.slice(0, 499)]; // Limit to 500 records
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
