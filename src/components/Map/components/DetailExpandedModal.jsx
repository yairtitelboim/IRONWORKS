import React from 'react';
import { createPortal } from 'react-dom';
import { 
  MapPin, 
  FileText, 
  Share2, 
  Bell, 
  Building2, 
  Users,
  ClipboardList,
  CheckCircle,
  Wrench,
  ChevronDown,
  ChevronUp,
  Zap,
  RotateCcw,
  Clock
} from 'lucide-react';
import { getGeographicConfig } from '../../../config/geographicConfig.js';
import TimelineIntelligence from './TimelineIntelligence.js';

// Reusable collapsible section component
const CollapsibleSection = ({ 
  title, 
  icon: IconComponent, 
  sectionKey, 
  children, 
  isExpanded, 
  onToggle,
  iconColor = "#ffffff",
  iconBg = "rgba(255, 255, 255, 0.15)"
}) => (
  <div style={{
    background: 'rgba(255, 255, 255, 0.02)',
    borderRadius: '8px',
    padding: '12px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    marginBottom: '10px',
    animation: 'slideInLeft 0.6s ease-out'
  }}>
    <div 
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
        marginBottom: isExpanded ? '12px' : '0',
        transition: 'all 0.3s ease'
      }}
      onClick={() => onToggle(sectionKey)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s ease'
        }}>
          <IconComponent 
            size={18} 
            color={iconColor} 
            style={{ 
              transition: 'all 0.3s ease',
              display: 'inline-block'
            }} 
          />
        </div>
        <h2 style={{
          fontSize: '18px',
          fontWeight: '700',
          color: '#ffffff',
          margin: '0',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
        }}>
          {title}
        </h2>
      </div>
      <div style={{
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        background: 'rgba(255, 255, 255, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.3s ease'
      }}>
        {isExpanded ? (
          <ChevronUp size={16} color="#ffffff" />
        ) : (
          <ChevronDown size={16} color="#ffffff" />
        )}
      </div>
    </div>
    
    {isExpanded && (
      <div style={{
        animation: 'fadeInUp 0.3s ease-out'
      }}>
        {children}
      </div>
    )}
  </div>
);

