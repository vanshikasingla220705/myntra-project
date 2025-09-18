import axios from "axios";
import { GoogleGenAI, createUserContent } from "@google/genai";
import { Product } from "../models/productModel.js"; // Your Mongoose model for CLOTHING
import { Decor } from "../models/decorModel.js";     // NEW: Your Mongoose model for DECOR

// Initialize the Generative AI client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// The embedding helper function remains the same
const EMBEDDING_SERVICE_URL = 'http://127.0.0.1:8000/embed';

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
 * Analyzes a text query, classifies it as 'clothing' or 'decor', gets recommendations,
 * and finds matching items in the correct database collection using vector search.
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

    // 2. GET RECOMMENDATIONS & CATEGORY FROM GEMINI
    // --- MODIFIED PROMPT ---
    // The prompt now explicitly asks the AI to classify the query and provides examples for both.
    const generationPrompt = `
Analyze the user's request.
1. First, classify the query's intent into ONE of two categories: "clothing" or "decor".
2. Understand the user's context what user is trying to say
like if the user is saying a party look give him the recommendations of skirts, pants, froks, heels, earingsetc.

but if the user is asking for the traditional look 
give him the things like golder kuta , sharara, juti, heels, bangles, lehenga, etc.

do not just give the recommended text only in single word ::
just define properly 
eg. golden color saree, juttis, sahrara, kurtas and give 3-5 strings like that so the vector embedding could find as many items as possible of all categories

also keep it same for western looks also 
if the user is asking the western looks give him heels , dresses, earings

3. Suggest ideal complementary items. The first recommendation should be the most prominent.
5. if the category is decor please find that what the user is trying to ask for
like if he is asking for table decoration give him lamps and vases and if the user is asking for wall decoration give him the products relatedd to wall decoration.

Example user query 1: "I need an outfit for a formal winter wedding."
Example output 1 (JSON format only):
{
  "category": "clothing",
  "context": "formal, winter, wedding",
  "recommendations": ["black velvet blazer", "white silk blouse", "tailored wool trousers"]
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
      model: 'gemini-1.5-flash',
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

    // --- NEW: DYNAMIC MODEL SELECTION ---
    // We select the database model based on the category returned by the AI.
    const { category, recommendations } = parsed;
    let searchModel;

    if (category === 'clothing') {
      searchModel = Product;
      console.log("✅ Category identified: Clothing. Searching in 'Product' collection.");
    } else if (category === 'decor') {
      searchModel = Decor;
      console.log("✅ Category identified: Decor. Searching in 'Decor' collection.");
    } else {
      // Handle cases where the AI returns an unknown or missing category
      return res.status(400).json({
          success: false,
          error: `AI returned an unsupported category: '${category}'. Cannot perform search.`,
          analysis: parsed
      });
    }

    // 3. VECTORIZE THE FIRST RECOMMENDATION (No changes here)
    const recommendationToSearch = recommendations[0];
    const queryVector = await getVectorEmbedding(recommendationToSearch);

    // 4. PERFORM VECTOR SEARCH IN THE CORRECT COLLECTION
    const pipeline = [{
      $vectorSearch: {
        index: 'vector_index_desc', // IMPORTANT: Ensure both collections have a vector index with this name
        path: 'description_embedding', // The field containing the vectors
        queryVector: queryVector,
        numCandidates: 150,
        limit: 10,
      },
    }, {
      $project: {
        _id: 1, item_name: 1, price: 1, image_url: 1, description: 1,
        score: { $meta: 'vectorSearchScore' },
      },
    }];

    // --- MODIFIED: Use the dynamically selected model for the query ---
    const recommendedItems = await searchModel.aggregate(pipeline);

    // 5. SEND FINAL RESPONSE (No changes here, but the payload is now dynamic)
    res.json({
      success: true,
      geminiRaw: rawText,
      analysis: parsed, // The `analysis` object now includes the category
      recommendedProducts: recommendedItems
    });

  } catch (err) {
    console.error("Multi-category search error:", err);
    res.status(500).json({ success: false, error: err.message || String(err) });
  }
};