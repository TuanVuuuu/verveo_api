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
      console.log('systemPrompt', systemPrompt);
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

HỖ TRỢ NGÀY ÂM LỊCH:
- Khi người dùng nhắc đến ngày âm lịch (ví dụ: "mùng 1 âm", "ngày rằm", "15 âm", "mùng 5 tháng 10 âm", v.v.), bạn PHẢI:
  1. Nhận diện đó là ngày âm lịch từ prompt
  2. Sử dụng thông tin ngày âm lịch hiện tại được cung cấp để tính toán
  3. Chuyển đổi ngày âm lịch sang ngày dương lịch tương ứng
  4. Trả về startTime và endTime theo ngày dương lịch đã chuyển đổi
- Ví dụ: Nếu người dùng nói "đi chợ vào mùng 1 âm sắp tới" và hôm nay là ngày 15/9 âm, thì mùng 1 âm sắp tới sẽ là ngày dương lịch tương ứng (ví dụ: 20/10 dương lịch)
- Luôn ưu tiên tìm ngày âm lịch gần nhất trong tương lai nếu không có tháng cụ thể
- Nếu có tháng âm lịch cụ thể, sử dụng tháng đó; nếu không, sử dụng tháng âm lịch hiện tại hoặc tháng tiếp theo

Trả về kết quả dưới dạng JSON hợp lệ.`;
  }

  private createDeepseekUserPrompt(prompt: string): string {
    const now = new Date();
    const currentTime = DateTime.format(now);
    const weekday = DateTime.weekdayVi(now);
    const currentLunar = DateTime.getCurrentLunarDate();
    
    const lunarInfo = currentLunar 
      ? `- Ngày âm lịch hiện tại: Mùng ${currentLunar.day} tháng ${currentLunar.month} năm ${currentLunar.year}`
      : '- Ngày âm lịch: Không xác định được';

      console.log('lunarInfo', lunarInfo);
    
    return `Dựa trên prompt sau, hãy tạo một todo item chi tiết:

Prompt: "${prompt}"

THÔNG TIN THỜI GIAN HIỆN TẠI:
- Ngày giờ hiện tại: ${currentTime}
- Thứ trong tuần: ${weekday}
- Ngày dương lịch: ${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}
- Giờ: ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}
${lunarInfo}

QUAN TRỌNG: Khi tạo trường "startTime" và "endTime", hãy tính toán dựa trên:
1. Thời gian hiện tại đã cho ở trên
2. Ngữ cảnh của prompt (ví dụ: "tối nay" = 19:00-23:00 hôm nay)
3. Thời gian cần thiết để hoàn thành công việc (ví dụ: "2 tiếng" = 2 giờ)
4. Nếu có thời gian cụ thể, tính startTime và endTime
5. Nếu KHÔNG có thời gian cụ thể, hãy ước lượng thời gian hợp lý dựa trên loại công việc
6. LUÔN phải có startTime và endTime, không được để null

XỬ LÝ NGÀY ÂM LỊCH - QUAN TRỌNG:
- Khi prompt nhắc đến ngày âm lịch (ví dụ: "mùng 1 âm", "ngày rằm", "15 âm", "mùng 5 tháng 10 âm", "mùng 1 âm tháng sau", v.v.):
  1. Nhận diện ngày âm lịch từ prompt (ngày, tháng nếu có)
  2. Tính toán ngày âm lịch sắp tới dựa trên ngày âm lịch hiện tại đã cho ở trên
  3. Chuyển đổi ngày âm lịch đó sang ngày dương lịch tương ứng
  4. Sử dụng ngày dương lịch đã chuyển đổi để tạo startTime và endTime

QUY TẮC TÌM NGÀY ÂM LỊCH GẦN NHẤT - ĐẶC BIỆT QUAN TRỌNG:
- Khi prompt chỉ nhắc đến ngày âm lịch mà KHÔNG có tháng cụ thể (ví dụ: "mùng 1 âm", "ngày rằm", "15 âm", "mùng 1 âm lịch"), bạn PHẢI tìm ngày âm lịch GẦN NHẤT trong tương lai:
  * BƯỚC 1: So sánh SỐ NGÀY được nhắc đến với SỐ NGÀY hiện tại (chỉ so sánh số, không so sánh tháng)
  * BƯỚC 2: Xác định tháng:
    - Nếu SỐ NGÀY hiện tại > SỐ NGÀY được nhắc đến → ngày đó trong tháng hiện tại ĐÃ QUA → phải dùng THÁNG TIẾP THEO
    - Nếu SỐ NGÀY hiện tại < SỐ NGÀY được nhắc đến → ngày đó trong tháng hiện tại CHƯA ĐẾN → dùng THÁNG HIỆN TẠI
  * BƯỚC 3: Chuyển đổi ngày âm lịch đã xác định sang ngày dương lịch tương ứng
  * BƯỚC 4: Sử dụng ngày dương lịch đó để tạo startTime và endTime

