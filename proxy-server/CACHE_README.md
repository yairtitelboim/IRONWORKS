# SERP API Caching System

> **📋 Primary Documentation**: This README is part of the comprehensive system documentation. For the complete architectural overview and production readiness plan, see **[WEEK01_REPORT_SEPT2025.md](../WEEK01_REPORT_SEPT2025.md)**.

This proxy server now includes a comprehensive caching system for SERP API responses to improve performance and reduce API calls during development and testing.

## 🚀 Features

- **Automatic Caching**: All SERP API responses are automatically cached
- **24-Hour TTL**: Cache entries expire after 24 hours
- **Smart Cache Keys**: Based on query, engine, coordinates, and radius
- **Cache Management**: View, clear, and warm the cache
- **Performance**: Instant responses for cached queries

## 📋 Available Endpoints

### Cache Management
- `GET /cache/status` - View cache statistics
- `GET /cache/clear` - Clear all cached responses
- `GET /cache/entries` - List all cached entries with details
- `POST /cache/warm` - Pre-warm cache with common queries

### SERP API (Cached)
- `GET /serp` - SERP API proxy with automatic caching

## 🔧 Usage Examples

### Check Cache Status
```bash
curl http://localhost:8080/cache/status
```

### View Cached Entries
```bash
curl http://localhost:8080/cache/entries
```

### Clear Cache
```bash
curl http://localhost:8080/cache/clear
```

### Warm Cache with Common Queries
```bash
curl -X POST http://localhost:8080/cache/warm \
  -H "Content-Type: application/json" \
  -d '{
    "queries": [
      {"q": "chemical plants", "ll": "31.9315,-97.347", "radius": "3"},
      {"q": "steel mills", "ll": "31.9315,-97.347", "radius": "3"},
      {"q": "oil and gas facilities", "ll": "31.9315,-97.347", "radius": "3"}
    ]
  }'
```

### Test Cached SERP Query
```bash
curl "http://localhost:8080/serp?engine=google&q=test&ll=31.9315,-97.347&radius=3&api_key=YOUR_API_KEY"
```

## 🎯 Cache Key Format

Cache keys are generated using this format:
```
{engine}_{query}_{ll}_{radius}
```

Example: `google_chemical plants_31.9315,-97.347_3`

## ⚡ Performance Benefits

- **First Request**: Normal API call time (1-3 seconds)
- **Subsequent Requests**: Instant response from cache
- **API Cost Reduction**: Avoid repeated calls for same queries
- **Development Speed**: Faster testing and iteration

## 🧹 Cache Management

### Automatic Cleanup
- Entries automatically expire after 24 hours
- Invalid entries are filtered out automatically

### Manual Management
- Clear specific entries or entire cache
- Monitor cache size and performance
- Warm cache with frequently used queries

## 📊 Cache Statistics

The `/cache/status` endpoint provides:
- Total cached entries
- Cache size in bytes
- TTL settings
- Cache hit/miss information

## 🚨 Important Notes

- Cache is stored in memory (cleared on server restart)
- API key validation still occurs for each request
- Cache warming requires valid API keys
- 24-hour TTL ensures data freshness

## 🔄 Development Workflow

1. **First Run**: Make SERP API calls normally
2. **Subsequent Runs**: Responses served from cache instantly
3. **Testing**: Use cached responses for UI development
4. **Production**: Cache reduces API costs and improves performance

## 📝 Example Cache Entry

```json
{
  "key": "google_test_31.9315,-97.347_3",
  "timestamp": 1756341223990,
  "age": 25484,
  "ageMinutes": 0,
  "isValid": true
}
```

## 🎉 Benefits for Development

- **Faster Testing**: No waiting for API responses
- **Cost Control**: Reduce SERP API usage during development
- **Consistent Data**: Same response for repeated queries
- **Offline Development**: Work with cached data when needed
