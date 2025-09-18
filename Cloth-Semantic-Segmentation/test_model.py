import os
import torch
from PIL import Image
from collections import OrderedDict
import io

# Import the necessary components from our other files
from network import U2NET
from processor import process_image

def load_checkpoint_for_api(model, checkpoint_path):
    """Loads the model checkpoint, same as in app.py."""
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

def main():
    # --- 1. CONFIGURE YOUR TEST HERE ---
    
    # Specify the path to your input image
    INPUT_IMAGE_PATH = 'input/test_image.jpg'
    
    # Specify which classes to extract. Change this based on your image!
    # [1] for Top
    # [2] for Bottom
    # [3] for Kurta
    # [2, 3] for Skirt
    # [1, 2] for Co-ord
    # [1, 3] for Lehenga
    CLASSES_TO_TEST = [3] 
    
    # The name of the output file
    OUTPUT_IMAGE_PATH = 'output/result.png'
    
    # --- END OF CONFIGURATION ---

    print("--- Starting Local Model Test ---")

    # 1. Load the model
    net = U2NET(in_ch=3, out_ch=4) 
    net = load_checkpoint_for_api(net, 'cloth_segm.pth')
    net.eval()

    # 2. Open and read the local image file into memory
    print(f"Opening image: {INPUT_IMAGE_PATH}")
    with open(INPUT_IMAGE_PATH, 'rb') as f:
        image_bytes = f.read()

    # 3. Process the image using our universal processor
    print(f"Processing image with classes: {CLASSES_TO_TEST}")
    result_bytes_io = process_image(image_bytes, net, classes_to_keep=CLASSES_TO_TEST)

    # 4. Save the result to a file
    # Create the output directory if it doesn't exist
    os.makedirs(os.path.dirname(OUTPUT_IMAGE_PATH), exist_ok=True)
    
    with open(OUTPUT_IMAGE_PATH, 'wb') as f:
        f.write(result_bytes_io.getbuffer())
        
    print(f"--- SUCCESS! ---")
    print(f"Segmented image saved to: {OUTPUT_IMAGE_PATH}")


if __name__ == '__main__':
    main()