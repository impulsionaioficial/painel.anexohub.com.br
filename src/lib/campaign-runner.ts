import { ContactItem, ErrorCategoryType, DetailedReportItem, QueueErrorPolicy } from './types';
import { parseSpintax } from './evolution-store';
import { dispatchWebhookEvent } from './webhook-dispatcher';

export interface BackgroundCampaign {
  id: string;
  title: string;
  status: 'running' | 'paused' | 'completed' | 'stopped';
  contacts: ContactItem[];
  /** Contador de tentativas usado somente para distribuir instâncias. */
  currentIndex: number;
  messageTemplate: string;
  attachment?: { name: string; base64: string; mimetype: string; sizeKb: number };
  enableSpintax: boolean;
  minDelay: number;
  maxDelay: number;
  selectedInstances: string[];
  errorPolicy: QueueErrorPolicy;
  pauseReason?: string;
  lastErrorCategory?: ErrorCategoryType;
  evolutionConfig: { baseUrl: string; apiKey: string };
  startedAt: string;
  completedAt?: string;
  logs: { timestamp: string; phone: string; status: 'success' | 'error' | 'info'; message: string }[];
  reports: DetailedReportItem[];
}

export interface CampaignEditableFields {
  title?: string;
  contacts?: ContactItem[];
  messageTemplate?: string;
  selectedInstances?: string[];
  enableSpintax?: boolean;
  minDelay?: number;
  maxDelay?: number;
  errorPolicy?: QueueErrorPolicy;
  attachment?: { name: string; base64: string; mimetype: string; sizeKb: number } | null;
}

const DEFAULT_ERROR_POLICY: QueueErrorPolicy = { pauseOn: ['SENDER_BLOCKED', 'TIMEOUT'] };
const globalCampaignsMap = new Map<string, BackgroundCampaign>();
const campaignGeneration = new Map<string, number>();
let activeCampaignId: string | null = null;

function categorizeError(errText: string, status: number): { category: ErrorCategoryType; title: string } {
  const text = errText.toLowerCase();
  if (text.includes('not registered') || text.includes('exists: false') || text.includes('exists false') || text.includes('invalid number') || text.includes('not on whatsapp')) {
    return { category: 'NUMBER_NOT_EXISTS', title: '🚫 Número Não Registrado no WhatsApp' };
  }
  if (status === 401 || status === 404 || text.includes('unauthorized') || text.includes('session closed') || text.includes('connection closed') || text.includes('logged out') || text.includes('instance disconnected') || text.includes('instance not found') || text.includes('instance close') || text.includes('not connected')) {
    return { category: 'SENDER_BLOCKED', title: '🔒 Instância/Sessão Desconectada ou Suspensa' };
  }
  if (status === 403 || text.includes('blocked') || text.includes('forbidden') || text.includes('user blocked')) {
    return { category: 'USER_BLOCKED', title: '⛔ Bloqueado pelo Destinatário' };
  }
  if (text.includes('timeout') || text.includes('econnrefused') || text.includes('fetch failed') || status === 408 || status >= 502) {
    return { category: 'TIMEOUT', title: '📡 Timeout / VPS Sem Resposta' };
  }
  return { category: 'UNKNOWN', title: `❌ Erro da API (${status || 'rede'})` };
}

function normalizeContact(contact: ContactItem): ContactItem {
  return {
    ...contact,
    selectedForSending: contact.selectedForSending !== false,
    status: contact.status === 'sending' ? 'pending' : contact.status,
    attemptCount: contact.attemptCount || 0,
  };
}

function normalizeErrorPolicy(policy?: QueueErrorPolicy): QueueErrorPolicy {
  const validCategories: ErrorCategoryType[] = ['NUMBER_NOT_EXISTS', 'SENDER_BLOCKED', 'USER_BLOCKED', 'TIMEOUT', 'UNKNOWN'];
  return {
    pauseOn: Array.isArray(policy?.pauseOn)
      ? policy.pauseOn.filter((category): category is ErrorCategoryType => validCategories.includes(category))
      : [...DEFAULT_ERROR_POLICY.pauseOn],
  };
}

function nextGeneration(id: string): number {
  const generation = (campaignGeneration.get(id) || 0) + 1;
  campaignGeneration.set(id, generation);
  return generation;
}

function launchCampaignLoop(id: string): void {
  const generation = nextGeneration(id);
  void runCampaignLoop(id, generation);
}

export function getActiveCampaign(): BackgroundCampaign | null {
  if (!activeCampaignId) return null;
  return globalCampaignsMap.get(activeCampaignId) || null;
}