// Startup Growth Analysis Chart Component
const StartupGrowthAnalysisChart = ({ nodeData }) => (
  <div style={{
    background: 'transparent',
    borderRadius: '8px',
    padding: '24px',
    border: '1px solid rgba(255, 255, 255, 0.1)'
  }}>
    <h4 style={{
      fontSize: '18px',
      fontWeight: '600',
      color: '#ffffff',
      margin: '0 0 20px 0',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
    }}>
      Startup Ecosystem Growth (2019-2024) - {nodeData.name}
    </h4>
    
    {/* ERCOT-style Chart */}
    <div style={{
      height: '200px',
      background: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '4px',
      position: 'relative',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      marginBottom: '16px'
    }}>
      {/* Chart Grid Lines */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `
          linear-gradient(to right, rgba(255, 255, 255, 0.1) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 1px, transparent 1px)
        `,
        backgroundSize: '50px 40px'
      }}></div>
      
      {/* Chart Lines */}
      <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
        {[
          { year: '2019', color: '#3b82f6', path: 'M 40 160 L 100 150 L 160 155 L 220 140 L 280 145 L 340 130 L 400 135 L 460 120 L 520 125 L 580 110 L 640 115 L 700 100 L 760 105 L 820 90' },
          { year: '2020', color: '#8b5cf6', path: 'M 40 155 L 100 145 L 160 150 L 220 135 L 280 140 L 340 125 L 400 130 L 460 115 L 520 120 L 580 105 L 640 110 L 700 95 L 760 100 L 820 85' },
          { year: '2021', color: '#06b6d4', path: 'M 40 150 L 100 140 L 160 145 L 220 130 L 280 135 L 340 120 L 400 125 L 460 110 L 520 115 L 580 100 L 640 105 L 700 90 L 760 95 L 820 80' },
          { year: '2022', color: '#10b981', path: 'M 40 145 L 100 135 L 160 140 L 220 125 L 280 130 L 340 115 L 400 120 L 460 105 L 520 110 L 580 95 L 640 100 L 700 85 L 760 90 L 820 75' },
          { year: '2023', color: '#f59e0b', path: 'M 40 140 L 100 130 L 160 135 L 220 120 L 280 125 L 340 110 L 400 115 L 460 100 L 520 105 L 580 90 L 640 95 L 700 80 L 760 85 L 820 70' },
          { year: '2024', color: '#ef4444', path: 'M 40 135 L 100 125 L 160 130 L 220 115 L 280 120 L 340 105 L 400 110 L 460 95 L 520 100 L 580 85 L 640 90 L 700 75 L 760 80 L 820 65', bold: true }
        ].map((line, index) => (
          <path
            key={line.year}
            d={line.path}
            stroke={line.color}
            strokeWidth={line.bold ? "2.5" : "1.5"}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={line.bold ? "1" : "0.6"}
          />
        ))}
        
        {/* Average Trend Line */}
        <path
          d="M 40 150 L 100 145 L 160 140 L 220 130 L 280 125 L 340 115 L 400 110 L 460 100 L 520 95 L 580 85 L 640 80 L 700 70 L 760 65 L 820 55"
          stroke="#ffffff"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="6,3"
        />
      </svg>
      
      {/* Y-axis Labels */}
      <div style={{
        position: 'absolute',
        left: '8px',
        top: '8px',
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: '11px',
        fontFamily: 'Inter, sans-serif',
        lineHeight: '1.2'
      }}>
        {['100%', '75%', '50%', '25%', '0%'].map((label, index) => (
          <div key={label} style={{ marginBottom: index < 4 ? '38px' : '0' }}>{label}</div>
        ))}
      </div>
      
      {/* X-axis Labels */}
      <div style={{
        position: 'absolute',
        bottom: '8px',
        left: '40px',
        right: '40px',
        display: 'flex',
        justifyContent: 'space-between',
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: '11px',
        fontFamily: 'Inter, sans-serif'
      }}>
        {['Q1', 'Q2', 'Q3', 'Q4', 'Q1'].map(quarter => (
          <span key={quarter}>{quarter}</span>
        ))}
      </div>
    </div>
    
    {/* Seasonal Legend */}
    <div style={{
      display: 'flex',
      gap: '16px',
      marginBottom: '16px',
      marginLeft: '50px',
      fontSize: '12px',
      fontFamily: 'Inter, sans-serif',
      flexWrap: 'wrap'
    }}>
      {[
        { year: '2024', color: '#ef4444' },
        { year: '2023', color: '#f59e0b' },
        { year: '2022', color: '#10b981' },
        { year: '2021', color: '#06b6d4' },
        { year: '2020', color: '#8b5cf6' },
        { year: '2019', color: '#3b82f6' },
        { year: 'Trend', color: '#ffffff', dashed: true }
      ].map((item, index) => (
        <div key={item.year} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ 
            width: '12px', 
            height: '2px', 
            background: item.color, 
            borderRadius: '1px',
            ...(item.dashed && { borderTop: '2px dashed #ffffff' })
          }}></div>
          <span style={{ color: 'rgba(255, 255, 255, 0.8)' }}>{item.year}</span>
        </div>
      ))}
    </div>
    
    {/* Key Metrics */}
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: '16px',
      fontSize: '14px',
      fontFamily: 'Inter, sans-serif'
    }}>
      {[
        { label: 'Peak Growth', value: '95%' },
        { label: 'Market Low', value: '65%' },
        { label: '5-Year Growth', value: '+12%' },
        { label: 'Market Variance', value: '30%' }
      ].map((metric, index) => (
        <div key={metric.label} style={{
          background: 'rgba(255, 255, 255, 0.05)',
          padding: '12px',
          borderRadius: '4px',
          textAlign: 'center',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', marginBottom: '4px' }}>{metric.label}</div>
          <div style={{ color: '#ffffff', fontWeight: '600', fontSize: '16px' }}>{metric.value}</div>
        </div>
      ))}
    </div>
  </div>
);

// Startup Assessment Component
const StartupAssessment = ({ nodeData, powerGridData, siteAssessmentData, environmentalData }) => {
  // Debug logging to see what data we're receiving
  console.log('🔍 StartupAssessment received data:', {
    nodeData,
    powerGridData,
    siteAssessmentData,
    environmentalData
  });
  
  // Helper function to get funding stage color
  const getFundingStageColor = (stage) => {
    switch (stage?.toLowerCase()) {
      case 'series a+': return '#22c55e';
      case 'series a': return '#10b981';
      case 'seed': return '#f59e0b';
      case 'pre-seed': return '#ef4444';
      default: return '#6b7280';
    }
  };

  // Helper function to get academic arbitrage score color
  const getAcademicScoreColor = (score) => {
    const scoreNum = parseInt(score?.split('/')[0]) || 0;
    if (scoreNum >= 9) return '#22c55e';
    if (scoreNum >= 7) return '#f59e0b';
    return '#ef4444';
  };

  return (
  <>
    {/* Primary Metrics - Startup Data */}
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '24px',
      marginBottom: '32px'
    }}>
      {/* Academic Arbitrage Score - From Geographic Intelligence */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: `conic-gradient(${getAcademicScoreColor(nodeData.geographicIntelligence?.academic_proximity?.academic_arbitrage_score)} 0deg ${(parseInt(nodeData.geographicIntelligence?.academic_proximity?.academic_arbitrage_score?.split('/')[0]) || 0) * 36}deg, rgba(255,255,255,0.1) ${(parseInt(nodeData.geographicIntelligence?.academic_proximity?.academic_arbitrage_score?.split('/')[0]) || 0) * 36}deg 360deg)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 12px',
          animation: 'scoreAnimation 1.5s ease-out 0.5s both'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: '#1f2937',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            fontWeight: '700',
            color: '#ffffff'
          }}>
            {nodeData.geographicIntelligence?.academic_proximity?.academic_arbitrage_score || 'N/A'}
          </div>
        </div>
        <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '14px' }}>Academic Arbitrage</div>
        <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '12px', marginTop: '4px' }}>Source: Geographic Intelligence</div>
      </div>
      
      {/* Funding Stage - From Startup Data */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.1)',
          border: `2px solid ${getFundingStageColor(nodeData.fundingStage)}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 12px',
          animation: 'fadeInScale 1s ease-out 0.8s both'
        }}>
          <div style={{
            fontSize: '12px',
            fontWeight: '700',
            color: getFundingStageColor(nodeData.fundingStage),
            textAlign: 'center',
            lineHeight: '1.2'
          }}>
            {nodeData.fundingStage || 'Unknown'}
          </div>
        </div>
        <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '14px' }}>Funding Stage</div>
        <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '12px', marginTop: '4px' }}>Source: Startup Data</div>
      </div>
      
      {/* Category - From Startup Data */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'rgba(99, 102, 241, 0.2)',
          border: '2px solid #6366f1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 12px',
          animation: 'fadeInScale 1s ease-out 1s both'
        }}>
          <div style={{
            fontSize: '12px',
            fontWeight: '700',
            color: '#6366f1',
            textAlign: 'center',
            lineHeight: '1.2'
          }}>
            {nodeData.category || 'Unknown'}
          </div>
        </div>
        <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '14px' }}>Category</div>
        <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '12px', marginTop: '4px' }}>Source: Startup Data</div>
      </div>
    </div>

    {/* Geographic Intelligence - Real Data from Startup Data */}
    <div style={{
      background: 'rgba(255, 255, 255, 0.02)',
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '24px',
      border: '1px solid rgba(255, 255, 255, 0.08)'
    }}>
      <h3 style={{
        fontSize: '16px',
        fontWeight: '600',
        color: '#ffffff',
        margin: '0 0 16px 0',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
      }}>
        Geographic Intelligence
      </h3>
      
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '16px'
      }}>
        {/* University Proximity - From Geographic Intelligence */}
        <div style={{
          padding: '12px',
          background: 'rgba(255, 255, 255, 0.03)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', marginBottom: '4px' }}>University Proximity</div>
          <div style={{ color: '#ffffff', fontSize: '18px', fontWeight: '600' }}>
            {typeof nodeData.geographicIntelligence?.academic_proximity?.most_relevant_university === 'string' 
              ? nodeData.geographicIntelligence.academic_proximity.most_relevant_university.split(' — ')[0] 
              : nodeData.geographicIntelligence?.academic_proximity?.most_relevant_university || 'Loading...'}
          </div>
          <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '11px', marginTop: '2px' }}>Source: Geographic Intelligence</div>
        </div>

        {/* Startup Density - From Geographic Intelligence */}
        <div style={{
          padding: '12px',
          background: 'rgba(255, 255, 255, 0.03)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', marginBottom: '4px' }}>Startup Density</div>
          <div style={{ color: '#ffffff', fontSize: '18px', fontWeight: '600' }}>
            {nodeData.geographicIntelligence?.network_effects?.startup_density_0_5_miles || 'Loading...'}
          </div>
          <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '11px', marginTop: '2px' }}>Source: Geographic Intelligence</div>
        </div>

        {/* Walkability Score - From Geographic Intelligence */}
        <div style={{
          padding: '12px',
          background: 'rgba(255, 255, 255, 0.03)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', marginBottom: '4px' }}>Walkability Score</div>
          <div style={{ color: '#ffffff', fontSize: '18px', fontWeight: '600' }}>
            {nodeData.geographicIntelligence?.infrastructure_access?.walkability_score || 'Loading...'}
          </div>
          <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '11px', marginTop: '2px' }}>Source: Geographic Intelligence</div>
        </div>

        {/* VC Proximity - From Geographic Intelligence */}
        <div style={{
          padding: '12px',
          background: 'rgba(255, 255, 255, 0.03)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', marginBottom: '4px' }}>VC Proximity</div>
          <div style={{ color: '#ffffff', fontSize: '18px', fontWeight: '600' }}>
            {typeof nodeData.geographicIntelligence?.network_effects?.vc_proximity === 'string' 
              ? nodeData.geographicIntelligence.network_effects.vc_proximity.split(',')[0] 
              : nodeData.geographicIntelligence?.network_effects?.vc_proximity || 'Loading...'}
          </div>
          <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '11px', marginTop: '2px' }}>Source: Geographic Intelligence</div>
        </div>
      </div>
    </div>

    {/* Business Context - Real Data from Startup Data */}
    <div style={{
      background: 'rgba(255, 255, 255, 0.02)',
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '24px',
      border: '1px solid rgba(255, 255, 255, 0.08)'
    }}>
      <h3 style={{
        fontSize: '16px',
        fontWeight: '600',
        color: '#ffffff',
        margin: '0 0 16px 0',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
      }}>
        Business Context
      </h3>
      
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '16px'
      }}>
        {/* Industries - From Startup Data */}
        <div style={{
          padding: '12px',
          background: 'rgba(255, 255, 255, 0.03)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', marginBottom: '4px' }}>Industries</div>
          <div style={{ color: '#ffffff', fontSize: '18px', fontWeight: '600' }}>
            {typeof nodeData.industries === 'string' ? nodeData.industries.split(',')[0] : nodeData.industries || 'Loading...'}
          </div>
          <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '11px', marginTop: '2px' }}>Source: Startup Data</div>
        </div>

        {/* Founded Date - From Startup Data */}
        <div style={{
          padding: '12px',
          background: 'rgba(255, 255, 255, 0.03)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', marginBottom: '4px' }}>Founded Date</div>
          <div style={{ color: '#ffffff', fontSize: '18px', fontWeight: '600' }}>
            {nodeData.foundedDate || 'Loading...'}
          </div>
          <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '11px', marginTop: '2px' }}>Source: Startup Data</div>
        </div>

        {/* CB Rank - From Startup Data */}
        <div style={{
          padding: '12px',
          background: 'rgba(255, 255, 255, 0.03)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', marginBottom: '4px' }}>CB Rank</div>
          <div style={{ color: '#ffffff', fontSize: '18px', fontWeight: '600' }}>
            #{nodeData.cbRank || 'Loading...'}
          </div>
          <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '11px', marginTop: '2px' }}>Source: Startup Data</div>
        </div>

        {/* Headquarters - From Startup Data */}
        <div style={{
          padding: '12px',
          background: 'rgba(255, 255, 255, 0.03)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', marginBottom: '4px' }}>Headquarters</div>
          <div style={{ color: '#ffffff', fontSize: '18px', fontWeight: '600' }}>
            {nodeData.headquarters || 'Loading...'}
          </div>
          <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '11px', marginTop: '2px' }}>Source: Startup Data</div>
        </div>
      </div>
    </div>

    {/* Data Sources Attribution */}
    <div style={{
      background: 'rgba(255, 255, 255, 0.02)',
      borderRadius: '8px',
      padding: '12px',
      border: '1px solid rgba(255, 255, 255, 0.05)',
      marginTop: '16px'
    }}>
      <div style={{
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: '12px',
        textAlign: 'center'
      }}>
        Data Sources: Geographic Intelligence • Startup Data • Crunchbase • Real-time APIs
      </div>
    </div>
  </>
  );
};

