/**
 * AnimationTestComponent - Test component for animation triggers
 * 
 * This component provides a simple interface to test animation triggers
 * for each marker type in the ALL category.
 */

import React, { useState } from 'react';

const AnimationTestComponent = ({ nodeAnimation }) => {
  const [testResults, setTestResults] = useState([]);

  // Test animation triggers for different marker types
  const testAnimations = () => {
    if (!nodeAnimation) {
      console.warn('⚠️ NodeAnimation not available');
      return;
    }

    const testCases = [
      {
        name: 'Power Plant',
        type: 'Power Plant',
        coordinates: [-97.7431, 30.2672], // Austin, TX
        expectedAnimation: 'pulse'
      },
      {
        name: 'Substation',
        type: 'Substation',
        coordinates: [-97.7431, 30.2672],
        expectedAnimation: 'ripple'
      },
      {
        name: 'Water Utility',
        type: 'Water Supply',
        coordinates: [-97.7431, 30.2672],
        expectedAnimation: 'glow'
      },
      {
        name: 'Data Center',
        type: 'Data Center',
        coordinates: [-97.7431, 30.2672],
        expectedAnimation: 'heartbeat'
      }
    ];

    const results = [];
    
    testCases.forEach((testCase, index) => {
      try {
        // Create mock node data
        const mockNode = {
          id: `test-${index + 1}`,
          name: testCase.name,
          type: testCase.type,
          powerScore: 8,
          risk: 'Low',
          content: `Test ${testCase.name} at ${testCase.coordinates[0]}, ${testCase.coordinates[1]}`
        };

        // Trigger animation
        nodeAnimation.triggerNodeAnimation(testCase.coordinates, {
          type: testCase.expectedAnimation,
          intensity: 0.8,
          duration: 2.0,
          nodeData: mockNode,
          category: 'all'
        });

        results.push({
          name: testCase.name,
          status: 'success',
          message: `Animation triggered: ${testCase.expectedAnimation}`
        });

        console.log(`✅ Test ${index + 1}: ${testCase.name} - ${testCase.expectedAnimation}`);
      } catch (error) {
        results.push({
          name: testCase.name,
          status: 'error',
          message: `Error: ${error.message}`
        });

        console.error(`❌ Test ${index + 1}: ${testCase.name} - Error:`, error);
      }
    });

    setTestResults(results);
  };

  if (!nodeAnimation) {
    return (
      <div style={{
        padding: '16px',
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: '8px',
        color: '#ef4444',
        fontSize: '14px'
      }}>
        ⚠️ NodeAnimation not available. Make sure to pass nodeAnimation prop.
      </div>
    );
  }

  return (
    <div style={{
      padding: '16px',
      background: 'rgba(0, 0, 0, 0.2)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '8px',
      margin: '16px 0'
    }}>
      <h3 style={{
        color: '#ffffff',
        fontSize: '16px',
        margin: '0 0 16px 0',
        fontWeight: '600'
      }}>
        🎬 Animation Test Panel
      </h3>
      
      <button
        onClick={testAnimations}
        style={{
          background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
          border: 'none',
          borderRadius: '6px',
          color: '#ffffff',
          padding: '8px 16px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '600',
          marginBottom: '16px'
        }}
        onMouseEnter={(e) => {
          e.target.style.background = 'linear-gradient(135deg, #1d4ed8, #1e40af)';
        }}
        onMouseLeave={(e) => {
          e.target.style.background = 'linear-gradient(135deg, #3b82f6, #1d4ed8)';
        }}
      >
        Test All Animations
      </button>

      {testResults.length > 0 && (
        <div style={{
          marginTop: '16px'
        }}>
          <h4 style={{
            color: '#ffffff',
            fontSize: '14px',
            margin: '0 0 8px 0',
            fontWeight: '600'
          }}>
            Test Results:
          </h4>
          {testResults.map((result, index) => (
            <div
              key={index}
              style={{
                padding: '8px 12px',
                margin: '4px 0',
                borderRadius: '4px',
                background: result.status === 'success' 
                  ? 'rgba(16, 185, 129, 0.1)' 
                  : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${result.status === 'success' 
                  ? 'rgba(16, 185, 129, 0.3)' 
                  : 'rgba(239, 68, 68, 0.3)'}`,
                color: result.status === 'success' ? '#10b981' : '#ef4444',
                fontSize: '12px'
              }}
            >
              <strong>{result.name}:</strong> {result.message}
            </div>
          ))}
        </div>
      )}

      <div style={{
        marginTop: '16px',
        padding: '12px',
        background: 'rgba(0, 0, 0, 0.3)',
        borderRadius: '6px',
        fontSize: '12px',
        color: '#d1d5db'
      }}>
        <strong>Animation Types:</strong><br/>
        • <span style={{ color: '#ef4444' }}>Power Plants:</span> Pulse animation<br/>
        • <span style={{ color: '#3b82f6' }}>Transmission:</span> Ripple effect<br/>
        • <span style={{ color: '#06b6d4' }}>Utilities:</span> Glow effect<br/>
        • <span style={{ color: '#8b5cf6' }}>Data Centers:</span> Heartbeat animation
      </div>
    </div>
  );
};

export default AnimationTestComponent;
