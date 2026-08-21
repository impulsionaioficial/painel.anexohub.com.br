import { ContactItem } from './types';

export const MAX_CAMPAIGN_CONTACTS = 10_000;

export interface ContactMergeResult {
  contacts: ContactItem[];
  addedCount: number;
  duplicateCount: number;
  invalidCount: number;
  limitCount: number;
}

export function contactPhoneKey(phone: string): string {
  return String(phone || '').replace(/\D/g, '');
}

/**
 * Mescla uma importação sem repetir números já presentes ou duplicados no
 * próprio arquivo. Contatos importados entram marcados para revisão/envio.
 */
export function mergeImportedContacts(
  current: ContactItem[],
  imported: ContactItem[],
  maximumContacts = MAX_CAMPAIGN_CONTACTS
): ContactMergeResult {
  const contacts = [...current];
  const knownPhones = new Set(current.map((contact) => contactPhoneKey(contact.phone)).filter(Boolean));
  let addedCount = 0;
  let duplicateCount = 0;
  let invalidCount = 0;
  let limitCount = 0;

  for (const contact of imported) {
    const phoneKey = contactPhoneKey(contact.phone);
    // Linhas explicitamente revisadas no importador podem permanecer na
    // campanha, desmarcadas, para o usuário decidir se deseja enviá-las.
    if (phoneKey.length < 8 && contact.importValidation !== 'invalid') {
      invalidCount += 1;
      continue;
    }
    if (knownPhones.has(phoneKey)) {
      duplicateCount += 1;
      continue;
    }
    if (contacts.length >= maximumContacts) {
      limitCount += 1;
      continue;
    }

    knownPhones.add(phoneKey);
    contacts.push({
      ...contact,
      name: contact.name?.trim() || 'Sem nome',
      selectedForSending: contact.selectedForSending !== false,
      status: contact.status || 'pending',
    });
    addedCount += 1;
  }

  return { contacts, addedCount, duplicateCount, invalidCount, limitCount };
}

export function describeContactImport(result: ContactMergeResult): string {
  const details = [`${result.addedCount} adicionado${result.addedCount === 1 ? '' : 's'}`];
  if (result.duplicateCount) details.push(`${result.duplicateCount} duplicado${result.duplicateCount === 1 ? '' : 's'} ignorado${result.duplicateCount === 1 ? '' : 's'}`);
  if (result.invalidCount) details.push(`${result.invalidCount} inválido${result.invalidCount === 1 ? '' : 's'}`);
  if (result.limitCount) details.push(`${result.limitCount} acima do limite de ${MAX_CAMPAIGN_CONTACTS.toLocaleString('pt-BR')}`);
  return details.join(' • ');
}
