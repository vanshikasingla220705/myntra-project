import mongoose from "mongoose";
import axios from "axios";
import dotenv from "dotenv";
import {Decor} from "./models/decorModel.js"; // Adjust the path to your product model if needed

dotenv.config(); // Load environment variables from a .env file

// --- CONFIGURATION ---
const MONGO_URI = process.env.MONGODB_API_KEY; // Your MongoDB connection string
const EMBEDDING_SERVICE_URL = 'http://127.0.0.1:8000/embed'; // The URL of your running Python service

/**
 * Helper function to call the FastAPI embedding service.
 * @param {string} text The text to vectorize.
 * @returns {Promise<number[]>} A promise that resolves to the vector array.
 */
const getVectorEmbedding = async (text) => {
  if (!text || text.trim() === "") {
    console.warn("Skipping empty or invalid text.");
    return null;
  }
  try {
    const response = await axios.post(EMBEDDING_SERVICE_URL, { text });
    return response.data.vector;
  } catch (error) {
    console.error(`Error getting embedding for "${text}": ${error.message}`);
    return null; // Return null on failure to continue with other products
  }
};

/**
 * Main function to find products, generate embeddings, and update the database.
 */
const processProducts = async () => {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("MongoDB connected successfully.");

  // Find all products that do NOT have the 'description_embedding' field yet
  const productsToProcess = await Decor.find({
    description_embedding: { $exists: false },
    description: { $exists: true, $ne: null } // Ensure description exists and is not null
  });

  if (productsToProcess.length === 0) {
    console.log("No products found that need embedding. All products are up to date!");
    return;
  }

  console.log(`Found ${productsToProcess.length} products to process.`);
  let successCount = 0;
  let errorCount = 0;

  for (const product of productsToProcess) {
    console.log(`--- Processing product: ${product.item_name} (ID: ${product._id}) ---`);

    // Use the product's description to generate the embedding
    const textToEmbed = product.description;
    const vector = await getVectorEmbedding(textToEmbed);

    if (vector) {
      // If we got a vector, update the product in the database
      await Decor.updateOne(
        { _id: product._id },
        { $set: { description_embedding: vector } }
      );
      console.log(`Successfully updated product ID: ${product._id}`);
      successCount++;
    } else {
      console.log(`Failed to generate embedding for product ID: ${product._id}. Skipping.`);
      errorCount++;
    }
  }

  console.log("\n--- Processing Complete ---");
  console.log(`Successfully updated ${successCount} products.`);
  console.log(`Failed to update ${errorCount} products.`);
};

// --- RUN THE SCRIPT ---
processProducts()
  .catch(console.error)
  .finally(() => mongoose.disconnect());