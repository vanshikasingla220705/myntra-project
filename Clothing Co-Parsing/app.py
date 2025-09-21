import gradio as gr
import torch
from collections import OrderedDict
import os
from PIL import Image
from io import BytesIO

# Import your existing model and processing logic
from network import U2NET
from processor import process_image

# --- 1. MODEL LOADING (Same as before) ---
def load_checkpoint_for_api(model, checkpoint_path):
    # Your existing load_checkpoint_for_api function...
    print(f"Loading checkpoints from: {checkpoint_path}")
    if not os.path.exists(checkpoint_path):
        raise FileNotFoundError(f"Checkpoint file not found at {checkpoint_path}")
    model_state_dict = torch.load(checkpoint_path, map_location=torch.device("cpu"))
    if list(model_state_dict.keys())[0].startswith('module.'):
        new_state_dict = OrderedDict()
        for k, v in model_state_dict.items():
            name = k[7:]
            new_state_dict[name] = v
        model.load_state_dict(new_state_dict)
    else:
        model.load_state_dict(model_state_dict)
    print("---- Checkpoints loaded successfully! ----")
    return model

# Load the model once
net = U2NET(in_ch=3, out_ch=4)
net = load_checkpoint_for_api(net, 'cloth_segm.pth')
net.eval()

# --- 2. WRAPPER FUNCTION FOR GRADIO ---
def segment_image_api(image_dict, clothing_type):
    # image_dict contains the uploaded image as a numpy array
    image_pil = Image.fromarray(image_dict)

    # Convert PIL Image to bytes for your existing processor
    with BytesIO() as buf:
        image_pil.save(buf, format='PNG')
        image_bytes = buf.getvalue()

    # Define which classes to keep based on the dropdown choice
    class_map = {
        "top": [1], "bottom": [2], "skirt": [2, 3],
        "coord": [1, 2], "kurta": [3], "lehenga": [1, 3]
    }
    classes_to_keep = class_map.get(clothing_type, [1]) # Default to top

    # Use your existing process_image function
    result_bytes_io = process_image(image_bytes, net, classes_to_keep)

    # Convert result back to a PIL Image for Gradio to display/return
    result_image = Image.open(result_bytes_io)
    return result_image

# --- 3. CREATE THE GRADIO INTERFACE ---
demo = gr.Interface(
    fn=segment_image_api,
    inputs=[
        gr.Image(label="Upload Clothing Image", type="numpy"),
        gr.Dropdown(
            label="Clothing Type",
            choices=["top", "bottom", "skirt", "coord", "kurta", "lehenga"],
            value="top"
        )
    ],
    outputs=gr.Image(label="Segmented Result", format="png"),
    title="Clothing Segmentation AI",
    description="Upload an image and select the clothing type to remove the background."
)

# --- 4. LAUNCH THE APP ---
if __name__ == "__main__":
    demo.launch()