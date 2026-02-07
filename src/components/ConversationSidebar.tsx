import React from 'react';
import { Plus, Trash2, MessageSquare, Loader2 } from 'lucide-react';
import { Conversation } from '@/types';
import clsx from 'clsx';

interface ConversationSidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  loading: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString();
};

const groupByDate = (conversations: Conversation[]) => {
  const groups: Record<string, Conversation[]> = {};
  conversations.forEach(conv => {
    const label = formatDate(conv.updated_at);
    if (!groups[label]) groups[label] = [];
    groups[label].push(conv);
  });
  return groups;
};

const ConversationSidebar: React.FC<ConversationSidebarProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  loading,
  hasMore,
  onLoadMore,
}) => {
  const grouped = groupByDate(conversations);

  return (
    <div className="flex flex-col h-full">
      <button
        onClick={onNewConversation}
        className="flex items-center gap-2 px-3 py-2.5 mb-3 bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors text-sm font-medium w-full justify-center"
      >
        <Plus size={16} />
        New Chat
      </button>

      <div className="flex-1 overflow-y-auto chat-container space-y-4">
        {loading && conversations.length === 0 && (
          <p className="text-text-tertiary text-sm text-center py-4">Loading conversations...</p>
        )}
        {!loading && conversations.length === 0 && (
          <p className="text-text-tertiary text-sm text-center py-4">No conversations yet. Start a new chat!</p>
        )}

        {Object.entries(grouped).map(([dateLabel, convs]) => (
          <div key={dateLabel}>
            <p className="text-xs text-text-tertiary font-medium px-2 mb-1">{dateLabel}</p>
            <div className="space-y-0.5">
              {convs.map(conv => (
                <div
                  key={conv.id}
                  className={clsx(
                    'group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors',
                    conv.id === activeConversationId
                      ? 'bg-accent-muted text-accent'
                      : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
                  )}
                  onClick={() => onSelectConversation(conv.id)}
                >
                  <MessageSquare size={14} className="flex-shrink-0" />
                  <span className="text-sm truncate flex-1">{conv.title}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteConversation(conv.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-text-tertiary hover:text-danger rounded transition-all"
                    aria-label={`Delete ${conv.title}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

        {hasMore && onLoadMore && (
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="w-full py-2 text-xs text-text-secondary hover:text-text-primary transition-colors flex items-center justify-center gap-1.5"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : null}
            {loading ? 'Loading...' : 'Load older conversations'}
          </button>
        )}
      </div>
    </div>
  );
};

export default ConversationSidebar;
