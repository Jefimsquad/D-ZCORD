import type { Server, UserProfile, Message } from './types';

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
    custom_status: 'Tocando Lo-Fi 24/7 🎧',
    bio: 'Bot oficial do DÉZCORD para música, moderação e integrações.',
  },
  {
    id: 'usr_aline',
    username: 'aline_dev',
    display_name: 'Aline Tech',
    avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    status: 'idle',
    custom_status: 'Almoçando...',
    bio: 'UI/UX Designer e fã do Discord.',
  },
  {
    id: 'usr_lucas',
    username: 'lucas_gamer',
    display_name: 'Lucas | Pro Player',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    status: 'dnd',
    custom_status: '🔴 Jogando Valorant',
    bio: 'Não perturbe, ranked decisiva!',
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
    name: 'DÉZCORD Oficial',
    icon_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80',
    owner_id: 'usr_me',
    description: 'Servidor oficial da comunidade DÉZCORD.',
    channels: [
      { id: 'c_geral', server_id: 'srv_dezcord', name: 'geral', type: 'text', category: 'TEXTO', topic: 'Canal oficial de bate-papo geral da comunidade DÉZCORD' },
      { id: 'c_anuncios', server_id: 'srv_dezcord', name: 'anúncios', type: 'text', category: 'TEXTO', topic: 'Novidades, atualizações e releases do app' },
      { id: 'c_desenvolvimento', server_id: 'srv_dezcord', name: 'dev-chat', type: 'text', category: 'TEXTO', topic: 'Discussões técnicas sobre GitHub, Supabase e React' },
      { id: 'c_memes', server_id: 'srv_dezcord', name: 'memes-e-midia', type: 'text', category: 'TEXTO', topic: 'Compartilhe memes e imagens divertidas' },
      { id: 'c_voz_lounge', server_id: 'srv_dezcord', name: 'Lounge Geral', type: 'voice', category: 'VOZ' },
      { id: 'c_voz_gaming', server_id: 'srv_dezcord', name: 'Gaming 🎮', type: 'voice', category: 'VOZ' },
      { id: 'c_voz_musica', server_id: 'srv_dezcord', name: 'Música & Rádio 🎶', type: 'voice', category: 'VOZ' }
    ]
  },
  {
    id: 'srv_devs',
    name: 'Comunidade Dev Brasil',
    icon_url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=120&auto=format&fit=crop&q=80',
    owner_id: 'usr_carlos',
    description: 'Espaço para desenvolvedores trocarem experiências.',
    channels: [
      { id: 'c_dev_geral', server_id: 'srv_devs', name: 'boas-vindas', type: 'text', category: 'BEM-VINDO' },
      { id: 'c_dev_duvidas', server_id: 'srv_devs', name: 'duvidas-frontend', type: 'text', category: 'SUPORTE' },
      { id: 'c_dev_call', server_id: 'srv_devs', name: 'Pair Programming', type: 'voice', category: 'VOZ' }
    ]
  },
  {
    id: 'srv_games',
    name: 'Squad Gamer',
    icon_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=120&auto=format&fit=crop&q=80',
    owner_id: 'usr_lucas',
    description: 'Jogatinas noturnas e torneios.',
    channels: [
      { id: 'c_game_chat', server_id: 'srv_games', name: 'chat-jogos', type: 'text', category: 'TEXTO' },
      { id: 'c_game_voice1', server_id: 'srv_games', name: 'Call Squad A', type: 'voice', category: 'VOZ' }
    ]
  }
];

export const initialMessages: Record<string, Message[]> = {
  'c_geral': [
    {
      id: 'msg_1',
      channel_id: 'c_geral',
      user_id: 'usr_dez',
      author: sampleUsers[1],
      content: '👋 **Bem-vindos ao DÉZCORD!** O seu novo aplicativo de comunicação em tempo real inspirado no Discord.',
      created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
      reactions: [
        { emoji: '🚀', count: 5, users: ['usr_me', 'usr_aline', 'usr_carlos'] },
        { emoji: '🎉', count: 4, users: ['usr_me', 'usr_lucas'] },
        { emoji: '🔥', count: 6, users: ['usr_carlos', 'usr_aline'] }
      ]
    },
    {
      id: 'msg_2',
      channel_id: 'c_geral',
      user_id: 'usr_carlos',
      author: sampleUsers[4],
      content: 'A integração com o **Supabase** e o **GitHub** está configurada! Suporta mensagens em tempo real, canais de voz com WebRTC e autenticação.',
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      reactions: [
        { emoji: '⚡', count: 3, users: ['usr_me'] }
      ]
    },
    {
      id: 'msg_3',
      channel_id: 'c_geral',
      user_id: 'usr_aline',
      author: sampleUsers[2],
      content: 'A interface do DÉZCORD ficou idêntica ao Discord! O tema escuro, a barra lateral de servidores e canais de voz funcionam perfeitamente.',
      created_at: new Date(Date.now() - 1800000).toISOString(),
      reactions: [
        { emoji: '💜', count: 2, users: ['usr_me', 'usr_aline'] }
      ]
    }
  ],
  'c_desenvolvimento': [
    {
      id: 'msg_dev_1',
      channel_id: 'c_desenvolvimento',
      user_id: 'usr_me',
      author: currentUser,
      content: '```typescript\n// Conexão Supabase Realtime no DÉZCORD\nconst channel = supabase.channel("room-messages")\n  .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, handleNewMessage)\n  .subscribe();\n```\nO código está modularizado e pronto!',
      created_at: new Date(Date.now() - 1200000).toISOString(),
      reactions: [{ emoji: '💻', count: 4, users: ['usr_carlos'] }]
    }
  ]
};
