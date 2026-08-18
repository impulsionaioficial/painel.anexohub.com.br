import 'server-only';

import dns from 'node:dns/promises';
import net from 'node:net';

function configuredHosts(variableName: string): Set<string> {
  return new Set(
    (process.env[variableName] || '')
      .split(',')
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean)
  );
}

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^::ffff:/, '');
  if (normalized === '::1' || normalized === '0.0.0.0') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true;

  if (net.isIPv4(normalized)) {
    const [a, b] = normalized.split('.').map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  return false;
}

export async function assertSafeHost(hostname: string, allowlistVariable?: string): Promise<void> {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('Destino de rede não permitido.');
  }

  const allowlist = allowlistVariable ? configuredHosts(allowlistVariable) : new Set<string>();
  if (process.env.NODE_ENV === 'production' && allowlistVariable && allowlist.size === 0) {
    throw new Error(`${allowlistVariable} deve ser configurada em produção.`);
  }
  if (allowlist.size > 0 && !allowlist.has(host)) throw new Error('Host fora da lista permitida.');

  if (net.isIP(host)) {
    if (isPrivateAddress(host)) throw new Error('Endereço privado ou reservado não permitido.');
    return;
  }

  const addresses = await dns.lookup(host, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some((result) => isPrivateAddress(result.address))) {
    throw new Error('O host resolve para uma rede privada ou reservada.');
  }
}

export async function assertSafeOutboundUrl(
  input: string,
  options: { allowHttp?: boolean; allowlistVariable?: string; allowedPorts?: number[] } = {}
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error('URL inválida.');
  }

  const allowedProtocols = options.allowHttp ? new Set(['https:', 'http:']) : new Set(['https:']);
  if (!allowedProtocols.has(url.protocol) || url.username || url.password) throw new Error('Protocolo ou credenciais na URL não permitidos.');

  const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
  if (options.allowedPorts && !options.allowedPorts.includes(port)) throw new Error('Porta de destino não permitida.');

  await assertSafeHost(url.hostname, options.allowlistVariable);
  return url;
}

export async function assertSafeEvolutionBaseUrl(input: string): Promise<string> {
  const url = await assertSafeOutboundUrl(input, {
    allowHttp: process.env.NODE_ENV !== 'production',
    allowlistVariable: 'EVOLUTION_ALLOWED_HOSTS',
  });
  return url.toString().replace(/\/$/, '');
}
