export interface BackendAIRequest {
  prompt: string;
  instructions: string;
  imageDataUrl: string;
  jsonMode: boolean;
}

export interface AIConfigSnapshot {
  apiKey: string;
  model: string;
}

type BackendAIRunner = (request: BackendAIRequest) => Promise<string>;

function sanitizeModel(model?: string): string {
  const clean = model?.trim();
  if (!clean) {
    return (import.meta.env.VITE_OPENAI_MODEL as string | undefined)?.trim() || 'gpt-5.6-sol';
  }
  return clean;
}

const envKey = (import.meta.env.VITE_OPENAI_API_KEY as string | undefined)?.trim() || '';
const envModel = (import.meta.env.VITE_OPENAI_MODEL as string | undefined)?.trim() || 'gpt-5.6-sol';
const initialKey = envKey || localStorage.getItem('tabby_openai_api_key')?.trim() || '';
const initialModel = envModel || localStorage.getItem('tabby_openai_model')?.trim() || 'gpt-5.6-sol';

// Keep localStorage synced with current .env configuration
if (envKey) {
  try {
    localStorage.setItem('tabby_openai_api_key', envKey);
  } catch {}
}
if (envModel) {
  try {
    localStorage.setItem('tabby_openai_model', envModel);
  } catch {}
}

export class AIProvider {
  private static runner: BackendAIRunner | null = null;
  private static backendConfigured = false;
  private static directApiKey = initialKey;
  private static modelName = initialModel;
  private static lastSnapshot: AIConfigSnapshot | null = null;

  static configureBackend(runner: BackendAIRunner) {
    this.runner = runner;
  }

  static setConfigured(configured: boolean, modelName?: string, apiKey?: string) {
    this.backendConfigured = configured;
    if (modelName?.trim()) {
      this.modelName = sanitizeModel(modelName);
      try {
        localStorage.setItem('tabby_openai_model', this.modelName);
      } catch {}
    }
    if (apiKey !== undefined) {
      this.directApiKey = apiKey.trim();
      try {
        if (this.directApiKey) {
          localStorage.setItem('tabby_openai_api_key', this.directApiKey);
        } else {
          localStorage.removeItem('tabby_openai_api_key');
        }
      } catch {}
    }
  }

  static getModelName(): string {
    return this.modelName;
  }

  static getApiKey(): string {
    return this.directApiKey;
  }

  static hasApiKey(): boolean {
    return Boolean(this.directApiKey) || this.backendConfigured;
  }

  static saveUndoSnapshot(apiKey: string, model: string) {
    this.lastSnapshot = { apiKey, model };
  }

  static getLastUndoSnapshot(): AIConfigSnapshot | null {
    return this.lastSnapshot;
  }

  static clearUndoSnapshot() {
    this.lastSnapshot = null;
  }

  private static async directFetch(request: BackendAIRequest, overrideKey?: string, overrideModel?: string): Promise<string> {
    const key = overrideKey?.trim() || this.directApiKey;
    if (!key) throw new Error('No OpenAI API key configured.');

    const model = sanitizeModel(overrideModel || this.modelName);
    const messages: Array<{ role: string; content: unknown }> = [];

    if (request.instructions.trim()) {
      messages.push({ role: 'system', content: request.instructions.trim() });
    }

    if (request.imageDataUrl.trim()) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: request.prompt },
          { type: 'image_url', image_url: { url: request.imageDataUrl.trim() } },
        ],
      });
    } else {
      messages.push({ role: 'user', content: request.prompt });
    }

    const requestBody: Record<string, unknown> = {
      model,
      messages,
      max_completion_tokens: 2000,
    };
    if (request.jsonMode) {
      requestBody.response_format = { type: 'json_object' };
    }

    let response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(requestBody),
    });

    // If max_completion_tokens is unsupported by an older model, retry with max_tokens
    if (!response.ok && response.status === 400) {
      const errorData = await response.json().catch(() => ({}));
      const message = (errorData as { error?: { message?: string } })?.error?.message || '';
      if (message.includes('max_completion_tokens')) {
        delete requestBody.max_completion_tokens;
        requestBody.max_tokens = 2000;
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify(requestBody),
        });
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = (errorData as { error?: { message?: string } })?.error?.message || response.statusText;
      throw new Error(`OpenAI request failed (${response.status}): ${message}`);
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('OpenAI returned an empty response.');
    return content;
  }

  static async executeRequest(request: BackendAIRequest): Promise<string> {
    if (this.runner && this.backendConfigured) {
      try {
        return await this.runner(request);
      } catch (backendError) {
        console.warn('Backend OpenAI request failed, attempting direct fetch:', backendError);
        if (this.directApiKey) {
          return await this.directFetch(request);
        }
        throw backendError;
      }
    }
    if (this.directApiKey) {
      return await this.directFetch(request);
    }
    if (this.runner) {
      return await this.runner(request);
    }
    throw new Error('OpenAI is not configured.');
  }

  static async testConnection(apiKey?: string, model?: string): Promise<boolean> {
    const keyToTest = apiKey?.trim() || this.directApiKey;
    const modelToTest = sanitizeModel(model || this.modelName);
    if (!keyToTest) return false;

    try {
      const response = await this.directFetch(
        {
          prompt: 'Respond with exactly: connected',
          instructions: 'Follow the request exactly.',
          imageDataUrl: '',
          jsonMode: false,
        },
        keyToTest,
        modelToTest,
      );
      return Boolean(response);
    } catch (error) {
      console.warn('OpenAI test connection failed:', error);
      return false;
    }
  }

  static async generateJson<T>(prompt: string, instructions?: string, imageDataUrl?: string): Promise<T | null> {
    if (!this.hasApiKey()) return null;
    try {
      const text = await this.executeRequest({
        prompt,
        instructions: instructions || 'Return one valid JSON object and no additional text.',
        imageDataUrl: imageDataUrl || '',
        jsonMode: true,
      });
      const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      return JSON.parse(cleaned) as T;
    } catch (error) {
      console.warn('OpenAI JSON request failed:', error);
      return null;
    }
  }

  static async generateText(prompt: string, instructions?: string, imageDataUrl?: string): Promise<string | null> {
    if (!this.hasApiKey()) return null;
    try {
      const text = await this.executeRequest({
        prompt,
        instructions: instructions || 'Answer clearly and concisely.',
        imageDataUrl: imageDataUrl || '',
        jsonMode: false,
      });
      return text.trim() || null;
    } catch (error) {
      console.warn('OpenAI text request failed:', error);
      return null;
    }
  }
}
