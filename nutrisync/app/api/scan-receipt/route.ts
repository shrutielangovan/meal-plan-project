import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`;

async function extractItemsWithGemini(content: string, isText: boolean) {
  const parts = isText
    ? [{ text: `Here is the text from a grocery receipt:\n\n${content}` }]
    : [{ inline_data: { mime_type: "image/jpeg", data: content } }];

  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          ...parts,
          {
            text: `Extract all food/grocery items from this receipt.
            Return ONLY a JSON array, no markdown, no explanation:
            [
              {"ingredient_name": "eggs", "quantity": 12, "unit": "pieces"},
              {"ingredient_name": "milk", "quantity": 1, "unit": "liters"}
            ]
            If quantity or unit is unclear, set them to null.
            Only include actual food/grocery items, ignore prices, taxes, store info.`
          }
        ]
      }]
    }),
  });

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType } = await req.json();

    let items = [];

    if (mimeType === "application/pdf") {
      const { extractText } = await import("unpdf");
      const buffer = Buffer.from(imageBase64, "base64");
      const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });

      if (!text?.trim()) {
        return NextResponse.json({ items: [], error: "Could not extract text from PDF" });
      }

      items = await extractItemsWithGemini(text, true);
    } else {
      items = await extractItemsWithGemini(imageBase64, false);
    }

    return NextResponse.json({ items });
  } catch (err) {
    console.error("Receipt scan error:", err);
    return NextResponse.json({ items: [] }, { status: 500 });
  }
}