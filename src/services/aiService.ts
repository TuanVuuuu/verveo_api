import axios from 'axios';
import { DateTime } from '../utils/datetime.js';

export interface GenTodoResponse {
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  labels: string[];
  priority: 'high' | 'medium' | 'low';
  message: string;
  confidence: number;
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
  }

  async generateTodoWithDeepseek(prompt: string): Promise<GenTodoResponse> {
    if (!this.openrouterApiKey) {
      return this.getGenTodoFallbackResponse(prompt);
    }

    try {
      const systemPrompt = this.createDeepseekSystemPrompt();
      const userPrompt = this.createDeepseekUserPrompt(prompt);

      const responseText = await this.callOpenrouterApi(systemPrompt, userPrompt);
      if (!responseText) return this.getGenTodoFallbackResponse(prompt);

      const parsed = this.parseDeepseekResponse(responseText, prompt);
      return parsed;
    } catch {
      return this.getGenTodoFallbackResponse(prompt);
    }
  }

  private createDeepseekSystemPrompt(): string {
    return `Bạn là trợ lý AI thông minh chuyên tạo todo list. Nhiệm vụ của bạn là tạo ra các todo item chi tiết và hữu ích dựa trên prompt của người dùng.

Hãy tạo todo với các thông tin sau:
- title: Tiêu đề ngắn gọn, rõ ràng
- description: Mô tả chi tiết về công việc cần làm
- startTime: Thời gian bắt đầu (ISO format: YYYY-MM-DD HH:MM:SS) - BẮT BUỘC
- endTime: Thời gian kết thúc (ISO format: YYYY-MM-DD HH:MM:SS) - BẮT BUỘC
- labels: Phân loại công việc (ví dụ: Học tập, Công việc, Gia đình, Sức khỏe, Giải trí, v.v.)
- priority: Độ ưu tiên (high/medium/low)
- message: Lời nhắc thân thiện, động viên
- confidence: Độ tin cậy (0.0-1.0)

QUAN TRỌNG VỀ THỜI GIAN - LUÔN ƯỚC LƯỢNG:
- Sử dụng thông tin thời gian hiện tại được cung cấp để tính toán thời gian chính xác
- "Cuối tuần" = Thứ Bảy hoặc Chủ Nhật
- "Tuần tới" = Tuần sau từ Thứ Hai
- "Ngày mai" = Ngày tiếp theo
- "Tối nay" = Buổi tối hôm nay (19:00-23:00)
- "Sáng mai" = Buổi sáng ngày mai (07:00-11:00)
- "Chiều mai" = Buổi chiều ngày mai (13:00-17:00)
- Nếu có thời gian cụ thể (ví dụ: "2 tiếng"), tính toán startTime và endTime dựa trên thời gian hiện tại
- Nếu KHÔNG có thời gian cụ thể, hãy ước lượng thời gian hợp lý dựa trên loại công việc:
  * Học tập: 1-3 giờ
  * Công việc: 2-8 giờ
  * Gia đình: 1-4 giờ
  * Sức khỏe: 30 phút - 2 giờ
  * Giải trí: 1-3 giờ
  * Mua sắm: 1-2 giờ
- Luôn sử dụng format ISO: YYYY-MM-DD HH:MM:SS
- KHÔNG BAO GIỜ để startTime hoặc endTime = null

Trả về kết quả dưới dạng JSON hợp lệ.`;
  }

  private createDeepseekUserPrompt(prompt: string): string {
    const now = new Date();
    const currentTime = DateTime.format(now);
    const weekday = DateTime.weekdayVi(now);
    return `Dựa trên prompt sau, hãy tạo một todo item chi tiết:

Prompt: "${prompt}"

THÔNG TIN THỜI GIAN HIỆN TẠI:
- Ngày giờ hiện tại: ${currentTime}
- Thứ trong tuần: ${weekday}
- Ngày: ${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}
- Giờ: ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}

QUAN TRỌNG: Khi tạo trường "startTime" và "endTime", hãy tính toán dựa trên:
1. Thời gian hiện tại đã cho ở trên
2. Ngữ cảnh của prompt (ví dụ: "tối nay" = 19:00-23:00 hôm nay)
3. Thời gian cần thiết để hoàn thành công việc (ví dụ: "2 tiếng" = 2 giờ)
4. Nếu có thời gian cụ thể, tính startTime và endTime
5. Nếu KHÔNG có thời gian cụ thể, hãy ước lượng thời gian hợp lý dựa trên loại công việc
6. LUÔN phải có startTime và endTime, không được để null

Hãy phân tích và tạo todo với thông tin đầy đủ, thực tế và hữu ích.`;
  }

  private async callOpenrouterApi(systemPrompt: string, userPrompt: string): Promise<string> {
    const headers = {
      Authorization: `Bearer ${this.openrouterApiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': this.httpReferer,
      'X-Title': this.appTitle
    };

    const payload = {
      model: this.deepseekModel,
      messages: [
        { role: 'system', content: systemPrompt },
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

  private parseDeepseekResponse(response: string, originalPrompt: string): GenTodoResponse {
    try {
      const startIdx = response.indexOf('{');
      const endIdx = response.lastIndexOf('}') + 1;
      if (startIdx !== -1 && endIdx > startIdx) {
        const jsonStr = response.slice(startIdx, endIdx);
        const result = JSON.parse(jsonStr);
        return this.validateAndCleanGenTodoResult(result, originalPrompt);
      }
    } catch {
      // fallthrough
    }
    return this.getGenTodoFallbackResponse(originalPrompt);
  }

  private validateAndCleanGenTodoResult(result: any, originalPrompt: string): GenTodoResponse {
    const safe: GenTodoResponse = {
      title: result?.title || `Todo từ: ${originalPrompt.slice(0, 50)}...`,
      description: result?.description || `Thực hiện: ${originalPrompt}`,
      startTime: result?.startTime || DateTime.offsetHours(1),
      endTime: result?.endTime || DateTime.offsetHoursFrom(result?.startTime || DateTime.offsetHours(1), 2),
      labels: Array.isArray(result?.labels) && result.labels.length ? result.labels : ['Công việc'],
      priority: ['high', 'medium', 'low'].includes(result?.priority) ? result.priority : 'medium',
      message: result?.message || `Hãy hoàn thành: ${result?.title || originalPrompt}`,
      confidence: typeof result?.confidence === 'number' ? Math.max(0, Math.min(1, result.confidence)) : 0.8,
      createdBy: 'DeepSeek-R1'
    };
    return safe;
  }

  private getGenTodoFallbackResponse(prompt: string): GenTodoResponse {
    const startTime = DateTime.offsetHours(1);
    const endTime = DateTime.offsetHoursFrom(startTime, 2);
    return {
      title: `Todo: ${prompt.slice(0, 50)}...`,
      description: `Thực hiện công việc: ${prompt}`,
      startTime,
      endTime,
      labels: ['Công việc'],
      priority: 'medium',
      message: `Hãy hoàn thành: ${prompt}`,
      confidence: 0.3,
      createdBy: null
    };
  }
}