export function getCampaignById(id: string): BackgroundCampaign | null {
  return globalCampaignsMap.get(id) || null;
}

export function getAllServerCampaignReports(): DetailedReportItem[] {
  const allReports: DetailedReportItem[] = [];
  globalCampaignsMap.forEach((campaign) => allReports.push(...campaign.reports));
  return allReports;
}

export function controlCampaign(id: string, action: 'pause' | 'resume' | 'stop'): boolean {
  const campaign = globalCampaignsMap.get(id);
  if (!campaign) return false;

  if (action === 'pause') {
    campaign.status = 'paused';
    campaign.pauseReason = campaign.pauseReason || 'Pausada manualmente.';
    nextGeneration(id);
  } else if (action === 'resume') {
    const hasPending = campaign.contacts.some((contact) => contact.selectedForSending !== false && contact.status === 'pending');
    if (!hasPending) return false;
    campaign.status = 'running';
    campaign.pauseReason = undefined;
    campaign.completedAt = undefined;
    launchCampaignLoop(id);
  } else {
    campaign.status = 'stopped';
    campaign.pauseReason = 'Interrompida manualmente. Os contatos pendentes foram preservados.';
    campaign.completedAt = new Date().toLocaleString('pt-BR');
    nextGeneration(id);
  }
  return true;
}

export function updateBackgroundCampaign(
  id: string,
  updates: CampaignEditableFields
): { success: boolean; error?: string; campaign?: BackgroundCampaign } {
  const campaign = globalCampaignsMap.get(id);
  if (!campaign) return { success: false, error: 'Campanha não encontrada no servidor.' };
  if (campaign.status === 'running') return { success: false, error: 'Pause a campanha antes de editar.' };

  if (typeof updates.title === 'string' && updates.title.trim()) campaign.title = updates.title.trim().slice(0, 160);
  if (typeof updates.messageTemplate === 'string') campaign.messageTemplate = updates.messageTemplate.slice(0, 20_000);
  if (typeof updates.enableSpintax === 'boolean') campaign.enableSpintax = updates.enableSpintax;
  if (Number.isFinite(updates.minDelay)) campaign.minDelay = Math.max(2, Math.min(3_600, Number(updates.minDelay)));
  if (Number.isFinite(updates.maxDelay)) campaign.maxDelay = Math.max(campaign.minDelay, Math.min(3_600, Number(updates.maxDelay)));
  if (updates.errorPolicy) campaign.errorPolicy = normalizeErrorPolicy(updates.errorPolicy);
  if (updates.attachment !== undefined) {
    if (updates.attachment?.base64 && updates.attachment.base64.length > 10 * 1024 * 1024) {
      return { success: false, error: 'Anexo acima do limite de 7,5 MB.' };
    }
    campaign.attachment = updates.attachment || undefined;
  }

  if (Array.isArray(updates.selectedInstances)) {
    const instances = [...new Set(updates.selectedInstances.map(String).map((value) => value.trim()).filter(Boolean))];
    if (instances.length === 0 || instances.length > 20) return { success: false, error: 'Selecione entre 1 e 20 instâncias.' };
    campaign.selectedInstances = instances;
  }
  if (Array.isArray(updates.contacts)) {
    if (updates.contacts.length === 0 || updates.contacts.length > 1_000) {
      return { success: false, error: 'A campanha deve conter entre 1 e 1.000 contatos.' };
    }
    campaign.contacts = updates.contacts.map(normalizeContact);
  }

  campaign.pauseReason = undefined;
  campaign.lastErrorCategory = undefined;
  return { success: true, campaign };
}

export function startBackgroundCampaign(
  contacts: ContactItem[],
  messageTemplate: string,
  minDelay: number,
  maxDelay: number,
  enableSpintax: boolean,
  selectedInstances: string[],
  evolutionConfig: { baseUrl: string; apiKey: string },
  attachment?: { name: string; base64: string; mimetype: string; sizeKb: number },
  errorPolicy?: QueueErrorPolicy
): BackgroundCampaign {
  const campaignId = `camp_${Date.now()}`;
  const validInstances = selectedInstances.length > 0 ? selectedInstances : ['instancia_default'];
  const newCampaign: BackgroundCampaign = {
    id: campaignId,
    title: `Campanha Multi-Instância ${new Date().toLocaleTimeString('pt-BR')}`,
    status: 'running',
    contacts: contacts.map((contact) => ({ ...normalizeContact(contact), status: 'pending' })),
    currentIndex: 0,
    messageTemplate,
    attachment,
    enableSpintax,
    minDelay,
    maxDelay,
    selectedInstances: validInstances,
    errorPolicy: normalizeErrorPolicy(errorPolicy),
    evolutionConfig,
    startedAt: new Date().toLocaleString('pt-BR'),
    logs: [{
      timestamp: new Date().toLocaleTimeString('pt-BR'),
      phone: 'SISTEMA_SERVER',
      status: 'info',
      message: `Campanha iniciada com rotação entre ${validInstances.length} instância(s) [${validInstances.join(', ')}].`,
    }],
    reports: [],
  };
  globalCampaignsMap.set(campaignId, newCampaign);
  activeCampaignId = campaignId;
  launchCampaignLoop(campaignId);
  return newCampaign;
}

