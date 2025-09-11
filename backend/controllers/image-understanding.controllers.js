// controllers/analyzeController.js
import fs from "node:fs";
import cloudinary from "../config/cloudinary.js";
import { GoogleGenAI, createUserContent, createPartFromUri } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

/**
 * analyzeImage:
 *  - Uploads incoming image to Cloudinary (supports multer memoryBuffer or disk path).
 *  - Calls Gemini with the Cloudinary URL as an image part.
 *  - If Gemini can't fetch the URL (network/permission), falls back to sending inline base64.
 *  - Accepts a user prompt in req.body.queryText (or req.body.userPrompt) and appends it to the base prompt.
 */
export const analyzeImage = async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, error: "No file uploaded (req.file missing)" });

    // 1) Upload to Cloudinary (handle buffer or disk path)
    let uploadResult;
    if (file.path) {
      // multer diskStorage -> file.path exists
      uploadResult = await cloudinary.uploader.upload(file.path, { resource_type: "image" });
    } else if (file.buffer) {
      // multer memoryStorage -> file.buffer exists
      const dataUri = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
      uploadResult = await cloudinary.uploader.upload(dataUri, { resource_type: "image" });
    } else {
      return res.status(400).json({ success: false, error: "Unsupported file object: no path or buffer found" });
    }

    const imageUrl = uploadResult.secure_url || uploadResult.url;
    const mimeType = file.mimetype || (uploadResult.format ? `image/${uploadResult.format}` : "image/jpeg");

    // 2) Compose the base prompt (your fashion analysis prompt)
    const basePrompt = `
Analyze this clothing item image and the user's query.
1. Identify the clothing item in the image (category, color, style).
2. Understand the user's context and needs from the query.
3. Suggest the ideal complementary outfit categories like tops, jackets, shoes, accessories.

Example output (JSON format only):
{
  "itemInImage": "blue jeans, casual",
  "context": "party, winter, night",
  "recommendations": ["black leather jacket", "high heels", "silver accessories"]
}
`;

    // 3) Add user's own prompt if provided
    const userPrompt = req.body?.queryText || req.body?.userPrompt || "";
    const finalPrompt = userPrompt ? `${basePrompt}\n\nUser query: ${userPrompt}` : basePrompt;

    // 4) Try calling Gemini with the Cloudinary URL (preferred — avoids sending base64)
    let geminiResponse;
    try {
      geminiResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash", // choose the model you prefer
        contents: createUserContent([
          finalPrompt,
          // attach the cloudinary URL as a part so Gemini can fetch the image
          createPartFromUri(imageUrl, mimeType),
        ]),
      });
    } catch (primaryErr) {
      // If Gemini can't fetch the external URL, fallback to inline base64
      console.warn("Primary Gemini call (URL) failed — falling back to inline base64:", primaryErr?.message || primaryErr);

      // prepare base64 data (read from buffer or from path)
      let base64Data = null;
      if (file.buffer) {
        base64Data = file.buffer.toString("base64");
      } else if (file.path) {
        base64Data = fs.readFileSync(file.path, { encoding: "base64" });
      }

      if (!base64Data) throw new Error("Couldn't prepare base64 fallback data for the image.");

      geminiResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: createUserContent([
          finalPrompt,
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
        ]),
      });
    }

    // 5) Extract text from Gemini response (best-effort; different SDKs shape responses differently)
    const rawText = geminiResponse?.text ?? JSON.stringify(geminiResponse);

    // Try parsing JSON output (because prompt asks for JSON). If parse fails, return raw text too.
    let parsed = null;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = null;
    }

    // 6) Return structured result
    res.json({
      success: true,
      cloudinary: {
        url: imageUrl,
        public_id: uploadResult.public_id,
        format: uploadResult.format,
      },
      geminiRaw: rawText,
      analysis: parsed ?? rawText,
    });
  } catch (err) {
    console.error("analyzeImage error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};
