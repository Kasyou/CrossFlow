import OpenAI from 'openai';
import { PROMPTS } from './prompts';

type Provider = 'deepseek' | 'qwen' | 'glm' | 'ollama';

interface AiConfig {
  provider: Provider;
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

const defaultModels: Record<Provider, string> = {
  deepseek: 'deepseek-chat',
  qwen: 'qwen-turbo',
  glm: 'glm-4-flash',
  ollama: 'qwen2.5:7b',
};

const defaultBaseUrls: Record<Provider, string> = {
  deepseek: 'https://api.deepseek.com',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  glm: 'https://open.bigmodel.cn/api/paas/v4',
  ollama: 'http://localhost:11434/v1',
};

export class AiAdapter {
  private client: OpenAI;
  private model: string;

  constructor(config: AiConfig) {
    this.model = config.model || defaultModels[config.provider];
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || defaultBaseUrls[config.provider],
    });
  }

  async translate(text: string, targetLang = 'English'): Promise<string> {
    const res = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: PROMPTS.translateProduct(text, targetLang) }],
      max_tokens: 200,
      temperature: 0.3,
    });
    return res.choices[0]?.message?.content?.trim() || text;
  }

  async classifyRefundReason(reason: string): Promise<string> {
    const res = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: PROMPTS.classifyRefundReason(reason) }],
      max_tokens: 10,
      temperature: 0,
    });
    return res.choices[0]?.message?.content?.trim() || 'other';
  }

  async generateAnomalyAlert(context: string): Promise<string> {
    const res = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: PROMPTS.anomalyAlert(context) }],
      max_tokens: 100,
      temperature: 0.5,
    });
    return res.choices[0]?.message?.content?.trim() || '';
  }
}

let adapterInstance: AiAdapter | null = null;

export function getAiAdapter(config?: AiConfig): AiAdapter | null {
  if (config) {
    adapterInstance = new AiAdapter(config);
  }
  return adapterInstance;
}
