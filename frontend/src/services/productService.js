import api from './api';

/**
 * Generates beauty product recommendations based on a skin analysis.
 * @param {number} analysisId - The ID of the FaceAnalysis record.
 * @returns {Promise<Object>} The generated recommendation details.
 */
export const generateProductRecommendations = async (analysisId) => {
  const response = await api.post('/api/products/recommend/', { analysis_id: analysisId });
  return response.data;
};

/**
 * Retrieves the user's beauty product recommendation history logs.
 * @returns {Promise<Array>} List of historical beauty recommendation logs.
 */
export const getProductRecommendationHistory = async () => {
  const response = await api.get('/api/products/history/');
  return response.data;
};

/**
 * Retrieves specific beauty product recommendation details.
 * @param {number} id - The ID of the RecommendationHistory record.
 * @returns {Promise<Object>} The recommendation log details.
 */
export const getProductRecommendationDetail = async (id) => {
  const response = await api.get(`/api/products/recommendation/${id}/`);
  return response.data;
};
