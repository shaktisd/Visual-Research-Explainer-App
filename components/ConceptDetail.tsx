
import React, { useState, useEffect, useRef } from 'react';
import { ConceptNode } from '../types';
import { generateConceptImage, expandNodeWithAI, askQuestionOnNode } from '../services/geminiService';
import { Sparkles, RefreshCw, ChevronRight, BookOpen, Lightbulb, Image as ImageIcon, MessageSquare, Send, FileText, Maximize2 } from 'lucide-react';

interface ConceptDetailProps {
  node: ConceptNode | null;
  pdfUrl: string | null;
  onUpdateNode: (node: ConceptNode) => void;
  onExpandNode: (parentNode: ConceptNode, newChildren: ConceptNode[]) => void;
  onViewImage: (url: string) => void;
}

type Tab = 'explain' | 'qa';

export const ConceptDetail: React.FC<ConceptDetailProps> = ({ node, pdfUrl, onUpdateNode, onExpandNode, onViewImage }) => {
  const [loadingImage, setLoadingImage] = useState(false);
  const [loadingExpansion, setLoadingExpansion] = useState(false);
  const [questionInput, setQuestionInput] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('explain');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-generate image if missing when node is opened
    if (node && !node.imageUrl && !loadingImage) {
        generateImage();
    }
    // Default to explain tab when switching nodes
    setActiveTab('explain');
  }, [node]);

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
      <div 
        className="relative w-full h-56 bg-slate-100 flex items-center justify-center group overflow-hidden shrink-0 cursor-pointer"
        onClick={() => node.imageUrl && onViewImage(node.imageUrl)}
      >
        {node.imageUrl ? (
            <>
                <img src={node.imageUrl} alt={node.label} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                     <div className="opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300 bg-white/90 text-slate-700 px-3 py-2 rounded-full shadow-lg flex items-center gap-2 text-xs font-bold">
                        <Maximize2 size={14} />
                        <span>View Fullscreen</span>
                     </div>
                </div>
            </>
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
