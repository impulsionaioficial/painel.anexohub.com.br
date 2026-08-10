import crypto from 'crypto';
import { prisma } from './prisma';

export interface WebhookEventPayload {
  event: 'whatsapp.message.sent' | 'whatsapp.message.error' | 'whatsapp.connection.update' | 'email.sent' | 'email.error';
  timestamp: string;
  data: Record<string, any>;
}

// In-memory log fallback for local memory storage if DB is not available
export const inMemoryWebhookLogs: Array<{
  id: string;
  webhookId: string;
  webhookName?: string;
  webhookUrl?: string;
  event: string;
  payload: string;
  statusCode?: number;
  responseBody?: string;
  status: 'success' | 'failed';
  createdAt: string;
}> = [];

export async function dispatchWebhookEvent(event: WebhookEventPayload['event'], data: Record<string, any>): Promise<number> {
  const timestamp = new Date().toISOString();
  const fullPayloadObj: WebhookEventPayload = {
    event,
    timestamp,
    data,
  };

  const payloadString = JSON.stringify(fullPayloadObj);
  let dispatchedCount = 0;

  try {
    const activeWebhooks = await prisma.webhook.findMany({
      where: {
        status: 'active',
      },
    });

    const matchingWebhooks = activeWebhooks.filter(
      (wh) => wh.events.includes(event) || wh.events.includes('*') || wh.events.length === 0
    );

    for (const webhook of matchingWebhooks) {
      dispatchedCount++;
      sendWebhookHttpRequest(webhook.id, webhook.name, webhook.url, webhook.secret, event, payloadString);
    }
  } catch {
    // If DB is offline, check if any webhook logs or test webhooks exist
    console.log(`[WEBHOOK DISPATCH] Event triggered: ${event} (DB offline mode)`);
  }

  return dispatchedCount;
}

export async function sendWebhookHttpRequest(
  webhookId: string,
  webhookName: string,
  url: string,
  secret: string,
  event: string,
  payloadString: string
): Promise<{ success: boolean; statusCode?: number; responseBody?: string }> {
  const signature = crypto.createHmac('sha256', secret || 'default_secret').update(payloadString).digest('hex');

  let statusCode = 500;
  let responseBody = '';
  let status: 'success' | 'failed' = 'failed';

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AllWhatsPy-Webhook-Dispatcher/2.5',
        'x-webhook-signature': signature,
        'x-webhook-event': event,
      },
      body: payloadString,
      signal: AbortSignal.timeout(8000), // 8s timeout
    });

    statusCode = res.status;
    responseBody = await res.text();

    if (res.ok) {
      status = 'success';
    }
  } catch (err: any) {
    statusCode = 0;
    responseBody = err.message || 'Erro de conexão ao enviar webhook';
    status = 'failed';
  }

  // Save log entry to DB
  try {
    await prisma.webhookLog.create({
      data: {
        webhookId,
        event,
        payload: payloadString,
        statusCode,
        responseBody: responseBody.substring(0, 1000), // truncate if too long
        status,
      },
    });
  } catch {
    // In-memory fallback
    inMemoryWebhookLogs.unshift({
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      webhookId,
      webhookName,
      webhookUrl: url,
      event,
      payload: payloadString,
      statusCode,
      responseBody: responseBody.substring(0, 1000),
      status,
      createdAt: new Date().toLocaleString('pt-BR'),
    });
    if (inMemoryWebhookLogs.length > 200) inMemoryWebhookLogs.pop();
  }

  return { success: status === 'success', statusCode, responseBody };
}