// Development Timeline Component
const DevelopmentTimeline = () => (
  <div style={{ position: 'relative', paddingLeft: '24px' }}>
    {/* Timeline Line */}
    <div style={{
      position: 'absolute',
      left: '8px',
      top: '0',
      bottom: '0',
      width: '2px',
      background: 'linear-gradient(to bottom, #3b82f6, rgba(59, 130, 246, 0.3))',
      animation: 'timelineGrow 2s ease-out 1s both'
    }}></div>
    
    {/* Timeline Items */}
    {[
      { phase: 'Site Acquisition', duration: '3-6 months', status: 'ready', delay: '1.2s' },
      { phase: 'Permits & Approvals', duration: '6-12 months', status: 'pending', delay: '1.4s' },
      { phase: 'Grid Interconnection', duration: '18-24 months', status: 'pending', delay: '1.6s' },
      { phase: 'Construction Phase 1', duration: '12-18 months', status: 'future', delay: '1.8s' },
      { phase: 'Commissioning & Testing', duration: '3-6 months', status: 'future', delay: '2.0s' }
    ].map((item, index) => (
      <div key={index} style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: '20px',
        animation: `fadeInRight 0.5s ease-out ${item.delay} both`
      }}>
        <div style={{
          position: 'absolute',
          left: '2px',
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          background: item.status === 'ready' ? '#22c55e' : item.status === 'pending' ? '#f59e0b' : 'rgba(255, 255, 255, 0.3)',
          border: '2px solid #1f2937'
        }}></div>
        <div style={{ marginLeft: '24px', flex: 1 }}>
          <div style={{ color: '#ffffff', fontSize: '16px', fontWeight: '500', marginBottom: '4px' }}>
            {item.phase}
          </div>
          <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px' }}>
            {item.duration}
          </div>
        </div>
      </div>
    ))}
  </div>
);

