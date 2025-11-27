import { useEffect, useRef, useCallback } from 'react';

interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  callback: () => void;
  preventDefault?: boolean;
  debounceMs?: number;
}

interface ExecutionState {
  isExecuting: boolean;
  lastExecutionTime: number;
}

export const useKeyboardShortcuts = (shortcuts: KeyboardShortcut[]) => {
  const shortcutsRef = useRef(shortcuts);
  const executionStateRef = useRef<Record<string, ExecutionState>>({});
  const timeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});

  // 创建防抖版本的回调
  const createDebouncedCallback = useCallback((shortcut: KeyboardShortcut, key: string) => {
    return (...args: any[]) => {
      const executionKey = `${shortcut.key}-${shortcut.ctrlKey ? 'ctrl' : ''}-${shortcut.shiftKey ? 'shift' : ''}-${shortcut.altKey ? 'alt' : ''}`;
      const state = executionStateRef.current[executionKey] || { isExecuting: false, lastExecutionTime: 0 };

      // 检查是否正在执行
      if (state.isExecuting) {
        console.log('Keyboard shortcut execution blocked:', executionKey);
        return;
      }

      // 防抖逻辑
      const now = Date.now();
      const timeSinceLastExecution = now - state.lastExecutionTime;
      const debounceMs = shortcut.debounceMs || 300;

      if (timeSinceLastExecution < debounceMs) {
        // 清除之前的超时并设置新的
        if (timeoutsRef.current[executionKey]) {
          clearTimeout(timeoutsRef.current[executionKey]);
        }

        timeoutsRef.current[executionKey] = setTimeout(() => {
          executionStateRef.current[executionKey] = { isExecuting: false, lastExecutionTime: 0 };
        }, debounceMs);

        return;
      }

      // 执行回调
      executionStateRef.current[executionKey] = { isExecuting: true, lastExecutionTime: now };

      try {
        shortcut.callback(...args);
      } finally {
        // 延迟重置执行状态，防止快速连续调用
        setTimeout(() => {
          executionStateRef.current[executionKey] = { isExecuting: false, lastExecutionTime: now };
        }, 100);
      }
    };
  }, []);

  useEffect(() => {
    shortcutsRef.current = shortcuts;

    // 清理超时
    return () => {
      Object.values(timeoutsRef.current).forEach(timeout => clearTimeout(timeout));
      timeoutsRef.current = {};
    };
  }, [shortcuts]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      for (const shortcut of shortcutsRef.current) {
        if (
          event.key.toLowerCase() === shortcut.key.toLowerCase() &&
          !!event.ctrlKey === !!shortcut.ctrlKey &&
          !!event.shiftKey === !!shortcut.shiftKey &&
          !!event.altKey === !!shortcut.altKey
        ) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }

          // 使用防抖版本的回调
          const debouncedCallback = createDebouncedCallback(shortcut, 'keydown');
          debouncedCallback();
          break;
        }
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      // 重置所有执行状态，允许按键松开后立即重新触发
      for (const shortcut of shortcutsRef.current) {
        const executionKey = `${shortcut.key}-${shortcut.ctrlKey ? 'ctrl' : ''}-${shortcut.shiftKey ? 'shift' : ''}-${shortcut.altKey ? 'alt' : ''}`;
        if (executionStateRef.current[executionKey]) {
          executionStateRef.current[executionKey] = { isExecuting: false, lastExecutionTime: 0 };
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);

      // 清理超时
      Object.values(timeoutsRef.current).forEach(timeout => clearTimeout(timeout));
      timeoutsRef.current = {};
    };
  }, [createDebouncedCallback]);

  return executionStateRef;
};

export default useKeyboardShortcuts;