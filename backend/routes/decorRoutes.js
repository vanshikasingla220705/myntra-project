import express from "express";
import multer from "multer";
import {analyzeDecorImage } from "../controllers/decorController.js"; // must match controller filename

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Accept up to 2 files under form-field name "images"
router.post("/image-understanding2", upload.array("images", 2), analyzeDecorImage);

export default router;
