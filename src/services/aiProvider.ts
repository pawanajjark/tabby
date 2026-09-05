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

export interface AIConfigStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

type BackendAIRunner = (request: BackendAIRequest) => Promise<string>;

const viteEnv = (import.meta as ImportMeta & { env?: ImportMetaEnv }).env;
const deploymentKey = (viteEnv?.VITE_OPENAI_API_KEY as string | undefined)?.trim() || '';
const deploymentModel = (viteEnv?.VITE_OPENAI_MODEL as string | undefined)?.trim() || 'gpt-5.6-sol';

function sanitizeModel(model?: string): string {
  const clean = model?.trim();
  return clean || deploymentModel;
}

function normalizedIdentity(identity: string): string {
  const clean = identity.trim().toLowerCase();
  if (!clean) throw new Error('A SpacetimeDB identity is required for local AI configuration.');
  return clean;
}

function configStorageKey(identity: string): string {
  return `tabby_ai_config_v2:${encodeURIComponent(normalizedIdentity(identity))}`;
}

export class AIProvider {
  private static runner: BackendAIRunner | null = null;
  private static backendConfigured = false;
  private static storage: AIConfigStorage | null = null;
  private static activeIdentity: string | null = null;
  private static directApiKey = '';
  private static modelName = deploymentModel;
  private static lastSnapshot: AIConfigSnapshot | null = null;

  static configureBackend(runner: BackendAIRunner) {
    this.runner = runner;
  }

  /** Clears prior secrets before loading the selected connection identity. */
  static setIdentityScope(identity: string, storage: AIConfigStorage = globalThis.localStorage): AIConfigSnapshot {
    this.activeIdentity = null;
    this.storage = storage;
    this.directApiKey = '';
    this.modelName = deploymentModel;
    this.backendConfigured = false;
    this.lastSnapshot = null;

    const normalized = normalizedIdentity(identity);
    this.activeIdentity = normalized;
    try {
      const parsed = JSON.parse(storage.getItem(configStorageKey(normalized)) ?? 'null') as Partial<AIConfigSnapshot> | null;
      if (parsed && typeof parsed === 'object') {
        this.directApiKey = typeof parsed.apiKey === 'string' ? parsed.apiKey.trim() : '';
        this.modelName = sanitizeModel(typeof parsed.model === 'string' ? parsed.model : undefined);
      }
    } catch {
      this.directApiKey = '';
      this.modelName = deploymentModel;
    }
    return { apiKey: this.directApiKey, model: this.modelName };
  }

  static getIdentityScope(): string | null {
    return this.activeIdentity;
  }

  static clearIdentityScope(identity: string, storage: AIConfigStorage = this.storage ?? globalThis.localStorage): void {
    const normalized = normalizedIdentity(identity);
    storage.removeItem(configStorageKey(normalized));
    if (this.activeIdentity === normalized) {
      this.activeIdentity = null;
      this.directApiKey = '';
      this.modelName = deploymentModel;
      this.backendConfigured = false;
      this.lastSnapshot = null;
    }
  }

  private static persistActiveConfig(): void {
    if (!this.activeIdentity || !this.storage) {
      throw new Error('Select a SpacetimeDB identity before saving local AI configuration.');
    }
    const key = configStorageKey(this.activeIdentity);
    if (!this.directApiKey && this.modelName === deploymentModel) {
      this.storage.removeItem(key);
      return;
    }
    this.storage.setItem(key, JSON.stringify({ apiKey: this.directApiKey, model: this.modelName }));
  }

  static setConfigured(configured: boolean, modelName?: string, apiKey?: string) {
    if (!this.activeIdentity) {
      throw new Error('Select a SpacetimeDB identity before changing AI configuration.');
    }
    this.backendConfigured = configured;
    if (modelName?.trim()) {
      this.modelName = sanitizeModel(modelName);
    }
    if (apiKey !== undefined) {
      this.directApiKey = apiKey.trim();
    }
    this.persistActiveConfig();
  }

  static getModelName(): string {
    return this.modelName;
  }

  static getApiKey(): string {
    return this.directApiKey;
  }

  static hasApiKey(): boolean {
    return Boolean(this.directApiKey || deploymentKey) || this.backendConfigured;
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
    const key = overrideKey?.trim() || this.directApiKey || deploymentKey;
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
        if (this.directApiKey || deploymentKey) {
          return await this.directFetch(request);
        }
        throw backendError;
      }
    }
    if (this.directApiKey || deploymentKey) {
      return await this.directFetch(request);
    }
    if (this.runner) {
      return await this.runner(request);
    }
    throw new Error('OpenAI is not configured.');
  }

  static async testConnection(apiKey?: string, model?: string): Promise<boolean> {
    const keyToTest = apiKey?.trim() || this.directApiKey || deploymentKey;
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
