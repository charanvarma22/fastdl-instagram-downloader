# Plagiarism API Integration Guide

## Overview
The n8n workflow requires a plagiarism checking API to ensure content originality. Below are setup instructions for multiple providers.

---

## Option 1: Copyleaks (Recommended)

**Why Copyleaks?**
- Comprehensive plagiarism detection
- API-friendly
- Supports multiple languages
- Batch processing available

### Setup Steps

1. **Sign Up**
   - Go to https://copyleaks.com/
   - Create an account
   - Navigate to API section

2. **Get API Credentials**
   - Email: your_email@domain.com
   - API Key: Will be provided in dashboard

3. **n8n Configuration**
   ```javascript
   // HTTP Request Node Configuration
   URL: https://api.copyleaks.com/v3/education/submit/file/{{ Date.now() }}
   Method: POST
   Authentication: Header Auth
   
   Headers:
   - Authorization: Bearer YOUR_API_KEY
   - Content-Type: application/json
   
   Body:
   {
     "text": "{{ $('Humanize Content').item.json.choices[0].message.content }}"
   }
   ```

4. **Get Results**
   ```javascript
   // Wait 5 seconds, then:
   URL: https://api.copyleaks.com/v3/education/{{ scanId }}/result
   Method: GET
   ```

5. **Interpret Results**
   ```javascript
   // Check aggregatedScore field
   if (aggregatedScore < 10) {
     // Content is original
   } else {
     // Regenerate content
   }
   ```

**Pricing:** Free tier available, paid plans from $9.99/month

---

## Option 2: Copyscape (Alternative)

**Pros:**
- Industry standard
- Fast results
- Pay-per-use model

### Setup Steps

1. **Sign Up**
   - Visit https://www.copyscape.com/
   - Create Copyscape Premium account
   - Get API username and key

2. **n8n HTTP Request Configuration**
   ```javascript
   URL: http://www.copyscape.com/api/
   Method: POST
   
   Body Parameters:
   u: YOUR_USERNAME
   k: YOUR_API_KEY
   o: csearch
   t: {{ $('Humanize Content').item.json.choices[0].message.content }}
   e: UTF-8
   ```

3. **Parse Response**
   ```xml
   <!-- Response format -->
   <result>
     <count>2</count>  <!-- Number of matches found -->
     <allpercentmatched>5</allpercentmatched>
   </result>
   ```

4. **Threshold Check**
   ```javascript
   const percentMatched = $json.allpercentmatched;
   if (percentMatched < 10) {
     // Pass
   } else {
     // Fail
   }
   ```

**Pricing:** $0.03 per search (10,000 words)

---

## Option 3: PlagiarismCheck.org (Budget-Friendly)

### Setup Steps

1. **Sign Up**
   - Go to https://plagiarismcheck.org/
   - Create account and get API key

2. **API Request**
   ```javascript
   URL: https://plagiarismcheck.org/api/v1/text
   Method: POST
   
   Headers:
   X-API-TOKEN: YOUR_API_KEY
   
   Body:
   {
     "text": "{{ $('Humanize Content').item.json.choices[0].message.content }}",
     "language": "en",
     "excludeQuotes": true,
     "excludeRefs": true
   }
   ```

3. **Get Results**
   ```javascript
   {
     "percentPlagiarized": 5,
     "sources": [...],
     "report": "..."
   }
   ```

**Pricing:** From $5/month for 100 checks

---

## Option 4: Custom Solution (Free - DIY)

If you want to avoid paid APIs, you can implement a basic similarity check:

### Using OpenAI + Web Search

```javascript
// Code Node in n8n
const content = $('Humanize Content').item.json.choices[0].message.content;

// Extract first paragraph
const firstPara = content.split('\n\n')[1];

// Search Google for exact phrase
// (Use n8n Google Search node)
// If many exact matches found → likely plagiarized
```

**Limitations:** 
- Not as accurate as dedicated tools
- Can give false positives
- No detailed reporting

