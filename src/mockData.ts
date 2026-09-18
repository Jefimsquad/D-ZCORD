import type { Server, UserProfile, Message, FileFolder, ProjectFile, ProjectTask } from './types';

export const currentUser: UserProfile = {
  id: 'usr_me',
  username: 'peppa',
  display_name: 'Peppa Developer',
  avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  status: 'online',
  custom_status: 'Codando o DÉZCORD 🚀',
  bio: 'Criador do DÉZCORD. Desenvolvedor Fullstack e entusiasta de sistemas distribuídos.',
  banner_color: '#5865F2',
  email: 'usuario@dezcord.gg'
};

export const sampleUsers: UserProfile[] = [
  currentUser,
  {
    id: 'usr_dez',
    username: 'dez_bot',
    display_name: 'DÉZ BOT 🤖',
    avatar_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
    status: 'online',
    custom_status: 'Assistente IA & Automação ⚡',
    bio: 'Bot inteligente do DÉZCORD para automações de projetos, resumos e suporte.',
  },
  {
    id: 'usr_aline',
    username: 'aline_dev',
    display_name: 'Aline Tech',
    avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    status: 'idle',
    custom_status: 'Revisando mockups no Drive 📁',
    bio: 'UI/UX Designer e Product Manager.',
  },
  {
    id: 'usr_lucas',
    username: 'lucas_gamer',
    display_name: 'Lucas | Fullstack',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    status: 'dnd',
    custom_status: '🔴 Focado nas Tarefas',
    bio: 'Desenvolvedor Frontend focado em React e performance.',
  },
  {
    id: 'usr_carlos',
    username: 'carlos_supabase',
    display_name: 'Carlos Supabase Guru',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    status: 'online',
    custom_status: 'PostgreSQL Realtime Master 🔥',
    bio: 'Especialista em banco de dados Supabase.',
  },
  {
    id: 'usr_mariana',
    username: 'mari_cloud',
    display_name: 'Mariana Cloud',
    avatar_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80',
    status: 'offline',
    custom_status: '',
    bio: 'DevOps engineer.',
  }
];

export const initialServers: Server[] = [
  {
    id: 'srv_dezcord',
    name: 'DÉZCORD Workspace',
    icon_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80',
    owner_id: 'usr_me',
    description: 'Projeto principal do DÉZCORD: Comunicação, Tarefas e Arquivos.',
    channels: [
      { id: 'c_geral', server_id: 'srv_dezcord', name: 'geral', type: 'text', category: 'TEXTO', topic: 'Canal principal de comunicação do projeto' },
      { id: 'c_dev', server_id: 'srv_dezcord', name: 'desenvolvimento', type: 'text', category: 'TEXTO', topic: 'Discussões técnicas, commits e arquitetura' },
      { id: 'c_design', server_id: 'srv_dezcord', name: 'design-feedback', type: 'text', category: 'TEXTO', topic: 'Compartilhamento de assets e telas' },
      { id: 'c_voz_reuniao', server_id: 'srv_dezcord', name: 'Reunião Diária 🎙️', type: 'voice', category: 'VOZ' },
      { id: 'c_voz_foco', server_id: 'srv_dezcord', name: 'Sala Foco & Pair 💻', type: 'voice', category: 'VOZ' }
    ]
  },
  {
    id: 'srv_mobile',
    name: 'App Mobile v2',
    icon_url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=120&auto=format&fit=crop&q=80',
    owner_id: 'usr_carlos',
    description: 'Desenvolvimento do app mobile nativo.',
    channels: [
      { id: 'c_mob_geral', server_id: 'srv_mobile', name: 'geral', type: 'text', category: 'TEXTO' },
      { id: 'c_mob_voice', server_id: 'srv_mobile', name: 'Daily Mobile', type: 'voice', category: 'VOZ' }
    ]
  }
];

export const initialFolders: FileFolder[] = [
  {
    id: 'f_docs',
    project_id: 'srv_dezcord',
    name: 'Documentos & Especificações',
    parent_id: null,
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'f_design',
    project_id: 'srv_dezcord',
    name: 'Design & UI Assets',
    parent_id: null,
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'f_sprints',
    project_id: 'srv_dezcord',
    name: 'Entregas & Sprints',
    parent_id: null,
    created_at: new Date().toISOString(),
  },
];

