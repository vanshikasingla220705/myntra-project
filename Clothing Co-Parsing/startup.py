import os
import requests
from tqdm import tqdm # For a nice progress bar

def download_file(url, destination):
    """Downloads a file from a URL to a destination, with progress bar."""
    if os.path.exists(destination):
        print(f"✅ Model file already exists at '{destination}'. Skipping download.")
        return
    
    print(f"⏳ Downloading model from {url} to {destination}...")
    try:
        with requests.get(url, stream=True) as r:
            r.raise_for_status()
            total_size = int(r.headers.get('content-length', 0))
            with open(destination, 'wb') as f, tqdm(
                total=total_size, unit='iB', unit_scale=True, desc="Downloading"
            ) as pbar:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
                    pbar.update(len(chunk))
        print("✅ Download complete.")
    except Exception as e:
        print(f"❌ ERROR: Failed to download model. {e}")
        # Exit with an error code if the download fails, so Render knows something went wrong.
        exit(1)

if __name__ == "__main__":
    # This URL will be read from the environment variable you set on Render
    model_url = os.environ.get("SEGMENTATION_MODEL_URL")
    
    if model_url:
        download_file(model_url, "cloth_segm.pth")
    else:
        print("⚠️ SEGMENTATION_MODEL_URL not set. Skipping model download.")
        # If the model doesn't exist locally either, this will likely cause an error later.
        if not os.path.exists("cloth_segm.pth"):
             print("❌ CRITICAL: Model file 'cloth_segm.pth' not found locally and no download URL was provided.")
             exit(1)