// Quick Actions Component
const QuickActions = () => (
  <div style={{
    background: 'rgba(255, 255, 255, 0.02)',
    borderRadius: '16px',
    padding: '24px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    animation: 'slideInRight 0.6s ease-out'
  }}>
    <h3 style={{
      fontSize: '18px',
      fontWeight: '600',
      color: '#ffffff',
      margin: '0 0 20px 0',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
    }}>
      Quick Actions
    </h3>
    
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {[
        { label: 'Schedule Site Visit', icon: MapPin, primary: true },
        { label: 'Download Report', icon: FileText, primary: false },
        { label: 'Share Analysis', icon: Share2, primary: false },
        { label: 'Set Alerts', icon: Bell, primary: false }
      ].map((action, index) => {
        const IconComponent = action.icon;
        return (
        <button
          key={index}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: action.primary ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            color: '#ffffff',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            animation: `fadeInUp 0.3s ease-out ${0.1 + index * 0.1}s both`
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateY(-2px)';
            e.target.style.background = 'rgba(255, 255, 255, 0.1)';
            const icon = e.target.querySelector('.action-icon');
            const iconContainer = e.target.querySelector('.icon-container');
            if (icon) {
              icon.style.animation = 'iconPulse 0.8s ease-in-out infinite';
              icon.style.transform = 'scale(1.1)';
            }
            if (iconContainer) {
              iconContainer.style.background = 'rgba(255, 255, 255, 0.25)';
              iconContainer.style.transform = 'scale(1.1)';
            }
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.background = 'rgba(255, 255, 255, 0.05)';
            const icon = e.target.querySelector('.action-icon');
            const iconContainer = e.target.querySelector('.icon-container');
            if (icon) {
              icon.style.animation = 'none';
              icon.style.transform = 'scale(1)';
            }
            if (iconContainer) {
              iconContainer.style.background = 'rgba(255, 255, 255, 0.15)';
              iconContainer.style.transform = 'scale(1)';
            }
          }}
        >
          <div 
            className="icon-container"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '12px',
              transition: 'all 0.3s ease'
            }}>
            <IconComponent 
              className="action-icon"
              size={16} 
              color="#ffffff" 
              style={{ 
                transition: 'all 0.3s ease',
                display: 'inline-block'
              }} 
            />
          </div>
          {action.label}
        </button>
        );
      })}
    </div>
  </div>
);

