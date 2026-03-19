/**
 * Perplexity API Client
 * Simple service to call Perplexity API for generating short answers
 */

export const queryPerplexity = async (question, context = '') => {
  try {
    // Build prompt - super short answer requested
    let prompt = question;
    if (context) {
      prompt = `${question}\n\nContext: ${context}\n\nProvide a super short answer (2-3 sentences maximum).`;
    } else {
      prompt = `${question}\n\nProvide a super short answer (2-3 sentences maximum).`;
    }

    const response = await fetch('/api/perplexity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [{
          role: 'user',
          content: prompt
        }],
        max_tokens: 200, // Keep it short
        temperature: 0.1,
        return_citations: true
      })
    });

    if (!response.ok) {
      console.error('❌ Perplexity API error:', response.status);
      return null;
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content;
    const citations = data.citations || [];

    return {
      answer,
      citations
    };
  } catch (error) {
    console.error('❌ Perplexity query error:', error);
    return null;
  }
};

