import type { UserProfile } from '../types';
import { Crown } from 'lucide-react';

interface MemberListSidebarProps {
  members: UserProfile[];
  ownerId: string;
}

export const MemberListSidebar: React.FC<MemberListSidebarProps> = ({ members, ownerId }) => {
  const getStatusDot = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-[#23a55a]';
      case 'idle':
        return 'bg-[#f0b232]';
      case 'dnd':
        return 'bg-[#f23f43]';
      default:
        return 'bg-[#80848e]';
    }
  };

  const onlineMembers = members.filter((m) => m.status !== 'offline');
  const offlineMembers = members.filter((m) => m.status === 'offline');

  return (
    <div className="w-60 bg-[#2b2d31] flex flex-col h-full border-l border-[#1f2023] select-none p-3 overflow-y-auto">
      {/* ONLINE CATEGORY */}
      <div className="mb-4">
        <div className="text-[11px] font-bold text-[#949ba4] tracking-wider uppercase px-2 mb-1">
          ONLINE — {onlineMembers.length}
        </div>

        <div className="space-y-0.5">
          {onlineMembers.map((member) => {
            const isOwner = member.id === ownerId;
            const isBot = member.username.includes('bot');

            return (
              <div
                key={member.id}
                className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-[#35373c] cursor-pointer transition group"
              >
                <div className="relative shrink-0">
                  <img
                    src={member.avatar_url}
                    alt={member.username}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                  <span
                    className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#2b2d31] ${getStatusDot(
                      member.status
                    )}`}
                  />
                </div>

                <div className="truncate flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-[#dbdee1] group-hover:text-white">
                    <span className="truncate">{member.display_name}</span>
                    {isOwner && <Crown size={14} className="text-[#f0b232] shrink-0" />}
                    {isBot && (
                      <span className="bg-[#5865f2] text-white text-[9px] font-bold px-1 rounded uppercase">
                        BOT
                      </span>
                    )}
                  </div>
                  {member.custom_status && (
                    <div className="text-xs text-[#949ba4] truncate font-normal">
                      {member.custom_status}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* OFFLINE CATEGORY */}
      {offlineMembers.length > 0 && (
        <div>
          <div className="text-[11px] font-bold text-[#949ba4] tracking-wider uppercase px-2 mb-1">
            OFFLINE — {offlineMembers.length}
          </div>

          <div className="space-y-0.5">
            {offlineMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-[#35373c] cursor-pointer transition opacity-60 hover:opacity-100"
              >
                <div className="relative shrink-0">
                  <img
                    src={member.avatar_url}
                    alt={member.username}
                    className="w-8 h-8 rounded-full object-cover grayscale"
                  />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#2b2d31] bg-[#80848e]" />
                </div>
                <div className="truncate flex-1">
                  <div className="text-sm font-medium text-[#949ba4] truncate">
                    {member.display_name}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
