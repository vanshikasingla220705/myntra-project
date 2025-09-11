import fs from "node:fs";
import cloudinary from "../config/cloudinary.js";
import { GoogleGenAI, createUserContent, createPartFromUri } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const analyzeImage = async (req, res) => {
  try {
    // support req.files (array) and fallback to single req.file
    const files = req.files ?? (req.file ? [req.file] : null);
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: "No images uploaded (field: images)" });
    }

    // Upload each image to Cloudinary
    const uploads = [];
    for (const file of files) {
      let uploadResult;
      if (file.path) {
        uploadResult = await cloudinary.uploader.upload(file.path, { resource_type: "image" });
      } else if (file.buffer) {
        const dataUri = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
        uploadResult = await cloudinary.uploader.upload(dataUri, { resource_type: "image" });
      } else {
        throw new Error("Unsupported file object: missing path and buffer");
      }
      uploads.push({ file, uploadResult });
    }

    // Prepare prompt
    const basePrompt = `
Analyze this clothing item image(s) and the user's query.
1. Identify the clothing item(s) in the image(s) (category, color, style).
2. Understand the user's context and needs from the query.
3. Suggest the ideal complementary outfit categories like tops, jackets, shoes, accessories.

Example output (JSON format only):
{
  "itemInImage": "blue jeans, casual",
  "context": "party, winter, night",
  "recommendations": ["black leather jacket", "high heels", "silver accessories"]
}
`;
    const userPrompt = req.body?.queryText || req.body?.userPrompt || "";
    const finalPrompt = userPrompt ? `${basePrompt}\n\nUser query: ${userPrompt}` : basePrompt;

    // Primary: give Gemini Cloudinary URLs
    const partsFromUri = uploads.map(({ uploadResult, file }) => {
      const url = uploadResult.secure_url || uploadResult.url;
      const mimeType = file.mimetype || (uploadResult.format ? `image/${uploadResult.format}` : "image/jpeg");
      return createPartFromUri(url, mimeType);
    });

    let geminiResponse;
    try {
      geminiResponse = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: createUserContent([ finalPrompt, ...partsFromUri ])
      });
    } catch (primaryErr) {
      console.warn("Gemini fetch-from-URL failed — falling back to inline base64:", primaryErr?.message || primaryErr);

      const inlineParts = uploads.map(({ file, uploadResult }) => {
        let base64Data;
        if (file.buffer) base64Data = file.buffer.toString("base64");
        else if (file.path) base64Data = fs.readFileSync(file.path, { encoding: "base64" });
        const mimeType = file.mimetype || (uploadResult.format ? `image/${uploadResult.format}` : "image/jpeg");
        return { inlineData: { mimeType, data: base64Data } };
      });

      geminiResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: createUserContent([ finalPrompt, ...inlineParts ])
      });
    }

    // Extract text from Gemini response (best-effort)
    const rawText =
      geminiResponse?.text ??
      geminiResponse?.response?.candidates?.[0]?.content?.parts?.[0]?.text ??
      JSON.stringify(geminiResponse);

    let parsed = null;
    try { parsed = JSON.parse(rawText); } catch { parsed = null; }

    res.json({
      success: true,
      images: uploads.map(({ uploadResult }) => ({
        url: uploadResult.secure_url || uploadResult.url,
        public_id: uploadResult.public_id,
        format: uploadResult.format,
      })),
      geminiRaw: rawText,
      analysis: parsed ?? rawText,
    });
  } catch (err) {
    console.error("analyzeImage error:", err);
    res.status(500).json({ success: false, error: err.message || String(err) });
  }
};
