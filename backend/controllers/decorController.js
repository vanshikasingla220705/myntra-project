import fs from "node:fs";
import axios from "axios";
import cloudinary from "../config/cloudinary.js";
import { GoogleGenAI, createUserContent, createPartFromUri } from "@google/genai";
import { Decor } from "../models/decorModel.js"; // Import your Decor model

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const EMBEDDING_SERVICE_URL = 'http://127.0.0.1:8000/embed';

// Helper function to get vector embeddings
const getVectorEmbedding = async (text) => {
  try {
    console.log(`Requesting embedding for: "${text}"`);
    const response = await axios.post(EMBEDDING_SERVICE_URL, { text: text });
    return response.data.vector;
  } catch (error) {
    console.error("Error calling embedding service:", error.message);
    throw new Error("Could not connect to the embedding service.");
  }
};

export const analyzeDecorImage = async (req, res) => {
  try {
    // 1. UPLOAD IMAGE TO CLOUDINARY
    const files = req.files ?? (req.file ? [req.file] : null);
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: "No images uploaded" });
    }

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

    // 2. GET DECOR RECOMMENDATIONS FROM GEMINI
    const basePrompt = `
You are an expert interior designer. Analyze the primary home decor item in the image.
1.  Identify the main item like a table a wall or a window where we can have the lamps or wall decor or vases.
2.  Based on the item, suggest 3-5 complementary decor items that would create a cohesive look, like if a table then suggest different flower vases or lamps as suggested by the user and if it is a wall then suggest different wall decor items etc.
3.  Do not suggest furniture like sofas or beds unless it's the main item.
4.  based on the user prompt give the results accordingly.

Example output (JSON format only):
{
  "itemInImage": "white ceramic flower vase, minimalist",
  "recommendations": ["pampas grass stems", "scented soy candle", "wooden coaster set", "abstract art print"]
}`;
    const userPrompt = req.body?.queryText || "";
    const finalPrompt = userPrompt ? `${basePrompt}\n\nUser query for context: ${userPrompt}` : basePrompt;

    let geminiResponse;
    try {
      // Primary attempt: Use Cloudinary URL
      const partsFromUri = uploads.map(({ uploadResult, file }) => {
        const url = uploadResult.secure_url || uploadResult.url;
        const mimeType = file.mimetype || (uploadResult.format ? `image/${uploadResult.format}` : "image/jpeg");
        return createPartFromUri(url, mimeType);
      });
      geminiResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: createUserContent([ finalPrompt, ...partsFromUri ])
      });
    } catch (primaryErr) {
      // Fallback: Use inline base64 data if URL fails
      console.warn("Gemini fetch-from-URL failed — falling back to inline base64:", primaryErr?.message || primaryErr);
      const inlineParts = uploads.map(({ file, uploadResult }) => {
        let base64Data;
        if (file.buffer) base64Data = file.buffer.toString("base64");
        else if (file.path) base64Data = fs.readFileSync(file.path, { encoding: "base64" });
        const mimeType = file.mimetype || (uploadResult.format ? `image/${uploadResult.format}` : "image/jpeg");
        return { inlineData: { mimeType, data: base64Data } };
      });
      geminiResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: createUserContent([ finalPrompt, ...inlineParts ])
      });
    }
    
    const rawText = geminiResponse?.text ?? geminiResponse?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // 3. PARSE GEMINI'S RESPONSE
    let parsed = null;
    try {
      const startIndex = rawText.indexOf('{');
      const endIndex = rawText.lastIndexOf('}');
      const jsonString = rawText.substring(startIndex, endIndex + 1);
      parsed = JSON.parse(jsonString);
    } catch (e) {
      console.error("Failed to parse JSON from Gemini:", e);
      return res.status(500).json({ success: false, error: "Failed to parse analysis from AI." });
    }

    if (!parsed?.recommendations?.length) {
      return res.status(200).json({ 
        success: true, 
        message: "Analysis complete, but no recommendations to search for.",
        analysis: parsed ?? rawText 
      });
    }
    
    // 4. VECTORIZE THE FIRST RECOMMENDATION
    const recommendationToSearch = parsed.recommendations[0];
    console.log(`Searching for decor similar to: "${recommendationToSearch}"`);
    const queryVector = await getVectorEmbedding(recommendationToSearch);

    // 5. PERFORM VECTOR SEARCH IN THE DECOR COLLECTION
    const pipeline = [
      {
        $vectorSearch: {
          index: 'vector_index_desc',
          path: 'description_embedding',
          queryVector: queryVector,
          numCandidates: 150,
          limit: 10,
        },
      },
      {
        $project: {
          _id: 1,
          item_name: 1,
          price: 1,
          image_url: 1,
          description: 1,
          score: { $meta: 'vectorSearchScore' },
        },
      },
    ];

    const recommendedProducts = await Decor.aggregate(pipeline);

    // 6. SEND FINAL RESPONSE
    res.json({
      success: true,
      images: uploads.map(({ uploadResult }) => ({
        url: uploadResult.secure_url || uploadResult.url,
        public_id: uploadResult.public_id,
        format: uploadResult.format,
      })),
      geminiRaw: rawText,
      analysis: parsed,
      recommendedProducts: recommendedProducts
    });

  } catch (err) {
    console.error("analyzeDecorImage error:", err);
    res.status(500).json({ success: false, error: err.message || String(err) });
  }
};