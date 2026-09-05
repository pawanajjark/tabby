// src/services/aiProvider.ts
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

const savedModelName = localStorage.getItem('tabby_openai_model');
const requestedModelName = savedModelName || import.meta.env.VITE_OPENAI_MODEL || '';
const configuredModelName = requestedModelName === 'gpt-5.6-sol' ? 'gpt-4.1-mini' : requestedModelName;

export class AIProvider {
  private static apiKey = localStorage.getItem('tabby_openai_api_key') || import.meta.env.VITE_OPENAI_API_KEY || '';
  private static modelName = configuredModelName || 'gpt-4.1-mini';

  static setConfig(apiKey: string, modelName?: string) {
    this.apiKey = apiKey.trim();
    if (this.apiKey) {
      localStorage.setItem('tabby_openai_api_key', this.apiKey);
    } else {
      localStorage.removeItem('tabby_openai_api_key');
    }

    if (modelName?.trim()) {
      this.modelName = modelName.trim();
      localStorage.setItem('tabby_openai_model', this.modelName);
    }
  }

  static getApiKey(): string {
    return this.apiKey;
  }

  static getModelName(): string {
    return this.modelName;
  }

  static hasApiKey(): boolean {
    return !!this.apiKey;
  }

  static getModel(): ChatOpenAI | null {
    if (!this.apiKey) return null;
    return new ChatOpenAI({
      openAIApiKey: this.apiKey,
      modelName: this.modelName,
      temperature: 0.2,
      configuration: {
        dangerouslyAllowBrowser: true,
      },
    });
  }

  static async generateJson<T>(prompt: string, systemInstruction?: string, imageBase64?: string): Promise<T | null> {
    const model = this.getModel();
    if (!model) return null;

    try {
      const messages: (HumanMessage | SystemMessage)[] = [];

      if (systemInstruction) {
        messages.push(new SystemMessage(systemInstruction + '\nYou must respond ONLY with valid JSON, no markdown code fence and no extra commentary.'));
      }

      if (imageBase64) {
        // LangChain OpenAI multimodal content format
        messages.push(
          new HumanMessage({
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageBase64,
                },
              },
            ],
          })
        );
      } else {
        messages.push(new HumanMessage(prompt));
      }

      const response = await model.invoke(messages);
      const text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
      
      // Clean markdown codeblocks if model returns ```json ... ```
      const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      return JSON.parse(cleaned) as T;
    } catch (err) {
      console.warn('LangChain OpenAI call failed, falling back to local heuristic engine:', err);
      return null;
    }
  }
}