function addErrorResult(
  campaign: BackgroundCampaign,
  campaignId: string,
  contactIndex: number,
  contact: ContactItem,
  instanceName: string,
  personalizedMessage: string,
  category: ErrorCategoryType,
  title: string,
  detail: string,
  sentAt: string
): void {
  const attempts = (contact.attemptCount || 0) + 1;
  campaign.contacts[contactIndex] = {
    ...contact,
    status: 'error',
    errorCategory: category,
    errorMessage: title,
    sentAt,
    lastInstanceName: instanceName,
    attemptCount: attempts,
  };
  campaign.lastErrorCategory = category;
  void dispatchWebhookEvent('whatsapp.message.error', {
    campaignId,
    phone: contact.phone,
    errorTitle: title,
    errorCategory: category,
    errorMessage: detail,
    instanceName,
    failedAt: sentAt,
  });
  campaign.logs.unshift({
    timestamp: new Date().toLocaleTimeString('pt-BR'),
    phone: contact.phone,
    status: 'error',
    message: `[ROTAÇÃO: ${instanceName}] Erro: ${title}`,
  });
  campaign.reports.unshift({
    id: `rep_err_${campaignId}_${contact.id}_${attempts}`,
    contactName: contact.name || 'Contato',
    phone: contact.phone,
    messageSent: personalizedMessage + (campaign.attachment ? ` [Anexo: ${campaign.attachment.name}]` : ''),
    status: 'error',
    errorCategory: category,
    errorMessage: `${title} - ${detail}`.slice(0, 2_000),
    sentAt,
    instanceName,
  });
}

function pauseIfConfigured(campaign: BackgroundCampaign, category: ErrorCategoryType, title: string): boolean {
  if (!campaign.errorPolicy.pauseOn.includes(category)) return false;
  campaign.status = 'paused';
  campaign.pauseReason = `${title}. Revise a fila e clique em Continuar quando desejar.`;
  campaign.logs.unshift({
    timestamp: new Date().toLocaleTimeString('pt-BR'),
    phone: 'SISTEMA_SERVER',
    status: 'info',
    message: `⏸️ Fila pausada pela política de erro: ${title}`,
  });
  return true;
}

async function waitForDelay(campaignId: string, generation: number, delaySeconds: number): Promise<boolean> {
  const endAt = Date.now() + delaySeconds * 1_000;
  while (Date.now() < endAt) {
    const campaign = globalCampaignsMap.get(campaignId);
    if (!campaign || campaign.status !== 'running' || campaignGeneration.get(campaignId) !== generation) return false;
    await new Promise((resolve) => setTimeout(resolve, Math.min(1_000, endAt - Date.now())));
  }
  return true;
}

