
import React, { useState, useEffect, useRef } from 'react';
import { ConceptNode, ExtractedFigure } from '../types';
import { generateConceptImage, expandNodeWithAI, askQuestionOnNode } from '../services/geminiService';
import { Sparkles, RefreshCw, ChevronRight, BookOpen, Lightbulb, Image as ImageIcon, MessageSquare, Send, BarChart2, FileText, Info, Eye } from 'lucide-react';

interface ConceptDetailProps {
  node: ConceptNode | null;
  pdfUrl: string | null;
  onUpdateNode: (node: ConceptNode) => void;
  onExpandNode: (parentNode: ConceptNode, newChildren: ConceptNode[]) => void;
}

type Tab = 'explain' | 'evidence' | 'qa';

export const ConceptDetail: React.FC<ConceptDetailProps> = ({ node, pdfUrl, onUpdateNode, onExpandNode }) => {
  const [loadingImage, setLoadingImage] = useState(false);
  const [loadingExpansion, setLoadingExpansion] = useState(false);
  const [questionInput, setQuestionInput] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('explain');
  const [selectedFigure, setSelectedFigure] = useState<ExtractedFigure | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-generate image if missing when node is opened
    if (node && !node.imageUrl && !loadingImage) {
        generateImage();
    }
    // Default to explain tab when switching nodes
    setActiveTab('explain');
    setSelectedFigure(null);
  }, [node]);

  // When switching to evidence tab, auto-select first figure if available
  useEffect(() => {
      if (activeTab === 'evidence' && node?.figures && node.figures.length > 0 && !selectedFigure) {
          setSelectedFigure(node.figures[0]);
      }
  }, [activeTab, node]);

  const generateImage = async () => {
    if (!node) return;
    setLoadingImage(true);
    try {
      const url = await generateConceptImage(node.imagePrompt);
      onUpdateNode({ ...node, imageUrl: url });
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingImage(false);
    }
  };

  const handleExpand = async () => {
      if (!node) return;
      setLoadingExpansion(true);
      const newChildren = await expandNodeWithAI(node);
      onExpandNode(node, newChildren);
      setLoadingExpansion(false);
  }

  const handleAskQuestion = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!node || !questionInput.trim()) return;

      const questionText = questionInput;
      setQuestionInput(''); // Clear input immediately
      setIsAsking(true);
      
      const answer = await askQuestionOnNode(node, questionText);
      
      const newQA = {
          question: questionText,
          answer: answer,
          timestamp: Date.now()
      };

      const updatedNode = {
          ...node,
          qa: [...(node.qa || []), newQA]
      };
      
      onUpdateNode(updatedNode);
      setIsAsking(false);
      
      // Force switch to QA tab if not already
      setActiveTab('qa');
  };

  const renderMarkdownTable = (content: string) => {
    const rows = content.trim().split('\n').filter(r => r.trim().startsWith('|'));
    if (rows.length < 2) return <pre className="text-xs bg-slate-50 p-2 overflow-x-auto whitespace-pre-wrap font-mono">{content}</pre>;

    return (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="min-w-full text-sm text-left">
                <tbody>
                    {rows.map((row, i) => {
                        const cells = row.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
                        if (row.includes('---')) return null;
                        return (
                            <tr key={i} className={i === 0 ? "bg-slate-100 font-bold" : "border-t border-slate-100"}>
                                {cells.map((cell, cIdx) => (
                                    <td key={cIdx} className="px-4 py-2 whitespace-nowrap">{cell.trim()}</td>
                                ))}
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    );
  };

  if (!node) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
        <BookOpen className="w-16 h-16 mb-4 opacity-20" />
        <h3 className="text-xl font-semibold mb-2">Select a Concept</h3>
        <p className="text-sm max-w-xs">Click on any node in the visualization to see its detailed breakdown, analogy, and visual explanation.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white border-l border-slate-200 shadow-xl">
      
      {/* Header Image Area */}
      <div className="relative w-full h-40 bg-slate-100 flex items-center justify-center group overflow-hidden shrink-0">
        {node.imageUrl ? (
            <img src={node.imageUrl} alt={node.label} className="w-full h-full object-cover" />
        ) : (
            <div className="flex flex-col items-center text-slate-400">
                {loadingImage ? <RefreshCw className="w-6 h-6 animate-spin mb-1" /> : <ImageIcon className="w-8 h-8 mb-1 opacity-50" />}
                <span className="text-xs">{loadingImage ? 'Generating...' : 'Waiting for image...'}</span>
            </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white sticky top-0 z-10">
          <button 
            onClick={() => setActiveTab('explain')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center ${activeTab === 'explain' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
              <FileText size={16} className="mr-2" /> Explanation
          </button>
          <button 
            onClick={() => setActiveTab('evidence')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center ${activeTab === 'evidence' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
              <BarChart2 size={16} className="mr-2" /> Data & Evidence
              {node.figures && node.figures.length > 0 && (
                  <span className="ml-1 bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full text-xs">{node.figures.length}</span>
              )}
          </button>
          <button 
            onClick={() => setActiveTab('qa')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center ${activeTab === 'qa' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
              <MessageSquare size={16} className="mr-2" /> Q&A
          </button>
      </div>

      {/* Scrollable Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 pb-20">
        <div className="mb-2">
            <h2 className="text-2xl font-bold text-slate-900 leading-tight">{node.label}</h2>
            <p className="text-slate-400 text-xs font-mono mt-1">ID: {node.id.slice(0,8)}</p>
        </div>

        {activeTab === 'explain' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center">
                        <BookOpen size={14} className="mr-2" /> Technical Summary
                    </h4>
                    <p className="text-slate-700 leading-relaxed text-sm">
                        {node.description}
                    </p>
                </div>
                <div>
                    <h4 className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-2 flex items-center">
                        <Sparkles size={14} className="mr-2" /> Simply Put
                    </h4>
                    <p className="text-slate-800 text-lg font-light leading-relaxed">
                        "{node.simpleExplanation}"
                    </p>
                </div>
                <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
                    <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2 flex items-center">
                        <Lightbulb size={14} className="mr-2" /> Analogy
                    </h4>
                    <p className="text-amber-900 italic text-sm">
                        {node.analogy}
                    </p>
                </div>
                 <button 
                    onClick={handleExpand}
                    disabled={loadingExpansion}
                    className="w-full py-3 px-4 bg-white border-2 border-slate-200 hover:border-blue-400 hover:text-blue-600 text-slate-600 font-semibold rounded-lg flex items-center justify-center transition-colors"
                 >
                    {loadingExpansion ? <RefreshCw className="animate-spin mr-2" size={18} /> : <ChevronRight className="mr-2" size={18} />}
                    {loadingExpansion ? 'Expanding Chain of Thought...' : 'Deep Dive (Add Sub-concepts)'}
                 </button>
            </div>
        )}

        {activeTab === 'evidence' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {!node.figures || node.figures.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">
                        <BarChart2 className="w-12 h-12 mx-auto mb-2 opacity-20" />
                        <p className="text-sm">No specific tables or charts extracted for this concept.</p>
                    </div>
                ) : (
                    <>
                        {/* Figure Selection List */}
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                            {node.figures.map((fig, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setSelectedFigure(fig)}
                                    className={`shrink-0 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                                        selectedFigure === fig 
                                            ? 'bg-blue-50 border-blue-200 text-blue-700' 
                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    {fig.type.charAt(0).toUpperCase() + fig.type.slice(1)} {idx + 1}
                                </button>
                            ))}
                        </div>

                        {/* Selected Figure Detail */}
                        {selectedFigure && (
                            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm animate-in fade-in zoom-in-95 duration-200">
                                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                                    <h4 className="font-semibold text-slate-800 text-sm truncate pr-2">{selectedFigure.title}</h4>
                                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${selectedFigure.type === 'table' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                        Pg {selectedFigure.pageNumber}
                                    </span>
                                </div>
                                
                                {/* PDF Viewer (Source) */}
                                {pdfUrl && (
                                   <div className="relative w-full bg-slate-100 border-b border-slate-200">
                                       <div className="absolute top-2 right-2 z-10 bg-black/50 text-white text-[10px] px-2 py-1 rounded pointer-events-none">
                                           Original Source (Page {selectedFigure.pageNumber})
                                       </div>
                                       <iframe 
                                            src={`${pdfUrl}#page=${selectedFigure.pageNumber}&view=FitH`} 
                                            className="w-full h-64 lg:h-80" 
                                            title={`PDF Source Page ${selectedFigure.pageNumber}`}
                                       />
                                       <div className="p-2 bg-slate-50 text-[10px] text-slate-400 text-center border-t border-slate-200">
                                           Scroll PDF to find figure if not immediately visible
                                       </div>
                                   </div>
                                )}

                                <div className="p-4 bg-white">
                                    <h5 className="text-xs font-bold text-slate-400 uppercase mb-2">AI Extraction</h5>
                                    {selectedFigure.type === 'table' ? (
                                        renderMarkdownTable(selectedFigure.content)
                                    ) : (
                                        <div className="bg-slate-50 p-3 rounded text-sm text-slate-600 font-mono whitespace-pre-wrap border border-slate-100">
                                            {selectedFigure.content}
                                        </div>
                                    )}
                                </div>
                                <div className="bg-amber-50 px-4 py-3 border-t border-amber-100">
                                    <div className="flex items-start">
                                        <Info size={14} className="text-amber-500 mt-0.5 mr-2 shrink-0" />
                                        <p className="text-xs text-amber-900 italic">{selectedFigure.insight}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        )}

        {activeTab === 'qa' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                 {node.qa && node.qa.length > 0 ? (
                    <div className="space-y-4">
                        {node.qa.map((item, idx) => (
                            <div key={idx} className="text-sm">
                                <div className="font-medium text-slate-800 mb-1 flex items-start">
                                    <span className="text-blue-500 mr-2 font-bold">Q:</span> 
                                    {item.question}
                                </div>
                                <div className="text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    {item.answer}
                                </div>
                                <div className="text-right mt-1">
                                    <span className="text-[10px] text-slate-300">{new Date(item.timestamp).toLocaleTimeString()}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                 ) : (
                     <div className="text-center py-8 text-slate-400">
                         <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-20" />
                         <p className="text-sm">Ask a question below to start a discussion about this concept.</p>
                     </div>
                 )}
                 {isAsking && (
                     <div className="text-sm pt-2 animate-pulse">
                         <div className="font-medium text-slate-800 mb-1">Q: {questionInput || "Sending..."}</div>
                         <div className="text-slate-400 bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-center">
                             <RefreshCw size={14} className="animate-spin mr-2" /> AI is thinking...
                         </div>
                     </div>
                 )}
            </div>
        )}
      </div>

      <div className="p-4 bg-white border-t border-slate-200">
         <form onSubmit={handleAskQuestion} className="relative">
             <input
                type="text"
                value={questionInput}
                onChange={(e) => setQuestionInput(e.target.value)}
                placeholder="Ask a question about this concept..."
                className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm"
                disabled={isAsking}
             />
             <button 
                type="submit"
                disabled={!questionInput.trim() || isAsking}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-blue-600 hover:bg-blue-50 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
             >
                <Send size={18} />
             </button>
         </form>
      </div>
    </div>
  );
};
