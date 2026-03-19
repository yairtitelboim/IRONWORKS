/**
 * API endpoint to save Perplexity response to public folder
 * POST /api/save-perplexity-response
 */

import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { responseData, filename = 'perplexity-houston-startup-analysis.json' } = req.body;

    if (!responseData) {
      return res.status(400).json({ error: 'Response data is required' });
    }

    // Ensure filename is safe
    const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = path.join(process.cwd(), 'public', safeFilename);

    // Write the response to public folder
    fs.writeFileSync(filePath, JSON.stringify(responseData, null, 2));

    console.log('✅ Perplexity response saved to public folder');
    console.log('📁 File path:', filePath);
    console.log('📊 Response summary:', {
      analysis_length: responseData.analysis?.length || 0,
      citations_count: responseData.citations?.length || 0,
      geoJson_features: responseData.geoJsonFeatures?.length || 0,
      completeness_score: responseData.validation?.completeness_score || 0
    });

    return res.status(200).json({
      success: true,
      message: 'Response saved successfully',
      filePath: filePath,
      filename: safeFilename,
      summary: {
        analysis_length: responseData.analysis?.length || 0,
        citations_count: responseData.citations?.length || 0,
        geoJson_features: responseData.geoJsonFeatures?.length || 0,
        completeness_score: responseData.validation?.completeness_score || 0
      }
    });

  } catch (error) {
    console.error('Error saving Perplexity response:', error);
    return res.status(500).json({ 
      error: 'Failed to save response',
      details: error.message 
    });
  }
}
