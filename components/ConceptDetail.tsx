import React, { useState, useEffect } from 'react';
import { ConceptNode } from '../types';
import { generateConceptImage, expandNodeWithAI } from '../services/geminiService';
import { Sparkles, RefreshCw, ChevronRight, BookOpen, Lightbulb, Image as ImageIcon } from 'lucide-react';

interface ConceptDetailProps {
  node: ConceptNode | null;
  onUpdateNode: (node: ConceptNode) => void;
  onExpandNode: (parentNode: ConceptNode, newChildren: ConceptNode[]) => void;
}

export const ConceptDetail: React.FC<ConceptDetailProps> = ({ node, onUpdateNode, onExpandNode }) => {
  const [loadingImage, setLoadingImage] = useState(false);
  const [loadingExpansion, setLoadingExpansion] = useState(false);

  useEffect(() => {
    // Auto-generate image if missing when node is opened
    if (node && !node.imageUrl && !loadingImage) {
        generateImage();
    }
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
    <div className="h-full flex flex-col bg-white border-l border-slate-200 overflow-y-auto shadow-xl">
      {/* Header Image */}
      <div className="relative w-full h-48 bg-slate-100 flex items-center justify-center group overflow-hidden shrink-0">
        {node.imageUrl ? (
          <img src={node.imageUrl} alt={node.label} className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" />
        ) : (
          <div className="flex flex-col items-center text-slate-400">
             {loadingImage ? (
                 <RefreshCw className="w-8 h-8 animate-spin mb-2" />
             ) : (
                 <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
             )}
            <span className="text-xs">{loadingImage ? 'Generating Visualization...' : 'Waiting for image...'}</span>
          </div>
        )}
        
        {!loadingImage && (
            <button 
                onClick={(e) => { e.stopPropagation(); generateImage(); }}
                className="absolute bottom-2 right-2 p-2 bg-white/90 rounded-full shadow hover:bg-blue-50 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Regenerate Image"
            >
                <RefreshCw size={16} />
            </button>
        )}
      </div>

      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-1">{node.label}</h2>
          <p className="text-slate-500 text-sm font-medium">Concept ID: {node.id.slice(0,8)}</p>
        </div>

        {/* Technical Description */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center">
                <BookOpen size={14} className="mr-2" /> Technical Summary
            </h4>
            <p className="text-slate-700 leading-relaxed text-sm">
                {node.description}
            </p>
        </div>

        {/* Simple Explanation */}
        <div>
             <h4 className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-2 flex items-center">
                <Sparkles size={14} className="mr-2" /> Simply Put (EL15)
            </h4>
            <p className="text-slate-800 text-lg font-light leading-relaxed">
                "{node.simpleExplanation}"
            </p>
        </div>

        {/* Analogy */}
        <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
             <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2 flex items-center">
                <Lightbulb size={14} className="mr-2" /> Analogy
            </h4>
            <p className="text-amber-900 italic text-sm">
                {node.analogy}
            </p>
        </div>
        
        {/* Actions */}
        <div className="pt-4 border-t border-slate-100">
             <button 
                onClick={handleExpand}
                disabled={loadingExpansion}
                className="w-full py-3 px-4 bg-white border-2 border-slate-200 hover:border-blue-400 hover:text-blue-600 text-slate-600 font-semibold rounded-lg flex items-center justify-center transition-colors"
             >
                {loadingExpansion ? <RefreshCw className="animate-spin mr-2" size={18} /> : <ChevronRight className="mr-2" size={18} />}
                {loadingExpansion ? 'Expanding Chain of Thought...' : 'Deep Dive (Add Sub-concepts)'}
             </button>
             <p className="text-xs text-center text-slate-400 mt-2">
                 Adds more granularity to the visual tree for this concept.
             </p>
        </div>
      </div>
    </div>
  );
};
