export type UserRole = 'admin' | 'user';

export type PermissionKey =
  | 'module_whatsapp_disparador'
  | 'module_whatsapp_config'
  | 'module_whatsapp_logs'
  | 'module_whatsapp_extrator'
  | 'module_email_disparador'
  | 'module_email_config'
  | 'module_users_admin'
  | 'module_integrations'
  | 'can_start_campaign'
  | 'can_delete_instance'
  | 'can_manage_smtp'
  | 'can_clear_logs';

export interface UserPermissionDefinition {
  key: PermissionKey;
  label: string;
  category: 'módulo' | 'ação';
  description: string;
}

export const ALL_PERMISSIONS: UserPermissionDefinition[] = [
  {
    key: 'module_whatsapp_disparador',
    label: 'Disparador WhatsApp',
    category: 'módulo',
    description: 'Acesso à página de disparos e envio de mensagens WhatsApp.',
  },
  {
    key: 'module_whatsapp_config',
    label: 'Configurações WhatsApp',
    category: 'módulo',
    description: 'Acesso às configurações da VPS e leitura de QR Code.',
  },
  {
    key: 'module_whatsapp_logs',
    label: 'Logs WhatsApp',
    category: 'módulo',
    description: 'Acesso aos relatórios e logs de disparos do WhatsApp.',
  },
  {
    key: 'module_whatsapp_extrator',
    label: 'Extrator de Contatos & Grupos',
    category: 'módulo',
    description: 'Extração de contatos da agenda, grupos e membros de grupos do WhatsApp.',
  },
  {
    key: 'module_email_disparador',
    label: 'Disparador de E-mail',
    category: 'módulo',
    description: 'Acesso ao disparador em massa de e-mails via SMTP.',
  },
  {
    key: 'module_email_config',
    label: 'Servidores SMTP',
    category: 'módulo',
    description: 'Acesso ao cadastro de SMTP e verificador de entregabilidade DNS.',
  },
  {
    key: 'module_users_admin',
    label: 'Gestão de Usuários',
    category: 'módulo',
    description: 'Acesso ao painel administrativo de criação e permissões de usuários.',
  },
  {
    key: 'module_integrations',
    label: 'APIs & Webhooks',
    category: 'módulo',
    description: 'Acesso ao gerenciador de chaves de API, webhooks e documentação de integração com CRM.',
  },
  {
    key: 'can_start_campaign',
    label: 'Iniciar Disparos em Massa',
    category: 'ação',
    description: 'Permite clicar no botão de iniciar campanhas de disparo.',
  },
  {
    key: 'can_delete_instance',
    label: 'Deletar Instâncias WhatsApp',
    category: 'ação',
    description: 'Permite excluir instâncias ativas da Evolution API na VPS.',
  },
  {
    key: 'can_manage_smtp',
    label: 'Gerenciar Servidores SMTP',
    category: 'ação',
    description: 'Permite cadastrar ou excluir credenciais de remetentes SMTP.',
  },
  {
    key: 'can_clear_logs',
    label: 'Limpar Logs e Históricos',
    category: 'ação',
    description: 'Permite apagar os registros de logs e relatórios do sistema.',
  },
];

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  permissions: PermissionKey[];
  createdAt: string;
}

export interface UserSession {
  user: UserAccount;
  token: string;
  expiresAt: string;
}
