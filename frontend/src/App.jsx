import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import ImageAnalyzerPage from './pages/ImageAnalyzerPage';
import RecommendationsPage from './pages/RecommendationsPage';
import MixAndMatchPage from './pages/MixAndMatchPage';
import CartStylingPage from './pages/CartStylingPage';

function App() {
  return (
    <div className="App">
      <Navbar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/clothing-analyzer" element={<ImageAnalyzerPage type="clothing" />} />
          <Route path="/decor-analyzer" element={<ImageAnalyzerPage type="decor" />} />
          <Route path="/recommendations" element={<RecommendationsPage />} />
          <Route path="/mix-and-match" element={<MixAndMatchPage />} />
          <Route path="/cart-styling" element={<CartStylingPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;