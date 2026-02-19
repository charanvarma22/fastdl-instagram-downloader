
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function analyzeInstagramUrl(url: string) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are an Instagram assistant. I have an Instagram URL: ${url}. 
      Since you cannot access live data, generate a plausible "AI Analysis" of what this post might contain based on common patterns of the URL if possible, or just provide 3 high-impact hashtags and a 1-sentence SEO summary for a downloader page using this URL. 
      Return the response in clear text.`,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini analysis error:", error);
    return "Ready to download your high-quality Instagram content.";
  }
}
