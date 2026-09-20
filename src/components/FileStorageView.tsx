import { useState, useRef } from 'react';
import type { FileFolder, ProjectFile, UserProfile } from '../types';
import {
  Folder,
  FolderPlus,
  Upload,
  FileText,
  Image as ImageIcon,
  FileCode,
  FileArchive,
  File,
  Download,
  Trash2,
  Share2,
  Eye,
  ChevronRight,
  Search,
  X,
  HardDrive,
  Users,
  Menu
} from 'lucide-react';

interface FileStorageViewProps {
  projectId: string;
  projectName: string;
  folders: FileFolder[];
  files: ProjectFile[];
  currentUser: UserProfile;
  onCreateFolder: (name: string, parentId: string | null) => void;
  onDeleteFolder: (folderId: string) => void;
  onUploadFile: (file: { name: string; size: number; mimeType: string; url: string; folderId: string | null }) => void;
  onDeleteFile: (fileId: string) => void;
  onShareToChat?: (file: ProjectFile) => void;
  showMemberList?: boolean;
  onToggleMemberList?: () => void;
  onOpenChannelList?: () => void;
}

type FilterType = 'all' | 'images' | 'documents';

export const FileStorageView = ({
  projectId,
  projectName,
  folders,
  files,
  currentUser: _currentUser,
  onCreateFolder,
  onDeleteFolder,
  onUploadFile,
  onDeleteFile,
  onShareToChat,
  showMemberList,
  onToggleMemberList,
  onOpenChannelList,
}: FileStorageViewProps) => {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [previewFile, setPreviewFile] = useState<ProjectFile | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Filter folders for current directory
  const currentFolders = folders.filter(
    (f) => f.project_id === projectId && f.parent_id === currentFolderId
  );

  // Filter files for current directory and filter type
  const currentFiles = files.filter((f) => {
    if (f.project_id !== projectId) return false;
    if (currentFolderId !== null && f.folder_id !== currentFolderId) return false;
    if (currentFolderId === null && f.folder_id !== null && !searchQuery) return false;

    if (searchQuery) {
      return f.name.toLowerCase().includes(searchQuery.toLowerCase());
    }

    if (filter === 'images') {
      return f.mime_type.startsWith('image/');
    }
    if (filter === 'documents') {
      return !f.mime_type.startsWith('image/');
    }
    return true;
  });

  // Calculate current folder breadcrumbs
  const getBreadcrumbs = () => {
    const crumbs = [{ id: null as string | null, name: projectName }];
    if (!currentFolderId) return crumbs;

    let curr = folders.find((f) => f.id === currentFolderId);
    const path = [];
    while (curr) {
      path.unshift({ id: curr.id, name: curr.name });
      curr = folders.find((f) => f.id === curr?.parent_id);
    }
    return [...crumbs, ...path];
  };

  // Process File Upload
  const handleFileUpload = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    Array.from(fileList).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        onUploadFile({
          name: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
          url: reader.result as string,
          folderId: currentFolderId,
        });
      };
      reader.readAsDataURL(file);
    });
  };

  // Helper to format bytes
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // File type icon helper
  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon size={22} className="text-[#3ecf8e]" />;
    if (mimeType.includes('pdf')) return <FileText size={22} className="text-[#f23f43]" />;
    if (mimeType.includes('javascript') || mimeType.includes('typescript') || mimeType.includes('json') || mimeType.includes('html')) {
      return <FileCode size={22} className="text-[#5865f2]" />;
    }
    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar')) {
      return <FileArchive size={22} className="text-[#f0b232]" />;
    }
    return <File size={22} className="text-[#949ba4]" />;
  };

  return (
    <div
      className="flex-1 bg-[#313338] flex flex-col h-full overflow-hidden relative"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFileUpload(e.dataTransfer.files);
      }}
    >
      {/* Drag overlay indicator */}
      {isDragging && (
        <div className="absolute inset-0 z-40 bg-[#5865f2]/20 border-4 border-dashed border-[#5865f2] rounded-xl flex items-center justify-center backdrop-blur-xs">
          <div className="bg-[#1e1f22] px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 text-white">
            <Upload size={32} className="text-[#5865f2] animate-bounce" />
            <span className="font-bold text-lg">Solte os arquivos para fazer upload no projeto</span>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="h-14 px-3 md:px-6 border-b border-[#1f2023] flex items-center justify-between gap-2 shadow-sm bg-[#313338]">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 overflow-x-auto text-sm text-[#949ba4] min-w-0">
          {onOpenChannelList && (
            <button
              onClick={onOpenChannelList}
              title="Lista de canais"
              className="md:hidden text-[#b5bac1] hover:text-white transition shrink-0"
            >
              <Menu size={22} />
            </button>
          )}
          <HardDrive size={18} className="text-[#5865f2] shrink-0" />
          {getBreadcrumbs().map((crumb, idx, arr) => (
            <div key={idx} className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setCurrentFolderId(crumb.id)}
                className={`hover:text-white transition font-medium ${
                  idx === arr.length - 1 ? 'text-white font-semibold' : ''
                }`}
              >
                {crumb.name}
              </button>
              {idx < arr.length - 1 && <ChevronRight size={14} className="text-[#4e5058]" />}
            </div>
          ))}
        </div>

        {/* Action Buttons & Filters */}
        <div className="flex items-center gap-3">
          {/* Search Box */}
          <div className="relative flex items-center">
            <input
              type="text"
              placeholder="Buscar arquivo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-40 focus:w-56 bg-[#1e1f22] text-xs px-3 py-1.5 pr-7 rounded text-white placeholder-[#949ba4] focus:outline-none transition-all"
            />
            <Search size={14} className="absolute right-2 text-[#949ba4] pointer-events-none" />
          </div>

          {/* Filter Pills */}
          <div className="flex bg-[#1e1f22] p-0.5 rounded text-xs text-[#949ba4]">
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded transition ${
                filter === 'all' ? 'bg-[#35373c] text-white font-medium' : 'hover:text-white'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilter('images')}
              className={`px-2.5 py-1 rounded transition ${
                filter === 'images' ? 'bg-[#35373c] text-white font-medium' : 'hover:text-white'
              }`}
            >
              Imagens
            </button>
            <button
              onClick={() => setFilter('documents')}
              className={`px-2.5 py-1 rounded transition ${
                filter === 'documents' ? 'bg-[#35373c] text-white font-medium' : 'hover:text-white'
              }`}
            >
              Documentos
            </button>
          </div>

          {/* New Folder Button */}
          <button
            onClick={() => setIsCreatingFolder(true)}
            className="flex items-center gap-1.5 bg-[#2b2d31] hover:bg-[#35373c] text-white text-xs font-semibold px-3 py-1.5 rounded transition"
            title="Criar Pasta"
          >
            <FolderPlus size={16} className="text-[#f0b232]" />
            <span>Nova Pasta</span>
          </button>

          {/* Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-semibold px-3.5 py-1.5 rounded transition shadow"
            title="Upload de Arquivos"
          >
            <Upload size={16} />
            <span>Upload</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={(e) => handleFileUpload(e.target.files)}
            className="hidden"
          />

          {/* Member List Toggle */}
          {onToggleMemberList && (
            <button
              onClick={onToggleMemberList}
              title={showMemberList ? 'Ocultar Lista de Usuários' : 'Exibir Lista de Usuários'}
              className={`p-1.5 rounded transition ${
                showMemberList ? 'text-white bg-[#404249]' : 'text-[#b5bac1] hover:bg-[#35373c] hover:text-white'
              }`}
            >
              <Users size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Main Storage Content Area */}
      <div className="flex-1 p-6 overflow-y-auto space-y-6">
        {/* Create Folder Inline Modal */}
        {isCreatingFolder && (
          <div className="bg-[#2b2d31] p-4 rounded-lg border border-[#3f4147] flex items-center gap-3 max-w-md animate-scale-up">
            <FolderPlus size={20} className="text-[#f0b232] shrink-0" />
            <input
              type="text"
              autoFocus
              placeholder="Nome da pasta (ex: Documentos, Design, Sprint 1)"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newFolderName.trim()) {
                  onCreateFolder(newFolderName.trim(), currentFolderId);
                  setNewFolderName('');
                  setIsCreatingFolder(false);
                }
                if (e.key === 'Escape') setIsCreatingFolder(false);
              }}
              className="bg-[#1e1f22] text-sm text-white px-3 py-1.5 rounded flex-1 focus:outline-none focus:ring-1 focus:ring-[#5865f2]"
            />
            <button
              onClick={() => {
                if (newFolderName.trim()) {
                  onCreateFolder(newFolderName.trim(), currentFolderId);
                  setNewFolderName('');
                  setIsCreatingFolder(false);
                }
              }}
              className="bg-[#23a55a] hover:bg-[#1f9350] text-white text-xs px-3 py-1.5 rounded font-semibold"
            >
              Criar
            </button>
            <button
              onClick={() => setIsCreatingFolder(false)}
              className="text-[#949ba4] hover:text-white text-xs"
            >
              Cancelar
            </button>
          </div>
        )}

        {/* Folders Section */}
        {currentFolders.length > 0 && (
          <div>
            <div className="text-xs font-bold text-[#949ba4] uppercase tracking-wider mb-3">
              Pastas ({currentFolders.length})
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {currentFolders.map((folder) => (
                <div
                  key={folder.id}
                  onClick={() => setCurrentFolderId(folder.id)}
                  className="bg-[#2b2d31] hover:bg-[#35373c] p-3 rounded-lg border border-[#35373c] cursor-pointer transition flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Folder size={20} className="text-[#f0b232] shrink-0" />
                    <span className="text-sm font-semibold text-white truncate">{folder.name}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteFolder(folder.id);
                    }}
                    title="Excluir Pasta"
                    className="opacity-0 group-hover:opacity-100 hover:text-[#f23f43] text-[#949ba4] transition"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Files Section */}
        <div>
          <div className="text-xs font-bold text-[#949ba4] uppercase tracking-wider mb-3">
            Arquivos ({currentFiles.length})
          </div>

          {currentFiles.length === 0 ? (
            <div className="bg-[#2b2d31]/50 border-2 border-dashed border-[#35373c] rounded-xl p-12 text-center flex flex-col items-center justify-center">
              <Upload size={40} className="text-[#949ba4] mb-3 opacity-50" />
              <div className="text-white font-semibold text-base">Nenhum arquivo nesta pasta</div>
              <p className="text-xs text-[#949ba4] mt-1 max-w-sm">
                Arraste e solte arquivos aqui ou clique no botão de Upload no topo para adicionar imagens e documentos ao projeto.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {currentFiles.map((file) => {
                const isImage = file.mime_type.startsWith('image/');

                return (
                  <div
                    key={file.id}
                    className="bg-[#2b2d31] border border-[#35373c] rounded-xl overflow-hidden hover:border-[#5865f2]/60 hover:shadow-lg transition flex flex-col group"
                  >
                    {/* File Thumbnail or Icon Header */}
                    <div
                      onClick={() => setPreviewFile(file)}
                      className="h-32 bg-[#1e1f22] flex items-center justify-center cursor-pointer overflow-hidden relative group/thumb"
                    >
                      {isImage ? (
                        <img
                          src={file.url}
                          alt={file.name}
                          className="w-full h-full object-cover transition duration-300 group-hover/thumb:scale-105"
                        />
                      ) : (
                        <div className="p-4 flex flex-col items-center gap-2">
                          {getFileIcon(file.mime_type)}
                          <span className="text-[10px] text-[#949ba4] uppercase tracking-wider font-mono">
                            {file.name.split('.').pop()}
                          </span>
                        </div>
                      )}

                      {/* Quick Hover Overlay */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center gap-2 transition">
                        <span className="bg-[#111214]/80 p-2 rounded-full text-white hover:scale-110 transition">
                          <Eye size={18} />
                        </span>
                      </div>
                    </div>

                    {/* File Metadata & Actions */}
                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <div>
                        <div
                          onClick={() => setPreviewFile(file)}
                          className="text-sm font-semibold text-white truncate cursor-pointer hover:text-[#5865f2] transition"
                          title={file.name}
                        >
                          {file.name}
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[#949ba4] mt-1">
                          <span>{formatBytes(file.size)}</span>
                          <span>{new Date(file.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {/* Card Action Buttons */}
                      <div className="flex items-center justify-between border-t border-[#35373c] pt-2 mt-3 text-[#949ba4]">
                        {/* Share to Chat button */}
                        {onShareToChat && (
                          <button
                            onClick={() => onShareToChat(file)}
                            className="flex items-center gap-1 text-xs hover:text-[#5865f2] transition"
                            title="Compartilhar no Chat"
                          >
                            <Share2 size={14} />
                            <span>Chat</span>
                          </button>
                        )}

                        {/* Download link */}
                        <a
                          href={file.url}
                          download={file.name}
                          className="hover:text-white transition p-1"
                          title="Baixar Arquivo"
                        >
                          <Download size={15} />
                        </a>

                        {/* Delete button */}
                        <button
                          onClick={() => onDeleteFile(file.id)}
                          className="hover:text-[#f23f43] transition p-1"
                          title="Excluir Arquivo"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* File Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111214]/85 backdrop-blur-sm p-6">
          <div className="bg-[#313338] rounded-xl border border-[#3f4147] shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#1f2023] flex items-center justify-between">
              <div className="truncate">
                <div className="text-base font-bold text-white truncate">{previewFile.name}</div>
                <div className="text-xs text-[#949ba4]">
                  {formatBytes(previewFile.size)} • {previewFile.mime_type}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={previewFile.url}
                  download={previewFile.name}
                  className="bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs px-3 py-1.5 rounded flex items-center gap-1.5 font-semibold transition"
                >
                  <Download size={14} />
                  <span>Download</span>
                </a>
                <button
                  onClick={() => setPreviewFile(null)}
                  className="text-[#949ba4] hover:text-white transition"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 p-6 overflow-auto flex items-center justify-center bg-[#1e1f22]">
              {previewFile.mime_type.startsWith('image/') ? (
                <img
                  src={previewFile.url}
                  alt={previewFile.name}
                  className="max-h-[70vh] object-contain rounded shadow"
                />
              ) : (
                <div className="text-center p-8">
                  <FileText size={64} className="text-[#5865f2] mx-auto mb-4" />
                  <div className="text-lg font-bold text-white mb-2">{previewFile.name}</div>
                  <p className="text-xs text-[#949ba4] mb-4">
                    Este documento pode ser baixado diretamente para visualização local no seu leitor preferido.
                  </p>
                  <a
                    href={previewFile.url}
                    download={previewFile.name}
                    className="inline-flex items-center gap-2 bg-[#23a55a] hover:bg-[#1f9350] text-white text-sm px-4 py-2 rounded-md font-semibold transition"
                  >
                    <Download size={16} />
                    <span>Baixar Arquivo Completo</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
