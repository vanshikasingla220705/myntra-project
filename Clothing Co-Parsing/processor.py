import torch
import torch.nn.functional as F
import torchvision.transforms as transforms
from PIL import Image
import numpy as np
import cv2
import io

# Helper class and function (no changes)
class Normalize_image(object):
    def __init__(self, mean, std):
        self.normalize_3 = transforms.Normalize([mean] * 3, [std] * 3)
    def __call__(self, image_tensor):
        return self.normalize_3(image_tensor)

def apply_transform(img):
    transforms_list = [transforms.ToTensor(), Normalize_image(0.5, 0.5)]
    return transforms.Compose(transforms_list)(img)


# This is our new, more robust processing function
def process_image(image_bytes, net, classes_to_keep):
    """
    Processes an image to segment clothing based on a list of class IDs.
    """
    try:
        # --- MODIFIED SECTION: More reliable way to open image from bytes ---
        # 1. Load the uploaded image from memory using OpenCV for robustness
        nparr = np.frombuffer(image_bytes, np.uint8)
        img_cv2 = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img_cv2 is None:
            raise ValueError("Could not decode image from bytes.")
            
        # Convert image from BGR (OpenCV default) to RGB (PIL/PyTorch default)
        img_rgb = cv2.cvtColor(img_cv2, cv2.COLOR_BGR2RGB)
        
        # Convert the numpy array to a PIL Image to use existing transforms
        original_image = Image.fromarray(img_rgb)
        img_size = original_image.size
        # --- END OF MODIFIED SECTION ---

        # 2. Pre-process the image for the model (no changes here)
        img_for_model = original_image.resize((768, 768), Image.BICUBIC)
        image_tensor = apply_transform(img_for_model)
        image_tensor = torch.unsqueeze(image_tensor, 0)

        # 3. Get segmentation mask from the model (no changes here)
        with torch.no_grad():
            d0, d1, d2, d3, d4, d5, d6 = net(image_tensor.to('cpu'))
            pred = torch.max(d0, dim=1, keepdim=True)[1]
            output_tensor = torch.squeeze(pred, dim=0)
            output_arr = output_tensor.cpu().numpy()

        # 4. Create the alpha mask in memory (no changes here)
        combined_mask = np.zeros_like(output_arr[0], dtype=np.uint8)
        for cls in classes_to_keep:
            combined_mask[output_arr[0] == cls] = 255
        
        alpha_mask_arr = combined_mask

        # Resize mask to the original image size
        alpha_mask_pil = Image.fromarray(alpha_mask_arr, mode='L')
        alpha_mask_pil = alpha_mask_pil.resize(img_size, Image.BICUBIC)
        
        # 5. Combine original image and alpha mask for a transparent result (no changes here)
        original_image_np = np.array(original_image)
        original_image_bgr = cv2.cvtColor(original_image_np, cv2.COLOR_RGB2BGR)
        alpha_mask_np = np.array(alpha_mask_pil)
        
        transparent_image_np = cv2.merge([original_image_bgr, alpha_mask_np])

        # 6. Convert the final transparent image to bytes to be sent back (no changes here)
        _, img_encoded = cv2.imencode(".png", transparent_image_np)
        return io.BytesIO(img_encoded.tobytes())

    except Exception as e:
        # If any error occurs, print it to the backend console for debugging
        print(f"An error occurred in process_image: {e}")
        # Return None to indicate failure, which will result in a 500 error
        return None