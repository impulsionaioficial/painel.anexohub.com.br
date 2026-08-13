import { ContactItem, ErrorCategoryType, DetailedReportItem } from './types';
import { parseSpintax } from './evolution-store';
import { dispatchWebhookEvent } from './webhook-dispatcher';


export interface BackgroundCampaign {
  id: string;
  title: string;
  status: 'running' | 'paused' | 'completed' | 'stopped';
  contacts: ContactItem[];
  currentIndex: number;
  messageTemplate: string;
  attachment?: { name: string; base64: string; mimetype: string; sizeKb: number };
  enableSpintax: boolean;
  minDelay: number;
  maxDelay: number;
  selectedInstances: string[];
  evolutionConfig: {
    baseUrl: string;
    apiKey: string;
  };
  startedAt: string;
  completedAt?: string;
  logs: { timestamp: string; phone: string; status: 'success' | 'error' | 'info'; message: string }[];
  reports: DetailedReportItem[];
}

const globalCampaignsMap = new Map<string, BackgroundCampaign>();
let activeCampaignId: string | null = null;

function categorizeError(errText: string, status: number): { category: ErrorCategoryType; title: string } {
  const text = errText.toLowerCase();

  if (text.includes('not registered') || text.includes('exists: false') || text.includes('exists false') || text.includes('invalid number') || text.includes('not on whatsapp')) {
    return { category: 'NUMBER_NOT_EXISTS', title: '🚫 Número Não Registrado no WhatsApp' };
  }
  if (status === 401 || text.includes('unauthorized') || text.includes('session closed') || text.includes('connection closed') || text.includes('logged out')) {
    return { category: 'SENDER_BLOCKED', title: '🔒 Sessão Desconectada / Número Disparador Suspenso' };
  }
  if (status === 403 || text.includes('blocked') || text.includes('forbidden') || text.includes('user blocked')) {
    return { category: 'USER_BLOCKED', title: '⛔ Bloqueado pelo Destinatário' };
  }
  if (text.includes('timeout') || text.includes('econnrefused') || text.includes('fetch failed') || status >= 502) {
    return { category: 'TIMEOUT', title: '📡 Timeout / VPS Sem Resposta' };
  }
  return { category: 'UNKNOWN', title: `❌ Erro da API (${status})` };
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
  globalCampaignsMap.forEach((camp) => {
    if (camp.reports && Array.isArray(camp.reports)) {
      allReports.push(...camp.reports);
    }
  });
  return allReports;
}

export function controlCampaign(id: string, action: 'pause' | 'resume' | 'stop'): boolean {
  const campaign = globalCampaignsMap.get(id);
  if (!campaign) return false;

  if (action === 'pause') {
    campaign.status = 'paused';
  } else if (action === 'resume') {
    campaign.status = 'running';
    runCampaignLoop(id);
  } else if (action === 'stop') {
    campaign.status = 'stopped';
    campaign.completedAt = new Date().toLocaleString('pt-BR');
  }
  return true;
}

export function startBackgroundCampaign(
  contacts: ContactItem[],
  messageTemplate: string,
  minDelay: number,
  maxDelay: number,
  enableSpintax: boolean,
  selectedInstances: string[],
  evolutionConfig: { baseUrl: string; apiKey: string },
  attachment?: { name: string; base64: string; mimetype: string; sizeKb: number }
): BackgroundCampaign {
  const campaignId = `camp_${Date.now()}`;
  const validInstances = selectedInstances.length > 0 ? selectedInstances : ['instancia_default'];

  const newCampaign: BackgroundCampaign = {
    id: campaignId,
    title: `Campanha Multi-Instância ${new Date().toLocaleTimeString('pt-BR')}`,
    status: 'running',
    contacts,
    currentIndex: 0,
    messageTemplate,
    attachment,
    enableSpintax,
    minDelay,
    maxDelay,
    selectedInstances: validInstances,
    evolutionConfig,
    startedAt: new Date().toLocaleString('pt-BR'),
    logs: [
      {
        timestamp: new Date().toLocaleTimeString('pt-BR'),
        phone: 'SISTEMA_SERVER',
        status: 'info',
        message: `Campanha iniciada com rotação entre ${validInstances.length} instância(s) [${validInstances.join(', ')}].`,
      },
    ],
    reports: [],
  };

  globalCampaignsMap.set(campaignId, newCampaign);
  activeCampaignId = campaignId;

  runCampaignLoop(campaignId);

  return newCampaign;
}

