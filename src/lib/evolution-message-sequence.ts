import 'server-only';

import { TypingSimulationConfig } from './types';
import { MAX_MESSAGE_PARTS, randomTypingDelay, splitMessageSequence } from './message-sequence';

interface SequenceAttachment {
  name: string;
  base64: string;
  mimetype: string;
}

interface SendEvolutionMessageSequenceOptions {
  baseUrl: string;
  apiKey: string;
  instanceName: string;
  recipient: string;
  message: string;
  attachment?: SequenceAttachment;
  typingSimulation?: TypingSimulationConfig;
  startMessagePart?: number;
}

export interface EvolutionMessageSequenceResult {
  messageIds: string[];
  messages: string[];
  recipient: string;
  sentParts: number;
}

export class EvolutionMessageSequenceError extends Error {
  status: number;
  detail: string;
  nextMessagePart: number;
  sentParts: number;

  constructor(status: number, detail: string, nextMessagePart: number, sentParts: number) {
    super(detail || `Falha da Evolution API (${status || 'rede'})`);
    this.name = 'EvolutionMessageSequenceError';
    this.status = status;
    this.detail = detail;
    this.nextMessagePart = nextMessagePart;
    this.sentParts = sentParts;
  }
}

function mediaTypeFor(mimetype: string): string {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('audio/')) return 'audio';
  if (mimetype.startsWith('video/')) return 'video';
  return 'document';
}

async function responseError(response: Response): Promise<string> {
  return (await response.text()).slice(0, 2_000);
}

export async function sendEvolutionMessageSequence(
  options: SendEvolutionMessageSequenceOptions
): Promise<EvolutionMessageSequenceResult> {
  const rawParts = splitMessageSequence(options.message);
  const parts = rawParts.length > 0 ? rawParts : options.attachment ? [''] : [];
  if (parts.length === 0) throw new EvolutionMessageSequenceError(400, 'Digite pelo menos uma mensagem.', 0, 0);
  if (parts.length > MAX_MESSAGE_PARTS) {
    throw new EvolutionMessageSequenceError(400, `Use no máximo ${MAX_MESSAGE_PARTS} mensagens por contato.`, 0, 0);
  }

  const startMessagePart = Math.max(0, Math.min(parts.length - 1, Number(options.startMessagePart) || 0));
  const messageIds: string[] = [];
  let target = options.recipient;
  let sentParts = 0;

  const request = async (endpoint: 'sendText' | 'sendMedia', body: Record<string, unknown>) => fetch(
    `${options.baseUrl.replace(/\/$/, '')}/message/${endpoint}/${options.instanceName}`,
    {
      method: 'POST',
      headers: { apikey: options.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    }
  );

  for (let index = startMessagePart; index < parts.length; index += 1) {
    const delay = randomTypingDelay(options.typingSimulation);
    const typingFields = delay ? { delay } : {};
    let response: Response;

    if (options.attachment && index === 0) {
      const cleanBase64 = options.attachment.base64.includes(',')
        ? options.attachment.base64.split(',')[1]
        : options.attachment.base64;
      response = await request('sendMedia', {
        number: target,
        mediatype: mediaTypeFor(options.attachment.mimetype),
        mimetype: options.attachment.mimetype || 'application/octet-stream',
        caption: parts[index],
        media: cleanBase64,
        fileName: options.attachment.name || 'arquivo',
        ...typingFields,
      });
    } else {
      const sendText = (number: string) => request('sendText', {
        number,
        text: parts[index],
        linkPreview: true,
        ...typingFields,
      });

      response = await sendText(target);
      if (!response.ok && !target.includes('@')) {
        const firstError = await responseError(response);
        const numberDoesNotExist = firstError.includes('exists:false')
          || firstError.includes('exists":false')
          || firstError.toLowerCase().includes('not registered');
        if (numberDoesNotExist) {
          const lidTarget = `${target}@lid`;
          const lidResponse = await sendText(lidTarget);
          if (lidResponse.ok) {
            target = lidTarget;
            response = lidResponse;
          } else {
            const whatsappTarget = `${target}@s.whatsapp.net`;
            const whatsappResponse = await sendText(whatsappTarget);
            if (whatsappResponse.ok) target = whatsappTarget;
            response = whatsappResponse;
          }
        } else {
          throw new EvolutionMessageSequenceError(response.status, firstError, index, sentParts);
        }
      }
    }

    if (!response.ok) {
      throw new EvolutionMessageSequenceError(response.status, await responseError(response), index, sentParts);
    }

    const data = await response.json().catch(() => ({}));
    messageIds.push(data.key?.id || data.messageId || `OK_${index + 1}`);
    sentParts += 1;
  }

  return { messageIds, messages: parts, recipient: target, sentParts };
}
