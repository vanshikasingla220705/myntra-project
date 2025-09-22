import axios from 'axios';

// Your backend server's base URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

/**
 * Performs an AI-powered text search.
 * @param {string} queryText - The user's search query.
 * @returns {Promise<object>} - The API response data.
 */
export const performTextSearch = (queryText) => {
  return apiClient.post('/text-search', { queryText });
};

/**
 * Analyzes a clothing image with an optional text prompt.
 * @param {FormData} formData - The form data containing the image and queryText.
 * @returns {Promise<object>} - The API response data.
 */
export const analyzeClothingImage = (formData) => {
  return apiClient.post('/image-understanding', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

/**
 * Analyzes a decor image with an optional text prompt.
 * @param {FormData} formData - The form data containing the image and queryText.
 * @returns {Promise<object>} - The API response data.
 */
export const analyzeDecorImage = (formData) => {
  return apiClient.post('/image-understanding2', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

/**
 * Segments a clothing item from an image.
 * @param {File} imageFile - The image file to segment.
 * @param {string} clothingType - The type of clothing (e.g., 'top', 'bottom').
 * @returns {Promise<Blob>} - The segmented image as a Blob.
 */
export const segmentImage = async (imageFile, clothingType) => {
    const formData = new FormData();
    formData.append('image', imageFile);

    const response = await apiClient.post(`/segment/${clothingType}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'blob', // Important for getting an image back
    });
    return response.data;
};