VÍ DỤ CHI TIẾT - PHẢI LÀM THEO ĐÚNG:
- Ví dụ 1: Nếu hôm nay là mùng 19 tháng 9 âm và prompt là "ngày mùng 1 âm lịch":
  * Ngày được nhắc đến: mùng 1 (số = 1)
  * Ngày hiện tại: mùng 19 (số = 19)
  * So sánh SỐ: 19 > 1 → mùng 1 tháng 9 âm ĐÃ QUA rồi
  * → PHẢI tìm mùng 1 tháng 10 âm (tháng tiếp theo)
  * → Chuyển đổi mùng 1 tháng 10 âm năm 2025 sang dương lịch (ví dụ: 20/11/2025)
  * → Tạo startTime và endTime cho ngày 20/11/2025 (ví dụ: 2025-11-20 08:00:00)
  * → KẾT QUẢ: startTime = 2025-11-20 08:00:00, KHÔNG PHẢI 2025-11-30

- Ví dụ 2: Nếu hôm nay là mùng 5 tháng 9 âm và prompt là "ngày rằm":
  * Ngày được nhắc đến: rằm = 15 (số = 15)
  * Ngày hiện tại: mùng 5 (số = 5)
  * So sánh SỐ: 5 < 15 → ngày rằm (15 âm) trong tháng 9 âm CHƯA ĐẾN
  * → Sử dụng ngày rằm tháng 9 âm (tháng hiện tại)
  * → Chuyển đổi mùng 15 tháng 9 âm sang dương lịch tương ứng
  * → Tạo startTime và endTime cho ngày dương lịch đó

- Ví dụ 3: Nếu hôm nay là mùng 25 tháng 9 âm và prompt là "mùng 1 âm":
  * Ngày được nhắc đến: mùng 1 (số = 1)
  * Ngày hiện tại: mùng 25 (số = 25)
  * So sánh SỐ: 25 > 1 → mùng 1 tháng 9 âm ĐÃ QUA rồi
  * → PHẢI tìm mùng 1 tháng 10 âm (tháng tiếp theo)
  * → Chuyển đổi mùng 1 tháng 10 âm sang dương lịch

XỬ LÝ TẾT NGUYÊN ĐÁN - ĐẶC BIỆT QUAN TRỌNG:
- "Tết nguyên đán" hoặc "Tết Nguyên Đán" = Tết Nguyên Đán (mùng 1 tháng 1 âm lịch)
- "ngày X Tết" hoặc "X Tết" = ngày X tháng 12 âm lịch (tháng cuối cùng của năm âm lịch, trước Tết)
- Ví dụ: "ngày 28 Tết" = ngày 28 tháng 12 âm lịch (không phải ngày 28 tháng 1 âm lịch)
- Ví dụ: "ngày 30 Tết" = ngày 30 tháng 12 âm lịch (ngày cuối cùng của năm âm lịch)
- Ví dụ: "mùng 1 Tết" = mùng 1 tháng 1 âm lịch (Tết Nguyên Đán)
- Lưu ý: Nếu năm âm lịch hiện tại là năm X, thì "ngày X Tết" sẽ là ngày X tháng 12 âm lịch năm X (nếu chưa qua Tết) hoặc năm X+1 (nếu đã qua Tết)

VÍ DỤ CỤ THỂ:
- Nếu prompt là "Mùng 1 âm tháng sau sẽ về quê" và hôm nay là:
  * Ngày dương lịch: 8/11/2025
  * Ngày âm lịch: Mùng 19 tháng 9 năm 2025
  * Thì bạn phải tính:
    + "Mùng 1 âm tháng sau" = Mùng 1 tháng (9+1) = Mùng 1 tháng 10 âm năm 2025
    + Chuyển đổi Mùng 1 tháng 10 âm năm 2025 sang ngày dương lịch tương ứng (ví dụ: 20/11/2025)
    + Tạo startTime và endTime cho ngày dương lịch đó (ví dụ: 2025-11-20 08:00:00)

- Nếu prompt là "ngày 28 Tết nguyên đán tôi sẽ về quê" và hôm nay là:
  * Ngày dương lịch: 8/11/2025
  * Ngày âm lịch: Mùng 19 tháng 9 năm 2025
  * Thì bạn phải tính:
    + "ngày 28 Tết" = ngày 28 tháng 12 âm lịch (tháng cuối cùng trước Tết)
    + Vì hôm nay là tháng 9 âm, nên "ngày 28 Tết" sẽ là ngày 28 tháng 12 âm lịch năm 2025
    + Chuyển đổi ngày 28 tháng 12 âm lịch năm 2025 sang ngày dương lịch tương ứng (ví dụ: 15/2/2026)
    + Tạo startTime và endTime cho ngày dương lịch đó (ví dụ: 2026-02-15 08:00:00)

