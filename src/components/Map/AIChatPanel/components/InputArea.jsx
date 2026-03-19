import React from 'react';
import { InputArea as StyledInputArea, Input } from '../StyledComponents';

const InputArea = ({ inputValue, setInputValue, handleSubmit }) => {
  return (
    <StyledInputArea>
      <form onSubmit={handleSubmit}>
        <Input
          type="text"
          placeholder="Ask a question about LA's urban landscape..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
      </form>
    </StyledInputArea>
  );
};

export default InputArea; 