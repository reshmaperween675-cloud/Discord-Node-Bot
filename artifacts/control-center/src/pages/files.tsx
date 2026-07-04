import React, { useState } from "react";
import { useGetFileTree, useGetFileContent, useSearchFiles } from "@workspace/api-client-react";
import { FileNode, FileSearchResult } from "@workspace/api-client-react";
import { Folder, FolderOpen, File as FileIcon, FileCode2, Search, Loader2, ChevronRight, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function FilesPage() {
  const { data: tree, isLoading: treeLoading } = useGetFileTree();
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  
  // Minimal search integration
  const [searchQuery, setSearchQuery] = useState("");
  const { data: searchResults } = useSearchFiles(
    { q: searchQuery },
    { query: { enabled: searchQuery.length > 2 } }
  );

  return (
    <div className="flex h-full max-w-[1800px] mx-auto overflow-hidden">
      
      {/* File Tree Sidebar */}
      <div className="w-72 border-r border-white/5 bg-black/10 flex flex-col shrink-0">
        <div className="p-4 border-b border-white/5">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input 
              placeholder="Search files..." 
              className="pl-8 bg-black/20 border-white/10 font-mono text-xs h-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {treeLoading ? (
            <div className="flex items-center justify-center p-8"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="font-mono text-sm">
              {tree && Array.isArray(tree) && (tree as FileNode[]).map((node: FileNode, i: number) => (
                <TreeNode key={i} node={node} onSelect={setSelectedPath} selectedPath={selectedPath} level={0} />
              ))}
              {tree && !Array.isArray(tree) && <TreeNode node={tree as FileNode} onSelect={setSelectedPath} selectedPath={selectedPath} level={0} />}
            </div>
          )}
        </div>
      </div>

      {/* Editor/Viewer Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e]">
        {searchQuery.length > 2 ? (
          <div className="flex-1 overflow-y-auto p-6">
            <h3 className="text-sm font-mono text-muted-foreground mb-4 border-b border-white/10 pb-2">Search Results for "{searchQuery}"</h3>
            <div className="space-y-4">
              {searchResults?.map((res: FileSearchResult, i: number) => (
                <div key={i} className="bg-black/30 border border-white/5 rounded-md p-4 cursor-pointer hover:border-primary/50" onClick={() => setSelectedPath(res.path)}>
                  <div className="text-xs font-mono text-primary mb-2">{res.path}:{res.line}</div>
                  <pre className="text-xs font-mono text-white/80 overflow-x-auto whitespace-pre-wrap">{res.content}</pre>
                </div>
              ))}
              {searchResults?.length === 0 && (
                <div className="text-center py-12 text-muted-foreground font-mono">No matches found.</div>
              )}
            </div>
          </div>
        ) : selectedPath ? (
          <FileViewer path={selectedPath} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground opacity-50">
            <FileCode2 className="w-16 h-16 mb-4" />
            <span className="font-mono text-sm tracking-widest">SELECT_FILE_TO_VIEW</span>
          </div>
        )}
      </div>
    </div>
  );
}

function TreeNode({ node, onSelect, selectedPath, level }: { node: FileNode, onSelect: (path: string) => void, selectedPath: string | null, level: number }) {
  const [isOpen, setIsOpen] = useState(level === 0 || node.name === "src");
  const isDir = node.type === "directory";
  
  if (isDir) {
    return (
      <div className="select-none">
        <div 
          className="flex items-center py-1 px-2 hover:bg-white/5 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
          style={{ paddingLeft: `${level * 12 + 8}px` }}
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <ChevronDown className="w-3 h-3 mr-1 opacity-70" /> : <ChevronRight className="w-3 h-3 mr-1 opacity-70" />}
          {isOpen ? <FolderOpen className="w-3.5 h-3.5 mr-1.5 text-primary/70" /> : <Folder className="w-3.5 h-3.5 mr-1.5 text-primary/70" />}
          <span className="truncate">{node.name}</span>
        </div>
        {isOpen && node.children?.map((child: FileNode, i: number) => (
          <TreeNode key={i} node={child} onSelect={onSelect} selectedPath={selectedPath} level={level + 1} />
        ))}
      </div>
    );
  }

  const isSelected = selectedPath === node.path;
  
  return (
    <div 
      className={`flex items-center py-1 px-2 cursor-pointer transition-colors ${isSelected ? 'bg-primary/20 text-primary' : 'hover:bg-white/5 text-muted-foreground hover:text-foreground'}`}
      style={{ paddingLeft: `${level * 12 + 20}px` }}
      onClick={() => onSelect(node.path)}
    >
      <FileIcon className={`w-3 h-3 mr-2 shrink-0 ${isSelected ? 'text-primary' : 'opacity-50'}`} />
      <span className="truncate">{node.name}</span>
    </div>
  );
}

function FileViewer({ path }: { path: string }) {
  const { data: file, isLoading } = useGetFileContent({ path }, { query: { enabled: !!path } });

  return (
    <div className="flex flex-col h-full">
      <div className="h-10 bg-black/40 border-b border-white/5 flex items-center px-4 shrink-0">
        <FileIcon className="w-3.5 h-3.5 text-muted-foreground mr-2" />
        <span className="font-mono text-xs text-foreground truncate">{path}</span>
        {file && (
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">{file.lines} LINES | {file.language?.toUpperCase() || 'TXT'}</span>
        )}
      </div>
      
      <div className="flex-1 overflow-auto bg-[#1e1e1e] p-4 relative">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !file ? (
          <div className="text-center py-12 text-muted-foreground font-mono">FILE_NOT_FOUND</div>
        ) : (
          <pre className="font-mono text-[13px] leading-relaxed text-[#d4d4d4] w-full">
            <code>
              {/* Very basic syntax coloring approximation - a real app would use Prism/Monaco */}
              {file.content.split('\n').map((line: string, i: number) => (
                <div key={i} className="flex hover:bg-white/[0.02]">
                  <span className="w-10 shrink-0 text-right pr-4 text-[#858585] select-none">{i + 1}</span>
                  <span className="whitespace-pre break-all">{line}</span>
                </div>
              ))}
            </code>
          </pre>
        )}
      </div>
    </div>
  );
}
