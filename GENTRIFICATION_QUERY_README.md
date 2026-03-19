# Gentrification Analysis Query Scripts

## Overview
These scripts query Perplexity AI with gentrification analysis data to generate insights about displacement risk patterns in downtown Houston.

## Setup

### 1. Environment Configuration
```bash
# Copy the template and add your API key
cp env-template.txt .env

# Edit .env file with your actual Perplexity API key
nano .env
```

### 2. Dependencies
- **Full version**: Requires `jq` for JSON processing
- **Simple version**: No additional dependencies

## Usage

### Full Version (with jq)
```bash
./gentrification-query.sh
```

### Simple Version (no jq)
```bash
./gentrification-query-simple.sh
```

## Workflow

1. **Spatial Analysis**: Runs `gentrification-spatial-analyzer.js` if needed
2. **Prompt Extraction**: Loads analysis prompt from `./public/gentrification-analysis-prompt.json`
3. **Perplexity Query**: Sends prompt to Perplexity AI
4. **Response Save**: Saves response to `perplexity-gentrification-response.json`

## Security Features

- ✅ **API Key Protection**: Stored in `.env` file (not committed to git)
- ✅ **Error Handling**: Validates API key and dependencies
- ✅ **JSON Escaping**: Proper handling of special characters
- ✅ **Dependency Check**: Ensures spatial analysis runs first

## Output

The script generates:
- `perplexity-gentrification-response.json` - Perplexity AI response
- Console feedback on progress and completion

## Troubleshooting

### API Key Issues
```bash
# Check if .env file exists and has correct format
cat .env
# Should show: PERPLEXITY_API_KEY=your_key_here
```

### Missing Dependencies
```bash
# Install jq (for full version)
brew install jq  # macOS
sudo apt-get install jq  # Ubuntu

# Or use simple version without jq
./gentrification-query-simple.sh
```

### Spatial Analysis Issues
```bash
# Run spatial analyzer manually
node gentrification-spatial-analyzer.js
```
