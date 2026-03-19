/**
 * Tavily API client for signal discovery
 * API CALL: POST https://api.tavily.com/search
 */

import axios from 'axios';

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const TAVILY_URL = 'https://api.tavily.com/search';

export class TavilyClient {
  constructor() {
    if (!TAVILY_API_KEY) {
      throw new Error('TAVILY_API_KEY environment variable is required');
    }
    this.apiKey = TAVILY_API_KEY;
  }

  /**
   * Search for signals using Tavily
   * @param {string} query - Search query
   * @param {number} maxResults - Maximum results to return (default: 10)
   * @param {Object} options - Additional search options
   * @param {number} options.days - Number of days back to search (e.g., 7 for last week)
   * @param {string} options.time_range - Time range: 'day', 'week', 'month', 'year' (or 'd', 'w', 'm', 'y')
   * @returns {Promise<Array>} Array of search results
   */
  async search(query, maxResults = 10, options = {}) {
    const { days, time_range } = options;
    
    // Build query with date context if not already present
    let enhancedQuery = query;
    if (days && !query.includes('days') && !query.includes('recent')) {
      // Add date context to query for better results
      enhancedQuery = `${query} (published in last ${days} days OR recent)`;
    }
    
    console.log(`🔍 [Tavily] Searching: "${enhancedQuery}"${days ? ` (last ${days} days)` : ''}`);
    
    try {
      const requestBody = {
        api_key: this.apiKey,
        query: enhancedQuery,
        search_depth: 'advanced',
        max_results: maxResults
      };
      
      // Add date filtering if provided
      if (days) {
        requestBody.days = days;
      } else if (time_range) {
        requestBody.time_range = time_range;
      }
      
      const response = await axios.post(
        TAVILY_URL,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      if (response.data.results) {
        console.log(`✅ [Tavily] Found ${response.data.results.length} results`);
        return response.data.results;
      } else {
        console.warn(`⚠️ [Tavily] Unexpected response format:`, response.data);
        return [];
      }
    } catch (error) {
      console.error(`❌ [Tavily] Search failed:`, error.message);
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Response: ${JSON.stringify(error.response.data).substring(0, 200)}`);
      }
      throw error;
    }
  }

  /**
   * Check API usage/credits
   * @returns {Promise<Object>} Usage information
   */
  async checkUsage() {
    try {
      const response = await axios.get(
        'https://api.tavily.com/usage',
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          },
          timeout: 10000
        }
      );

      return response.data;
    } catch (error) {
      console.error(`❌ [Tavily] Usage check failed:`, error.message);
      return null;
    }
  }
}

export default TavilyClient;