---

## Recommended Workflow Setup

### For Production (Recommended)
```
Use Copyleaks or Copyscape
- More accurate
- Better reporting
- API reliability
```

### For Testing/Development
```
Use free tier of Copyleaks
OR implement custom similarity check
```

### Threshold Settings

```javascript
// Recommended thresholds by content type
Blog posts: < 10% similarity
Academic: < 5% similarity  
News: < 15% similarity (quotes allowed)

// Configure in .env
PLAGIARISM_THRESHOLD=10
```

---

## n8n Node Configuration Examples

### Copyleaks Full Setup

```json
{
  "nodes": [
    {
      "name": "Submit to Copyleaks",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "https://api.copyleaks.com/v3/education/submit/file/{{ Date.now() }}",
        "method": "POST",
        "authentication": "predefinedCredentialType",
        "nodeCredentialType": "httpHeaderAuth",
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            {
              "name": "text",
              "value": "={{ $('Humanize Content').item.json.choices[0].message.content }}"
            }
          ]
        }
      }
    },
    {
      "name": "Wait 5 Seconds",
      "type": "n8n-nodes-base.wait",
      "parameters": {
        "amount": 5,
        "unit": "seconds"
      }
    },
    {
      "name": "Get Results",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "https://api.copyleaks.com/v3/education/{{ $('Submit to Copyleaks').item.json.scanId }}/result",
        "method": "GET",
        "authentication": "predefinedCredentialType",
        "nodeCredentialType": "httpHeaderAuth"
      }
    },
    {
      "name": "Check Threshold",
      "type": "n8n-nodes-base.if",
      "parameters": {
        "conditions": {
          "number": [
            {
              "value1": "={{ $json.aggregatedScore }}",
              "operation": "smaller",
              "value2": 10
            }
          ]
        }
      }
    }
  ]
}
```

---

## Error Handling

Add error handling for API failures:

```javascript
// Code Node
try {
  // Attempt plagiarism check
  const result = await checkPlagiarism(content);
  
  if (result.error) {
    // Log error but don't block publish
    console.error('Plagiarism check failed:', result.error);
    // Optionally: proceed anyway or retry
    return { passed: true, note: 'Check skipped due to API error' };
  }
  
  return result;
} catch (error) {
  console.error('Plagiarism API error:', error);
  // Decide: fail safe (don't publish) or proceed anyway
  return { passed: false, error: error.message };
}
```

---

## Testing Your Setup

### Test with Sample Text

```bash
# Test Copyleaks API
curl -X POST https://api.copyleaks.com/v3/education/submit/file/test123 \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text": "The quick brown fox jumps over the lazy dog."}'
```

### Expected Response
```json
{
  "scanId": "abc123...",
  "status": "pending"
}
```

---

## Cost Comparison

| Provider | Free Tier | Paid Plans | Best For |
|----------|-----------|------------|----------|
| **Copyleaks** | 10 pages/month | $9.99/mo | Full features |
| **Copyscape** | None | $0.03/check | Pay-per-use |
| **PlagiarismCheck** | Limited | $5/mo | Budget-friendly |
| **Custom (DIY)** | Free | Free | Testing only |

---

## Troubleshooting

### API Returns Error 401
- Check API key is correct
- Verify authentication headers
- Ensure API key hasn't expired

### API Returns Error 429
- You've hit rate limit
- Wait before retrying
- Upgrade plan if needed

### Always Returns High Similarity
- Check if citations/quotes are excluded
- Verify language settings
- Review API documentation for flags

### API Timeout
- Increase wait time (5 → 10 seconds)
- Add retry logic
- Contact support if persistent

---

## Final Recommendation

**For Production:** Use **Copyleaks**
- Most reliable
- Best documentation
- Good pricing for volume

**For Testing:** Use **Copyleaks free tier** or custom solution

**For High Volume:** Consider **Copyscape** pay-per-use model

---

*Last Updated: 2025*
