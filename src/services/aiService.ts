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
      const userPrompt = this.createDeepseekUserPrompt(prompt);

      const responseText = await this.callOpenrouterApi(userPrompt);
      if (!responseText) return this.getGenTodoFallbackResponse(prompt);

      const parsed = this.parseDeepseekResponse(responseText, prompt);
      return parsed;
    } catch {
      return this.getGenTodoFallbackResponse(prompt);
    }
  }

  private createDeepseekUserPrompt(prompt: string): string {
    const now = new Date();
    const currentLunar = DateTime.getCurrentLunarDate();
    
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

Dựa trên prompt sau, hãy tạo một todo item chi tiết:

Prompt: "${prompt}"

THÔNG TIN THỜI GIAN HIỆN TẠI:
- Ngày dương lịch: ${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}
${currentLunar ? `- Ngày âm lịch: Ngày ${currentLunar.day} tháng ${currentLunar.month} năm ${currentLunar.year}` : '- Ngày âm lịch: Không xác định'}
- Giờ: ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}

QUY TẮC XỬ LÝ NGÀY ÂM LỊCH - QUAN TRỌNG:

⚠️ QUAN TRỌNG NHẤT: KẾT QUẢ TRẢ VỀ PHẢI LÀ NGÀY DƯƠNG LỊCH, KHÔNG PHẢI NGÀY ÂM LỊCH ⚠️

Khi prompt nhắc đến ngày âm lịch, bạn PHẢI:
1. Nhận diện ngày âm lịch từ prompt (ngày, tháng nếu có)
2. Xác định ngày âm lịch cụ thể (ngày, tháng, năm)
3. CHUYỂN ĐỔI BẮT BUỘC: Ngày âm lịch đó PHẢI được chuyển đổi sang ngày dương lịch tương ứng
4. Sử dụng ngày dương lịch đã chuyển đổi để tạo startTime và endTime
5. KHÔNG BAO GIỜ dùng trực tiếp ngày dương lịch hiện tại khi prompt nhắc đến ngày âm lịch
6. KHÔNG BAO GIỜ trả về ngày âm lịch trong startTime và endTime - PHẢI là ngày dương lịch

1. KHI PROMPT CÓ CẢ THÁNG VÀ NGÀY ÂM LỊCH (ví dụ: "ngày 6 tháng 11 âm lịch"):
   - "tháng X âm lịch" = tháng X âm lịch, KHÔNG PHẢI tháng X dương lịch
   - Xác định năm: So sánh tháng được nhắc đến với tháng hiện tại
     * Tháng nhắc đến > tháng hiện tại → dùng năm hiện tại
     * Tháng nhắc đến < tháng hiện tại → dùng năm tiếp theo
     * Tháng nhắc đến = tháng hiện tại → so sánh ngày để xác định năm
   - CHUYỂN ĐỔI BẮT BUỘC: Ngày X tháng Y âm lịch năm Z → PHẢI chuyển đổi sang ngày dương lịch tương ứng
   - Sử dụng ngày dương lịch đã chuyển đổi để tạo startTime và endTime
   - Ví dụ: Hôm nay 9/11/2025 (Ngày 19 tháng 9 âm), prompt "ngày 6 tháng 11 âm lịch" → 11 > 9 → năm 2025 → ngày 6 tháng 11 âm năm 2025 = 25/12/2025 (dương lịch) → startTime = 2025-12-25 08:00:00

2. KHI PROMPT CHỈ CÓ NGÀY ÂM LỊCH (ví dụ: "mùng 1 âm", "ngày rằm", "mùng 5 âm lịch"):
   - Tìm ngày GẦN NHẤT trong TƯƠNG LAI (KHÔNG PHẢI quá khứ)
   - So sánh SỐ NGÀY: Nếu ngày hiện tại > ngày nhắc đến → dùng tháng tiếp theo, ngược lại → dùng tháng hiện tại
   - CHUYỂN ĐỔI BẮT BUỘC: Ngày X tháng Y âm lịch năm Z → PHẢI chuyển đổi sang ngày dương lịch tương ứng
   - Sử dụng ngày dương lịch đã chuyển đổi để tạo startTime và endTime
   - PHẢI verify ngày dương lịch trong tương lai
   - Ví dụ: Hôm nay 9/11/2025 (Ngày 19 tháng 9 âm), prompt "mùng 1 âm lịch" → 19 > 1 → mùng 1 tháng 10 âm năm 2025 = 20/11/2025 (dương lịch) → startTime = 2025-11-20 08:00:00, KHÔNG PHẢI 2025-11-10

