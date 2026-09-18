export type UserStatus = 'online' | 'idle' | 'dnd' | 'offline';

export interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  status: UserStatus;
  custom_status?: string;
  bio?: string;
  banner_color?: string;
  email?: string;
}

export type ChannelType = 'text' | 'voice' | 'files' | 'tasks';

export interface Channel {
  id: string;
  server_id: string;
  name: string;
  type: ChannelType;
  category?: string;
  topic?: string;
  unread_count?: number;
}

export interface FileFolder {
  id: string;
  project_id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
}

export interface ProjectFile {
  id: string;
  project_id: string;
  folder_id: string | null;
  name: string;
  size: number;
  mime_type: string;
  url: string; // Base64 data URL or external URL
  uploaded_by: UserProfile;
  created_at: string;
}

export interface ProjectTask {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done';
  assigned_to?: UserProfile;
  priority: 'low' | 'medium' | 'high';
  created_at: string;
}

export interface Server {
  id: string;
  name: string;
  icon_url: string;
  owner_id: string;
  description?: string;
  channels: Channel[];
}

export interface Reaction {
  emoji: string;
  count: number;
  users: string[]; // user IDs
}

export interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  author: UserProfile;
  content: string;
  created_at: string;
  updated_at?: string;
  attachments?: string[];
  reactions?: Reaction[];
  reply_to?: {
    id: string;
    author_name: string;
    content: string;
  };
}

export interface VoiceParticipant {
  user_id: string;
  user: UserProfile;
  is_speaking: boolean;
  is_muted: boolean;
  is_deafened: boolean;
  is_video: boolean;
  is_screensharing: boolean;
}

export interface DirectMessageConversation {
  id: string;
  user: UserProfile;
  last_message?: string;
  unread_count?: number;
}
