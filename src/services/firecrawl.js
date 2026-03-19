import axios from 'axios';

const FIRECRAWL_API_KEY = process.env.firecrawl || process.env.REACT_APP_FIRECRAWL_API_KEY;
const FIRECRAWL_BASE_URL = 'https://api.firecrawl.dev';

/**
 * Scrapes a single URL and returns the data in JSON format
 * @param {string} url - The URL to scrape
 * @param {Object} options - Additional options for the scrape
 * @returns {Promise<Object>} - The scraped data
 */
export const scrapeUrl = async (url, options = {}) => {
  try {
    const response = await axios.post(`${FIRECRAWL_BASE_URL}/scrape`, {
      url,
      format: 'json', // Request JSON format for structured data
      ...options
    }, {
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error scraping URL with Firecrawl:', error);
    throw error;
  }
};

/**
 * Crawls a website and returns data from multiple pages
 * @param {string} url - The starting URL to crawl
 * @param {Object} options - Additional options for the crawl
 * @returns {Promise<Object>} - The crawled data
 */
export const crawlWebsite = async (url, options = {}) => {
  try {
    const response = await axios.post(`${FIRECRAWL_BASE_URL}/crawl`, {
      url,
      format: 'json',
      maxPages: options.maxPages || 10, // Limit pages by default
      ...options
    }, {
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error crawling website with Firecrawl:', error);
    throw error;
  }
};

/**
 * Extracts structured data from a website using Firecrawl's extract API
 * @param {string} url - The URL to extract data from
 * @param {string} prompt - The extraction prompt
 * @returns {Promise<Object>} - The extracted structured data
 */
export const extractStructuredData = async (url, prompt) => {
  try {
    const response = await axios.post(`${FIRECRAWL_BASE_URL}/extract`, {
      url,
      prompt
    }, {
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error extracting data with Firecrawl:', error);
    throw error;
  }
}; 