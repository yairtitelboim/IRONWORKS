import React from 'react';
import {
  SkeletonContainer,
  SkeletonTitle,
  SkeletonCard,
  SkeletonHeader,
  SkeletonHeading,
  SkeletonCost,
  SkeletonText,
  SkeletonMetrics,
  SkeletonMetric
} from '../StyledComponents';

const InterventionSkeleton = () => {
  return (
    <SkeletonContainer>
      <SkeletonTitle />
      
      {/* First Card */}
      <SkeletonCard>
        <SkeletonHeader>
          <SkeletonHeading />
          <SkeletonCost />
        </SkeletonHeader>
        <SkeletonText $width="90%" />
        <SkeletonText $width="85%" />
        <SkeletonText $width="40%" />
        <SkeletonMetrics>
          <SkeletonMetric />
          <SkeletonMetric />
          <SkeletonMetric />
        </SkeletonMetrics>
      </SkeletonCard>

      {/* Second Card */}
      <SkeletonCard>
        <SkeletonHeader>
          <SkeletonHeading />
          <SkeletonCost />
        </SkeletonHeader>
        <SkeletonText $width="88%" />
        <SkeletonText $width="82%" />
        <SkeletonText $width="45%" />
        <SkeletonMetrics>
          <SkeletonMetric />
          <SkeletonMetric />
        </SkeletonMetrics>
      </SkeletonCard>

      {/* Third Card */}
      <SkeletonCard>
        <SkeletonHeader>
          <SkeletonHeading />
          <SkeletonCost />
        </SkeletonHeader>
        <SkeletonText $width="92%" />
        <SkeletonText $width="87%" />
        <SkeletonText $width="35%" />
        <SkeletonMetrics>
          <SkeletonMetric />
          <SkeletonMetric />
          <SkeletonMetric />
        </SkeletonMetrics>
      </SkeletonCard>
    </SkeletonContainer>
  );
};

export default InterventionSkeleton; 