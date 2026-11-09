import React, { useState, useEffect } from 'react';
import { evaluateExpression } from '../../utils/evaluateExpression';

interface EvaluatedInputProps {
  initialValue: string;
  onCommit: (value: string) => void;
  onCancel?: () => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  type?: string;
  autoFocus?: boolean;
}

const EvaluatedInput: React.FC<EvaluatedInputProps> = ({
  initialValue,
  onCommit,
  onCancel,
  ...inputProps
}) => {
  const [editValue, setEditValue] = useState(initialValue);

  useEffect(() => {
    setEditValue(initialValue);
  }, [initialValue]);

  const commit = () => {
    const computed = evaluateExpression(editValue);
    const finalValue = isNaN(computed) ? editValue : computed.toString();
    setEditValue(finalValue);
    onCommit(finalValue);
  };

  const cancel = () => {
    setEditValue(initialValue);
    onCancel?.();
  };

  return (
    <input
      type="text"
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit();
        } else if (e.key === 'Escape') {
          cancel();
        }
      }}
      {...inputProps}
    />
  );
};

export default EvaluatedInput;
