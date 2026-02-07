import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, MessageSender } from '@/types';
import MessageItem from './MessageItem';
import { Send, Menu } from 'lucide-react';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (query: string) => void;
  isLoading: boolean;
  placeholderText?: string;
  initialQuerySuggestions?: string[];
  onSuggestedQueryClick?: (query: string) => void;
  isFetchingSuggestions?: boolean;
  onToggleSidebar?: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  onSendMessage,
  isLoading,
  placeholderText,
  initialQuerySuggestions,
  onSuggestedQueryClick,
  isFetchingSuggestions,
  onToggleSidebar,
}) => {
  const [userQuery, setUserQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = () => {
    if (userQuery.trim() && !isLoading) {
      onSendMessage(userQuery.trim());
      setUserQuery('');
    }
  };

  const showSuggestions = initialQuerySuggestions && initialQuerySuggestions.length > 0 &&
    messages.filter(m => m.sender !== MessageSender.SYSTEM).length <= 1;

  return (
    <div className="flex flex-col h-full bg-bg-secondary rounded-xl shadow-sm border border-border">
      <div className="p-4 border-b border-border flex justify-between items-center">
        <div className="flex items-center gap-3">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="p-1.5 text-text-secondary hover:text-text-primary rounded-md hover:bg-bg-tertiary transition-colors md:hidden"
              aria-label="Open case file"
            >
              <Menu size={20} />
            </button>
          )}
          <div>
            <h2 className="text-xl font-semibold text-text-primary">BATASnatin Docs Chit-Chat</h2>
            {placeholderText && messages.filter(m => m.sender !== MessageSender.SYSTEM).length === 0 && (
              <p className="text-xs text-text-secondary mt-1 max-w-md truncate" title={placeholderText}>
                {placeholderText}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex-grow p-4 overflow-y-auto chat-container bg-bg-primary">
        <div className="max-w-4xl mx-auto w-full">
          {messages.map((msg) => (
            <MessageItem key={msg.id} message={msg} />
          ))}

          {isFetchingSuggestions && (
            <div className="flex justify-center items-center p-3">
              <div className="flex items-center space-x-1.5 text-text-secondary">
                <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" />
                <span className="text-sm">Fetching suggestions...</span>
              </div>
            </div>
          )}

          {showSuggestions && onSuggestedQueryClick && (
            <div className="my-3 px-1">
              <p className="text-xs text-text-secondary mb-1.5 font-medium">Or try one of these:</p>
              <div className="flex flex-wrap gap-1.5">
                {initialQuerySuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => onSuggestedQueryClick(suggestion)}
                    className="bg-accent-muted text-accent px-2.5 py-1 rounded-full text-xs hover:bg-accent/20 transition-colors shadow-sm"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="p-4 border-t border-border bg-bg-secondary rounded-b-xl">
        <div className="flex items-center gap-2">
          <textarea
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            placeholder="Ask a legal question..."
            className="flex-grow h-8 min-h-[32px] py-1.5 px-2.5 border border-border bg-bg-input text-text-primary placeholder:text-text-tertiary rounded-lg focus:ring-1 focus:ring-accent/30 focus:border-accent/30 transition-shadow resize-none text-sm"
            rows={1}
            disabled={isLoading || isFetchingSuggestions}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || isFetchingSuggestions || !userQuery.trim()}
            className="h-8 w-8 p-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0"
            aria-label="Send message"
          >
            {isLoading && messages[messages.length - 1]?.isLoading && messages[messages.length - 1]?.sender === MessageSender.MODEL ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
