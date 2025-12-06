export interface ConceptNode {
  id: string;
  label: string;
  description: string;
  simpleExplanation: string; // "Like I'm 5"
  analogy: string;
  imagePrompt: string;
  imageUrl?: string; // Generated on demand
  children?: ConceptNode[];
  isExpanded?: boolean; // UI state
}

export interface TreeData {
  root: ConceptNode;
}

export interface ProcessingStatus {
  step: 'idle' | 'uploading' | 'analyzing' | 'visualizing' | 'error';
  message?: string;
}
