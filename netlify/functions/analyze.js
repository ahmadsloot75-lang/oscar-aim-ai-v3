const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({
        ok: false,
        error: "Method not allowed"
      })
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");

    if (
      !body.device ||
      !body.hud ||
      !body.sensitivity ||
      !Array.isArray(body.frames) ||
      body.frames.length === 0
    ) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          ok: false,
          error: "المدخلات ناقصة."
        })
      };
    }

    const image = (url) => ({
      type: "input_image",
      image_url: url,
      detail: "high"
    });

    const prompt = `
أنت مدرب Aim متخصص في Free Fire على الهاتف.

حلل صور HUD والحساسية ولقطات اللعب المرسلة لك.

لا تخترع معلومات غير ظاهرة في الصور.
إذا كانت معلومة غير واضحة، اذكر أن الثقة منخفضة.
لا تفترض أن الحساسية تحتاج تغييرًا إلا إذا كانت هناك قرائن واضحة.

أعد JSON فقط بهذا الشكل:

{
  "aim_score": 0,
  "hud_score": 0,
  "drag_control": 0,
  "movement": 0,
  "confidence": "high",
  "issues": [],
  "strengths": [],
  "recommendations": [
    {
      "title": "",
      "current": "",
      "recommended": "",
      "reason": ""
    }
  ],
  "notes": []
}

كل الدرجات من 0 إلى 100.
`;

    const content = [
      {
        type: "input_text",
        text: prompt
      },
      {
        type: "input_text",
        text: "صورة HUD:"
      },
      image(body.hud),
      {
        type: "input_text",
        text: "صورة الحساسية:"
      },
      image(body.sensitivity),
      {
        type: "input_text",
        text: "لقطات اللعب:"
      },
      ...body.frames.map(image)
    ];

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.6",
      input: [
        {
          role: "user",
          content
        }
      ],
      max_output_tokens: 1800
    });

    const text = response.output_text || "";
    const match = text.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error("AI لم يرجع JSON صالحًا.");
    }

    const analysis = JSON.parse(match[0]);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify({
        ok: true,
        analysis
      })
    };

  } catch (error) {
    console.error("ANALYZE ERROR:", error);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ok: false,
        error: "فشل التحليل على الخادم."
      })
    };
  }
};
