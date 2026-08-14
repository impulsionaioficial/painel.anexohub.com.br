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
  code?: string;
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
  errorCategory?: 'NUMBER_NOT_EXISTS' | 'SENDER_BLOCKED' | 'USER_BLOCKED' | 'TIMEOUT' | 'UNKNOWN';
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

// --- DETAILED REPORT & SCHEDULER TYPES ---

export type ErrorCategoryType = 'NUMBER_NOT_EXISTS' | 'SENDER_BLOCKED' | 'USER_BLOCKED' | 'TIMEOUT' | 'UNKNOWN';

export interface DetailedReportItem {
  id: string;
  contactName: string;
  phone: string;
  messageSent: string;
  status: 'success' | 'error' | 'pending';
  errorCategory?: ErrorCategoryType;
  errorMessage?: string;
  sentAt: string;
  instanceName: string;
}

// --- QUEUE / MULTI-CAMPAIGN TYPES ---

export type QueueExecutionMode = 'sequential' | 'parallel';
export type QueueCampaignStatus = 'queued' | 'running' | 'paused' | 'completed' | 'stopped';

export interface QueueCampaignAttachment {
  name: string;
  base64: string;
  mimetype: string;
  sizeKb: number;
}

export interface QueueCampaignItem {
  id: string;
  title: string;
  contacts: ContactItem[];
  messageTemplate: string;
  attachment?: QueueCampaignAttachment;
  selectedInstances: string[];
  enableSpintax: boolean;
  minDelay: number;
  maxDelay: number;
  executionMode: QueueExecutionMode;
  order: number;
  status: QueueCampaignStatus;
  sentCount: number;
  errorCount: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface ScheduledTaskAttachment {
  name: string;
  base64: string;
  mimetype: string;
  sizeKb: number;
}

export interface ScheduledTask {
  id: string;
  title: string;
  contacts: ContactItem[];
  messageTemplate: string;
  attachment?: ScheduledTaskAttachment;
  enableSpintax: boolean;
  minDelay: number;
  maxDelay: number;
  scheduleType: 'once' | 'recurring';
  executeAt?: string;
  recurrenceUnit?: 'minutes' | 'hours' | 'days' | 'weeks' | 'months';
  recurrenceInterval?: number;
  status: 'active' | 'paused' | 'completed';
  createdDate: string;
  lastRun?: string;
  nextRun?: string;
}

// --- EMAIL & SCRAPER TYPES ---

export interface SMTPAccount {
  id: string;
  name: string;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string;
  maxDaily?: number;
  status: 'active' | 'inactive' | 'error';
}

export interface EmailContactItem {
  id: string;
  email: string;
  name?: string;
  company?: string;
  source?: string;
  status: 'pending' | 'sending' | 'sent' | 'error';
  errorMessage?: string;
  sentAt?: string;
}

export interface EmailCampaignData {
  subject: string;
  bodyHtml: string;
  minDelay: number;
  maxDelay: number;
  contacts: EmailContactItem[];
  smtpAccountIds: string[];
  enableSpintax: boolean;
  replyTo?: string;
}

export interface ScrapeQueryFilter {
  keywords: string;
  platform: 'google' | 'linkedin' | 'facebook' | 'instagram' | 'twitter' | 'all';
  domainFilter: '@gmail.com' | '@hotmail.com' | '@outlook.com' | '@yahoo.com' | 'all';
  maxResults: number;
}

export interface ScrapedLead {
  id: string;
  email: string;
  name?: string;
  platform: string;
  sourceUrl?: string;
  snippet?: string;
  dateFound: string;
}
