import api from './api';

/**
 * Uploads a selfie image to the backend server.
 * @param {File} imageFile - The file object to upload.
 * @param {Function} onUploadProgress - Callback to receive upload progress events.
 * @returns {Promise<Object>} The API response with message, image_id, and image_url.
 */
export const uploadImage = async (imageFile, onUploadProgress) => {
  const formData = new FormData();
  formData.append('image', imageFile);

  const response = await api.post('/api/analysis/upload/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (onUploadProgress && progressEvent.total) {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onUploadProgress(percentCompleted);
      }
    },
  });
  return response.data;
};

/**
 * Retrieves the list of uploaded images for the authenticated user.
 * @returns {Promise<Array>} List of user images.
 */
export const getImages = async () => {
  const response = await api.get('/api/analysis/images/');
  return response.data;
};

/**
 * Deletes a specific uploaded image.
 * @param {number} id - The ID of the image to delete.
 * @returns {Promise<Object>} Success message.
 */
export const deleteImage = async (id) => {
  const response = await api.delete(`/api/analysis/image/${id}/`);
  return response.data;
};

/**
 * Triggers face detection and landmark extraction on the server.
 * @param {number} imageId - The ID of the uploaded image to analyze.
 * @returns {Promise<Object>} The detection result.
 */
export const detectFace = async (imageId) => {
  const response = await api.post('/api/analysis/detect-face/', { image_id: imageId });
  return response.data;
};

/**
 * Retrieves the face analysis results.
 * @param {number} id - The ID of the FaceAnalysis record or UploadedImage.
 * @returns {Promise<Object>} The analysis results.
 */
export const getAnalysisResult = async (id) => {
  const response = await api.get(`/api/analysis/result/${id}/`);
  return response.data;
};

/**
 * Triggers face shape detection and measurement calculations on the server.
 * @param {number} imageId - The ID of the uploaded image to analyze.
 * @returns {Promise<Object>} The face shape detection result.
 */
export const detectFaceShape = async (imageId) => {
  const response = await api.post('/api/analysis/detect-face-shape/', { image_id: imageId });
  return response.data;
};

/**
 * Retrieves the face shape result by ID.
 * @param {number} id - The ID of the FaceAnalysis record or UploadedImage.
 * @returns {Promise<Object>} The shape results containing shape type and confidence.
 */
export const getFaceShapeResult = async (id) => {
  const response = await api.get(`/api/analysis/face-shape/${id}/`);
  return response.data;
};

/**
 * Triggers AI skin analysis on the server.
 * @param {number} imageId - The ID of the uploaded image to analyze.
 * @returns {Promise<Object>} The skin analysis result.
 */
export const detectSkin = async (imageId) => {
  const response = await api.post('/api/analysis/skin-analysis/', { image_id: imageId });
  return response.data;
};

/**
 * Retrieves the skin analysis result by ID.
 * @param {number} id - The ID of the FaceAnalysis record or UploadedImage.
 * @returns {Promise<Object>} The stored skin analysis result.
 */
export const getSkinResult = async (id) => {
  const response = await api.get(`/api/analysis/skin-analysis/${id}/`);
  return response.data;
};


