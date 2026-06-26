import api from './api';

/**
 * Triggers recommendation generation based on a face shape analysis.
 * @param {number} analysisId - The ID of the FaceAnalysis record.
 * @returns {Promise<Object>} The generated recommendation details.
 */
export const generateRecommendation = async (analysisId) => {
  const response = await api.post('/api/recommendations/generate/', { analysis_id: analysisId });
  return response.data;
};

/**
 * Retrieves the user's styling recommendations history logs.
 * @returns {Promise<Array>} List of historical recommendation logs.
 */
export const getRecommendationHistory = async () => {
  const response = await api.get('/api/recommendations/history/');
  return response.data;
};

/**
 * Retrieves specific recommendation log details.
 * @param {number} id - The ID of the RecommendationHistory record.
 * @returns {Promise<Object>} The recommendation log details.
 */
export const getRecommendationDetail = async (id) => {
  const response = await api.get(`/api/recommendations/${id}/`);
  return response.data;
};
