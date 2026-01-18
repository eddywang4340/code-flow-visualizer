import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY 
});

export async function call_llm(query: string, structure: any) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: query,
      config: {
        responseMimeType: 'application/json',
        responseSchema: structure, 
      },
    });

    const text = response.text
    if (!text) {
      throw new Error("No text was returned from the model.");
    }

    const result = JSON.parse(text);
    console.log(result);
    return result;

  } catch (error) {
    console.error("Error querying Gemini:", error);
    throw error;
  }
}

// output schema
export const codeSchema = {
  type: "object",
  properties: {
    bigO: { 
      type: "string", 
      description: "The complexity in big O notation, e.g., O(n), O(n^2), etc" 
    },
    complexity: { 
        type: "string", 
        description: "The complexity in one word, e.g. linear, linearithmic, quadratic, etc" 
    },
    description: {
        type: "string",
        description: "The purpose of the function in 1-2 sentences"
    }
  },
  required: ["bigO", "complexity"]
};


// testing
const codeToAnalyze = "for (let i = 0; i < n; i++) { console.log(i); }";

(async () => {
    const result = await call_llm(
    `Analyze the time complexity and purpose of this code: ${codeToAnalyze}`, 
    codeSchema
    );
})();
