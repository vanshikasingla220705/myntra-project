import express from "express";
import { getTextBasedRecommendations } from "../controllers/searchController.js"; // Adjust path if needed

const router = express.Router();

// Defines the route for a POST request to /text-search
router.post("/text-search", getTextBasedRecommendations);
 
export default router;