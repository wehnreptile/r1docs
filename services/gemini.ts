
import { GoogleGenAI } from "@google/genai";
import { PRODUCTS } from "../constants";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const docCache: Record<string, string> = {};

async function fetchDocContent(path: string): Promise<string> {
  if (docCache[path]) return docCache[path];
  try {
    const response = await fetch(path);
    if (!response.ok) return "";
    const text = await response.text();
    docCache[path] = text;
    return text;
  } catch {
    return "";
  }
}

export interface AskDocsResponse {
  text: string;
  sources?: Array<{ title: string; uri: string }>;
}

export async function askDocs(query: string): Promise<AskDocsResponse> {
  const contentPromises = PRODUCTS.flatMap(p => 
    p.docs.map(async d => {
      const content = await fetchDocContent(d.contentPath);
      return `Product: ${p.name}\nDoc Title: ${d.title}\nCategory: ${d.category}\nContent: ${content.substring(0, 1500)}...`;
    })
  );

  const contexts = await Promise.all(contentPromises);
  const contextText = contexts.join('\n\n---\n\n');

  const systemInstruction = `
    You are "DevDocs AI", a world-class senior staff engineer helping colleagues understand our product ecosystem.
    
    PRODUCTS: Consumer App, Delivery App, API Gateway.
    
    GUIDELINES:
    1. PRIORITIZE the provided INTERNAL DOCUMENTATION CONTEXT.
    2. If the answer is not in internal docs, use GOOGLE SEARCH to provide context from general industry standards (e.g. JWT specs, React patterns).
    3. Always specify if information is from "Internal Docs" or "General Tech Standards".
    4. Keep answers technical, concise, and professional.
    5. Format with clear Markdown headers, bolding, and code blocks.
    
    INTERNAL DOCUMENTATION CONTEXT:
    ${contextText}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: query,
      config: {
        systemInstruction,
        temperature: 0.2,
        tools: [{ googleSearch: {} }]
      },
    });

    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.filter(chunk => chunk.web)
      ?.map(chunk => ({
        title: chunk.web?.title || 'Resource',
        uri: chunk.web?.uri || '#'
      }));

    return {
      text: response.text || "No specific answer found.",
      sources: sources && sources.length > 0 ? sources : undefined
    };
  } catch (error) {
    console.error("AI Search Error:", error);
    return { 
      text: "I'm having trouble searching the documentation files right now. Please navigate using the sidebar or check if the .md files are accessible." 
    };
  }
}
