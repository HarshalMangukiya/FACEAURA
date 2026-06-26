import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import UploadPage from './pages/Upload';
import GalleryPage from './pages/Gallery';
import FaceAnalysis from './pages/FaceAnalysis';
import FaceShapeResult from './pages/FaceShapeResult';
import Recommendations from './pages/Recommendations';
import SkinAnalysis from './pages/SkinAnalysis';
import BeautyRecommendations from './pages/BeautyRecommendations';
import VirtualTryOn from './pages/VirtualTryOn';
import LiveDetection from './pages/LiveDetection';
import TryOnHistoryPage from './pages/TryOnHistory';


function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen flex flex-col bg-[#0b0f19]">
          <Navbar />
          
          <main className="flex-1 w-full relative z-10">
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Protected Routes */}
              <Route
                path="/upload"
                element={
                  <ProtectedRoute>
                    <UploadPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/gallery"
                element={
                  <ProtectedRoute>
                    <GalleryPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/analysis/:imageId"
                element={
                  <ProtectedRoute>
                    <FaceAnalysis />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/face-shape-result/:imageId"
                element={
                  <ProtectedRoute>
                    <FaceShapeResult />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/skin-analysis/:imageId"
                element={
                  <ProtectedRoute>
                    <SkinAnalysis />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/recommendations"
                element={
                  <ProtectedRoute>
                    <Recommendations />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/recommendations/result/:historyId"
                element={
                  <ProtectedRoute>
                    <Recommendations />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/beauty-recommendations"
                element={
                  <ProtectedRoute>
                    <BeautyRecommendations />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/beauty-recommendations/result/:historyId"
                element={
                  <ProtectedRoute>
                    <BeautyRecommendations />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/virtual-tryon"
                element={
                  <ProtectedRoute>
                    <VirtualTryOn />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/tryon-history"
                element={
                  <ProtectedRoute>
                    <TryOnHistoryPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/live-detection"
                element={
                  <ProtectedRoute>
                    <LiveDetection />
                  </ProtectedRoute>
                }
              />



              {/* Redirect root to upload page */}
              <Route path="/" element={<Navigate to="/upload" replace />} />
              <Route path="*" element={<Navigate to="/upload" replace />} />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
