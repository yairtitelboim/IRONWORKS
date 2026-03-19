import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import 'mapbox-gl/dist/mapbox-gl.css';

import AccessChatPage from './pages/AccessChat/AccessChatPage';

axios.defaults.withCredentials = true;

const Map = lazy(() => import('./components/Map'));

const MapApp = () => {
  const [isLoading, setIsLoading] = useState(true);
  const isUpdatingRef = useRef(false);
  const articlesRef = useRef([]);

  const fetchArticles = useCallback(async () => {
    if (isUpdatingRef.current) {
      return;
    }
    setIsLoading(true);
    try {
      const response = await axios.get('/DC.json');
      if (Array.isArray(response.data)) {
        articlesRef.current = response.data;
      } else {
        articlesRef.current = [];
      }
    } catch (error) {
      articlesRef.current = [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const handleArticleUpdate = useCallback((updatedArticle) => {
    if (updatedArticle === null) {
      return;
    }
    if (!updatedArticle || !updatedArticle.location) {
      return;
    }
    isUpdatingRef.current = true;
    const prevArticles = articlesRef.current || [];
    const newArticles = prevArticles.map((article) =>
        article.location.address === updatedArticle.location.address ? updatedArticle : article
      );
    articlesRef.current = newArticles;
    setTimeout(() => {
      isUpdatingRef.current = false;
    }, 0);
  }, []);

  if (isLoading) {
    return <p>Loading...</p>;
  }

  return (
    <Suspense fallback={<p>Loading...</p>}>
      <Map articles={articlesRef.current} onArticleUpdate={handleArticleUpdate} />
    </Suspense>
  );
};

function App() {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';

  if (pathname === '/access' || pathname.startsWith('/access/')) {
    return <AccessChatPage />;
  }

  return <MapApp />;
}

export default App;
