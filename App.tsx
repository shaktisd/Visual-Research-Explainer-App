
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Upload, FileText, Activity, AlertCircle, X, Folder, Save, FolderOpen, Plus, Trash2, Download, File, ChevronRight, Edit2 } from 'lucide-react';
import { analyzePaper } from './services/geminiService';
import { TreeVisualizer } from './components/TreeVisualizer';
import { ConceptDetail } from './components/ConceptDetail';
import { ConceptNode, ProcessingStatus, TreeData, Project, ResearchDocument } from './types';

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

function App() {
  // State
  const [project, setProject] = useState<Project>({
    id: generateId(),
    name: 'Untitled Research Project',
    createdAt: Date.now(),
    documents: []
  });
  
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  
  // PDF URL for the generic PDF viewer - derived from active doc
  const [activePdfUrl, setActivePdfUrl] = useState<string | null>(null);
  
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  // Derived Active Document
  const activeDocument = project.documents.find(d => d.id === activeDocId) || null;
  const activeTreeData = activeDocument?.treeData || null;

  // Selected Node Object (derived from tree search)
  const getSelectedNode = useCallback((root: ConceptNode | undefined, id: string | null): ConceptNode | null => {
    if (!root || !id) return null;
    if (root.id === id) return root;
    if (root.children) {
      for (const child of root.children) {
        const found = getSelectedNode(child, id);
        if (found) return found;
      }
    }
    return null;
  }, []);

  const selectedNode = activeTreeData ? getSelectedNode(activeTreeData.root, selectedNodeId) : null;

  // Update PDF URL when active document changes
  useEffect(() => {
    if (activeDocument && activeDocument.contentBase64 && activeDocument.fileType === 'application/pdf') {
       // Convert Base64 back to Blob URL for viewing
       const byteCharacters = atob(activeDocument.contentBase64);
       const byteNumbers = new Array(byteCharacters.length);
       for (let i = 0; i < byteCharacters.length; i++) {
           byteNumbers[i] = byteCharacters.charCodeAt(i);
       }
       const byteArray = new Uint8Array(byteNumbers);
       const blob = new Blob([byteArray], { type: 'application/pdf' });
       const url = URL.createObjectURL(blob);
       setActivePdfUrl(url);
       return () => URL.revokeObjectURL(url);
    } else {
       setActivePdfUrl(null);
    }
  }, [activeDocument]);

  // --- Project Actions ---

  const handleNewProject = () => {
    // If there are documents, warn the user
    if (project.documents.length > 0) {
      if (!window.confirm("Start a new project? Any unsaved progress on the current project will be lost.")) {
        return;
      }
    }

    const projectName = prompt("Enter a name for the new project:", "My Research Project");
    if (!projectName) return; // User cancelled

    setProject({
      id: generateId(),
      name: projectName,
      createdAt: Date.now(),
      documents: []
    });
    setActiveDocId(null);
    setSelectedNodeId(null);
  };

  const handleRenameProject = () => {
      const newName = prompt("Rename Project:", project.name);
      if (newName && newName.trim()) {
          setProject(p => ({ ...p, name: newName.trim() }));
      }
  };

  const handleSaveProject = () => {
    const dataStr = JSON.stringify(project);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `${project.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleImportProject = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        // Basic validation
        if (!json.documents || !Array.isArray(json.documents)) {
           throw new Error("Invalid project file format");
        }
        setProject(json);
        // Set first doc as active if available
        if (json.documents.length > 0) {
            setActiveDocId(json.documents[0].id);
            if (json.documents[0].treeData) {
               setSelectedNodeId(json.documents[0].treeData.root.id);
            }
        }
      } catch (err) {
        alert("Failed to import project: Invalid file.");
        console.error(err);
      }
    };
    reader.readAsText(file);
    // Reset input
    event.target.value = '';
  };

  // --- Document Actions ---

  const handleAddDocument = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Create new document entry
    const newDocId = generateId();
    
    // Read file immediately for Base64 storage
    const reader = new FileReader();
    reader.onload = async () => {
       const base64String = (reader.result as string).split(',')[1];
       
       const newDoc: ResearchDocument = {
          id: newDocId,
          name: file.name,
          fileType: file.type,
          contentBase64: base64String,
          treeData: null,
          status: { step: 'analyzing', message: 'Analyzing structure...' }
       };

       // Add to project and set active
       setProject(prev => ({
          ...prev,
          documents: [...prev.documents, newDoc]
       }));
       setActiveDocId(newDocId);
       
       // Trigger Analysis
       try {
          const rootNode = await analyzePaper(base64String, file.type);
          
          setProject(prev => ({
             ...prev,
             documents: prev.documents.map(d => d.id === newDocId ? {
                 ...d,
                 treeData: { root: rootNode },
                 status: { step: 'visualizing' }
             } : d)
          }));
          
          // Auto-select root
          setSelectedNodeId(rootNode.id);

       } catch (error: any) {
          setProject(prev => ({
             ...prev,
             documents: prev.documents.map(d => d.id === newDocId ? {
                 ...d,
                 status: { step: 'error', message: error.message || 'Analysis failed' }
             } : d)
          }));
       }
    };
    reader.readAsDataURL(file);
    event.target.value = ''; // Reset
  };

  const handleDeleteDocument = (docId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (window.confirm("Remove this document from the project?")) {
          setProject(prev => ({
              ...prev,
              documents: prev.documents.filter(d => d.id !== docId)
          }));
          if (activeDocId === docId) {
              setActiveDocId(null);
              setSelectedNodeId(null);
          }
      }
  };

  // --- Tree Interaction ---

  const handleUpdateActiveTree = useCallback((updatedNode: ConceptNode) => {
     if (!activeDocId) return;

     setProject(prev => {
         const docIndex = prev.documents.findIndex(d => d.id === activeDocId);
         if (docIndex === -1) return prev;

         const currentDoc = prev.documents[docIndex];
         if (!currentDoc.treeData) return prev;

         // Recursive update helper
         const updateNodeInTree = (current: ConceptNode): ConceptNode => {
             if (current.id === updatedNode.id) return updatedNode;
             if (current.children) {
                 return { ...current, children: current.children.map(updateNodeInTree) };
             }
             return current;
         };

         const newTreeData = { root: updateNodeInTree(currentDoc.treeData.root) };

         const updatedDoc = { ...currentDoc, treeData: newTreeData };
         const newDocs = [...prev.documents];
         newDocs[docIndex] = updatedDoc;

         return { ...prev, documents: newDocs };
     });
     
     // Ensure selection stays
     setSelectedNodeId(updatedNode.id);
  }, [activeDocId]);


  const handleExpandNode = useCallback((parentNode: ConceptNode, newChildren: ConceptNode[]) => {
      const updatedParent = {
          ...parentNode,
          children: [...(parentNode.children || []), ...newChildren]
      };
      handleUpdateActiveTree(updatedParent);
  }, [handleUpdateActiveTree]);

  return (
    <div className="flex h-screen w-screen bg-slate-100 text-slate-900 overflow-hidden">
      
      {/* LEFT SIDEBAR: Project Explorer */}
      <aside className={`bg-slate-900 text-slate-300 flex flex-col transition-all duration-300 ${isSidebarOpen ? 'w-72' : 'w-0 overflow-hidden'}`}>
         {/* Project Header */}
         <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0 group">
             <div className="flex items-center space-x-2 truncate overflow-hidden cursor-pointer" onClick={handleRenameProject}>
                 <Folder size={18} className="text-blue-400 shrink-0" />
                 <span className="font-semibold text-sm truncate text-slate-200" title={project.name}>{project.name}</span>
             </div>
             <button 
                onClick={handleRenameProject} 
                className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                title="Rename Project"
             >
                <Edit2 size={14} />
             </button>
         </div>

         {/* Document List */}
         <div className="flex-1 overflow-y-auto p-2 space-y-1">
             <div className="text-xs font-bold text-slate-500 uppercase px-3 py-2 mt-2">Documents</div>
             
             {project.documents.map(doc => (
                 <div 
                    key={doc.id}
                    onClick={() => { setActiveDocId(doc.id); if(doc.treeData) setSelectedNodeId(doc.treeData.root.id); }}
                    className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${activeDocId === doc.id ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}
                 >
                     <div className="flex items-center space-x-3 overflow-hidden">
                         {doc.status.step === 'analyzing' || doc.status.step === 'uploading' ? (
                             <Activity size={16} className="animate-spin text-blue-400" />
                         ) : doc.status.step === 'error' ? (
                             <AlertCircle size={16} className="text-red-400" />
                         ) : (
                             <FileText size={16} className={activeDocId === doc.id ? 'text-white' : 'text-slate-400'} />
                         )}
                         <span className="truncate">{doc.name}</span>
                     </div>
                     <button 
                        onClick={(e) => handleDeleteDocument(doc.id, e)}
                        className={`opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-700 ${activeDocId === doc.id ? 'hover:bg-blue-700' : ''}`}
                     >
                         <Trash2 size={12} />
                     </button>
                 </div>
             ))}

             {/* Add Document Button */}
             <label className="flex items-center space-x-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-800 text-slate-400 hover:text-blue-400 border border-dashed border-slate-700 hover:border-blue-400 mt-2 transition-all">
                 <Plus size={16} />
                 <span className="text-sm">Add PDF to Project</span>
                 <input type="file" className="hidden" accept=".pdf,.txt,.md" onChange={handleAddDocument} />
             </label>
         </div>

         {/* Project Actions Footer */}
         <div className="p-4 border-t border-slate-800 bg-slate-950 space-y-2 shrink-0">
             <div className="grid grid-cols-2 gap-2">
                <button onClick={handleSaveProject} className="flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-xs py-2 rounded transition-colors">
                    <Save size={14} /> <span>Save</span>
                </button>
                <label className="flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-xs py-2 rounded transition-colors cursor-pointer">
                    <FolderOpen size={14} /> <span>Open</span>
                    <input type="file" className="hidden" accept=".json" onChange={handleImportProject} />
                </label>
             </div>
             <button onClick={handleNewProject} className="w-full flex items-center justify-center space-x-2 bg-transparent hover:bg-slate-900 text-slate-500 hover:text-slate-300 text-xs py-2 rounded border border-slate-800 transition-colors">
                 <Plus size={14} /> <span>New Project</span>
             </button>
         </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative h-full overflow-hidden">
        {/* Header */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 z-20 shadow-sm">
           <div className="flex items-center">
              {!isSidebarOpen && (
                  <button onClick={() => setSidebarOpen(true)} className="mr-4 text-slate-500 hover:text-slate-700">
                      <ChevronRight size={20} />
                  </button>
              )}
               {activeDocument && (
                  <div className="flex items-center space-x-2">
                     <FileText size={18} className="text-blue-500" />
                     <h2 className="font-semibold text-slate-700">{activeDocument.name}</h2>
                     <span className={`text-xs px-2 py-0.5 rounded-full ${activeDocument.status.step === 'visualizing' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {activeDocument.status.step === 'visualizing' ? 'Ready' : activeDocument.status.step}
                     </span>
                  </div>
               )}
           </div>
           
           <div className="flex items-center space-x-2">
                {isSidebarOpen && (
                   <button onClick={() => setSidebarOpen(false)} title="Toggle Sidebar" className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-md">
                       <X size={18} />
                   </button>
                )}
           </div>
        </header>

        {/* Workspace */}
        <div className="flex-1 relative bg-dot-pattern overflow-hidden">
            {!activeDocument ? (
                // Empty State / Dashboard
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50">
                    <div className="max-w-lg">
                        <div className="w-20 h-20 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center mx-auto mb-6">
                            <Folder size={40} className="text-blue-500" />
                        </div>
                        <h1 className="text-3xl font-bold text-slate-800 mb-2">{project.name}</h1>
                        <p className="text-slate-500 mb-8">
                            {project.documents.length === 0 
                                ? "This project is empty. Upload a research paper to start analyzing." 
                                : "Select a document from the sidebar to view its concept tree."}
                        </p>
                        
                        {project.documents.length === 0 && (
                            <label className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-lg shadow-blue-200/50 transition-all cursor-pointer">
                                <Plus className="mr-2" size={20} />
                                Add First Document
                                <input type="file" className="hidden" accept=".pdf,.txt,.md" onChange={handleAddDocument} />
                            </label>
                        )}
                    </div>
                </div>
            ) : (
                <>
                    {/* Processing States */}
                    {(activeDocument.status.step === 'analyzing' || activeDocument.status.step === 'uploading') && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-10">
                            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                            <h3 className="text-xl font-semibold text-slate-700">Analyzing Document</h3>
                            <p className="text-slate-500 mt-2 animate-pulse">{activeDocument.status.message}</p>
                        </div>
                    )}

                    {activeDocument.status.step === 'error' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-white z-10">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4">
                                <AlertCircle size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-red-600 mb-2">Analysis Failed</h3>
                            <p className="text-slate-600 max-w-md text-center mb-6">{activeDocument.status.message}</p>
                        </div>
                    )}

                    {/* Visualization */}
                    {activeDocument.status.step === 'visualizing' && activeDocument.treeData && (
                        <TreeVisualizer 
                           data={activeDocument.treeData.root} 
                           onNodeClick={(node) => setSelectedNodeId(node.id)} 
                           selectedNodeId={selectedNodeId || undefined}
                        />
                    )}
                </>
            )}
        </div>
      </main>

      {/* RIGHT SIDEBAR: Details */}
      <aside className={`w-[400px] shrink-0 border-l border-slate-200 bg-white shadow-xl z-30 transition-transform ${selectedNode ? 'translate-x-0' : 'translate-x-full absolute right-0'}`}>
         {activeDocument && (
            <ConceptDetail 
                node={selectedNode} 
                pdfUrl={activePdfUrl}
                onUpdateNode={handleUpdateActiveTree}
                onExpandNode={handleExpandNode}
                onViewImage={setViewingImageUrl}
            />
         )}
      </aside>
       
       {/* Collapsed Right Sidebar Placeholder (optional visual cue) */}
       {!selectedNode && activeDocument && (
          <div className="absolute right-6 bottom-6 z-20 pointer-events-none">
             {/* Can add help text or minimal controls here */}
          </div>
       )}

      {/* Fullscreen Image Modal */}
      {viewingImageUrl && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={() => setViewingImageUrl(null)}
          >
              <button 
                  className="absolute top-6 right-6 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors z-50"
                  onClick={(e) => {
                      e.stopPropagation();
                      setViewingImageUrl(null);
                  }}
              >
                  <X size={32} />
              </button>
              <img 
                src={viewingImageUrl} 
                alt="Full size concept" 
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300 select-none"
                onClick={(e) => e.stopPropagation()} 
              />
          </div>
      )}
    </div>
  );
}

export default App;
