// productModel.js

import mongoose, {Schema} from "mongoose";

const decorSchema = new Schema(
    {
        // --- CHANGE THIS LINE ---
        item_name: { // Changed from "item" to "item_name"
            type: String,
            required: true
        },
        description: {
            type: String,
            required: true
        },
        price: {
            type: String, 
            required: true
        },
        image_url: { // Assuming this is the image URL
            type: String, 
            required: true
        },
        description_embedding: {
            type: [Number],
            required: false 
        },
    },{collection:'myntra2'}
);

export const Decor = mongoose.model("Decor", decorSchema,"myntra2");