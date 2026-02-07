import React from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import sql from 'highlight.js/lib/languages/sql';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import bash from 'highlight.js/lib/languages/bash';
import plaintext from 'highlight.js/lib/languages/plaintext';
import DOMPurify from 'dompurify';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('json', json);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('plaintext', plaintext);
import { ChatMessage, MessageSender, UrlContextMetadataItem, FileData } from '@/types';
import { FileImage, FileText, Loader2 } from 'lucide-react';

marked.setOptions({
  highlight: function (code: string, lang: string) {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
    return hljs.highlight(code, { language }).value;
  },
  langPrefix: 'hljs language-',
} as object);

interface MessageItemProps {
  message: ChatMessage;
}

const SenderAvatar: React.FC<{ sender: MessageSender }> = ({ sender }) => {
  let avatarChar = '';
  let classes = '';

  if (sender === MessageSender.USER) {
    avatarChar = 'U';
    classes = 'bg-accent text-white';
  } else if (sender === MessageSender.MODEL) {
    avatarChar = 'AI';
    classes = 'bg-bg-hover text-text-primary';
  } else {
    avatarChar = 'S';
    classes = 'bg-bg-tertiary text-text-secondary';
  }

  return (
    <div className={`w-8 h-8 rounded-full ${classes} flex items-center justify-center text-sm font-semibold flex-shrink-0`}>
      {avatarChar}
    </div>
  );
};

const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const isUser = message.sender === MessageSender.USER;
  const isModel = message.sender === MessageSender.MODEL;
  const isSystem = message.sender === MessageSender.SYSTEM;

  const renderMessageContent = () => {
    if (isModel && !message.isLoading) {
      const rawMarkup = marked.parse(message.text || '') as string;
      const sanitizedMarkup = DOMPurify.sanitize(rawMarkup);
      return <div className="prose prose-sm w-full min-w-0" dangerouslySetInnerHTML={{ __html: sanitizedMarkup }} />;
    }

    let textClass = 'text-text-primary';
    if (isUser) textClass = 'text-white dark:text-white';
    if (isSystem) textClass = 'text-text-secondary';

    return <div className={`whitespace-pre-wrap text-sm ${textClass}`}>{message.text}</div>;
  };

  const renderUserAttachedFiles = (files: FileData[]) => (
    <div className="mt-2.5 pt-2.5 border-t border-border-subtle">
      <h4 className="text-xs font-semibold text-text-secondary mb-1.5">Attached Document(s):</h4>
      <ul className="space-y-1">
        {files.map(file => (
          <li key={file.id} className="flex items-center gap-2 text-xs text-text-primary">
            {file.mimeType.startsWith('image/')
              ? <FileImage size={14} className="text-text-secondary flex-shrink-0" />
              : <FileText size={14} className="text-text-secondary flex-shrink-0" />}
            <span className="truncate" title={file.name}>{file.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  const renderModelProcessingFiles = (files: FileData[]) => (
    <div className="mt-2.5 pt-2.5 border-t border-border-subtle">
      <h4 className="text-xs font-semibold text-text-secondary mb-1.5 flex items-center gap-1.5">
        <Loader2 size={12} className="animate-spin" />
        Processing {files.length} document(s)...
      </h4>
      <ul className="space-y-1">
        {files.map(file => (
          <li key={file.id} className="flex items-center gap-2 text-xs text-text-secondary">
            {file.mimeType.startsWith('image/')
              ? <FileImage size={14} className="flex-shrink-0" />
              : <FileText size={14} className="flex-shrink-0" />}
            <span className="truncate" title={file.name}>{file.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  let bubbleClasses = 'p-3 rounded-lg shadow-sm w-full ';
  if (isUser) {
    bubbleClasses += 'bg-user-bubble text-white rounded-br-none';
  } else if (isModel) {
    bubbleClasses += 'bg-model-bubble border border-border-subtle rounded-bl-none';
  } else {
    bubbleClasses += 'bg-system-bubble text-text-secondary rounded-bl-none';
  }

  return (
    <div className={`flex mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="flex items-start gap-2 max-w-[85%]">
        {!isUser && <SenderAvatar sender={message.sender} />}
        <div className={bubbleClasses}>
          {message.isLoading ? (
            <div className="flex items-center space-x-1.5">
              <div className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:-0.3s] bg-text-secondary" />
              <div className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:-0.15s] bg-text-secondary" />
              <div className="w-1.5 h-1.5 rounded-full animate-bounce bg-text-secondary" />
            </div>
          ) : (
            renderMessageContent()
          )}

          {isUser && message.files && message.files.length > 0 && renderUserAttachedFiles(message.files)}
          {isModel && message.isLoading && message.files && message.files.length > 0 && renderModelProcessingFiles(message.files)}

          {isModel && !message.isLoading && message.urlContext && message.urlContext.length > 0 && (
            <div className="mt-2.5 pt-2.5 border-t border-border-subtle">
              <h4 className="text-xs font-semibold text-text-secondary mb-1">Context URLs Retrieved:</h4>
              <ul className="space-y-0.5">
                {message.urlContext.map((meta: UrlContextMetadataItem, index: number) => {
                  const statusText = typeof meta.urlRetrievalStatus === 'string'
                    ? meta.urlRetrievalStatus.replace('URL_RETRIEVAL_STATUS_', '')
                    : 'UNKNOWN';
                  const isSuccess = meta.urlRetrievalStatus === 'URL_RETRIEVAL_STATUS_SUCCESS';

                  return (
                    <li key={index} className="text-[11px] text-text-secondary">
                      <a href={meta.retrievedUrl} target="_blank" rel="noopener noreferrer" className="hover:underline break-all text-accent">
                        {meta.retrievedUrl}
                      </a>
                      <span className={`ml-1.5 px-1 py-0.5 rounded-sm text-[9px] ${
                        isSuccess
                          ? 'bg-accent-muted text-accent'
                          : 'bg-bg-tertiary text-text-tertiary'
                      }`}>
                        {statusText}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {message.aiProvider && !message.isLoading && (
            <div className="mt-1.5 text-[10px] text-text-tertiary text-right">
              via {message.aiProvider}
            </div>
          )}
        </div>
        {isUser && <SenderAvatar sender={message.sender} />}
      </div>
    </div>
  );
};

export default MessageItem;
