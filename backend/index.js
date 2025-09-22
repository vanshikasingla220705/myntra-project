import express from "express";
import dotenv from "dotenv";
import analyzeRoutes from "./routes/image-understanding.routes.js";
import decorRoutes from "./routes/decorRoutes.js";
import searchRoute from "./routes/searchRoute.js";
import connectDB from "./config/db.js";
import cors from "cors";
import multer from "multer";
import axios from "axios";
import { Client } from "@gradio/client";
import sharp from 'sharp';

// Load environment variables
dotenv.config();

// Connect to the database
connectDB();

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Gradio Client once at the start
let client;
try {
  client = await Client.connect("Vanshikasinglakkr/myntra-segmentation");
  console.log("Successfully connected to Gradio client.");
} catch (error) {
  console.error("Failed to connect to Gradio client:", error);
  // Exit if the client is essential for the application to run
  process.exit(1);
}

// Setup multer for in-memory file storage
const memoryUpload = multer({ storage: multer.memoryStorage() });


// --- Routes ---
app.use("/api", analyzeRoutes);
app.use("/api", decorRoutes);
app.use("/api", searchRoute);


/**
 * @route POST /api/segment/:clothingType
 * @desc Uploads an image, sends it to a Gradio segmentation model, and returns the resulting image.
 * @access Public
 */
app.post('/api/segment/:clothingType', memoryUpload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const { clothingType } = req.params;

  try {
    // 1. Convert the uploaded image buffer to a standard JPEG buffer using sharp.
    // This ensures consistency in the image format sent to the model.
    const jpgBuffer = await sharp(req.file.buffer)
      .jpeg({ quality: 90 }) // You can adjust the quality if needed
      .toBuffer();

    // 2. The @gradio/client in Node.js expects a Blob for file inputs.
    // We create a Blob from our JPEG buffer.
    const imageBlob = new Blob([jpgBuffer], { type: 'image/jpeg' });

    // 3. Send the image Blob and clothing type to the Gradio model's predict endpoint.
    console.log(`Sending image to Gradio for segmentation with type: ${clothingType}`);
    const result = await client.predict("/predict", {
      image_dict: imageBlob,      // Pass the Blob object as required by the client
      clothing_type: clothingType,
    });
    console.log("Received a response from Gradio.");

    // 4. The result from an Image output component is an object containing a URL.
    // We assume the segmented image is the first item in the data array.
    const outputImageUrl = result.data[0]?.url;

    if (!outputImageUrl) {
        console.error("Gradio API did not return a valid image URL in the response.", result);
        throw new Error('API did not return a valid image URL.');
    }

    // 5. Fetch the resulting image from the provided URL using axios.
    const imageResponse = await axios.get(outputImageUrl, {
        responseType: 'arraybuffer' // We need the raw image data as a buffer
    });

    // 6. Send the final processed image back to the user.
    // We'll use the content-type from the fetched image response.
    res.set('Content-Type', imageResponse.headers['content-type'] || 'image/png');
    res.send(imageResponse.data);

  } catch (error) {
    // Provide detailed error logging for easier debugging
    let errorMessage = error.message;
    if (error.response) { // Check for errors from axios requests
      errorMessage = `Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`;
    }
    console.error('Error in /api/segment route:', errorMessage, error.stack);
    res.status(500).json({ error: 'An internal error occurred while processing the image.' });
  }
});


/**
 * @route GET /api/proxy-image
 * @desc Proxies an image from a given URL to bypass potential CORS issues.
 * @access Public
 */
app.get('/api/proxy-image', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'Image URL is required.' });
  }

  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer'
    });
    res.set('Content-Type', response.headers['content-type']);
    res.send(response.data);
  } catch (error) {
    console.error('Error proxying image:', error.message);
    res.status(500).json({ error: 'Failed to fetch the image from the provided URL.' });
  }
});


// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
