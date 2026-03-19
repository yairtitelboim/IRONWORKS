import React from 'react';
import { Sparkles, Brain, Zap, Cpu } from 'lucide-react';
import {
  ModelSelectContainer,
  ModelIcon,
  ModelSelect,
  StyledOption,
  LoadingDots,
  LoadingDot,
  ModelLoadingIndicator
} from '../StyledComponents';
import { MODEL_COLORS } from '../mockData';

const ModelSelector = ({ 
  selectedModel, 
  handleModelChange
}) => {
  // Helper function to get the icon for each model
  const getModelIcon = (modelId) => {
    switch(modelId) {
      case 'gpt4':
        return <Sparkles />;
      case 'claude3':
        return <Brain />;
      case 'llama3':
        return <Zap />;
      case 'deepseek':
        return <Cpu />;
      default:
        return <Sparkles />;
    }
  };

  // Helper function to apply the model color theme to elements
  const getModelTheme = () => {
    return MODEL_COLORS[selectedModel] || MODEL_COLORS.claude3;
  };
  
  return (
    <ModelSelectContainer 
      $bgColor={getModelTheme()} 
      className="model-select-container"
    >
      <ModelIcon>
        {getModelIcon(selectedModel)}
      </ModelIcon>
      <ModelSelect 
        value={selectedModel} 
        onChange={handleModelChange}
        className="model-select"
      >
        <StyledOption value="gpt4" $bgColor={MODEL_COLORS.gpt4 + '30'}>
          GPT-4
        </StyledOption>
        <StyledOption value="claude3" $bgColor={MODEL_COLORS.claude3 + '30'}>
          Claude 3
        </StyledOption>
        <StyledOption value="llama3" $bgColor={MODEL_COLORS.llama3 + '30'}>
          Llama 3
        </StyledOption>
        <StyledOption value="deepseek" $bgColor={MODEL_COLORS.deepseek + '30'}>
          DeepSeek
        </StyledOption>
      </ModelSelect>
      <LoadingDots>
        <LoadingDot $delay="0s" />
        <LoadingDot $delay="0.2s" />
        <LoadingDot $delay="0.4s" />
      </LoadingDots>
      <ModelLoadingIndicator $bgColor={getModelTheme()} />
    </ModelSelectContainer>
  );
};

export default ModelSelector; 