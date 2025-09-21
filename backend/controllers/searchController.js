import axios from "axios";
import { GoogleGenAI, createUserContent } from "@google/genai";
import { Product } from "../models/productModel.js"; // Your Mongoose model for CLOTHING
import { Decor } from "../models/decorModel.js";     // Your Mongoose model for DECOR

// Initialize the Generative AI client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// The embedding helper function remains the same
const EMBEDDING_SERVICE_URL =process.env.EMBEDDING_SERVICE_URL;

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


/**
 * Analyzes a text query, gets recommendations, and finds matching items
 * by performing multiple parallel searches and combining the results.
 */
export const getTextBasedRecommendations = async (req, res) => {
  try {
    // 1. VALIDATE INPUT (No changes here)
    const { queryText } = req.body;
    if (!queryText || typeof queryText !== 'string' || queryText.trim() === '') {
      return res.status(400).json({
        success: false,
        error: "A non-empty 'queryText' field is required."
      });
    }

    // 2. GET RECOMMENDATIONS & CATEGORY FROM GEMINI (No changes here)
    const generationPrompt = `
Analyze the user's request.
1. First, classify the query's intent into ONE of two categories: "clothing" or "decor".
2. Understand the user's context what user is trying to say

3.if the category is clothing then just suggest the clothes related to that inquiry and also suggest 
the footwear and accessories related to that. 

4. Suggest ideal complementary items. The first recommendation should be the most prominent.
5. if the category is decor please find that what the user is trying to ask for
like if he is asking for table decoration give him lamps and vases and if the user is asking for wall decoration give him the products relatedd to wall decoration.

Example user query 1: "I need an outfit for a formal winter wedding."
Example output 1 (JSON format only):
{
  "category": "clothing",
  "context": "formal, winter, wedding",
  "recommendations": ["black velvet blazer", "black high sandals", "golden earings"]
}

Example user query 2: "Help me find a centerpiece for my rustic dining room table."
Example output 2 (JSON format only):
{
  "category": "decor",
  "context": "centerpiece, rustic, dining room",
  "recommendations": ["distressed wood candle holder set", "eucalyptus garland", "burlap table runner"]
}`;

    const finalPrompt = `${generationPrompt}\n\nUser query: ${queryText}`;

    const geminiResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: createUserContent([finalPrompt])
    });
    
    // Parse the response (No changes here)
    const rawText = geminiResponse?.text ?? geminiResponse?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    let parsed = null;
    try {
      const startIndex = rawText.indexOf('{');
      const endIndex = rawText.lastIndexOf('}');
      if (startIndex !== -1 && endIndex !== -1) {
        parsed = JSON.parse(rawText.substring(startIndex, endIndex + 1));
      }
    } catch (e) {
      console.error("Failed to parse JSON from Gemini:", e);
    }

    if (!parsed || !parsed.recommendations || parsed.recommendations.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Analysis complete, but no specific recommendations to search for.",
        analysis: parsed ?? { rawText }
      });
    }

    // DYNAMIC MODEL SELECTION (No changes here)
    const { category, recommendations } = parsed;
    let searchModel;

    if (category === 'clothing') {
      searchModel = Product;
      console.log("✅ Category identified: Clothing. Searching in 'Product' collection.");
    } else if (category === 'decor') {
      searchModel = Decor;
      console.log("✅ Category identified: Decor. Searching in 'Decor' collection.");
    } else {
      return res.status(400).json({
          success: false,
          error: `AI returned an unsupported category: '${category}'. Cannot perform search.`,
          analysis: parsed
      });
    }

    // --- THIS IS THE ONLY SECTION THAT HAS BEEN CHANGED ---
    // Perform parallel searches and combine the results into a single list.

    console.log("✅ Performing a separate search for each AI recommendation...");

    const searchTasks = recommendations.map(async (searchTerm) => {
        try {
            const queryVector = await getVectorEmbedding(searchTerm);
            const pipeline = [{
                $search: {
                    index: 'vector_index_desc',
                    path: 'description_embedding',
                    queryVector: queryVector,
                    numCandidates: 100,
                    limit: 4, // Get top 4 results for EACH term
                },
            }, {
                $project: { _id: 1, item_name: 1, price: 1, image_url: 1, description: 1 },
            }];
            return searchModel.aggregate(pipeline);
        } catch (err) {
            console.error(`Failed to search for term "${searchTerm}":`, err);
            return []; // Return empty array on failure
        }
    });

    // Wait for all searches to complete
    const resultsFromAllSearches = await Promise.all(searchTasks);

    // Combine all results into a single flat array
    const combinedProducts = resultsFromAllSearches.flat();

    // Remove duplicate products that may appear in multiple search results
    const uniqueProducts = [];
    const seenIds = new Set();
    for (const product of combinedProducts) {
      // Mongoose returns _id as an object, so we convert it to a string for comparison
      const productId = product._id.toString();
      if (!seenIds.has(productId)) {
        seenIds.add(productId);
        uniqueProducts.push(product);
      }
    }
    
    console.log(`✅ Combined and deduplicated results. Found ${uniqueProducts.length} unique products.`);

    // 5. SEND THE FINAL COMBINED RESPONSE
    res.json({
        success: true,
        geminiRaw: rawText,
        analysis: parsed,
        // The key is back to 'recommendedProducts' with a flat, unique list
        recommendedProducts: uniqueProducts
    });
    // --- END OF CHANGED SECTION ---

  } catch (err) {
    console.error("Multi-category search error:", err);
    res.status(500).json({ success: false, error: err.message || String(err) });
  }
};