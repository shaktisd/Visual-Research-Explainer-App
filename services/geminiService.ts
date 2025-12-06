
import { GoogleGenAI, Type } from "@google/genai";
import { ConceptNode } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Schema for extracted figures (tables/charts)
const figureSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    type: { type: Type.STRING, enum: ["table", "chart", "diagram"] },
    content: { type: Type.STRING, description: "If table: Markdown formatted table. If chart/diagram: Detailed text description of what is visually shown." },
    insight: { type: Type.STRING, description: "The specific conclusion or data point this figure proves." },
    pageNumber: { type: Type.INTEGER, description: "The specific page number (1-indexed) in the PDF where this figure is located." }
  },
  required: ["title", "type", "content", "insight", "pageNumber"]
};

// Shared properties to ensure consistency
const baseNodeProperties = {
  id: { type: Type.STRING },
  label: { type: Type.STRING },
  description: { type: Type.STRING },
  simpleExplanation: { type: Type.STRING },
  analogy: { type: Type.STRING },
  imagePrompt: { type: Type.STRING },
  figures: { 
    type: Type.ARRAY, 
    items: figureSchema,
    description: "Any charts, tables, or diagrams from the paper that support this specific concept."
  }
};

// Define explicit schema levels to prevent "empty properties" error in deep recursion
// and to enforce a structured chain of thought depth.

// Level 3: Leaf nodes (simplest concepts, no children enforced in schema)
const leafNodeSchema = {
  type: Type.OBJECT,
  properties: {
    ...baseNodeProperties
  },
  required: ["id", "label", "description", "simpleExplanation", "analogy", "imagePrompt"],
};

// Level 2: Can contain leaf nodes
const level2NodeSchema = {
  type: Type.OBJECT,
  properties: {
    ...baseNodeProperties,
    children: {
      type: Type.ARRAY,
      items: leafNodeSchema,
    },
  },
  required: ["id", "label", "description", "simpleExplanation", "analogy", "imagePrompt"],
};

// Level 1: Can contain Level 2 nodes
const level1NodeSchema = {
  type: Type.OBJECT,
  properties: {
    ...baseNodeProperties,
    children: {
      type: Type.ARRAY,
      items: level2NodeSchema,
    },
  },
  required: ["id", "label", "description", "simpleExplanation", "analogy", "imagePrompt"],
};

// Root: Can contain Level 1 nodes
const rootNodeSchema = {
  type: Type.OBJECT,
  properties: {
    ...baseNodeProperties,
    children: {
      type: Type.ARRAY,
      items: level1NodeSchema,
    },
  },
  required: ["id", "label", "description", "simpleExplanation", "analogy", "imagePrompt"],
};

const CONCEPT_TREE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    root: rootNodeSchema,
  },
};

export async function analyzePaper(base64Data: string, mimeType: string): Promise<ConceptNode> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data,
            },
          },
          {
            text: `You are an expert research paper explainer. 
            Analyze the provided document. Break it down into a logical "Chain of Thought" concept tree.
            
            1. The Root node is the Paper Title and main thesis.
            2. Children are main sections or core pillars of the research.
            3. Further descendants are periphery concepts, definitions, or specific mechanism details explaining the parent.
            4. Ensure no concept is left unexplained. If a concept is complex, break it down further.
            
            IMPORTANT: EXTRACT VISUAL DATA
            For each concept, if the paper contains a relevant Table, Chart, or Diagram:
            - Extract it into the 'figures' array.
            - Identify the EXACT Page Number it appears on.
            - For Tables: Convert the data into a clean Markdown table format in 'content'.
            - For Charts: Describe the visual trends, axes, and data points in 'content'.
            - Provide the 'insight' derived from that figure.
            
            For EACH node, provide:
            - id: A unique string ID.
            - label: Short title (max 5 words).
            - description: Technical summary (2-3 sentences).
            - simpleExplanation: An "Explain Like I'm 5" version (very simple).
            - analogy: A real-world analogy to help understand the concept.
            - imagePrompt: A specific, descriptive prompt to generate an educational illustration of this concept.
            
            Output strictly valid JSON adhering to the schema.`,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: CONCEPT_TREE_SCHEMA,
        thinkingConfig: { thinkingBudget: 4096 } // Allow some thinking for structure
      },
    });

    if (!response.text) throw new Error("No response from Gemini");
    
    const parsed = JSON.parse(response.text);
    return parsed.root;
  } catch (error) {
    console.error("Analysis failed:", error);
    throw error;
  }
}

export async function generateConceptImage(prompt: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `Create a clean, educational, scientific illustration. Style: Minimalist flat design, schematic, easy to understand. White background. Subject: ${prompt}` }],
      },
    });

    // Extract image from response parts
    for (const part of response.candidates?.[0]?.content?.parts || []) {
       if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
       }
    }
    throw new Error("No image generated");
  } catch (error) {
    console.error("Image generation failed:", error);
    // Return a fallback placeholder if generation fails to avoid breaking UI
    return `https://picsum.photos/seed/${encodeURIComponent(prompt)}/400/300`;
  }
}

export async function expandNodeWithAI(nodeContext: ConceptNode): Promise<ConceptNode[]> {
    // This function helps user "Add their own nodes" or "Expand" a node further
     try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [{
                    text: `The user wants to understand this concept deeper: "${nodeContext.label}".
                    Current description: ${nodeContext.description}.
                    
                    Generate 2-3 specific sub-concepts that explain this parent concept in more detail.
                    Return a JSON array of ConceptNodes.`
                }]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                     type: Type.OBJECT,
                     properties: {
                         children: {
                             type: Type.ARRAY,
                             items: level2NodeSchema // Allows depth if model wants, but usually just returns direct children
                         }
                     }
                }
            }
        });
        
        const parsed = JSON.parse(response.text);
        return parsed.children || [];
    } catch (e) {
        console.error("Expansion failed", e);
        return [];
    }
}

export async function askQuestionOnNode(nodeContext: ConceptNode, question: string): Promise<string> {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [{
                    text: `You are a research tutor. The user is currently studying the specific concept: "${nodeContext.label}".
                    
                    Concept Context:
                    Description: ${nodeContext.description}
                    Analogy: ${nodeContext.analogy}
                    Simple Explanation: ${nodeContext.simpleExplanation}
                    
                    User Question: "${question}"
                    
                    Provide a clear, concise answer (max 3 sentences) that directly addresses the question using the context of this concept. 
                    Do not introduce unrelated information.`
                }]
            },
        });
        
        return response.text || "I couldn't generate an answer at this time.";
    } catch (e) {
        console.error("Q&A failed", e);
        return "Sorry, I encountered an error while answering your question.";
    }
}
