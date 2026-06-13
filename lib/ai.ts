import OpenAI from "openai";

// 通义千问 Qwen 客户端（支持多模态图片识别）
function createQwenClient() {
  const apiKey = process.env.QWEN_API_KEY;
  const baseURL = process.env.QWEN_BASE_URL;
  if (!apiKey) {
    throw new Error("AI 服务未配置，请设置 QWEN_API_KEY 环境变量");
  }
  if (!baseURL) {
    throw new Error("AI 服务未配置，请设置 QWEN_BASE_URL 环境变量");
  }
  return new OpenAI({ apiKey, baseURL });
}

const qwen = process.env.QWEN_API_KEY ? createQwenClient() : null;

export interface RecognizedItem {
  productName?: string;
  ingredientName?: string;
  name?: string;
  brand?: string;
  spec?: string;
  qty?: number;
  unit?: string;
  purchaseUnit?: string;
  unitPrice?: number;
  amount?: number;
  stockUnit?: string;
  stockQty?: number;
  categoryName?: string;
}

// 清洗模型返回内容：去除 markdown 代码块标记及首尾空白
function cleanModelContent(content: string): string {
  return content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

const ALLOWED_VISION_MODELS = [
  "qwen-vl-max",
  "qwen-vl-plus",
  "qwen2.5-vl-72b-instruct",
  "qwen2.5-vl-7b-instruct",
  "qwen2.5-vl-3b-instruct",
];

const DEFAULT_VISION_MODEL = "qwen-vl-max";

export async function recognizePurchaseReceipt(imageBase64: string): Promise<{
  supplierName?: string;
  summary?: string;
  items: RecognizedItem[];
  totalAmount?: number;
}> {
  if (!qwen) {
    throw new Error("AI 服务未配置，请设置 QWEN_API_KEY 环境变量");
  }

  const configuredModel = process.env.QWEN_MODEL?.trim();
  const model =
    configuredModel && ALLOWED_VISION_MODELS.includes(configuredModel)
      ? configuredModel
      : DEFAULT_VISION_MODEL;

  if (configuredModel && configuredModel !== model) {
    console.warn(
      `[AI] QWEN_MODEL "${configuredModel}" 不是已知的视觉模型，将使用默认模型 "${model}"。支持的模型：${ALLOWED_VISION_MODELS.join(", ")}`
    );
  }

  console.log(`[AI] 使用模型: ${model}, baseURL: ${process.env.QWEN_BASE_URL || "默认"}`);
  const prompt = `请识别这张采购单图片，提取所有采购物料信息。以 JSON 格式返回：
{
  "supplierName": "供应商名称（采购单抬头可见时填写，否则省略）",
  "summary": "采购单标题/摘要（单据顶部或备注处可见时填写，否则省略）",
  "items": [
    {
      "productName": "产品品牌名称/别名，采购单上印刷的完整商品名称，如 升隆小酥肉、海天金标生抽",
      "brand": "品牌前缀，如 升隆、海天；若无法从产品品牌名称/别名中拆分，可与 productName 填相同内容",
      "ingredientName": "食材名称，从产品品牌名称/别名中去除品牌前缀后的名称，如 小酥肉、金标生抽；若无法准确提取，与 productName 填相同内容",
      "categoryName": "二级分类名称，如 调味品、猪肉、蔬菜（可见时填写，否则省略）",
      "spec": "采购规格，如 1千克*10袋、1件=20袋、1.9L*6瓶",
      "qty": 数量,
      "purchaseUnit": "采购单位，如 件、箱、袋、斤",
      "unitPrice": 单价（每采购单位）,
      "amount": 金额,
      "stockUnit": "入库单位，如 袋、瓶（能从规格推导时填写）",
      "stockQty": 入库数量（能从规格推导时填写）
    }
  ],
  "totalAmount": 总金额
}
要求：
1. productName 必须准确识别，不要遗漏任何物料。
2. brand 尽量识别；若无法从产品品牌名称/别名中拆分，brand 与 productName 填相同内容。
3. ingredientName 尽量从 productName 中提取；若无法准确提取（如没有明显品牌前缀），ingredientName 与 productName 填相同内容。
4. spec 中的换算关系必须保留原样，例如 "1千克*10袋" 不要合并为 "10千克"。
5. qty、unitPrice、amount 尽量识别；识别不到则省略。
6. totalAmount 识别采购单总金额。
7. 只返回 JSON，不要其他文字。`;

  let response;
  try {
    response = await qwen.chat.completions.create({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageBase64 } },
          ],
        },
      ],
      max_tokens: 4096,
    });
  } catch (apiErr: unknown) {
    const err = apiErr instanceof Error ? apiErr : new Error(String(apiErr));
    console.error(`[AI] 模型调用失败: ${err.message}`);
    if ((apiErr as { code?: string })?.code) {
      console.error(`[AI] 错误码: ${(apiErr as { code?: string }).code}`);
    }
    throw new Error(`AI 模型调用失败: ${err.message}`);
  }

  const rawContent = response.choices[0]?.message?.content;
  if (!rawContent) {
    console.error("[AI] 模型返回空内容，完整响应:", JSON.stringify(response, null, 2));
    throw new Error("识别失败，AI 返回空内容");
  }

  const content = cleanModelContent(rawContent);
  if (!content) {
    console.error("[AI] 清洗后内容为空，原始内容:", rawContent.slice(0, 1000));
    throw new Error("识别失败，AI 返回内容为空");
  }

  console.log("[AI] 采购单识别原始返回前 1000 字符:", content.slice(0, 1000));

  try {
    const parsed = JSON.parse(content);
    console.log("[AI] 采购单识别解析结果:", JSON.stringify({ itemsCount: parsed.items?.length, totalAmount: parsed.totalAmount }));

    // 辅助函数：从字符串中提取数字（如 "10斤" → 10, "18元/斤" → 18, "180元" → 180）
    const extractNumber = (value: unknown): number | undefined => {
      if (value == null) return undefined;
      if (typeof value === "number") return value;
      const match = String(value).match(/\d+\.?\d*/);
      return match ? Number(match[0]) : undefined;
    };

    return {
      supplierName: parsed.supplierName ? String(parsed.supplierName).trim() : undefined,
      summary: parsed.summary ? String(parsed.summary).trim() : undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

        const productName = String(item.productName || item.name || "").trim();
        const brand = item.brand ? String(item.brand).trim() : undefined;
        let ingredientName = item.ingredientName
          ? String(item.ingredientName).trim()
          : undefined;
        // 兜底：如果 ingredientName 未返回，且 brand 是 productName 的前缀，则去除 brand 前缀
        if (!ingredientName && productName && brand && brand !== productName) {
          const idx = productName.indexOf(brand);
          if (idx === 0) {
            ingredientName = productName.slice(brand.length).trim();
          }
        }
        if (!ingredientName) ingredientName = productName;

        return {
          productName,
          ingredientName,
          name: productName,
          brand,
          categoryName: item.categoryName ? String(item.categoryName).trim() : undefined,
          spec: item.spec ? String(item.spec).trim() : undefined,
          qty,
          purchaseUnit: item.purchaseUnit ? String(item.purchaseUnit).trim() : unit,
          unitPrice: extractNumber(item.unitPrice),
          amount: extractNumber(item.amount),
          stockUnit: item.stockUnit ? String(item.stockUnit).trim() : undefined,
          stockQty: extractNumber(item.stockQty),
        };
      }),
      totalAmount: extractNumber(parsed.totalAmount),
    };
  } catch (parseErr: unknown) {
    const err = parseErr instanceof Error ? parseErr : new Error(String(parseErr));
    console.error(`[AI] 采购单识别结果解析失败: ${err.message}`);
    console.error("[AI] 原始内容前 1000 字符:", content.slice(0, 1000));
    throw new Error(`识别结果解析失败，AI 未返回合法 JSON: ${err.message}`);
  }
}

