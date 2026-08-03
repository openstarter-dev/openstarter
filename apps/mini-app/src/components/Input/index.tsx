import { View, Input as TaroInput, Text } from '@tarojs/components';
import './index.scss';

interface InputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'password';
  error?: string;
  name?: string;
}

export default function Input({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  error,
  name,
}: InputProps) {
  return (
    <View className="input-group">
      {label && <Text className="input-group__label">{label}</Text>}
      <TaroInput
        className={`input-group__input${error ? ' input-group__input--error' : ''}`}
        value={value}
        onInput={(e) => onChange(e.detail.value)}
        placeholder={placeholder}
        password={type === 'password'}
        name={name}
      />
      {error && <Text className="input-group__error">{error}</Text>}
    </View>
  );
}