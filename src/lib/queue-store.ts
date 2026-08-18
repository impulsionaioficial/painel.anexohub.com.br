import { QueueCampaignItem } from './types';

const QUEUE_STORAGE_KEY = 'awp_queue_campaigns';

const DEFAULT_PAUSE_ON_ERRORS = ['SENDER_BLOCKED', 'TIMEOUT'] as const;

function normalizeCampaign(campaign: QueueCampaignItem): QueueCampaignItem {
  const contacts = Array.isArray(campaign.contacts)
    ? campaign.contacts.map((contact) => ({
        ...contact,
        selectedForSending: contact.selectedForSending !== false,
        status: contact.status,
        attemptCount: contact.attemptCount || 0,
      }))
    : [];

  return {
    ...campaign,
    contacts,
    selectedInstances: Array.isArray(campaign.selectedInstances) ? campaign.selectedInstances : [],
    errorPolicy: campaign.errorPolicy || { pauseOn: [...DEFAULT_PAUSE_ON_ERRORS] },
    sentCount: contacts.filter((contact) => contact.status === 'sent').length,
    errorCount: contacts.filter((contact) => contact.status === 'error').length,
  };
}

/** Recupera de refresh/fechamento da aba sem reenviar contatos já concluídos. */
export function recoverInterruptedQueueCampaigns(): QueueCampaignItem[] {
  const campaigns = getStoredQueueCampaigns();
  const recovered = campaigns.map((campaign) => {
    if (campaign.status !== 'running' || campaign.id.startsWith('camp_')) return campaign;
    return {
      ...campaign,
      status: 'paused' as const,
      pauseReason: 'A execução foi interrompida pelo recarregamento da página. Revise e clique em Continuar.',
      contacts: campaign.contacts.map((contact) =>
        contact.status === 'sending' ? { ...contact, status: 'pending' as const } : contact
      ),
    };
  });
  saveStoredQueueCampaigns(recovered);
  return recovered;
}

// Load all queue campaigns sorted by order
export function getStoredQueueCampaigns(): QueueCampaignItem[] {
  if (typeof window === 'undefined') return [];
  const saved = sessionStorage.getItem(QUEUE_STORAGE_KEY);
  if (!saved) return [];
  try {
    const parsed: QueueCampaignItem[] = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeCampaign).sort((a, b) => a.order - b.order);
  } catch {
    return [];
  }
}

// Overwrite all queue campaigns
export function saveStoredQueueCampaigns(campaigns: QueueCampaignItem[]): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(campaigns.map(normalizeCampaign)));
}

// Add or upsert a queue campaign
export function addStoredQueueCampaign(campaign: QueueCampaignItem): QueueCampaignItem[] {
  if (typeof window === 'undefined') return [];
  const current = getStoredQueueCampaigns();
  
  const existingIndex = current.findIndex((c) => c.id === campaign.id);
  if (existingIndex >= 0) {
    current[existingIndex] = { ...current[existingIndex], ...campaign };
    saveStoredQueueCampaigns(current);
    return current;
  }

  // Calculate next order
  const maxOrder = current.reduce((max, c) => Math.max(max, c.order || 0), 0);
  const newCamp = {
    ...campaign,
    order: campaign.order || maxOrder + 1,
  };

  const updated = [...current, newCamp];
  saveStoredQueueCampaigns(updated);
  return updated;
}

// Update an existing queue campaign
export function updateStoredQueueCampaign(
  id: string,
  updates: Partial<QueueCampaignItem>
): QueueCampaignItem[] {
  if (typeof window === 'undefined') return [];
  const current = getStoredQueueCampaigns();
  const updated = current.map((c) => (c.id === id ? { ...c, ...updates } : c));
  saveStoredQueueCampaigns(updated);
  return updated;
}

// Delete a queue campaign
export function deleteStoredQueueCampaign(id: string): QueueCampaignItem[] {
  if (typeof window === 'undefined') return [];
  const current = getStoredQueueCampaigns();
  const filtered = current.filter((c) => c.id !== id);
  // Re-index orders
  const reordered = filtered.map((c, idx) => ({ ...c, order: idx + 1 }));
  saveStoredQueueCampaigns(reordered);
  return reordered;
}

// Move queue campaign up or down in order
export function moveQueueCampaign(id: string, direction: 'up' | 'down'): QueueCampaignItem[] {
  if (typeof window === 'undefined') return [];
  const current = getStoredQueueCampaigns();
  const index = current.findIndex((c) => c.id === id);
  if (index === -1) return current;

  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= current.length) return current;

  // Swap
  const temp = current[index];
  current[index] = current[targetIndex];
  current[targetIndex] = temp;

  // Reassign orders
  const updated = current.map((c, idx) => ({ ...c, order: idx + 1 }));
  saveStoredQueueCampaigns(updated);
  return updated;
}
