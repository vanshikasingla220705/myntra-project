import express from "express";
import multer from "multer";
import { analyzeImage } from "../controllers/analyzeController.js";

const router = express.Router();

// Use memory storage (keeps file buffers in RAM, not disk)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Accept up to 2 images
router.post("/analyze", upload.array("images", 2), analyzeImage);

export default router;
