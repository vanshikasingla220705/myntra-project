import express from "express";
import dotenv from "dotenv";
import analyzeRoutes from "./routes/image-understanding.routes.js";
import decorRoutes from "./routes/decorRoutes.js"
import searchRoute from "./routes/searchRoute.js"
import connectDB from "./config/db.js"; // <-- 1. IMPORT THE DB CONNECTION
import cors from "cors"
dotenv.config();
import multer from "multer"
import axios from "axios"
import FormData from 'form-data';
const PYTHON_API_URL = process.env.SEGMENTATION_SERVICE_URL;
const memoryUpload = multer({ storage: multer.memoryStorage() });
// --- 2. CALL THE CONNECTION FUNCTION ---
connectDB();
// ------------------------------------

const app = express();
const corsOptions = {
  origin: 'https://myntra-project-3.onrender.com', // Your frontend URL
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

// Routes
app.use("/api", analyzeRoutes);
app.use("/api",decorRoutes);
app.use("/api",searchRoute);
app.post('/api/segment/:clothingType', memoryUpload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }
  const { clothingType } = req.params;
  try {
    const form = new FormData();
    form.append('file', req.file.buffer, req.file.originalname);
    const response = await axios.post(`${PYTHON_API_URL}/segment/${clothingType}`, form, {
      headers: form.getHeaders(),
      responseType: 'arraybuffer',
    });
    res.set('Content-Type', 'image/png');
    res.send(response.data);
  } catch (error) {
    console.error('Error forwarding to Python API:', error.message);
    res.status(500).json({ error: 'Error processing image.' });
  }
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});