import fs from "node:fs";
import axios from "axios";
import cloudinary from "../config/cloudinary.js";
import { GoogleGenAI, createUserContent, createPartFromUri } from "@google/genai";
import { Product } from "../models/productModel.js";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Use the base URL from environment variable
const EMBEDDING_SERVICE_URL = process.env.EMBEDDING_SERVICE_URL;

/**
 * Helper function to call our Gradio embedding service.
 * @param {string} text The text to vectorize.
 * @returns {Promise<number[]>} A promise that resolves to the vector array.
 */
const getVectorEmbedding = async (text) => {
  try {
    console.log(`Requesting embedding for (Gradio): "${text}"`);

    // Step 1: Initiate the Gradio API call
    const initiateResponse = await axios.post(`${EMBEDDING_SERVICE_URL}/gradio_api/call/generate_embedding`, {
      data: [text]
    });

    // Extract the event ID from the response
    const eventId = initiateResponse.data?.event_id;
    if (!eventId) {
      throw new Error("No event ID received from Gradio API");
    }

    // Step 2: Poll for the result using the event ID
    const resultResponse = await axios.get(`${EMBEDDING_SERVICE_URL}/gradio_api/call/generate_embedding/${eventId}`);

    // Parse the SSE format response
    const sseData = resultResponse.data;
    
    // The response comes in SSE format: "event: complete\ndata: [...]"
    // We need to extract the JSON data after "data: "
    let jsonData;
    if (typeof sseData === 'string') {
      // Parse SSE format
      const lines = sseData.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.substring(6); // Remove "data: " prefix
          try {
            jsonData = JSON.parse(dataStr);
            break;
          } catch (e) {
            console.error("Failed to parse SSE data:", e);
          }
        }
      }
    } else {
      // If it's already parsed JSON
      jsonData = sseData;
    }

    // Extract the vector from the parsed data
    let vector;
    if (Array.isArray(jsonData) && jsonData[0]?.vector) {
      vector = jsonData[0].vector;
    } else if (jsonData?.data?.[0]?.vector) {
      vector = jsonData.data[0].vector;
    } else {
      console.error("Could not find vector in response:", jsonData);
      throw new Error("Could not extract vector from Gradio response");
    }

    // Final check to ensure the vector is valid
    if (!Array.isArray(vector)) {
      console.error("Invalid vector from Gradio service:", vector);
      throw new Error("Gradio API did not return a valid vector array.");
    }

    return vector;

  } catch (error) {
    console.error("Error calling Gradio embedding service:", error.message);
    throw new Error(
      "Could not get a valid response from the embedding service."
    );
  }
};

export const analyzeImage = async (req, res) => {
  try {
    // 1. UPLOAD IMAGE TO CLOUDINARY
    const files = req.files ?? (req.file ? [req.file] : null);
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: "No images uploaded (field: images)" });
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

    // 2. GET TEXT RECOMMENDATIONS FROM GEMINI
    const basePrompt = `
Analyze this clothing item image(s) and the user's query.
1. Identify the clothing item(s) in the image(s) (category, color, style).
2. Understand the user's context and needs from the query.
3. Suggest 3-5 ideal complementary outfit categories like tops, jackets, shoes, accessories.

Example output (JSON format only):
{
  "itemInImage": "blue jeans, casual",
  "context": "party, winter, night",
  "recommendations": ["black leather jacket", "high heels", "silver accessories"]
}`;
    const userPrompt = req.body?.queryText || req.body?.userPrompt || "";
    const finalPrompt = userPrompt ? `${basePrompt}\n\nUser query: ${userPrompt}` : basePrompt;

    const partsFromUri = uploads.map(({ uploadResult, file }) => {
      const url = uploadResult.secure_url || uploadResult.url;
      const mimeType = file.mimetype || (uploadResult.format ? `image/${uploadResult.format}` : "image/jpeg");
      return createPartFromUri(url, mimeType);
    });

    let geminiResponse;
    try {
      geminiResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
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
        model: "gemini-2.5-flash-lite",
        contents: createUserContent([ finalPrompt, ...inlineParts ])
      });
    }
    
    const rawText = geminiResponse?.text ?? geminiResponse?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // Parse the response from Gemini
    let parsed = null;
    try {
      const startIndex = rawText.indexOf('{');
      const endIndex = rawText.lastIndexOf('}');
      if (startIndex !== -1 && endIndex !== -1) {
        const jsonString = rawText.substring(startIndex, endIndex + 1);
        parsed = JSON.parse(jsonString);
      } else {
        console.error("Could not find a valid JSON object in Gemini's response.");
      }
    } catch (e) {
      console.error("Failed to parse JSON from Gemini:", e);
    }
    
    if (!parsed || !parsed.recommendations || parsed.recommendations.length === 0) {
      return res.status(200).json({ 
          success: true, 
          message: "Analysis complete, but no recommendations to search for.",
          analysis: parsed ?? { rawText },
          images: uploads.map(({ uploadResult }) => ({ url: uploadResult.secure_url }))
      });
    }

    // Perform parallel searches for each recommendation and combine the results.
    const { recommendations } = parsed;
    console.log("✅ Performing a separate search for each AI recommendation from image analysis...");

    const searchTasks = recommendations.map(async (searchTerm) => {
        try {
            const queryVector = await getVectorEmbedding(searchTerm);
            const pipeline = [{
      $vectorSearch: {
        index: "vector_index_desc",
        path: "description_embedding", 
        queryVector: queryVector,
        numCandidates: 100,
        limit: 6,
      },
    },
   {
                $project: { _id: 1, item_name: 1, price: 1, image_url: 1, description: 1 },
            }];
            return Product.aggregate(pipeline);
        } catch (err) {
            console.error(`Failed to search for term "${searchTerm}":`, err);
            return [];
        }
    });

    // Wait for all searches to complete
    const resultsFromAllSearches = await Promise.all(searchTasks);

    // Combine all results into a single flat array
    const combinedProducts = resultsFromAllSearches.flat();

    // Remove duplicate products
    const uniqueProducts = [];
    const seenIds = new Set();
    for (const product of combinedProducts) {
      const productId = product._id.toString();
      if (!seenIds.has(productId)) {
        seenIds.add(productId);
        uniqueProducts.push(product);
      }
    }
    
    console.log(`✅ Combined and deduplicated results. Found ${uniqueProducts.length} unique products.`);

    // 5. SEND FINAL COMBINED RESPONSE TO FRONTEND
    res.json({
      success: true,
      images: uploads.map(({ uploadResult }) => ({
        url: uploadResult.secure_url || uploadResult.url,
        public_id: uploadResult.public_id,
      })),
      geminiRaw: rawText,
      analysis: parsed,
      recommendedProducts: uniqueProducts
    });

  } catch (err) {
    console.error("analyzeImage error:", err);
    res.status(500).json({ success: false, error: err.message || String(err) });
  }
};