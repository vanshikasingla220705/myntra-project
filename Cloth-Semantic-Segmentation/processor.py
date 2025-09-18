import torch
import torch.nn.functional as F
import torchvision.transforms as transforms
from PIL import Image
import numpy as np
import cv2
import io

# Helper class and function (kept from your friend's scripts)
class Normalize_image(object):
    def __init__(self, mean, std):
        self.normalize_3 = transforms.Normalize([mean] * 3, [std] * 3)
    def __call__(self, image_tensor):
        return self.normalize_3(image_tensor)

def apply_transform(img):
    transforms_list = [transforms.ToTensor(), Normalize_image(0.5, 0.5)]
    return transforms.Compose(transforms_list)(img)


# This is our new universal processing function
def process_image(image_bytes, net, classes_to_keep):
    """
    Processes an image to segment clothing based on a list of class IDs.

    Args:
        image_bytes (bytes): The raw bytes of the uploaded image.
        net (torch.nn.Module): The loaded U2NET model.
        classes_to_keep (list): A list of integers for the classes to include in the mask (e.g., [2] or [1, 3]).
    """
    # 1. Load the uploaded image from memory
    original_image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    img_size = original_image.size

    # 2. Pre-process the image for the model
    img_for_model = original_image.resize((768, 768), Image.BICUBIC)
    image_tensor = apply_transform(img_for_model)
    image_tensor = torch.unsqueeze(image_tensor, 0)

    # 3. Get the segmentation mask from the model
    with torch.no_grad():
        output_tensor = net(image_tensor.to('cpu'))
        output_tensor = F.log_softmax(output_tensor[0], dim=1)
        output_tensor = torch.max(output_tensor, dim=1, keepdim=True)[1]
        output_tensor = torch.squeeze(output_tensor, dim=0)
        output_arr = output_tensor.cpu().numpy()

    # 4. Create the alpha mask in memory using the provided classes
    # This is the flexible part that handles all clothing types
    combined_mask = np.zeros_like(output_arr[0], dtype=np.uint8)
    for cls in classes_to_keep:
        combined_mask[output_arr[0] == cls] = 255
    
    alpha_mask_arr = combined_mask

    # Resize mask to the original image size
    alpha_mask_pil = Image.fromarray(alpha_mask_arr, mode='L')
    alpha_mask_pil = alpha_mask_pil.resize(img_size, Image.BICUBIC)
    
    # 5. Combine original image and alpha mask for a transparent result
    original_image_np = np.array(original_image)
    original_image_bgr = cv2.cvtColor(original_image_np, cv2.COLOR_RGB2BGR)
    alpha_mask_np = np.array(alpha_mask_pil)
    
    transparent_image_np = cv2.merge([original_image_bgr, alpha_mask_np])

    # 6. Convert the final transparent image to bytes to be sent back
    _, img_encoded = cv2.imencode(".png", transparent_image_np)
    return io.BytesIO(img_encoded.tobytes())