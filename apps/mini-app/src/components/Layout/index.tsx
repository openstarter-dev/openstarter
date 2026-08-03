import { View } from '@tarojs/components';
import { ReactNode } from 'react';
import './index.scss';

interface LayoutProps {
  children: ReactNode;
  loading?: boolean;
  className?: string;
}

export default function Layout({ children, loading = false, className = '' }: LayoutProps) {
  return (
    <View className={`layout ${className}`}>
      {loading ? (
        <View className="layout__loading">
          <View className="layout__loading-spinner" />
        </View>
      ) : (
        children
      )}
    </View>
  );
}