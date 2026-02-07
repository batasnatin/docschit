import React, { useState, useRef } from 'react';
import { Plus, Trash2, ChevronDown, X, FileUp, FileText, FileImage, Loader2 } from 'lucide-react';
import { KnowledgeGroup, FileData } from '@/types';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

interface KnowledgeBaseManagerProps {
  urls: string[];
  onAddUrl: (url: string) => void;
  onRemoveUrl: (url: string) => void;
  onClearUrls: () => void;
  maxUrls?: number;
  files: FileData[];
  onAddFile: (file: FileData) => void;
  onRemoveFile: (fileId: string) => void;
  onClearFiles: () => void;
  maxFiles?: number;
  knowledgeGroups: KnowledgeGroup[];
  activeGroupId: string;
  onSetGroupId: (id: string) => void;
  onCloseSidebar?: () => void;
}

const MAX_FILE_SIZE_MB = 150;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const KnowledgeBaseManager: React.FC<KnowledgeBaseManagerProps> = ({
  urls,
  onAddUrl,
  onRemoveUrl,
  onClearUrls,
  maxUrls = 20,
  files,
  onAddFile,
  onRemoveFile,
  onClearFiles,
  maxFiles = 5,
  knowledgeGroups,
  activeGroupId,
  onSetGroupId,
  onCloseSidebar,
}) => {
  const [currentUrlInput, setCurrentUrlInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddUrl = () => {
    setError(null);
    const urlInput = currentUrlInput.trim();
    if (!urlInput) { setError('URL cannot be empty.'); return; }

    let normalizedUrl = urlInput;
    if (!/^(?:f|ht)tps?:\/\//i.test(urlInput)) {
      normalizedUrl = 'https://' + urlInput;
    }

    try {
      const urlObject = new URL(normalizedUrl);
      if (urlObject.protocol !== 'http:' && urlObject.protocol !== 'https:') {
        throw new Error('Only http and https protocols are supported.');
      }
      if (!urlObject.hostname.includes('.') && urlObject.hostname !== 'localhost') {
        throw new Error('Please enter a valid domain name.');
      }
      const finalUrl = urlObject.toString();
      if (urls.length >= maxUrls) { setError(`Maximum of ${maxUrls} URLs reached for this group.`); return; }
      if (urls.includes(finalUrl)) { setError('This URL has already been added to this group.'); return; }
      onAddUrl(finalUrl);
      setCurrentUrlInput('');
    } catch {
      setError('Invalid URL format. Please enter a full and valid web address.');
    }
  };

  const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(new Error(`Failed to read file: ${reader.error?.message || 'Unknown error'}`));
      reader.readAsArrayBuffer(file);
    });

  const readFileAsDataURL = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error(`Failed to read file: ${reader.error?.message || 'Unknown error'}`));
      reader.readAsDataURL(file);
    });

  const readFileAsText = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error(`Failed to read file: ${reader.error?.message || 'Unknown error'}`));
      reader.readAsText(file);
    });

  const readImageFile = async (file: File, fileId: string): Promise<FileData> => {
    const dataUrl = await readFileAsDataURL(file);
    const base64String = dataUrl.split(',')[1];
    if (!base64String) throw new Error('Could not encode image file to Base64.');
    return { id: fileId, name: file.name, mimeType: file.type, data: base64String };
  };

  const readPdfFile = async (file: File, fileId: string): Promise<FileData> => {
    try {
      const arrayBuffer = await readFileAsArrayBuffer(file);
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map(item => 'str' in item ? item.str : '').join(' ');
        fullText += '\n';
      }
      return { id: fileId, name: file.name, mimeType: file.type, text: fullText };
    } catch (err: unknown) {
      const error = err as Error & { name?: string };
      if (error.name === 'PasswordException') throw new Error(`Failed to parse '${file.name}': The PDF is password-protected.`);
      throw new Error(`Failed to parse PDF '${file.name}'. It may be corrupted or in an unsupported format.`);
    }
  };

  const readDocxFile = async (file: File, fileId: string): Promise<FileData> => {
    try {
      const arrayBuffer = await readFileAsArrayBuffer(file);
      const result = await mammoth.extractRawText({ arrayBuffer });
      return { id: fileId, name: file.name, mimeType: file.type, text: result.value };
    } catch {
      throw new Error(`Failed to parse DOCX '${file.name}'. The file may be corrupted or not a valid .docx file.`);
    }
  };

  const readTextFile = async (file: File, fileId: string): Promise<FileData> => {
    const text = await readFileAsText(file);
    if (typeof text !== 'string') throw new Error(`Could not read the content of text file '${file.name}'.`);
    return { id: fileId, name: file.name, mimeType: file.type || 'text/plain', text };
  };

  const processFile = async (file: File): Promise<FileData> => {
    const fileId = `file-${Date.now()}-${file.name}`;
    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    if (file.type.startsWith('image/')) return readImageFile(file, fileId);
    if (fileExtension === 'pdf' || file.type === 'application/pdf') return readPdfFile(file, fileId);
    if (fileExtension === 'docx' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return readDocxFile(file, fileId);
    return readTextFile(file, fileId);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = event.target.files?.[0];
    if (!file) return;
    if (files.length >= maxFiles) { setError(`Maximum of ${maxFiles} files reached for this group.`); return; }
    if (file.size > MAX_FILE_SIZE_BYTES) { setError(`File size cannot exceed ${MAX_FILE_SIZE_MB}MB.`); return; }
    if (files.some(f => f.name === file.name)) { setError(`A file named "${file.name}" has already been added.`); return; }

    setIsProcessingFile(true);
    try {
      const newFile = await processFile(file);
      onAddFile(newFile);
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'An unknown error occurred while processing the file.');
    } finally {
      setIsProcessingFile(false);
      if (event.target) event.target.value = '';
    }
  };

  const activeGroupName = knowledgeGroups.find(g => g.id === activeGroupId)?.name || 'Unknown Group';
  const acceptedFileTypes = '.txt,.md,.json,.py,.js,.html,.css,.csv,image/png,image/jpeg,image/webp,.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  return (
    <div className="p-4 bg-bg-secondary shadow-sm rounded-xl h-full flex flex-col border border-border">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold text-text-primary">Case File</h2>
        {onCloseSidebar && (
          <button
            onClick={onCloseSidebar}
            className="p-1 text-text-secondary hover:text-text-primary rounded-md hover:bg-bg-tertiary transition-colors md:hidden"
            aria-label="Close case file"
          >
            <X size={24} />
          </button>
        )}
      </div>

      <div className="mb-3">
        <label htmlFor="url-group-select-kb" className="block text-sm font-medium text-text-secondary mb-1">
          Active Case File
        </label>
        <div className="relative w-full">
          <select
            id="url-group-select-kb"
            value={activeGroupId}
            onChange={(e) => onSetGroupId(e.target.value)}
            className="w-full py-2 pl-3 pr-8 appearance-none border border-border bg-bg-input text-text-primary rounded-md focus:ring-1 focus:ring-accent/30 focus:border-accent/30 text-sm"
          >
            {knowledgeGroups.map(group => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary pointer-events-none" aria-hidden="true" />
        </div>
      </div>

      {/* URL Management */}
      <div className="mb-1">
        <label className="block text-xs font-medium text-text-secondary mb-1">URL Management</label>
        <div className="flex items-center gap-2">
          <input
            type="url"
            value={currentUrlInput}
            onChange={(e) => setCurrentUrlInput(e.target.value)}
            placeholder="https://lawphil.net/statutes/..."
            className="flex-grow h-8 py-1 px-2.5 border border-border bg-bg-input text-text-primary placeholder:text-text-tertiary rounded-lg focus:ring-1 focus:ring-accent/30 focus:border-accent/30 transition-shadow text-sm"
            onKeyPress={(e) => e.key === 'Enter' && handleAddUrl()}
          />
          <button
            onClick={handleAddUrl}
            disabled={urls.length >= maxUrls}
            className="h-8 w-8 p-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0"
            aria-label="Add URL"
          >
            <Plus size={16} />
          </button>
          <button
            onClick={onClearUrls}
            disabled={urls.length === 0}
            className="h-8 w-8 p-1.5 bg-danger-muted hover:bg-danger/20 text-danger rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0"
            aria-label="Clear all URLs"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* File Management */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-text-secondary mb-1 mt-2">File Management</label>
        <input type="file" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} accept={acceptedFileTypes} />
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={files.length >= maxFiles || isProcessingFile}
            className="flex-grow h-8 px-3 bg-bg-tertiary hover:bg-bg-hover text-text-primary rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-sm gap-2"
            aria-label="Upload a file"
          >
            {isProcessingFile ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <FileUp size={14} />
                <span>Upload Document</span>
              </>
            )}
          </button>
          <button
            onClick={onClearFiles}
            disabled={files.length === 0}
            className="flex-shrink-0 h-8 px-3 bg-danger-muted hover:bg-danger/20 text-danger rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-sm gap-2"
            aria-label="Clear all files"
          >
            <Trash2 size={14} />
            <span>Clear</span>
          </button>
        </div>
        <p className="text-xs text-center text-text-tertiary mt-1.5">Supports text, images, PDF, and .docx files.</p>
      </div>

      {error && <p className="text-xs text-danger mb-2">{error}</p>}

      <div className="flex-grow overflow-y-auto space-y-2 chat-container">
        {urls.length === 0 && files.length === 0 && (
          <p className="text-text-tertiary text-center py-3 text-sm">
            Add legal documents or URLs to the case file "{activeGroupName}" to begin your analysis.
          </p>
        )}

        {urls.map((url) => (
          <div key={url} className="flex items-center justify-between p-2.5 bg-bg-tertiary border border-border-subtle rounded-lg hover:shadow-sm transition-shadow">
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline truncate" title={url}>
              {url}
            </a>
            <button
              onClick={() => onRemoveUrl(url)}
              className="p-1 text-text-secondary hover:text-danger rounded-md hover:bg-danger-muted transition-colors flex-shrink-0 ml-2"
              aria-label={`Remove ${url}`}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}

        {files.map((file) => (
          <div key={file.id} className="flex items-center justify-between p-2.5 bg-bg-tertiary border border-border-subtle rounded-lg hover:shadow-sm transition-shadow">
            <div className="flex items-center gap-2 truncate">
              {file.mimeType.startsWith('image/') ? (
                <FileImage size={16} className="text-text-secondary flex-shrink-0" />
              ) : (
                <FileText size={16} className="text-text-secondary flex-shrink-0" />
              )}
              <span className="text-xs text-text-primary truncate" title={file.name}>{file.name}</span>
            </div>
            <button
              onClick={() => onRemoveFile(file.id)}
              className="p-1 text-text-secondary hover:text-danger rounded-md hover:bg-danger-muted transition-colors flex-shrink-0 ml-2"
              aria-label={`Remove ${file.name}`}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KnowledgeBaseManager;
