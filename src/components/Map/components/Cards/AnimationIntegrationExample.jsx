/**
 * AnimationIntegrationExample - Example of how to integrate animations with the table system
 * 
 * This component shows how to set up the complete animation integration
 * for the ALL category table triggers.
 */

import React, { useEffect, useState } from 'react';
import NodeAnimation from '../../../utils/nodeAnimation';

const AnimationIntegrationExample = ({ 
  map, 
  updateToolFeedback,
  children 
}) => {
  const [nodeAnimation, setNodeAnimation] = useState(null);

  // Initialize the animation system
  useEffect(() => {
    if (map && updateToolFeedback) {
      const animation = new NodeAnimation(map, updateToolFeedback);
      setNodeAnimation(animation);
      
      console.log('🎬 NodeAnimation system initialized');
      
      // Cleanup on unmount
      return () => {
        if (animation) {
          animation.stopAnimations();
        }
      };
    }
  }, [map, updateToolFeedback]);

  // Pass nodeAnimation to children
  const childrenWithAnimation = React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child, { nodeAnimation });
    }
    return child;
  });

  return <>{childrenWithAnimation}</>;
};

export default AnimationIntegrationExample;
