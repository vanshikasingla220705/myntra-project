import express from "express";
import dotenv from "dotenv";
import analyzeRoutes from "./routes/image-understanding.routes.js";
import decorRoutes from "./routes/decorRoutes.js"
import searchRoute from "./routes/searchRoute.js"
import connectDB from "./config/db.js"; // <-- 1. IMPORT THE DB CONNECTION

dotenv.config();

// --- 2. CALL THE CONNECTION FUNCTION ---
connectDB();
// ------------------------------------

const app = express();

app.use(express.json());

// Routes
app.use("/api", analyzeRoutes);
app.use("/api",decorRoutes);
app.use("/api",searchRoute);

app.listen(5000, () => {
  console.log("Server running on port 5000");
});