export async function recognizeOutboundSheet(imageBase64: string): Promise<{
  items: RecognizedItem[];
}> {
  if (!qwen) {
    throw new Error("AI 服务未配置，请设置 QWEN_API_KEY 环境变量");
  }

  const configuredModel = process.env.QWEN_MODEL?.trim();
  const model =
    configuredModel && ALLOWED_VISION_MODELS.includes(configuredModel)
      ? configuredModel
      : DEFAULT_VISION_MODEL;

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
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageBase64 } },
        ],
      },
    ],
    max_tokens: 4096,
  });

  const rawContent = response.choices[0]?.message?.content;
  if (!rawContent) throw new Error("识别失败，AI 返回空内容");

  const content = cleanModelContent(rawContent);
  if (!content) throw new Error("识别失败，AI 返回内容为空");

  try {
    const parsed = JSON.parse(content);

    const extractNumber = (value: unknown): number | undefined => {
      if (value == null) return undefined;
      if (typeof value === "number") return value;
      const match = String(value).match(/\d+\.?\d*/);
      return match ? Number(match[0]) : undefined;
    };

    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    console.error("[AI] 出库单识别结果解析失败，原始内容前 1000 字符:", content.slice(0, 1000));
    throw new Error("识别结果解析失败，AI 未返回合法 JSON");
  }
}
