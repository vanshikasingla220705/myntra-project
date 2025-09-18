import sys
import torch
from torchvision import models, transforms
from PIL import Image
import numpy as np
import cv2

# Load DeepLabV3 pretrained on COCO
model = models.segmentation.deeplabv3_resnet101(pretrained=True).eval()

input_path = sys.argv[1]
output_path = sys.argv[2]

preprocess = transforms.Compose([
    transforms.Resize((520, 520)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
])

image = Image.open(input_path).convert("RGB")
input_tensor = preprocess(image).unsqueeze(0)

with torch.no_grad():
    output = model(input_tensor)['out'][0]
mask = output.argmax(0).byte().cpu().numpy()

# COCO label for "person" is 15
cloth_mask = (mask == 15).astype(np.uint8) * 255

# Remove everything except cloth
img = cv2.imread(input_path, cv2.IMREAD_UNCHANGED)
cloth_only = cv2.bitwise_and(img, img, mask=cloth_mask)

cv2.imwrite(output_path, cloth_only)
print("Cloth extracted and saved:", output_path)
