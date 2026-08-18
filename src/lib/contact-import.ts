import { ContactItem } from './types';

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
  maximumContacts = 1_000
): ContactMergeResult {
  const contacts = [...current];
  const knownPhones = new Set(current.map((contact) => contactPhoneKey(contact.phone)).filter(Boolean));
  let addedCount = 0;
  let duplicateCount = 0;
  let invalidCount = 0;
  let limitCount = 0;

  for (const contact of imported) {
    const phoneKey = contactPhoneKey(contact.phone);
    if (phoneKey.length < 8) {
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
      selectedForSending: true,
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
  if (result.limitCount) details.push(`${result.limitCount} acima do limite de 1.000`);
  return details.join(' • ');
}