3. PHÂN BIỆT QUAN TRỌNG - "MÙNG X TẾT" vs "NGÀY X TẾT":
   - "mùng 1 âm lịch" = mùng 1 gần nhất (có thể tháng 10, 11, 12, hoặc tháng 1 năm sau)
   - "mùng 1 Tết" = mùng 1 tháng 1 âm lịch (Tết Nguyên Đán)
   - "mùng X Tết" (với X > 1, ví dụ: "mùng 2 Tết", "mùng 3 Tết", "mùng 5 Tết") = mùng X tháng 1 âm lịch (sau Tết Nguyên Đán)
   - "ngày X Tết" (không có "mùng", ví dụ: "ngày 28 Tết", "ngày 30 Tết") = ngày X tháng 12 âm lịch (trước Tết Nguyên Đán)
   - Ví dụ: "mùng 3 Tết" = mùng 3 tháng 1 âm lịch (KHÔNG PHẢI mùng 3 tháng 12 âm lịch)
     * Hôm nay 9/11/2025 (Ngày 19 tháng 9 âm), prompt "mùng 3 Tết" → mùng 3 tháng 1 âm lịch năm 2026 = 19/2/2026 (dương lịch) → startTime = 2026-02-19 08:00:00
   - Ví dụ: "ngày 28 Tết" = ngày 28 tháng 12 âm lịch (KHÔNG PHẢI ngày 28 tháng 1 âm lịch)

4. NHẬN DIỆN CÁC NGÀY LỄ ÂM LỊCH CỦA VIỆT NAM:
   Khi prompt nhắc đến tên ngày lễ, bạn PHẢI:
   1. Nhận diện ngày âm lịch tương ứng với ngày lễ
   2. CHUYỂN ĐỔI BẮT BUỘC sang ngày dương lịch tương ứng
   3. Sử dụng ngày dương lịch đã chuyển đổi để tạo startTime và endTime
   4. KHÔNG BAO GIỜ trả về ngày âm lịch trong kết quả
   
   Danh sách ngày lễ:
   - "Tết Nguyên Đán" hoặc "Tết" = mùng 1 tháng 1 âm lịch → chuyển đổi sang ngày dương lịch
   - "Tết Nguyên Tiêu" hoặc "Rằm tháng Giêng" = rằm tháng 1 âm lịch (15/1 âm) → chuyển đổi sang ngày dương lịch
   - "Tết Hàn Thực" = mùng 3 tháng 3 âm lịch → chuyển đổi sang ngày dương lịch
   - "Tết Thanh Minh" = thường vào tháng 3 âm lịch (khoảng 4-6/3 âm) → chuyển đổi sang ngày dương lịch
   - "Giỗ Tổ Hùng Vương" = 10 tháng 3 âm lịch → chuyển đổi sang ngày dương lịch
   - "Tết Đoan Ngọ" hoặc "Tết Đoan Dương" = mùng 5 tháng 5 âm lịch → chuyển đổi sang ngày dương lịch
   - "Lễ Vu Lan" hoặc "Rằm tháng Bảy" = rằm tháng 7 âm lịch (15/7 âm) → chuyển đổi sang ngày dương lịch
   - "Tết Trung Thu" hoặc "Rằm tháng Tám" = rằm tháng 8 âm lịch (15/8 âm) → chuyển đổi sang ngày dương lịch
   - "Tết Trùng Cửu" = mùng 9 tháng 9 âm lịch → chuyển đổi sang ngày dương lịch
   - "Tết Ông Táo" hoặc "Ông Táo về trời" = 23 tháng 12 âm lịch → chuyển đổi sang ngày dương lịch
   - "Rằm tháng X" = 15 tháng X âm lịch (X là số tháng) → chuyển đổi sang ngày dương lịch
   - "Mùng X tháng Y" = ngày X tháng Y âm lịch → chuyển đổi sang ngày dương lịch
   
   ⚠️ LƯU Ý: Sau khi nhận diện ngày lễ âm lịch, PHẢI chuyển đổi sang ngày dương lịch tương ứng và sử dụng ngày dương lịch đó trong startTime và endTime. KHÔNG BAO GIỜ trả về ngày âm lịch.

5. LUÔN verify ngày dương lịch phải TRONG TƯƠNG LAI sau khi chuyển đổi
6. Format: YYYY-MM-DD HH:MM:SS (ví dụ: 2025-11-20 08:00:00)
7. LUÔN phải có startTime và endTime, không được để null

⚠️ NHẮC LẠI QUAN TRỌNG: 
- Khi prompt nhắc đến ngày âm lịch hoặc ngày lễ âm lịch, PHẢI chuyển đổi sang ngày dương lịch tương ứng
- startTime và endTime PHẢI là ngày dương lịch (format: YYYY-MM-DD HH:MM:SS)
- KHÔNG BAO GIỜ trả về ngày âm lịch trong startTime và endTime
- Ví dụ: "Tết Trung Thu" → rằm tháng 8 âm lịch → chuyển đổi sang ngày dương lịch (ví dụ: 2025-10-06) → startTime = 2025-10-06 08:00:00

Trả về kết quả dưới dạng JSON hợp lệ.`;
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


