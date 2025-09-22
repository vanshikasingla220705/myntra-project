from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import logging

# Setup basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- 1. Initialize FastAPI App ---
# This is the main entry point for our API.
app = FastAPI(
    title="Text Embedding Service",
    description=(
        "A simple API to convert text into vector embeddings using a "
        "sentence-transformer model."
    ),
    version="1.0.0",
)


# --- 2. Load the AI Model ---
# We load the model here, ONCE, when the application starts up. This is a
# critical optimization. If we loaded it inside the endpoint function, it
# would reload from disk on every single API call, which is very slow.
try:
    logger.info("Loading the sentence-transformer model...")
    # 'all-MiniLM-L6-v2' is a great, lightweight model. It creates
    # 384-dimensional vectors.
    model = SentenceTransformer('all-MiniLM-L6-v2')
    logger.info("Model loaded successfully.")
except Exception as e:
    logger.error(f"Failed to load model: {e}")
    model = None


# --- 3. Define Request Body Structure ---
# Using Pydantic's BaseModel ensures that the incoming request data
# is valid. We expect a JSON object with a single key "text".
# e.g., { "text": "Cream or Off-white Kurta" }
class TextInput(BaseModel):
    text: str


# --- 4. Create the API Endpoint ---
# This decorator tells FastAPI to create an endpoint that listens for
# POST requests at the path '/embed'.
@app.post("/embed/")
def get_embedding(text_input: TextInput):
    """
    Receives text input and returns its vector embedding.
    """
    if model is None:
        return {"error": "Model is not available"}, 503  # Service Unavailable

    try:
        # The core logic: take the text from the validated request body.
        text_to_embed = text_input.text
        logger.info(f"Generating embedding for: '{text_to_embed}'")

        # Use the pre-loaded model to encode the text into a vector.
        embedding = model.encode(text_to_embed)

        # Convert the NumPy array to a list to make it JSON-serializable.
        embedding_list = embedding.tolist()

        logger.info("Embedding generated successfully.")
        return {"text": text_to_embed, "vector": embedding_list}

    except Exception as e:
        logger.error(f"An error occurred during embedding: {e}")
        return {"error": "Failed to generate embedding"}, 500


# A simple root endpoint to check if the service is running
@app.get("/")
def read_root():
    return {"status": "Embedding service is running."}
