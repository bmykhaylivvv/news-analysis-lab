'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
} from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

const chartOptions = {
  responsive: true,
  plugins: {
    legend: {
      position: 'top',
    },
  },
  scales: {
    y: {
      beginAtZero: true,
    },
  },
};

export default function News() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [articles, setArticles] = useState([]);
  const [savedArticles, setSavedArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [timeRange, setTimeRange] = useState('24h');
  const [view, setView] = useState('search');
  const [activeChart, setActiveChart] = useState('publishing');
  const [pageSize, setPageSize] = useState(20);
  const [progress, setProgress] = useState({ 
    processing: { current: 0, total: 0 },
    saving: { current: 0, total: 0 },
    wordCount: 0
  });

  console.log('savedArticles: ', savedArticles);

  const supabase = createClient();

  // Load saved articles on component mount
  useEffect(() => {
    loadSavedArticles();
  }, [timeRange]);

  // Function to load saved articles
  const loadSavedArticles = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('articles')
        .select(`
          *,
          word_frequencies (
            word,
            frequency
          )
        `)
        .order('published_at', { ascending: false });

      // Apply time range filter
      const now = new Date();
      let timeFilter;
      switch (timeRange) {
        case '24h':
          timeFilter = new Date(now - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          timeFilter = new Date(now - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          timeFilter = new Date(now - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          timeFilter = null;
      }

      if (timeFilter) {
        query = query.gte('published_at', timeFilter.toISOString().replace('T', ' ').replace('Z', '+00'));
      }

      const { data, error } = await query;

      if (error) throw error;

      setSavedArticles(data);
      updateAnalysis(data);
    } catch (err) {
      setError(err.message);
      console.error('Error loading saved articles:', err);
    } finally {
      setLoading(false);
    }
  };

  // Enhanced analysis function with chart data
  const updateAnalysis = (articles) => {
    const analysis = {
      totalArticles: articles.length,
      averageWordCount: Math.round(
        articles.reduce((acc, curr) => acc + (curr.word_count || 0), 0) / articles.length
      ),
      sourceStats: {},
      categoryStats: {},
      topWords: {},
      publishingTrends: {
        morning: 0,    // 6-12
        afternoon: 0,  // 12-18
        evening: 0,    // 18-24
        night: 0       // 0-6
      },
      wordCountTrends: [], // For word count over time
    };

    console.log('Total articles to analyze:', articles.length);

    // Sort articles by date for trends
    const sortedArticles = [...articles].sort((a, b) => 
      new Date(a.published_at) - new Date(b.published_at)
    );

    sortedArticles.forEach(article => {
      // Source statistics
      analysis.sourceStats[article.source_name] = (analysis.sourceStats[article.source_name] || 0) + 1;

      // Category statistics
      if (article.category) {
        analysis.categoryStats[article.category] = (analysis.categoryStats[article.category] || 0) + 1;
      }

      // Word frequencies
      if (article.word_frequencies) {
        article.word_frequencies.forEach(({ word, frequency }) => {
          analysis.topWords[word] = (analysis.topWords[word] || 0) + frequency;
        });
      }

      // Publishing time trends
      if (article?.published_at) {
        try {
          const timeMatch = article.published_at.match(/^(\d{2}):/);
          if (timeMatch) {
            const publishedHour = parseInt(timeMatch[1], 10);
            console.log('Parsed hour:', publishedHour);

            if (publishedHour >= 6 && publishedHour < 12) {
              analysis.publishingTrends.morning++;
              console.log('Added to morning');
            }
            else if (publishedHour >= 12 && publishedHour < 18) {
              analysis.publishingTrends.afternoon++;
              console.log('Added to afternoon');
            }
            else if (publishedHour >= 18) {
              analysis.publishingTrends.evening++;
              console.log('Added to evening');
            }
            else {
              analysis.publishingTrends.night++;
              console.log('Added to night');
            }
          } else {
            console.warn('Could not extract hour from time:', article.published_at);
          }

          // Word count trends - use the full timestamp
          analysis.wordCountTrends.push({
            date: article.published_at.split('+')[0],
            count: article.word_count || 0
          });
        } catch (err) {
          console.error('Error processing article time:', {
            article_id: article.id,
            published_at: article.published_at,
            error: err.message
          });
        }
      }
    });

    console.log('Final publishing trends:', analysis.publishingTrends);

    // Convert topWords to sorted array
    analysis.topWords = Object.entries(analysis.topWords)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);

      console.log('analysis.publishingTrends: ', analysis.publishingTrends);

    // Prepare chart data
    analysis.chartData = {
      publishing: {
        labels: ['Morning (6-12)', 'Afternoon (12-18)', 'Evening (18-24)', 'Night (0-6)'],
        datasets: [{
          label: 'Articles Published',
          data: [
            analysis.publishingTrends.morning,
            analysis.publishingTrends.afternoon,
            analysis.publishingTrends.evening,
            analysis.publishingTrends.night
          ],
          backgroundColor: [
            'rgba(255, 206, 86, 0.5)',
            'rgba(75, 192, 192, 0.5)',
            'rgba(153, 102, 255, 0.5)',
            'rgba(54, 162, 235, 0.5)',
          ],
          borderColor: [
            'rgba(255, 206, 86, 1)',
            'rgba(75, 192, 192, 1)',
            'rgba(153, 102, 255, 1)',
            'rgba(54, 162, 235, 1)',
          ],
          borderWidth: 1,
        }],
      },
      sources: {
        labels: Object.keys(analysis.sourceStats).slice(0, 5),
        datasets: [{
          label: 'Articles per Source',
          data: Object.values(analysis.sourceStats).slice(0, 5),
          backgroundColor: [
            'rgba(255, 99, 132, 0.5)',
            'rgba(54, 162, 235, 0.5)',
            'rgba(255, 206, 86, 0.5)',
            'rgba(75, 192, 192, 0.5)',
            'rgba(153, 102, 255, 0.5)',
          ],
          borderColor: [
            'rgba(255, 99, 132, 1)',
            'rgba(54, 162, 235, 1)',
            'rgba(255, 206, 86, 1)',
            'rgba(75, 192, 192, 1)',
            'rgba(153, 102, 255, 1)',
          ],
          borderWidth: 1,
        }],
      },
      words: {
        labels: analysis.topWords.map(([word]) => word).slice(0, 5),
        datasets: [{
          label: 'Word Frequency',
          data: analysis.topWords.map(([, count]) => count).slice(0, 5),
          backgroundColor: 'rgba(75, 192, 192, 0.5)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1,
        }],
      },
      wordCount: {
        labels: [...new Set(analysis.wordCountTrends.map(item => item.date))],
        datasets: [{
          label: 'Word Count Over Time',
          data: analysis.wordCountTrends.map(item => item.count),
          fill: false,
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1,
        }],
      },
    };

    setAnalysis(analysis);
  };

  // Function to calculate word frequencies
  const calculateWordFrequencies = (text) => {
    if (!text) return [];
    
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);

    const frequencies = {};
    words.forEach(word => {
      frequencies[word] = (frequencies[word] || 0) + 1;
    });

    return Object.entries(frequencies)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);
  };

  const fetchNews = async () => {
    if (!query) return;

    setLoading(true);
    setProgress({
      processing: { current: 0, total: 0 },
      saving: { current: 0, total: 0 },
      wordCount: 0
    });

    try {
      const response = await fetch(
        `https://newsapi.org/v2/everything?q=${query}&pageSize=${pageSize}&apiKey=${process.env.NEXT_PUBLIC_NEWS_API_KEY}`
      );
      const data = await response.json();

      if (data.status === 'error') {
        console.error('NewsAPI Error:', data);
        return;
      }

      setProgress(prev => ({
        ...prev,
        processing: { current: 0, total: data.articles.length }
      }));

      // Process articles
      const processedArticles = data.articles.map((article, index) => {
        setProgress(prev => ({
          ...prev,
          processing: { ...prev.processing, current: index + 1 }
        }));

        const date = new Date(article.publishedAt);
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        const formattedTime = `${hours}:${minutes}:${seconds}+00`;
        
        const wordCount = article.content ? article.content.split(/\s+/).length : 0;
        
        setProgress(prev => ({
          ...prev,
          wordCount: prev.wordCount + wordCount
        }));

        return {
          title: article.title || '',
          description: article.description || '',
          source_name: article.source?.name || 'Unknown',
          author: article.author || null,
          url: article.url,
          published_at: formattedTime,
          content: article.content || '',
          category: category || null,
          word_count: wordCount
        };
      });

      // Save to database
      setProgress(prev => ({
        ...prev,
        saving: { current: 0, total: processedArticles.length }
      }));

      for (let i = 0; i < processedArticles.length; i++) {
        const article = processedArticles[i];
        
        await supabase.from('articles').insert([article]);
        
        setProgress(prev => ({
          ...prev,
          saving: { ...prev.saving, current: i + 1 }
        }));
      }

      setArticles(processedArticles);
      await updateAnalysis(processedArticles);
    } catch (err) {
      console.error('Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Function to automatically fetch new articles based on trending topics
  const fetchTrendingArticles = async () => {
    if (!analysis?.topWords?.length) return;
    
    // Use top 3 words as search queries
    const searchQueries = analysis.topWords.slice(0, 3).map(([word]) => word);
    
    for (const query of searchQueries) {
      setQuery(query);
      await fetchNews();
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="mb-8 space-y-4">
        <div className="flex space-x-4">
          <button
            onClick={() => setView('search')}
            className={`px-4 py-2 rounded ${view === 'search' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            Search News
          </button>
          <button
            onClick={() => setView('saved')}
            className={`px-4 py-2 rounded ${view === 'saved' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            Saved Articles
          </button>
        </div>

        {view === 'search' && (
          <>
            <div className="flex space-x-4">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search news..."
                className="flex-grow p-2 border rounded"
              />
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="p-2 border rounded"
              >
                <option value={10}>10 articles</option>
                <option value={20}>20 articles</option>
                <option value={50}>50 articles</option>
                <option value={100}>100 articles</option>
              </select>
              <button
                onClick={fetchNews}
                disabled={loading || !query}
                className={`px-4 py-2 rounded ${
                  loading || !query
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>

            {loading && (
              <div className="mt-4 space-y-4">
                <div>
                  <div className="mb-2 flex justify-between text-sm text-gray-600">
                    <span>Processing articles...</span>
                    <span>{progress.processing.current} / {progress.processing.total}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${progress.processing.total ? (progress.processing.current / progress.processing.total * 100) : 0}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex justify-between text-sm text-gray-600">
                    <span>Saving to database...</span>
                    <span>{progress.saving.current} / {progress.saving.total}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-green-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${progress.saving.total ? (progress.saving.current / progress.saving.total * 100) : 0}%` }}
                    ></div>
                  </div>
                </div>

                <div className="text-sm text-gray-600">
                  Total words processed: {progress.wordCount.toLocaleString()}
                </div>
              </div>
            )}
          </>
        )}

        {view === 'saved' && (
          <div className="flex space-x-4">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="p-2 border rounded"
            >
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="all">All Time</option>
            </select>
            <button
              onClick={fetchTrendingArticles}
              disabled={loading}
              className="px-4 py-2 bg-green-500 text-white rounded disabled:bg-gray-300"
            >
              Fetch Related Articles
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 mb-4 text-red-700 bg-red-100 rounded">
          {error}
        </div>
      )}

      {analysis && (
        <div className="p-4 mb-8 bg-white rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">Analytics Dashboard</h2>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold mb-2 text-blue-800">General Statistics</h3>
              <p className="text-lg">Total Articles: {analysis.totalArticles}</p>
              <p className="text-lg">Average Word Count: {analysis.averageWordCount}</p>
            </div>

            <div className="p-4 bg-green-50 rounded-lg">
              <h3 className="font-semibold mb-2 text-green-800">Publishing Distribution</h3>
              <p>Morning (6-12): {analysis.publishingTrends.morning}</p>
              <p>Afternoon (12-18): {analysis.publishingTrends.afternoon}</p>
              <p>Evening (18-24): {analysis.publishingTrends.evening}</p>
              <p>Night (0-6): {analysis.publishingTrends.night}</p>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex space-x-4 mb-4">
              <button
                onClick={() => setActiveChart('publishing')}
                className={`px-4 py-2 rounded ${activeChart === 'publishing' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              >
                Publishing Times
              </button>
              <button
                onClick={() => setActiveChart('sources')}
                className={`px-4 py-2 rounded ${activeChart === 'sources' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              >
                Top Sources
              </button>
              <button
                onClick={() => setActiveChart('words')}
                className={`px-4 py-2 rounded ${activeChart === 'words' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              >
                Word Frequency
              </button>
            </div>

            <div className="bg-white p-4 rounded-lg shadow">
              {activeChart === 'publishing' && (
                <Pie data={analysis.chartData.publishing} options={chartOptions} />
              )}
              {activeChart === 'sources' && (
                <Bar data={analysis.chartData.sources} options={chartOptions} />
              )}
              {activeChart === 'words' && (
                <Bar data={analysis.chartData.words} options={chartOptions} />
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {(view === 'search' ? articles : savedArticles).map((article) => (
          <div key={article.id} className="p-4 bg-white rounded shadow">
            <h2 className="text-xl font-bold mb-2">{article.title}</h2>
            <p className="text-gray-600 mb-2">{article.description}</p>
            <div className="text-sm text-gray-500">
              <p>Source: {article.source_name}</p>
              <p>Category: {article.category || 'Uncategorized'}</p>
              <p>Published: {article.published_at}</p>
              <p>Word Count: {article.word_count}</p>
            </div>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              Read More
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
