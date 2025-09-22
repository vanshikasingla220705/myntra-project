from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import torch
from collections import OrderedDict
import os
import requests # <--- ADD THIS IMPORT
from io import BytesIO # <--- ADD THIS IMPORT

# Import the model architecture and our universal processor
from network import U2NET
from processor import process_image

# --- 1. SETUP & MODEL LOADING ---
app = Flask(__name__)
CORS(app)

# ... (Your existing load_checkpoint_for_api function) ...
def load_checkpoint_for_api(model, checkpoint_path):
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

# Initialize and load the model once at startup
net = U2NET(in_ch=3, out_ch=4) 
net = load_checkpoint_for_api(net, 'cloth_segm.pth')
net.eval()

# --- 2. API ENDPOINTS ---

# --- NEW SECTION: IMAGE PROXY ---
# This new route handles fetching images from website URLs
@app.route('/proxy-image', methods=['GET'])
def proxy_image():
    # Get the image URL from the query parameters
    image_url = request.args.get('url')
    if not image_url:
        return "URL parameter is missing", 400

    try:
        # Fetch the image from the external URL
        # Set a user-agent to pretend we're a browser, which helps avoid blocks
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
        response = requests.get(image_url, headers=headers, stream=True)
        response.raise_for_status() # Raise an exception for bad status codes

        # Return the image content with the correct content type
        return send_file(
            BytesIO(response.content),
            mimetype=response.headers.get('Content-Type', 'image/png')
        )
    except requests.exceptions.RequestException as e:
        print(f"Error fetching image via proxy: {e}")
        return str(e), 500
# --- END OF NEW SECTION ---


# ... (Your existing handle_request helper function and all /segment/... endpoints) ...
def handle_request(processing_function):
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
        
    try:
        image_bytes = file.read()
        segmented_image_bytes = processing_function(image_bytes, net)

        if segmented_image_bytes is None:
            print("Image processing failed, returning 500 error to client.")
            return jsonify({'error': 'Image processing failed on the server. The image might be invalid or corrupted.'}), 500

        return send_file(segmented_image_bytes, mimetype='image/png')
        
    except Exception as e:
        print(f"An unhandled error occurred in handle_request: {e}")
        return jsonify({'error': 'An internal server error occurred.'}), 500

@app.route('/segment/top', methods=['POST'])
def segment_top_endpoint():
    print("Request for TOP: using classes [1]")
    return handle_request(lambda img, model: process_image(img, model, classes_to_keep=[1]))

@app.route('/segment/bottom', methods=['POST'])
def segment_bottom_endpoint():
    print("Request for BOTTOM: using classes [2]")
    return handle_request(lambda img, model: process_image(img, model, classes_to_keep=[2]))

@app.route('/segment/skirt', methods=['POST'])
def segment_skirt_endpoint():
    print("Request for SKIRT: using classes [2, 3]")
    return handle_request(lambda img, model: process_image(img, model, classes_to_keep=[2, 3]))

@app.route('/segment/coord', methods=['POST'])
def segment_coord_endpoint():
    print("Request for COORD: using classes [1, 2]")
    return handle_request(lambda img, model: process_image(img, model, classes_to_keep=[1, 2]))

@app.route('/segment/kurta', methods=['POST'])
def segment_kurta_endpoint():
    print("Request for KURTA: using classes [3]")
    return handle_request(lambda img, model: process_image(img, model, classes_to_keep=[3]))

@app.route('/segment/lehenga', methods=['POST'])
def segment_lehenga_endpoint():
    print("Request for LEHENGA: using classes [1, 3]")
    return handle_request(lambda img, model: process_image(img, model, classes_to_keep=[1, 3]))


# --- 3. RUN THE SERVER ---
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8001, debug=True)