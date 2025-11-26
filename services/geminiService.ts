import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const enhanceStory = async (
  location: string, 
  rawNotes: string, 
  transport: string
): Promise<string> => {
  if (!apiKey) {
    console.warn("Gemini API Key is missing.");
    return rawNotes;
  }

  try {
    const prompt = `
      나는 여행 작가야. 다음 정보를 바탕으로 감성적이고 흥미로운 짧은 여행 일지(약 2~3문장)를 한국어로 작성해줘.
      
      장소: ${location}
      이동 수단: ${transport}
      내 메모: ${rawNotes}
      
      결과물은 바로 일지에 쓸 수 있는 텍스트만 줘.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || rawNotes;
  } catch (error) {
    console.error("Gemini Error:", error);
    return rawNotes;
  }
};
