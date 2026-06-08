import OpenAI from "openai";

// 通义千问 Qwen 客户端（支持多模态图片识别）
const qwen = process.env.QWEN_API_KEY
  ? new OpenAI({ apiKey: process.env.QWEN_API_KEY, baseURL: process.env.QWEN_BASE_URL })
  : null;

export interface RecognizedItem {
  name: string;
  spec?: string;
  qty?: number;
  unit?: string;
  unitPrice?: number;
  amount?: number;
}

export async function recognizePurchaseReceipt(imageBase64: string): Promise<{
  items: RecognizedItem[];
  totalAmount?: number;
}> {
  if (!qwen) {
    throw new Error("AI 服务未配置，请设置 QWEN_API_KEY 环境变量");
  }

  const prompt = `请识别这张采购单图片，提取所有采购物料信息。以 JSON 格式返回：
{
  "items": [
    { "name": "物料名称", "spec": "规格", "qty": 数量, "unit": "单位", "unitPrice": 单价, "amount": 金额 }
  ],
  "totalAmount": 总金额
}
要求：
1. name 必须准确识别，不要遗漏任何物料
2. qty 和 unitPrice 尽量识别，识别不到则省略
3. totalAmount 识别采购单总金额
4. 只返回 JSON，不要其他文字`;

  const response = await qwen.chat.completions.create({
    model: process.env.QWEN_MODEL || "qwen3.6-flash",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageBase64 } },
        ],
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 4096,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("识别失败，AI 返回空内容");

  try {
    const parsed = JSON.parse(content);

    // 辅助函数：从字符串中提取数字（如 "10斤" → 10, "18元/斤" → 18, "180元" → 180）
    const extractNumber = (value: any): number | undefined => {
      if (value == null) return undefined;
      if (typeof value === "number") return value;
      const match = String(value).match(/\d+\.?\d*/);
      return match ? Number(match[0]) : undefined;
    };

    return {
      items: (parsed.items || []).map((item: any) => {
        // 尝试从 qty 字符串中提取单位和数量（如 "10斤" → qty: 10, unit: "斤"）
        let qty: number | undefined;
        let unit: string | undefined;
        if (typeof item.qty === "string") {
          const match = item.qty.match(/(\d+\.?\d*)\s*(.+)/);
          if (match) {
            qty = Number(match[1]);
            unit = match[2].trim();
          } else {
            qty = extractNumber(item.qty);
          }
        } else {
          qty = extractNumber(item.qty);
        }
        // 如果 item.unit 已提供，优先使用
        if (item.unit) unit = String(item.unit).trim();

        // 尝试从 unitPrice 字符串中提取单位（如 "18元/斤" → priceUnit: "元/斤"）
        let priceUnit = item.unitPrice || item.unit;
        if (typeof item.unitPrice === "string" && item.unitPrice.includes("/")) {
          priceUnit = String(item.unitPrice).trim();
        }

        return {
          name: String(item.name || "").trim(),
          spec: item.spec ? String(item.spec).trim() : undefined,
          qty,
          unit,
          unitPrice: extractNumber(item.unitPrice),
          amount: extractNumber(item.amount),
        };
      }),
      totalAmount: extractNumber(parsed.totalAmount),
    };
  } catch {
    throw new Error("识别结果解析失败");
  }
}

export async function recognizeOutboundSheet(imageBase64: string): Promise<{
  items: RecognizedItem[];
}> {
  if (!qwen) {
    throw new Error("AI 服务未配置，请设置 QWEN_API_KEY 环境变量");
  }

  const prompt = `请识别这张出库单图片，提取所有出库物料信息。以 JSON 格式返回：
{
  "items": [
    { "name": "物料名称", "spec": "规格", "qty": 数量, "unit": "单位" }
  ]
}
要求：
1. name 必须准确识别
2. 只返回 JSON，不要其他文字`;

  const response = await qwen.chat.completions.create({
    model: process.env.QWEN_MODEL || "qwen3.6-flash",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageBase64 } },
        ],
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 4096,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("识别失败，AI 返回空内容");

  try {
    const parsed = JSON.parse(content);

    const extractNumber = (value: any): number | undefined => {
      if (value == null) return undefined;
      if (typeof value === "number") return value;
      const match = String(value).match(/\d+\.?\d*/);
      return match ? Number(match[0]) : undefined;
    };

    return {
      items: (parsed.items || []).map((item: any) => {
        let qty: number | undefined;
        let unit: string | undefined;
        if (typeof item.qty === "string") {
          const match = item.qty.match(/(\d+\.?\d*)\s*(.+)/);
          if (match) {
            qty = Number(match[1]);
            unit = match[2].trim();
          } else {
            qty = extractNumber(item.qty);
          }
        } else {
          qty = extractNumber(item.qty);
        }
        if (item.unit) unit = String(item.unit).trim();

        return {
          name: String(item.name || "").trim(),
          spec: item.spec ? String(item.spec).trim() : undefined,
          qty,
          unit,
        };
      }),
    };
  } catch {
    throw new Error("识别结果解析失败");
  }
}
