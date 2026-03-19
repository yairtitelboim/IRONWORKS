const DEFAULT_BASE_URL = 'http://localhost:3001';

const getBaseUrl = () => {
  if (typeof window !== 'undefined' && window.__MCP_API_BASE_URL__) {
    return window.__MCP_API_BASE_URL__;
  }
  return DEFAULT_BASE_URL;
};

/**
 * searchInfrastructure
 *
 * Calls the MCP infrastructure search endpoint with parsed query params.
 * The caller is responsible for parsing natural language into:
 *  - facilityName
 *  - facilityKey
 *  - radius
 *  - category
 */
export const searchInfrastructure = async ({
  facilityName,
  facilityKey,
  radius,
  category
}) => {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/mcp/search`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      facilityName,
      facilityKey,
      radius,
      category
    })
  });

  if (!response.ok) {
    throw new Error(`MCP search failed (${response.status})`);
  }

  return response.json();
};