export const initialFiles: ProjectFile[] = [
  {
    id: 'file_1',
    project_id: 'srv_dezcord',
    folder_id: 'f_design',
    name: 'interface-dark-mode.png',
    size: 428000,
    mime_type: 'image/png',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
    uploaded_by: sampleUsers[2],
    created_at: new Date(Date.now() - 43200000).toISOString(),
  },
  {
    id: 'file_2',
    project_id: 'srv_dezcord',
    folder_id: 'f_docs',
    name: 'arquitetura-projeto-dezcord.pdf',
    size: 1540000,
    mime_type: 'application/pdf',
    url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80',
    uploaded_by: currentUser,
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'file_3',
    project_id: 'srv_dezcord',
    folder_id: null,
    name: 'banner-projeto.png',
    size: 612000,
    mime_type: 'image/png',
    url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80',
    uploaded_by: currentUser,
    created_at: new Date().toISOString(),
  }
];

export const initialTasks: ProjectTask[] = [
  {
    id: 'tsk_1',
    project_id: 'srv_dezcord',
    title: 'Estruturar Canais de Texto e Canais de Voz',
    description: 'Interface idêntica ao Discord com detecção de fala e controles de mute.',
    status: 'done',
    assigned_to: currentUser,
    priority: 'high',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'tsk_2',
    project_id: 'srv_dezcord',
    title: 'Implementar Armazenamento Interno com Pastas',
    description: 'Upload de arquivos, pastas organizadas, pré-visualização de imagens e documentos.',
    status: 'done',
    assigned_to: currentUser,
    priority: 'high',
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'tsk_3',
    project_id: 'srv_dezcord',
    title: 'Conectar ao Supabase (PostgreSQL & Realtime)',
    description: 'Tabelas criadas, RLS e sincronização de mensagens em tempo real.',
    status: 'in_progress',
    assigned_to: sampleUsers[4],
    priority: 'high',
    created_at: new Date().toISOString(),
  },
  {
    id: 'tsk_4',
    project_id: 'srv_dezcord',
    title: 'Automatizar Assistente IA no Dézcord Bot',
    description: 'Respostas a comandos /ia, /resumo e apoio às discussões de equipe.',
    status: 'in_progress',
    assigned_to: sampleUsers[1],
    priority: 'medium',
    created_at: new Date().toISOString(),
  },
  {
    id: 'tsk_5',
    project_id: 'srv_dezcord',
    title: 'Sincronizar Repositório Remoto no GitHub',
    description: 'Testar push para a branch main e documentar instruções.',
    status: 'todo',
    assigned_to: currentUser,
    priority: 'medium',
    created_at: new Date().toISOString(),
  }
];

export const initialMessages: Record<string, Message[]> = {
  'c_geral': [
    {
      id: 'msg_1',
      channel_id: 'c_geral',
      user_id: 'usr_dez',
      author: sampleUsers[1],
      content: '👋 **Bem-vindos ao DÉZCORD Workspace!** Um ambiente completo integrando **Comunicação**, **Organização de Projetos** e **Armazenamento de Arquivos**.',
      created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
      reactions: [
        { emoji: '🚀', count: 5, users: ['usr_me', 'usr_aline', 'usr_carlos'] },
        { emoji: '🎉', count: 4, users: ['usr_me', 'usr_lucas'] }
      ]
    },
    {
      id: 'msg_2',
      channel_id: 'c_geral',
      user_id: 'usr_carlos',
      author: sampleUsers[4],
      content: 'Agora temos a aba **📁 Arquivos & Documentos** com pastas no projeto e o **📋 Quadro de Tarefas** integrado!',
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      reactions: [{ emoji: '🔥', count: 3, users: ['usr_me'] }]
    }
  ],
  'c_dev': [
    {
      id: 'msg_dev_1',
      channel_id: 'c_dev',
      user_id: 'usr_me',
      author: currentUser,
      content: '```typescript\n// DÉZCORD: Comunicação + Armazenamento + Organização\nconst workspace = {\n  chat: "Realtime Supabase",\n  storage: "Pastas e Arquivos Internos",\n  tasks: "Kanban Board Integrado",\n  voice: "WebRTC Audio / Video"\n};\n```\nO sistema está modular e dinâmico!',
      created_at: new Date(Date.now() - 1200000).toISOString(),
      reactions: [{ emoji: '💻', count: 4, users: ['usr_carlos'] }]
    }
  ]
};
