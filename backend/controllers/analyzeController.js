import fs from "node:fs";
import axios from "axios"; // Import axios to make HTTP requests
import cloudinary from "../config/cloudinary.js";
import { GoogleGenAI, createUserContent, createPartFromUri } from "@google/genai";
import {Product} from "../models/productModel.js"; // You'll need your Mongoose Product model

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// --- NEW: URL for our Python Embedding Service ---
const EMBEDDING_SERVICE_URL = 'http://127.0.0.1:8000/embed';

/**
 * --- NEW: Helper function to call our FastAPI embedding service ---
 * This function takes a string of text, sends it to the Python service,
 * and gets back the vector embedding.
 * @param {string} text The text to vectorize.
 * @returns {Promise<number[]>} A promise that resolves to the vector array.
 */
const getVectorEmbedding = async (text) => {
  try {
    console.log(`Requesting embedding for: "${text}"`);
    const response = await axios.post(EMBEDDING_SERVICE_URL, { text: text });
    return response.data.vector;
  } catch (error) {
    // Log the detailed error, but throw a simpler one to the caller
    console.error("Error calling embedding service:", error.message);
    throw new Error("Could not connect to the embedding service.");
  }
};


export const analyzeImage = async (req, res) => {
  try {
    // 1. UPLOAD IMAGE TO CLOUDINARY (Your existing logic is great)
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

    // 2. GET TEXT RECOMMENDATIONS FROM GEMINI (Your existing logic)
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
        model: 'gemini-1.5-flash',
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
        model: "gemini-1.5-flash", // Adjusted model name
        contents: createUserContent([ finalPrompt, ...inlineParts ])
      });
    }
    
   // ...after getting geminiResponse
    
    const rawText = geminiResponse?.text ?? geminiResponse?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // --- NEW: Clean and parse the response from Gemini ---
    let parsed = null;
    try {
        // 1. Find the start and end of the JSON block
        const startIndex = rawText.indexOf('{');
        const endIndex = rawText.lastIndexOf('}');
        
        if (startIndex !== -1 && endIndex !== -1) {
            // 2. Extract just the JSON string
            const jsonString = rawText.substring(startIndex, endIndex + 1);
            // 3. Parse the clean JSON string
            parsed = JSON.parse(jsonString);
        } else {
            console.error("Could not find a valid JSON object in Gemini's response.");
        }
    } catch (e) {
        console.error("Failed to parse JSON from Gemini:", e);
        // Keep 'parsed' as null to handle the error gracefully
    }
    
    // This 'if' block now works as intended
    if (!parsed || !parsed.recommendations || parsed.recommendations.length === 0) {
        return res.status(200).json({ 
            success: true, 
            message: "Analysis complete, but no recommendations to search for.",
            analysis: parsed ?? rawText 
        });
    }

    // --- 3. VECTORIZE THE FIRST RECOMMENDATION ---
    // This part of your code will now be reached successfully
    const recommendationToSearch = parsed.recommendations[0];
    console.log(`Searching for products similar to: "${recommendationToSearch}"`); // <-- Good for debugging!
    const queryVector = await getVectorEmbedding(recommendationToSearch);

    // ...the rest of your vector search logic follows

    // --- 4. PERFORM VECTOR SEARCH IN MONGODB ATLAS ---
    // This assumes you have a Vector Search Index in Atlas named 'default'.
    // Please replace 'default' with your actual index name.
    const pipeline = [
      {
        $vectorSearch: {
          index: 'vector_index_desc', // <-- IMPORTANT: Change to your Atlas Vector Search index name
          path: 'description_embedding', // The field in your documents containing the vectors
          queryVector: queryVector,
          numCandidates: 150, // The number of candidates to consider
          limit: 10, // The number of top results to return
        },
      },
      {
        $project: {
          _id: 1,
          item_name: 1, // Or title, whichever you use
          price: 1,
          image_url: 1,
          description:1,
          score: { $meta: 'vectorSearchScore' }, // The similarity score from the search
        },
      },
    ];

    const recommendedProducts = await Product.aggregate(pipeline);

    // --- 5. SEND FINAL RESPONSE TO FRONTEND ---
    res.json({
      success: true,
      images: uploads.map(({ uploadResult }) => ({
        url: uploadResult.secure_url || uploadResult.url,
        public_id: uploadResult.public_id,
        format: uploadResult.format,
      })),
      geminiRaw: rawText,
      analysis: parsed,
      recommendedProducts: recommendedProducts // <-- Here are the matching products!
    });

  } catch (err) {
    console.error("analyzeImage error:", err);
    res.status(500).json({ success: false, error: err.message || String(err) });
  }
};