- Nếu prompt là "ngày mùng 1 âm lịch tôi sẽ về quê" và hôm nay là:
  * Ngày dương lịch: 8/11/2025
  * Ngày âm lịch: Mùng 19 tháng 9 năm 2025
  * Thì bạn PHẢI tính theo đúng quy tắc:
    + BƯỚC 1: Ngày được nhắc đến = mùng 1 (số = 1), Ngày hiện tại = mùng 19 (số = 19)
    + BƯỚC 2: So sánh SỐ: 19 > 1 → mùng 1 tháng 9 âm ĐÃ QUA rồi
    + BƯỚC 3: → PHẢI tìm mùng 1 tháng 10 âm (tháng tiếp theo)
    + BƯỚC 4: Chuyển đổi mùng 1 tháng 10 âm năm 2025 sang ngày dương lịch tương ứng (ví dụ: 20/11/2025)
    + BƯỚC 5: Tạo startTime và endTime cho ngày dương lịch đó (ví dụ: 2025-11-20 08:00:00)
    + KẾT QUẢ: startTime = 2025-11-20 08:00:00, KHÔNG PHẢI 2025-11-30

- Nếu prompt là "ngày rằm tôi sẽ đi chợ" và hôm nay là mùng 5 tháng 9 âm:
  * Ngày rằm (15 âm) trong tháng 9 âm chưa đến (vì hôm nay mới mùng 5)
  * → Sử dụng ngày rằm tháng 9 âm (tháng hiện tại)
  * → Chuyển đổi mùng 15 tháng 9 âm sang ngày dương lịch tương ứng
  * Tạo startTime và endTime cho ngày dương lịch đó

- Nếu prompt là "đi chợ vào mùng 1 âm sắp tới" và hôm nay là mùng 15 tháng 9 âm:
  * Mùng 1 âm sắp tới = mùng 1 tháng 10 âm (vì mùng 1 tháng 9 đã qua)
  * Chuyển đổi mùng 1 tháng 10 âm sang ngày dương lịch (ví dụ: 20/11/2025)
  * Tạo startTime và endTime cho ngày 20/11/2025

- Nếu prompt là "cúng rằm vào ngày 15 âm tháng này" và hôm nay là mùng 10 tháng 9 âm:
  * Ngày 15 âm tháng này = mùng 15 tháng 9 âm
  * Chuyển đổi mùng 15 tháng 9 âm sang ngày dương lịch tương ứng
  * Tạo startTime và endTime cho ngày dương lịch đó

LƯU Ý QUAN TRỌNG - PHẢI TUÂN THỦ:
- "Tháng sau" trong âm lịch = tháng âm lịch hiện tại + 1
- "Tháng này" trong âm lịch = tháng âm lịch hiện tại
- "Sắp tới" = tìm ngày âm lịch gần nhất trong tương lai
- Khi prompt chỉ có ngày âm lịch KHÔNG có tháng (ví dụ: "mùng 1 âm", "ngày rằm", "15 âm", "mùng 1 âm lịch"):
  * PHẢI tìm ngày âm lịch GẦN NHẤT trong tương lai
  * QUY TẮC SO SÁNH:
    + So sánh SỐ NGÀY được nhắc đến với SỐ NGÀY hiện tại
    + Nếu ngày hiện tại > ngày được nhắc đến → ngày đó trong tháng hiện tại đã qua → dùng tháng tiếp theo
    + Nếu ngày hiện tại < ngày được nhắc đến → ngày đó trong tháng hiện tại chưa đến → dùng tháng hiện tại
  * Ví dụ: Hôm nay mùng 19, prompt "mùng 1" → 19 > 1 → mùng 1 tháng này đã qua → dùng mùng 1 tháng sau
  * Ví dụ: Hôm nay mùng 5, prompt "rằm" (15) → 5 < 15 → rằm tháng này chưa đến → dùng rằm tháng này
- "ngày X Tết" = ngày X tháng 12 âm lịch (KHÔNG phải tháng 1 âm lịch)
- "mùng 1 Tết" = mùng 1 tháng 1 âm lịch (Tết Nguyên Đán)
- Luôn chuyển đổi ngày âm lịch sang ngày dương lịch trước khi tạo startTime và endTime
- Format: YYYY-MM-DD HH:MM:SS (ví dụ: 2025-11-20 08:00:00)
- QUAN TRỌNG: Phải tính toán CHÍNH XÁC, không được ước lượng hoặc đoán mò

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