async function runCampaignLoop(campaignId: string, generation: number): Promise<void> {
  const campaign = globalCampaignsMap.get(campaignId);
  if (!campaign) return;

  while (campaign.status === 'running' && campaignGeneration.get(campaignId) === generation) {
    const contactIndex = campaign.contacts.findIndex((contact) => contact.selectedForSending !== false && contact.status === 'pending');
    if (contactIndex === -1) {
      campaign.status = 'completed';
      campaign.completedAt = new Date().toLocaleString('pt-BR');
      campaign.pauseReason = undefined;
      campaign.logs.unshift({
        timestamp: new Date().toLocaleTimeString('pt-BR'),
        phone: 'SISTEMA_SERVER',
        status: 'info',
        message: '🎉 Todos os contatos selecionados foram processados.',
      });
      return;
    }

    const contact = campaign.contacts[contactIndex];
    const instances = campaign.selectedInstances;
    const currentInstance = instances[campaign.currentIndex % instances.length];
    campaign.currentIndex += 1;
    campaign.contacts[contactIndex] = { ...contact, status: 'sending', lastInstanceName: currentInstance };

    let personalizedMsg = campaign.messageTemplate.replace(/\{nome\}/gi, contact.name || 'Cliente');
    if (campaign.enableSpintax) personalizedMsg = parseSpintax(personalizedMsg);
    const cleanPhone = contact.phone.replace(/\D/g, '');
    const sentAt = new Date().toLocaleString('pt-BR');
    const { baseUrl, apiKey } = campaign.evolutionConfig;

    try {
      if (!baseUrl || !apiKey || baseUrl.includes('exemplo.com')) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      } else {
        const cleanBaseUrl = baseUrl.replace(/\/$/, '');
        const isAttachment = Boolean(campaign.attachment?.base64);
        const endpoint = isAttachment ? 'sendMedia' : 'sendText';
        const body = isAttachment
          ? {
              number: cleanPhone,
              mediatype: campaign.attachment!.mimetype?.startsWith('image/') ? 'image'
                : campaign.attachment!.mimetype?.startsWith('audio/') ? 'audio'
                : campaign.attachment!.mimetype?.startsWith('video/') ? 'video' : 'document',
              mimetype: campaign.attachment!.mimetype,
              caption: personalizedMsg,
              media: campaign.attachment!.base64.includes(',') ? campaign.attachment!.base64.split(',')[1] : campaign.attachment!.base64,
              fileName: campaign.attachment!.name,
              options: { delay: 1200 },
            }
          : { number: cleanPhone, text: personalizedMsg, options: { delay: 1200 } };
        const response = await fetch(`${cleanBaseUrl}/message/${endpoint}/${currentInstance}`, {
          method: 'POST',
          headers: { apikey: apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok) {
          const detail = (await response.text()).slice(0, 2_000);
          const parsed = categorizeError(detail, response.status);
          addErrorResult(campaign, campaignId, contactIndex, contact, currentInstance, personalizedMsg, parsed.category, parsed.title, detail, sentAt);
          if (pauseIfConfigured(campaign, parsed.category, parsed.title)) return;
        } else {
          campaign.contacts[contactIndex] = {
            ...contact,
            status: 'sent',
            sentAt,
            lastInstanceName: currentInstance,
            attemptCount: (contact.attemptCount || 0) + 1,
            errorCategory: undefined,
            errorMessage: undefined,
          };
        }
      }

      if (campaign.contacts[contactIndex].status === 'sending') {
        campaign.contacts[contactIndex] = {
          ...contact,
          status: 'sent',
          sentAt,
          lastInstanceName: currentInstance,
          attemptCount: (contact.attemptCount || 0) + 1,
          errorCategory: undefined,
          errorMessage: undefined,
        };
      }
      if (campaign.contacts[contactIndex].status === 'sent') {
        void dispatchWebhookEvent('whatsapp.message.sent', {
          campaignId,
          phone: contact.phone,
          message: personalizedMsg,
          instanceName: currentInstance,
          sentAt,
        });
        campaign.logs.unshift({
          timestamp: new Date().toLocaleTimeString('pt-BR'),
          phone: contact.phone,
          status: 'success',
          message: `[ROTAÇÃO: ${currentInstance}] Enviado com sucesso`,
        });
        campaign.reports.unshift({
          id: `rep_${campaignId}_${contact.id}_${campaign.contacts[contactIndex].attemptCount}`,
          contactName: contact.name || 'Contato',
          phone: contact.phone,
          messageSent: personalizedMsg + (campaign.attachment ? ` [Anexo: ${campaign.attachment.name}]` : ''),
          status: 'success',
          sentAt,
          instanceName: currentInstance,
        });
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Falha de rede desconhecida';
      const parsed = categorizeError(detail, 0);
      addErrorResult(campaign, campaignId, contactIndex, contact, currentInstance, personalizedMsg, parsed.category, parsed.title, detail, sentAt);
      if (pauseIfConfigured(campaign, parsed.category, parsed.title)) return;
    }

    const hasMorePending = campaign.contacts.some((pendingContact) => pendingContact.selectedForSending !== false && pendingContact.status === 'pending');
    if (!hasMorePending) continue;
    const delaySec = Math.floor(Math.random() * (campaign.maxDelay - campaign.minDelay + 1)) + campaign.minDelay;
    campaign.logs.unshift({
      timestamp: new Date().toLocaleTimeString('pt-BR'),
      phone: 'SERVIDOR',
      status: 'info',
      message: `Aguardando ${delaySec}s antes do próximo contato selecionado.`,
    });
    if (!(await waitForDelay(campaignId, generation, delaySec))) return;
  }
}