// Risk Assessment Component
const RiskAssessment = () => (
  <div style={{
    background: 'rgba(255, 255, 255, 0.02)',
    borderRadius: '16px',
    padding: '24px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    animation: 'slideInRight 0.6s ease-out 0.2s both'
  }}>
    <h3 style={{
      fontSize: '18px',
      fontWeight: '600',
      color: '#ffffff',
      margin: '0 0 20px 0',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
    }}>
      Risk Assessment
    </h3>
    
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {[
        { factor: 'Grid Stability', level: 'Low', score: 85 },
        { factor: 'Environmental', level: 'Low', score: 90 },
        { factor: 'Regulatory', level: 'Medium', score: 70 },
        { factor: 'Market', level: 'Low', score: 80 }
      ].map((risk, index) => (
        <div key={index} style={{
          animation: `fadeInLeft 0.4s ease-out ${0.5 + index * 0.1}s both`
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <span style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '14px' }}>
              {risk.factor}
            </span>
            <span style={{
              color: risk.level === 'Low' ? '#22c55e' : risk.level === 'Medium' ? '#f59e0b' : '#ef4444',
              fontSize: '12px',
              fontWeight: '600'
            }}>
              {risk.level}
            </span>
          </div>
          <div style={{
            width: '100%',
            height: '6px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '3px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${risk.score}%`,
              height: '100%',
              background: risk.level === 'Low' ? '#22c55e' : risk.level === 'Medium' ? '#f59e0b' : '#ef4444',
              borderRadius: '3px',
              animation: `progressBarGrow 1s ease-out ${1 + index * 0.2}s both`
            }}></div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Key Contacts Component
const KeyContacts = () => (
  <div style={{
    background: 'rgba(255, 255, 255, 0.02)',
    borderRadius: '16px',
    padding: '24px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    animation: 'slideInRight 0.6s ease-out 0.4s both'
  }}>
    <h3 style={{
      fontSize: '18px',
      fontWeight: '600',
      color: '#ffffff',
      margin: '0 0 20px 0',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
    }}>
      Key Contacts
    </h3>
    
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {[
        { name: 'Site Manager', contact: 'John Smith • (512) 555-0123', icon: Users },
        { name: 'ERCOT Liaison', contact: 'Sarah Johnson • (512) 555-0456', icon: Building2 }
      ].map((contact, index) => {
        const IconComponent = contact.icon;
        return (
        <div key={index} style={{
          padding: '12px',
          background: 'rgba(255, 255, 255, 0.03)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          transition: 'all 0.2s ease',
          cursor: 'pointer'
        }}
        onMouseEnter={(e) => {
          e.target.style.background = 'rgba(255, 255, 255, 0.06)';
          e.target.style.transform = 'translateX(4px)';
          const icon = e.target.querySelector('.contact-icon');
          if (icon) {
            icon.style.animation = 'iconPulse 0.8s ease-in-out infinite';
            icon.style.transform = 'scale(1.1)';
          }
        }}
        onMouseLeave={(e) => {
          e.target.style.background = 'rgba(255, 255, 255, 0.03)';
          e.target.style.transform = 'translateX(0)';
          const icon = e.target.querySelector('.contact-icon');
          if (icon) {
            icon.style.animation = 'none';
            icon.style.transform = 'scale(1)';
          }
        }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease'
          }}>
            <IconComponent 
              className="contact-icon"
              size={14} 
              color="#ffffff" 
              style={{ 
                transition: 'all 0.3s ease',
                display: 'inline-block'
              }} 
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#ffffff', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
              {contact.name}
            </div>
            <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px' }}>
              {contact.contact}
            </div>
          </div>
        </div>
        );
      })}
    </div>
  </div>
);

// Next Steps Component
const NextSteps = () => (
  <div style={{
    background: 'rgba(99, 102, 241, 0.1)',
    borderRadius: '16px',
    padding: '24px',
    border: '1px solid rgba(99, 102, 241, 0.2)',
    animation: 'slideInRight 0.6s ease-out 0.4s both'
  }}>
    <h3 style={{
      fontSize: '18px',
      fontWeight: '600',
      color: '#ffffff',
      margin: '0 0 20px 0',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    }}>
      <div style={{
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        background: 'rgba(99, 102, 241, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.3s ease'
      }}>
        <CheckCircle 
          size={18} 
          color="#6366f1" 
          style={{ 
            transition: 'all 0.3s ease',
            display: 'inline-block'
          }} 
        />
      </div>
      Next Steps
    </h3>
    
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {[
        { title: 'Site Visit & Due Diligence', desc: 'Schedule on-site assessment within 30 days' },
        { title: 'Grid Interconnection Study', desc: 'Initiate formal application with ERCOT' },
        { title: 'Environmental Assessment', desc: 'Commission Phase I environmental study' },
        { title: 'Financial Modeling', desc: 'Develop detailed pro forma analysis' },
        { title: 'Stakeholder Engagement', desc: 'Meet with local authorities & community' }
      ].map((step, index) => (
        <div key={index} style={{
          padding: '12px',
          background: 'rgba(99, 102, 241, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(99, 102, 241, 0.2)'
        }}>
          <div style={{ color: '#ffffff', fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
            {index + 1}. {step.title}
          </div>
          <div style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '12px' }}>
            {step.desc}
          </div>
        </div>
      ))}
    </div>
  </div>
);

const DetailExpandedModal = ({ 
  isOpen, 
  onClose, 
  nodeData, 
  category,
  toolData 
}) => {
  // Extract data from toolData or use defaults
  const powerGridData = toolData?.powerGridAnalysis || {};
  const siteAssessmentData = toolData?.siteAssessment || {};
  const environmentalData = toolData?.environmentalAnalysis || {};
  
  // Helper function to get funding stage color
  const getFundingStageColor = (stage) => {
    switch (stage?.toLowerCase()) {
      case 'series a+': return '#22c55e';
      case 'series a': return '#10b981';
      case 'seed': return '#f59e0b';
      case 'pre-seed': return '#ef4444';
      default: return '#6b7280';
    }
  };
  
  // Collapsible sections state
  const [expandedSections, setExpandedSections] = React.useState({
    powerGridAnalysis: false,
    siteAssessment: true,
    timelineIntelligence: false,
    developmentTimeline: true,
    executiveSummary: true,
    technicalDetails: false
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Get location information for display
  const getLocationInfo = () => {
    // Try to get location from nodeData first, then fallback to geographic config
    if (nodeData?.address) {
      return nodeData.address;
    }
    
    // Extract location from content if available
    if (nodeData?.content) {
      const locationMatch = nodeData.content.match(/\*\*Location:\*\* (.+?)(?:\n|$)/) ||
                           nodeData.content.match(/\*\*Address:\*\* (.+?)(?:\n|$)/) ||
                           nodeData.content.match(/\*\*Site:\*\* (.+?)(?:\n|$)/);
      if (locationMatch) {
        return locationMatch[1].trim();
      }
    }
    
    // Fallback to geographic config
    const geoConfig = getGeographicConfig('default');
    return `${geoConfig.city}, ${geoConfig.state} (${geoConfig.county})`;
  };


  if (!isOpen || !nodeData) return null;

  const modalContent = (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: '40px 20px 20px 20px',
      backdropFilter: 'blur(1px)'
    }}>
      <div style={{
        backgroundColor: '#1f2937',
        borderRadius: '8px',
        padding: '12px',
        width: '98vw',
        maxWidth: '1600px',
        maxHeight: '98vh',
        overflow: 'auto',
        position: 'relative',
        border: '2px solid rgba(59, 130, 246, 0.3)',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.8)',
        animation: 'modalSlideIn 0.3s ease-out',
        transform: 'scale(0.7)',
        transformOrigin: 'center center'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
          paddingBottom: '8px',
          borderBottom: '2px solid rgba(59, 130, 246, 0.2)'
        }}>
          <div>
            <h2 style={{
              fontSize: '20px',
              fontWeight: '700',
              color: '#ffffff',
              margin: '0 0 4px 0',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <MapPin size={18} color="#60a5fa" />
              {getLocationInfo()}
            </h2>
            <div style={{
              fontSize: '16px',
              color: 'rgba(255, 255, 255, 0.7)',
              fontWeight: '500',
              marginBottom: '4px'
            }}>
              {nodeData.name} • Node {nodeData.id}
            </div>
            <div style={{
              fontSize: '14px',
              color: 'rgba(255, 255, 255, 0.5)',
              fontWeight: '400'
            }}>
              {nodeData.type}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={() => {
                // TODO: Implement run again functionality
                console.log('Run Again clicked');
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                color: '#ffffff',
                padding: '12px 20px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '600',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.2)';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
            >
              <RotateCcw size={16} color="#ffffff" />
              Run Again
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                color: '#ffffff',
                padding: '12px 20px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '600',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.2)';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* Startup Growth Analysis */}
        <CollapsibleSection
          title="Startup Growth Analysis"
          icon={Zap}
          sectionKey="powerGridAnalysis"
          isExpanded={expandedSections.powerGridAnalysis}
          onToggle={toggleSection}
          iconColor="#ffffff"
          iconBg="rgba(255, 255, 255, 0.15)"
        >
          <StartupGrowthAnalysisChart nodeData={nodeData} />
        </CollapsibleSection>

        {/* Main Dashboard Layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 412px',
          gap: '16px',
          marginBottom: '16px',
          alignItems: 'start',
          alignContent: 'start'
        }}>
          {/* Left Column - Primary Content */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            {/* Key Metrics Overview */}
            <CollapsibleSection
              title="Startup Assessment Overview"
              icon={Building2}
              sectionKey="siteAssessment"
              isExpanded={expandedSections.siteAssessment}
              onToggle={toggleSection}
            >
              <StartupAssessment 
                nodeData={nodeData} 
                powerGridData={powerGridData}
                siteAssessmentData={siteAssessmentData}
                environmentalData={environmentalData}
              />
            </CollapsibleSection>

            {/* Timeline Intelligence */}
            <CollapsibleSection
              title="Timeline Intelligence"
              icon={Clock}
              sectionKey="timelineIntelligence"
              isExpanded={expandedSections.timelineIntelligence}
              onToggle={toggleSection}
              iconColor="#8b5cf6"
              iconBg="rgba(139, 92, 246, 0.2)"
            >
              <TimelineIntelligence 
                nodeData={nodeData} 
                powerGridData={powerGridData}
                siteAssessmentData={siteAssessmentData}
                environmentalData={environmentalData}
              />
            </CollapsibleSection>

            {/* Development Timeline */}
            <CollapsibleSection
              title="Development Timeline"
              icon={CheckCircle}
              sectionKey="developmentTimeline"
              isExpanded={expandedSections.developmentTimeline}
              onToggle={toggleSection}
              iconColor="#22c55e"
              iconBg="rgba(34, 197, 94, 0.2)"
            >
              <DevelopmentTimeline />
            </CollapsibleSection>

            {/* Technical Analysis Details */}
            <CollapsibleSection
              title="Technical Analysis Details"
              icon={Wrench}
              sectionKey="technicalDetails"
              isExpanded={expandedSections.technicalDetails}
              onToggle={toggleSection}
            >
              <div style={{
                color: 'rgba(255, 255, 255, 0.9)',
                fontSize: '14px',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
              }}>
                {nodeData.technicalDetails || `Startup Analysis for ${nodeData.name}

Geographic Intelligence Assessment:
• University Proximity: ${typeof nodeData.geographicIntelligence?.academic_proximity?.most_relevant_university === 'string' ? nodeData.geographicIntelligence.academic_proximity.most_relevant_university.split(' — ')[0] : nodeData.geographicIntelligence?.academic_proximity?.most_relevant_university || 'MIT'} - ${nodeData.geographicIntelligence?.academic_proximity?.academic_arbitrage_score || 'N/A'}
• Startup Density: ${nodeData.geographicIntelligence?.network_effects?.startup_density_0_5_miles || 'High density'} within 0.5 miles
• Walkability Score: ${nodeData.geographicIntelligence?.infrastructure_access?.walkability_score || '9/10'} with excellent transit connectivity
• VC Proximity: ${typeof nodeData.geographicIntelligence?.network_effects?.vc_proximity === 'string' ? nodeData.geographicIntelligence.network_effects.vc_proximity.split(',')[0] : nodeData.geographicIntelligence?.network_effects?.vc_proximity || 'Multiple VCs'} within walking distance

Business Context:
• Founded: ${nodeData.foundedDate || 'Recent'} in ${nodeData.headquarters || 'Location TBD'}
• Industries: ${typeof nodeData.industries === 'string' ? nodeData.industries.split(',')[0] : nodeData.industries || 'Technology'} with focus on ${nodeData.category || 'AI/ML'}
• Funding Stage: ${nodeData.fundingStage || 'Unknown'} with Crunchbase rank #${nodeData.cbRank || 'TBD'}
• Description: ${nodeData.description || 'Active startup'}

Growth Trajectory:
• Expansion Opportunities: ${nodeData.geographicIntelligence?.growth_trajectory?.expansion_opportunities || 'Multiple adjacent buildings available'}
• Infrastructure Constraints: ${nodeData.geographicIntelligence?.growth_trajectory?.infrastructure_constraints || 'High rents and limited space'}
• Planned Developments: ${nodeData.geographicIntelligence?.growth_trajectory?.planned_developments || 'Kendall Square undergoing further development'}`}
              </div>
            </CollapsibleSection>

            {/* Executive Summary */}
            <CollapsibleSection
              title="Executive Summary"
              icon={ClipboardList}
              sectionKey="executiveSummary"
              isExpanded={expandedSections.executiveSummary}
              onToggle={toggleSection}
            >
              <div style={{
                color: 'rgba(255, 255, 255, 0.9)',
                fontSize: '16px',
                lineHeight: '1.6',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
              }}>
                <p style={{ margin: '0 0 16px 0' }}>
                  <strong>Startup Assessment:</strong> {nodeData.name} presents a <span style={{color: getFundingStageColor(nodeData.fundingStage)}}>{nodeData.fundingStage || 'Unknown'}</span> stage opportunity in the {nodeData.category || 'Technology'} sector with an academic arbitrage score of <strong>{nodeData.geographicIntelligence?.academic_proximity?.academic_arbitrage_score || 'N/A'}</strong>.
                </p>
                <p style={{ margin: '0 0 16px 0' }}>
                  <strong>Key Advantages:</strong> {typeof nodeData.geographicIntelligence?.academic_proximity?.most_relevant_university === 'string' ? nodeData.geographicIntelligence.academic_proximity.most_relevant_university.split(' — ')[0] : nodeData.geographicIntelligence?.academic_proximity?.most_relevant_university || 'University proximity'}, {nodeData.geographicIntelligence?.network_effects?.startup_density_0_5_miles || 'high startup density'}, {nodeData.geographicIntelligence?.infrastructure_access?.walkability_score || 'excellent walkability'}, and proximity to {typeof nodeData.geographicIntelligence?.network_effects?.vc_proximity === 'string' ? nodeData.geographicIntelligence.network_effects.vc_proximity.split(',')[0] : nodeData.geographicIntelligence?.network_effects?.vc_proximity || 'major VCs'} for funding and networking.
                </p>
                <p style={{ margin: '0 0 16px 0' }}>
                  <strong>Primary Considerations:</strong> Founded in {nodeData.foundedDate || 'recent years'}, operating in {typeof nodeData.industries === 'string' ? nodeData.industries.split(',')[0] : nodeData.industries || 'technology'}, with headquarters at {nodeData.headquarters || 'location TBD'}. Crunchbase rank #{nodeData.cbRank || 'TBD'} indicates market position.
                </p>
                <p style={{ margin: '0' }}>
                  <strong>Growth Outlook:</strong> Positioned in {nodeData.geographicIntelligence?.competitive_positioning?.talent_acquisition_advantage || 'talent-rich environment'} with {nodeData.geographicIntelligence?.network_effects?.networking_opportunities || 'strong networking opportunities'}. Geographic advantages include {nodeData.spatialInsights?.geographic_advantages?.[0] || 'strategic location benefits'}.
                </p>
              </div>
            </CollapsibleSection>
          </div>

          {/* Right Column - Fixed Sidebar */}
          <div style={{ 
            position: 'sticky',
            top: '5px',
            display: 'flex', 
            flexDirection: 'column', 
            gap: '10px',
            height: 'fit-content',
            alignSelf: 'start'
          }}>
            
            <QuickActions />
            <RiskAssessment />
            <KeyContacts />
            <NextSteps />
          </div>
        </div>



        {/* Footer */}
        <div style={{
          marginTop: '12px',
          paddingTop: '8px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '14px',
            color: 'rgba(255, 255, 255, 0.6)',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
          }}>
            Node ID: {nodeData.id} • Last Updated: {new Date().toLocaleString()}
          </div>
        </div>
      </div>

      <style>
        {`
          @keyframes modalSlideIn { from { opacity: 0; transform: scale(0.9) translateY(-20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
          @keyframes slideInLeft { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); } }
          @keyframes slideInRight { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
          @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes fadeInRight { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
          @keyframes fadeInLeft { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
          @keyframes scoreAnimation { from { transform: rotate(0deg) scale(0.8); opacity: 0; } to { transform: rotate(360deg) scale(1); opacity: 1; } }
          @keyframes pulseRisk { 0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); } 50% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); } }
          @keyframes fadeInScale { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); } }
          @keyframes timelineGrow { from { height: 0; } to { height: 100%; } }
          @keyframes progressBarGrow { from { width: 0%; } to { width: 100%; } }
          @keyframes iconPulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.15); opacity: 0.8; } }
        `}
      </style>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default DetailExpandedModal;
