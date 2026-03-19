import React, { useEffect, useRef, memo } from 'react';
import { 
  Rocket, 
  Wand2, 
  ChevronRight, 
  Home,
  Scale,
  Map
} from 'lucide-react';
import { 
  InitialPrompt, 
  AnimatedDiv, 
  QuestionButton, 
  QuestionIcon, 
  SeeMoreButton 
} from '../StyledComponents';
import { MODEL_COLORS } from '../mockData';

// Create a ref accessible outside the component to reference the instance
// This allows us to manipulate the DOM without needing re-renders
const questionsContainerRef = React.createRef();

const InitialQuestions = ({ 
  handlePredefinedQuestion, 
  selectedModel,
  isDiffusionActive
}) => {
  
  // Create refs to access buttons for animation
  const buttonRefs = useRef([]);
  const initialRender = useRef(true);
  const componentInstanceId = useRef(`questions-${Math.random().toString(36).substring(2, 9)}`);

  // Helper function to apply the model color theme to elements
  const getModelTheme = () => {
    const theme = MODEL_COLORS[selectedModel] || MODEL_COLORS.claude3;
    return theme;
  };

  // Helper function to convert hex color to RGB
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? 
      `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : 
      '0, 136, 204'; // Default fallback color
  };

  // Add a data attribute to help identify this component instance
  useEffect(() => {
    if (questionsContainerRef.current) {
      questionsContainerRef.current.setAttribute('data-instance-id', componentInstanceId.current);
      
      // Apply accent colors for all buttons on initial render
      const modelColor = MODEL_COLORS[selectedModel] || MODEL_COLORS.claude3;
      document.querySelectorAll('.initial-question').forEach(button => {
        button.classList.add('model-accent-active');
      });
    }
  }, []);

  // Effect to update button properties when model changes
  useEffect(() => {
    
    if (!initialRender.current) {
      
      // Debug current button states
      buttonRefs.current.forEach((buttonRef, index) => {
        if (buttonRef) {
        }
      });
    } else {
      initialRender.current = false;
      
      // Debug initial setup
      if (questionsContainerRef.current) {
        const buttons = questionsContainerRef.current.querySelectorAll('.initial-question');
      }
    }
  }, [selectedModel]);

  // Update diffusion state on buttons - No longer needed since we're using props
  

  // Add debug log before render
  

  // Add a click handler wrapper
  const handleQuestionClick = (questionText, buttonIndex) => {
    
    // Get the clicked button directly by index
    const button = buttonRefs.current[buttonIndex];
    
    if (button) {
      button.classList.add('clicking');
      
      // Let the click animation complete before handling the question
      setTimeout(() => {
        button.classList.remove('clicking');
        
        // Small delay before starting model change
        setTimeout(() => {
          handlePredefinedQuestion(questionText);
        }, 50);
      }, 150); // Match this to the animation duration
    } else {
      handlePredefinedQuestion(questionText);
    }
  };

  // Helper for consistent styling with logging
  const getDiffusionStyles = (index) => {
    // No longer need to apply styles inline as we're using pseudo-elements
    // The class will handle the styling
    const styles = isDiffusionActive ? {
      position: 'relative'
    } : {};
    
    return styles;
  };
  
  // Helper for consistent class naming with logging
  const getButtonClassName = (index) => {
    const className = `initial-question ${isDiffusionActive ? 'diffusion-active' : ''}`;
    return className;
  };

  return (
    <div ref={questionsContainerRef} className="questions-container">
      <InitialPrompt>
        <div style={{ 
          fontSize: '26px', 
          marginBottom: '50px',
          marginTop: '15px',
          fontWeight: 700,
          fontFamily: "'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          lineHeight: 1.4,
        }}>
          Navigate Boston's startup ecosystem: <span style={{ fontWeight: 900, color: '#fffdfa' }}>Uncovering hidden innovation potential</span>
        </div>
      </InitialPrompt>

      <AnimatedDiv $delay={0} style={{ marginTop: '30px', marginBottom: '20px' }} className="AnimatedDiv">
        <QuestionButton 
          ref={el => {
            buttonRefs.current[0] = el;
          }}
          onClick={() => handleQuestionClick("Analyze Boston startup ecosystem innovation potential", 0)}
          $accentColor={getModelTheme()}
          $iconGlow={getModelTheme()}
          $modelColorRgb={hexToRgb(getModelTheme())}
          $bgGradient={`linear-gradient(135deg, ${getModelTheme()}20, ${getModelTheme()}20)`}
          $hoverBgGradient={`linear-gradient(135deg, ${getModelTheme()}30, ${getModelTheme()}40)`}
          $isDiffusionActive={isDiffusionActive}
          className={getButtonClassName(0)}
          style={getDiffusionStyles(0)}
        >
          <QuestionIcon $animationType="pulse" $color={getModelTheme()} className="QuestionIcon">
            <Rocket strokeWidth={1.5} />
          </QuestionIcon>
          <span key={`diffusion-${isDiffusionActive ? 'active' : 'inactive'}-0`}>Identify startup ecosystem opportunities with highest innovation potential</span>
        </QuestionButton>
      </AnimatedDiv>

      <AnimatedDiv $delay={0} style={{ marginBottom: '20px' }} className="AnimatedDiv">
        <QuestionButton 
          ref={el => buttonRefs.current[1] = el}
          onClick={() => handleQuestionClick("Finding Downtown parcels with the highest emergency resilience potential...", 1)}
          $accentColor={getModelTheme()}
          $iconGlow={getModelTheme()}
          $modelColorRgb={hexToRgb(getModelTheme())}
          $bgGradient={`linear-gradient(135deg, ${getModelTheme()}20, ${getModelTheme()}20)`}
          $hoverBgGradient={`linear-gradient(135deg, ${getModelTheme()}30, ${getModelTheme()}40)`}
          $isDiffusionActive={isDiffusionActive}
          className={getButtonClassName(1)}
          style={getDiffusionStyles(1)}
        >
          <QuestionIcon $animationType="rotate" $color={getModelTheme()} className="QuestionIcon">
            <Wand2 strokeWidth={1.5} />
          </QuestionIcon>
          <span key={`diffusion-${isDiffusionActive ? 'active' : 'inactive'}-1`}>Which Downtown parcels have highest emergency resilience potential?</span>
        </QuestionButton>
      </AnimatedDiv>

      <AnimatedDiv $delay={0} style={{ marginBottom: '20px' }} className="AnimatedDiv">
        <QuestionButton 
          ref={el => buttonRefs.current[2] = el}
          onClick={() => handleQuestionClick("Which neighborhoods would transform with just one policy change?", 2)}
          $accentColor={getModelTheme()}
          $iconGlow={getModelTheme()}
          $modelColorRgb={hexToRgb(getModelTheme())}
          $bgGradient={`linear-gradient(135deg, ${getModelTheme()}20, ${getModelTheme()}20)`}
          $hoverBgGradient={`linear-gradient(135deg, ${getModelTheme()}30, ${getModelTheme()}40)`}
          $isDiffusionActive={isDiffusionActive}
          className={getButtonClassName(2)}
          style={getDiffusionStyles(2)}
        >
          <QuestionIcon $animationType="rotate" $color={getModelTheme()} className="QuestionIcon">
            <Scale strokeWidth={1.5} />
          </QuestionIcon>
          <span key={`diffusion-${isDiffusionActive ? 'active' : 'inactive'}-2`}>Which neighborhoods need only single zoning changes to connect isolated areas?</span>
        </QuestionButton>
      </AnimatedDiv>
      
      <AnimatedDiv $delay={0} style={{ marginBottom: '20px' }} className="AnimatedDiv">
        <QuestionButton 
          ref={el => buttonRefs.current[3] = el}
          onClick={() => handleQuestionClick("Map housing opportunity gaps near job centers", 3)}
          $accentColor={getModelTheme()}
          $iconGlow={getModelTheme()}
          $modelColorRgb={hexToRgb(getModelTheme())}
          $bgGradient={`linear-gradient(135deg, ${getModelTheme()}20, ${getModelTheme()}20)`}
          $hoverBgGradient={`linear-gradient(135deg, ${getModelTheme()}30, ${getModelTheme()}40)`}
          $isDiffusionActive={isDiffusionActive}
          className={getButtonClassName(3)}
          style={getDiffusionStyles(3)}
        >
          <QuestionIcon $animationType="pulse" $color={getModelTheme()} className="QuestionIcon">
            <Home strokeWidth={1.5} />
          </QuestionIcon>
          <span key={`diffusion-${isDiffusionActive ? 'active' : 'inactive'}-3`}>Map optimal sites balancing housing needs and emergency services</span>
        </QuestionButton>
      </AnimatedDiv>
      
      <AnimatedDiv $delay={0} style={{ marginBottom: '100px' }} className="AnimatedDiv">
        <SeeMoreButton 
          ref={el => buttonRefs.current[4] = el}
          onClick={() => handleQuestionClick("Show me more policy optimization opportunities", 4)}
          $modelColorRgb={hexToRgb(getModelTheme())}
          $isDiffusionActive={isDiffusionActive}
          className={getButtonClassName(4)}
          style={getDiffusionStyles(4)}
        >
          <QuestionIcon $animationType="bounce" $color={getModelTheme()} className="QuestionIcon">
            <ChevronRight strokeWidth={1.5} />
          </QuestionIcon>
          <span key={`diffusion-${isDiffusionActive ? 'active' : 'inactive'}-4`}>See more options</span>
        </SeeMoreButton>
      </AnimatedDiv>
    </div>
  );
};

// Use React.memo with a comparison function that only prevents re-renders for model changes
// but allows re-renders when diffusion state changes
const MemoizedInitialQuestions = memo(InitialQuestions, (prevProps, nextProps) => {
  
  // If diffusion state changed, allow re-render
  if (prevProps.isDiffusionActive !== nextProps.isDiffusionActive) {
    return false; // false means "do not prevent re-render"
  }
  
  // For other changes (like model), prevent re-renders
  return true; // true means "prevent re-render"
});

// Export the component and the ref to access it
export default MemoizedInitialQuestions;
export { questionsContainerRef }; 