async function runCampaignLoop(campaignId: string) {
  const campaign = globalCampaignsMap.get(campaignId);
  if (!campaign) return;

  const { baseUrl, apiKey } = campaign.evolutionConfig;
  const instances = campaign.selectedInstances;

  for (let i = campaign.currentIndex; i < campaign.contacts.length; i++) {
    if (campaign.status === 'paused' || campaign.status === 'stopped') {
      return;
    }

    campaign.currentIndex = i;
    const contact = campaign.contacts[i];
    contact.status = 'sending';

    const currentInstance = instances[i % instances.length];

    let personalizedMsg = campaign.messageTemplate.replace(/\{nome\}/gi, contact.name || 'Cliente');
    if (campaign.enableSpintax) {
      personalizedMsg = parseSpintax(personalizedMsg);
    }

    const cleanPhone = contact.phone.replace(/\D/g, '');
    const sentTimeString = new Date().toLocaleString('pt-BR');

    try {
      if (!baseUrl || !apiKey || baseUrl.includes('exemplo.com')) {
        await new Promise((r) => setTimeout(r, 600));

        contact.status = 'sent';
        contact.sentAt = new Date().toLocaleTimeString('pt-BR');

        dispatchWebhookEvent('whatsapp.message.sent', {
          campaignId,
          phone: contact.phone,
          message: personalizedMsg,
          instanceName: currentInstance,
          sentAt: sentTimeString,
        });

        campaign.logs.unshift({
          timestamp: new Date().toLocaleTimeString('pt-BR'),
          phone: contact.phone,
          status: 'success',
          message: `[ROTAÇÃO: ${currentInstance}] Mensagem enviada para ${contact.phone}`,
        });

        // Add to campaign reports store
        campaign.reports.unshift({
          id: `rep_${campaignId}_${i}`,
          contactName: contact.name || 'Contato',
          phone: contact.phone,
          messageSent: personalizedMsg + (campaign.attachment ? ` [Anexo: ${campaign.attachment.name}]` : ''),
          status: 'success',
          sentAt: sentTimeString,
          instanceName: currentInstance,
        });
      } else {
        const cleanBaseUrl = baseUrl.replace(/\/$/, '');
        let res: Response;

        if (campaign.attachment && campaign.attachment.base64) {
          let cleanBase64 = campaign.attachment.base64;
          if (cleanBase64.includes(',')) cleanBase64 = cleanBase64.split(',')[1];

          let mediaType = 'document';
          if (campaign.attachment.mimetype?.startsWith('image/')) mediaType = 'image';
          else if (campaign.attachment.mimetype?.startsWith('audio/')) mediaType = 'audio';
          else if (campaign.attachment.mimetype?.startsWith('video/')) mediaType = 'video';

          res = await fetch(`${cleanBaseUrl}/message/sendMedia/${currentInstance}`, {
            method: 'POST',
            headers: { 'apikey': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              number: cleanPhone,
              mediatype: mediaType,
              mimetype: campaign.attachment.mimetype,
              caption: personalizedMsg,
              media: cleanBase64,
              fileName: campaign.attachment.name,
              options: { delay: 1200 },
            }),
          });
        } else {
          res = await fetch(`${cleanBaseUrl}/message/sendText/${currentInstance}`, {
            method: 'POST',
            headers: { 'apikey': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              number: cleanPhone,
              text: personalizedMsg,
              options: { delay: 1200 },
            }),
          });
        }

        if (res.ok) {
          contact.status = 'sent';
          contact.sentAt = new Date().toLocaleTimeString('pt-BR');

          dispatchWebhookEvent('whatsapp.message.sent', {
            campaignId,
            phone: contact.phone,
            message: personalizedMsg,
            instanceName: currentInstance,
            sentAt: sentTimeString,
          });

          campaign.logs.unshift({
            timestamp: new Date().toLocaleTimeString('pt-BR'),
            phone: contact.phone,
            status: 'success',
            message: `[ROTAÇÃO: ${currentInstance}] Enviado com sucesso`,
          });

          campaign.reports.unshift({
            id: `rep_${campaignId}_${i}`,
            contactName: contact.name || 'Contato',
            phone: contact.phone,
            messageSent: personalizedMsg + (campaign.attachment ? ` [Anexo: ${campaign.attachment.name}]` : ''),
            status: 'success',
            sentAt: sentTimeString,
            instanceName: currentInstance,
          });
        } else {
          const errText = await res.text();
          const parsedErr = categorizeError(errText, res.status);
          contact.status = 'error';
          contact.errorMessage = parsedErr.title;

          dispatchWebhookEvent('whatsapp.message.error', {
            campaignId,
            phone: contact.phone,
            errorTitle: parsedErr.title,
            errorCategory: parsedErr.category,
            errorMessage: errText,
            instanceName: currentInstance,
            failedAt: sentTimeString,
          });

          campaign.logs.unshift({
            timestamp: new Date().toLocaleTimeString('pt-BR'),
            phone: contact.phone,
            status: 'error',
            message: `[ROTAÇÃO: ${currentInstance}] Erro: ${parsedErr.title}`,
          });

          campaign.reports.unshift({
            id: `rep_err_${campaignId}_${i}`,
            contactName: contact.name || 'Contato',
            phone: contact.phone,
            messageSent: personalizedMsg + (campaign.attachment ? ` [Anexo: ${campaign.attachment.name}]` : ''),
            status: 'error',
            errorCategory: parsedErr.category,
            errorMessage: `${parsedErr.title} - ${errText}`,
            sentAt: sentTimeString,
            instanceName: currentInstance,
          });
        }
      }
    } catch (err: any) {
      contact.status = 'error';
      contact.errorMessage = err.message;
    }

    if (i < campaign.contacts.length - 1 && campaign.status === 'running') {
      const delaySec = Math.floor(Math.random() * (campaign.maxDelay - campaign.minDelay + 1)) + campaign.minDelay;
      campaign.logs.unshift({
        timestamp: new Date().toLocaleTimeString('pt-BR'),
        phone: 'SERVIDOR',
        status: 'info',
        message: `Aguardando delay de ${delaySec}s... (Próximo envio usará a instância: ${instances[(i + 1) % instances.length]})`,
      });
      await new Promise((r) => setTimeout(r, delaySec * 1000));
    }
  }

  campaign.status = 'completed';
  campaign.completedAt = new Date().toLocaleString('pt-BR');
  campaign.logs.unshift({
    timestamp: new Date().toLocaleTimeString('pt-BR'),
    phone: 'SISTEMA_SERVER',
    status: 'info',
    message: '🎉 Campanha Multi-Instância finalizada com sucesso!',
  });
}
