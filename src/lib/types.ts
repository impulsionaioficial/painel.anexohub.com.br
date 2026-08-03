export interface EvolutionConfig {
  baseUrl: string;
  apiKey: string;
  instanceName: string;
}

export interface InstanceStatus {
  instanceName: string;
  state: 'open' | 'connecting' | 'close';
  profileName?: string;
  profilePictureUrl?: string;
  ownerJid?: string;
}

export interface QRCodeData {
  pairingCode?: string;
  code?: string; // base64 QR code image or string
  base64?: string;
  count?: number;
}

export interface ContactItem {
  id: string;
  phone: string;
  name?: string;
  var1?: string;
  var2?: string;
  status: 'pending' | 'sending' | 'sent' | 'error';
  errorMessage?: string;
  sentAt?: string;
}

export interface CampaignData {
  title: string;
  messageTemplate: string;
  minDelay: number;
  maxDelay: number;
  contacts: ContactItem[];
  enableSpintax: boolean;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  phone: string;
  status: 'success' | 'error' | 'info';
  message: string;
}
