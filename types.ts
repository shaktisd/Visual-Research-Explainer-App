
export interface QAItem {
  question: string;
  answer: string;
  timestamp: number;
}

export interface ExtractedFigure {
  title: string;
  type: 'table' | 'chart' | 'diagram';
  content: string; // Markdown table or detailed description
  insight: string; // Key takeaway
  pageNumber: number; // The page number where this figure appears
}

export interface ConceptNode {
  id: string;
  label: string;
  description: string;
  simpleExplanation: string; // "Like I'm 5"
  analogy: string;
  imagePrompt: string;
  imageUrl?: string; // Generated on demand
  figures?: ExtractedFigure[]; // Tables, charts, diagrams extracted from the paper
  children?: ConceptNode[];
  isExpanded?: boolean; // UI state
  qa?: QAItem[]; // User questions and AI answers specific to this node
}

export interface TreeData {
  root: ConceptNode;
}

export interface ProcessingStatus {
  step: 'idle' | 'uploading' | 'analyzing' | 'visualizing' | 'error';
  message?: string;
}

export interface ResearchDocument {
  id: string;
  name: string;
  fileType: string;
  contentBase64: string; // Stored for export/import portability
  treeData: TreeData | null;
  status: ProcessingStatus;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  documents: ResearchDocument[];
}
