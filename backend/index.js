import express from "express";
import dotenv from "dotenv";
import analyzeRoutes from "./routes/analyzeRoutes.js";

dotenv.config();
const app = express();

app.use(express.json());

// Routes
app.use("/api", analyzeRoutes);

app.listen(5000, () => {
  console.log("Server running on port 5000");
});
