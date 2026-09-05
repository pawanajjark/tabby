// src/services/aiProvider.ts

export interface AIProviderConfig {
  apiKey?: string;
  model?: string;
}

export class AIProvider {
  private static apiKey = localStorage.getItem('tabby_gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || '';

  static setApiKey(key: string) {
    this.apiKey = key.trim();
    if (this.apiKey) {
      localStorage.setItem('tabby_gemini_api_key', this.apiKey);
    } else {
      localStorage.removeItem('tabby_gemini_api_key');
    }
  }

  static getApiKey(): string {
    return this.apiKey;
  }

  static hasApiKey(): boolean {
    return !!this.apiKey;
  }

  static async generateJson<T>(prompt: string, systemInstruction?: string, imageBase64?: string): Promise<T | null> {
    if (!this.apiKey) return null;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`;
      const parts: any[] = [];
      
      if (imageBase64) {
        const mimeMatch = imageBase64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (mimeMatch) {
          parts.push({
            inline_data: {
              mime_type: mimeMatch[1],
              data: mimeMatch[2],
            }
          });
        }
      }
      
      parts.push({ text: prompt });

      const requestBody: any = {
        contents: [{ parts }],
        generationConfig: {
          response_mime_type: 'application/json',
          temperature: 0.2,
        },
      };

      if (systemInstruction) {
        requestBody.system_instruction = {
          parts: [{ text: systemInstruction }]
        };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        console.warn('Gemini API request failed:', response.statusText);
        return null;
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return null;

      return JSON.parse(text) as T;
    } catch (err) {
      console.warn('Error calling Gemini API, falling back to local heuristic:', err);
      return null;
    }
  }
}
