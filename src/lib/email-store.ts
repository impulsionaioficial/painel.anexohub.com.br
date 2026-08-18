import { SMTPAccount, ScrapedLead } from './types';

export const DEFAULT_SMTP: SMTPAccount = {
  id: 'smtp_demo_1',
  name: 'Conta SMTP de Teste',
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  user: 'seuemail@gmail.com',
  pass: 'sua-senha-ou-app-password',
  fromName: 'Atendimento',
  fromEmail: 'seuemail@gmail.com',
  status: 'active',
};

// Persistence for SMTP Accounts
export function getStoredSMTPAccounts(): SMTPAccount[] {
  if (typeof window === 'undefined') return [DEFAULT_SMTP];
  const saved = sessionStorage.getItem('awp_smtp_accounts');
  if (!saved) return [DEFAULT_SMTP];
  try {
    return JSON.parse(saved);
  } catch {
    return [DEFAULT_SMTP];
  }
}

export function saveStoredSMTPAccounts(accounts: SMTPAccount[]): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('awp_smtp_accounts');
  sessionStorage.setItem('awp_smtp_accounts', JSON.stringify(accounts));
}

// Storage for Scraped Leads Buffer (Pass from Scraper -> Email / WhatsApp)
export function getStoredScrapedLeads(): ScrapedLead[] {
  if (typeof window === 'undefined') return [];
  const saved = sessionStorage.getItem('awp_scraped_leads');
  if (!saved) return [];
  try {
    return JSON.parse(saved);
  } catch {
    return [];
  }
}

export function saveStoredScrapedLeads(leads: ScrapedLead[]): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('awp_scraped_leads');
  sessionStorage.setItem('awp_scraped_leads', JSON.stringify(leads));
}

// Regex helper to extract valid email addresses from text
export function extractEmailsFromText(text: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex) || [];
  // Return unique emails only
  return Array.from(new Set(matches.map((e) => e.toLowerCase().trim())));
}
