import axios from 'axios';
import { DateTime } from '../utils/datetime.js';
import { HybridTimeResolverService } from './hybridTimeResolverService.js';
import { logger } from '../utils/logger.js';

export interface GenTodoIntent {
  title: string;
  message: string;
  labels: string[];
  priority: 'high' | 'medium' | 'low';
}

export interface GenTodoResponse {
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  labels: string[];
  priority: 'high' | 'medium' | 'low';
  message: string;
  createdBy: string | null;
}

export class AIService {
  public readonly openrouterApiKey: string | undefined;
  private readonly openrouterBaseUrl: string;
  private readonly deepseekModel: string;
  private readonly apiTimeoutMs: number;
  private readonly maxTokens: number;
  private readonly temperature: number;
  private readonly topP: number;
  private readonly httpReferer: string;
  private readonly appTitle: string;
  private readonly timeResolver: HybridTimeResolverService;

  constructor() {
    this.openrouterApiKey = process.env.OPENROUTER_API_KEY;
    this.openrouterBaseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
    this.deepseekModel = process.env.DEEPSEEK_MODEL || 'deepseek/deepseek-v3.1-terminus';
    this.apiTimeoutMs = parseInt(process.env.API_TIMEOUT || '30000', 10);
    this.maxTokens = parseInt(process.env.MAX_TOKENS || '500', 10);
    this.temperature = parseFloat(process.env.TEMPERATURE || '0.7');
    this.topP = parseFloat(process.env.TOP_P || '0.9');
    this.httpReferer = process.env.HTTP_REFERER || 'http://localhost:8000';
    this.appTitle = process.env.APP_TITLE || 'Verveo Todo Generator';
    this.timeResolver = new HybridTimeResolverService();
  }

  async generateTodoIntent(prompt: string): Promise<GenTodoIntent> {
    if (!this.openrouterApiKey) {
      return this.getFallbackIntent(prompt);
    }

    try {
      const userPrompt = this.createLeanUserPrompt(prompt);
      const responseText = await this.callOpenrouterApi(userPrompt);
      if (!responseText) return this.getFallbackIntent(prompt);

      return this.safeParseIntent(responseText, prompt);
    } catch {
      return this.getFallbackIntent(prompt);
    }
  }

  async generateTodoWithDeepseek(prompt: string, now?: Date): Promise<GenTodoResponse> {
    const currentTime = now || new Date();
    
    logger.info('[AIService] generateTodoWithDeepseek called', {
      prompt,
      now: currentTime.toISOString(),
      nowLocal: currentTime.toString()
    });

    // 1. DeepSeek AI: Generate title, message, priority, labels only
    const intent = await this.generateTodoIntent(prompt);
    
    logger.info('[AIService] DeepSeek intent generated', {
      title: intent.title,
      labels: intent.labels,
      priority: intent.priority
    });
    
    // 2. Dart service (one_extract_task): Extract time + full task info from original prompt
    logger.info('[AIService] Calling timeResolver.resolve (one_extract_task)', {
      prompt,
      durationHours: 2,
      now: currentTime.toISOString()
    });
    
    const resolvedTime = await this.timeResolver.resolve(prompt, 2, currentTime);

    logger.info('[AIService] TimeResolver returned', {
      startTime: resolvedTime.startTime,
      endTime: resolvedTime.endTime,
      startTimeParsed: new Date(resolvedTime.startTime).toISOString(),
      endTimeParsed: new Date(resolvedTime.endTime).toISOString(),
      startTimeTimestamp: new Date(resolvedTime.startTime).getTime(),
      endTimeTimestamp: new Date(resolvedTime.endTime).getTime()
    });

    const result = {
      title: intent.title,
      description: prompt, // Keep original prompt as description
      startTime: resolvedTime.startTime,
      endTime: resolvedTime.endTime,
      labels: intent.labels,
      priority: intent.priority,
      message: intent.message,
      createdBy: 'one_extract_task + DeepSeek'
    };

    logger.info('[AIService] Final GenTodoResponse', {
      ...result,
      startTimeISO: new Date(result.startTime).toISOString(),
      endTimeISO: new Date(result.endTime).toISOString()
    });

    return result;
  }

  private createLeanUserPrompt(prompt: string): string {
    return `Bạn là trợ lý AI tạo todo từ câu nói của người dùng.

NHIỆM VỤ:
- Tạo title ngắn gọn (bỏ phần thời gian)
- Tạo message động viên hoặc nhắc nhở (không có thời gian)
- Phân loại labels
- Đánh giá priority

TRẢ VỀ JSON:
- title: tên công việc ngắn gọn
- message: lời nhắc động viên hoặc nhắc nhở (ngắn, friendly)
- labels: mảng phân loại (ví dụ: ["Công việc"], ["Cá nhân"], ["Gia đình"])
- priority: "high" | "medium" | "low"

VÍ DỤ:
Input: "tối nay đi ăn lẩu"
Output: {"title":"đi ăn lẩu","message":"Hẹn gặp bạn tối nay! 🍲","labels":["Cá nhân"],"priority":"medium"}

Input: "họp khách hàng sáng mai"
Output: {"title":"họp khách hàng","message":"Chuẩn bị tốt cho cuộc họp! 💼","labels":["Công việc"],"priority":"high"}

PROMPT:
"${prompt}"

Chỉ trả về JSON, không text thêm.`;
  }

  private safeParseIntent(response: string, originalPrompt: string): GenTodoIntent {
    try {
      const startIdx = response.indexOf('{');
      const endIdx = response.lastIndexOf('}') + 1;
      if (startIdx !== -1 && endIdx > startIdx) {
        const jsonStr = response.slice(startIdx, endIdx);
        const json = JSON.parse(jsonStr);
        return {
          title: json.title ?? `Todo: ${originalPrompt.slice(0, 40)}`,
          message: json.message ?? 'Hãy hoàn thành công việc này 💪',
          labels: Array.isArray(json.labels) ? json.labels : ['Công việc'],
          priority: ['high', 'medium', 'low'].includes(json.priority) ? json.priority : 'medium'
        };
      }
    } catch {
      // fallthrough
    }
    return this.getFallbackIntent(originalPrompt);
  }

  private getFallbackIntent(prompt: string): GenTodoIntent {
    return {
      title: `Todo: ${prompt.slice(0, 50)}...`,
      message: 'Hãy hoàn thành công việc này 💪',
      labels: ['Công việc'],
      priority: 'medium'
    };
  }

  private async callOpenrouterApi(userPrompt: string): Promise<string> {
    const headers = {
      Authorization: `Bearer ${this.openrouterApiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': this.httpReferer,
      'X-Title': this.appTitle
    };

    const payload = {
      model: this.deepseekModel,
      messages: [
        { role: 'user', content: userPrompt }
      ],
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      top_p: this.topP
    };

    const url = `${this.openrouterBaseUrl}/chat/completions`;
    const resp = await axios.post(url, payload, { headers, timeout: this.apiTimeoutMs });
    if (resp.status === 200) {
      const content: string | undefined = resp.data?.choices?.[0]?.message?.content;
      return (content || '').trim();
    }
    return '';
  }

}


