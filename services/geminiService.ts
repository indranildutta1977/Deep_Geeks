import { GoogleGenAI, GenerateContentResponse, Tool } from "@google/genai";
import { Attachment, ModelType } from "../types";

// Helper to convert Blob/File to Base64
export const fileToGenerativePart = async (file: File): Promise<{ mimeType: string; data: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve({
        mimeType: file.type,
        data: base64String,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const getClient = () => {
  // In a real deployed environment, process.env.API_KEY is populated.
  // For demo purposes, we assume it's there. 
  const apiKey = process.env.API_KEY || ''; 
  if (!apiKey) {
    console.warn("API Key is missing from environment variables.");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateResponseStream = async (
  modelId: string,
  prompt: string,
  attachments: Attachment[],
  systemInstruction?: string,
  useSearch: boolean = false
) => {
  const ai = getClient();
  
  // Prepare content parts
  const parts: any[] = [];
  
  // Add attachments first
  for (const att of attachments) {
    if (att.base64) {
      parts.push({
        inlineData: {
          mimeType: att.mimeType,
          data: att.base64
        }
      });
    }
  }

  // Add text prompt
  parts.push({ text: prompt });

  const tools: Tool[] = [];
  if (useSearch) {
    tools.push({ googleSearch: {} });
  }

  try {
    const result = await ai.models.generateContentStream({
      model: modelId,
      contents: { parts },
      config: {
        systemInstruction,
        tools: tools.length > 0 ? tools : undefined,
        // Ensure grounding URLs are returned if search is used
      },
    });
    return result;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const enhancePrompt = async (originalPrompt: string): Promise<string> => {
  const ai = getClient();
  try {
    const response = await ai.models.generateContent({
      model: ModelType.GEMINI_FLASH,
      contents: `Rewrite the following user prompt to be more precise, detailed, and optimized for a large language model. Only return the optimized prompt, no explanations. Original prompt: "${originalPrompt}"`,
    });
    return response.text || originalPrompt;
  } catch (e) {
    console.error("Enhance prompt failed", e);
    return originalPrompt;
  }
};
