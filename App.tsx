
import React, { useState, useCallback, useEffect } from 'react';
import { Upload, FileText, Activity, AlertCircle } from 'lucide-react';
import { analyzePaper } from './services/geminiService';
import { TreeVisualizer } from './components/TreeVisualizer';
import { ConceptDetail } from './components/ConceptDetail';
import { ConceptNode, ProcessingStatus, TreeData } from './types';

function App() {
  const [status, setStatus] = useState<ProcessingStatus>({ step: 'idle' });
  const [treeData, setTreeData] = useState<TreeData | null>(null);
  const [selectedNode, setSelectedNode] = useState<ConceptNode | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Cleanup object URL when component unmounts or url changes
  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  // File Upload Handler
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus({ step: 'uploading' });

    try {
      // Validate file type
      if (!['application/pdf', 'text/plain', 'text/markdown'].includes(file.type)) {
         throw new Error("Unsupported file type. Please upload PDF, TXT or MD.");
      }

      setStatus({ step: 'analyzing', message: 'Reading document and building concept tree...' });

      // Create URL for PDF rendering if it is a PDF
      if (file.type === 'application/pdf') {
          const url = URL.createObjectURL(file);
          setPdfUrl(url);
      } else {
          setPdfUrl(null);
      }

      // Convert to Base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64String = (reader.result as string).split(',')[1];
        try {
           const rootNode = await analyzePaper(base64String, file.type);
           setTreeData({ root: rootNode });
           setSelectedNode(rootNode); // Select root initially
           setStatus({ step: 'visualizing' });
        } catch (err: any) {
           setStatus({ step: 'error', message: err.message || 'Failed to analyze paper' });
        }
      };
      reader.onerror = () => setStatus({ step: 'error', message: 'Failed to read file' });
      reader.readAsDataURL(file);

    } catch (error: any) {
      setStatus({ step: 'error', message: error.message });
    }
  };

  const handleNodeClick = useCallback((node: ConceptNode) => {
    setSelectedNode(node);
  }, []);

  const handleUpdateNode = useCallback((updatedNode: ConceptNode) => {
     // Recursively update the tree data
     const updateTree = (current: ConceptNode): ConceptNode => {
         if (current.id === updatedNode.id) {
             return updatedNode;
         }
         if (current.children) {
             return {
                 ...current,
                 children: current.children.map(updateTree)
             };
         }
         return current;
     };

     if (treeData) {
         setTreeData({ root: updateTree(treeData.root) });
         setSelectedNode(updatedNode); // Keep selection updated
     }
  }, [treeData]);

  const handleExpandNode = useCallback((parentNode: ConceptNode, newChildren: ConceptNode[]) => {
      // Append new children to the parent node
      const updatedParent = {
          ...parentNode,
          children: [...(parentNode.children || []), ...newChildren]
      };
      handleUpdateNode(updatedParent);
  }, [handleUpdateNode]);

  return (
    <div className="flex h-screen w-screen bg-slate-50 text-slate-900">
      
      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative">
        {/* Top Navigation / Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-20">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
               <Activity size={20} />
            </div>
            <h1 className="font-bold text-lg text-slate-800">Visual Research Explainer</h1>
          </div>
          
          {status.step !== 'idle' && status.step !== 'error' && (
             <div className="flex items-center text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                {status.step === 'analyzing' ? status.message : 'Visualization Active'}
             </div>
          )}

           <div className="flex items-center space-x-4">
               {/* Simple Re-upload button */}
               <label className="cursor-pointer text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">
                  Upload New
                  <input type="file" className="hidden" accept=".pdf,.txt,.md" onChange={handleFileUpload} />
               </label>
           </div>
        </header>

        {/* Central Visualization Canvas */}
        <div className="flex-1 relative overflow-hidden bg-dot-pattern">
            {status.step === 'idle' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-slate-50">
                    <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-slate-100 text-center">
                        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-600">
                            <Upload size={32} />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">Upload Research Paper</h2>
                        <p className="text-slate-500 mb-8">
                            Select a PDF to generate an interactive "Chain of Thought" visual explanation tree.
                        </p>
                        
                        <label className="block w-full cursor-pointer group">
                             <div className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-200 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center">
                                 <FileText className="mr-2" size={20} />
                                 Select PDF File
                             </div>
                             <input type="file" className="hidden" accept=".pdf,.txt,.md" onChange={handleFileUpload} />
                        </label>
                        <p className="mt-4 text-xs text-slate-400">
                           Supported formats: PDF, TXT, Markdown
                        </p>
                    </div>
                </div>
            )}

            {status.step === 'analyzing' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-10">
                    <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                    <h3 className="text-xl font-semibold text-slate-700">Analyzing Document</h3>
                    <p className="text-slate-500 mt-2 animate-pulse">Deconstructing concepts...</p>
                </div>
            )}

            {status.step === 'error' && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-white">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4">
                        <AlertCircle size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-red-600 mb-2">Analysis Failed</h3>
                    <p className="text-slate-600 max-w-md text-center mb-6">{status.message}</p>
                    <button 
                       onClick={() => setStatus({ step: 'idle' })}
                       className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
                    >
                        Try Again
                    </button>
                 </div>
            )}

            {status.step === 'visualizing' && treeData && (
                <TreeVisualizer 
                   data={treeData.root} 
                   onNodeClick={handleNodeClick} 
                   selectedNodeId={selectedNode?.id}
                />
            )}
        </div>
      </main>

      {/* Right Sidebar - Detail View */}
      <aside className={`w-[400px] shrink-0 transform transition-transform duration-300 ease-in-out absolute right-0 top-16 bottom-0 z-30 lg:relative lg:top-0 lg:block bg-white shadow-2xl lg:shadow-none ${status.step === 'visualizing' ? 'translate-x-0' : 'translate-x-full lg:translate-x-0 lg:hidden'}`}>
         <ConceptDetail 
            node={selectedNode} 
            pdfUrl={pdfUrl}
            onUpdateNode={handleUpdateNode}
            onExpandNode={handleExpandNode}
         />
      </aside>
    </div>
  );
}

export default App;
