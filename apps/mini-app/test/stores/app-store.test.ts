import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../src/stores/app-store';

describe('app-store', () => {
  beforeEach(() => {
    useAppStore.setState({ isReady: false });
  });

  it('should start with isReady false', () => {
    expect(useAppStore.getState().isReady).toBe(false);
  });

  it('should set isReady to true', () => {
    useAppStore.getState().setReady();
    expect(useAppStore.getState().isReady).toBe(true);
  });
});