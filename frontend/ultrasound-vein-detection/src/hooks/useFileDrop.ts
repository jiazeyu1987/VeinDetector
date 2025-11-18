import React, { useState, useCallback } from 'react';

interface UseFileDropProps {
  onFileDrop: (files: File[]) => void;
  accept?: string[];
  multiple?: boolean;
}

interface UseFileDropReturn {
  isDragOver: boolean;
  dragOverCount: number;
  fileInputProps: {
    onDrop: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragEnter: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
  };
  openFileDialog: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
}

export const useFileDrop = ({
  onFileDrop,
  accept = ['*'],
  multiple = false,
}: UseFileDropProps): UseFileDropReturn => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragOverCount, setDragOverCount] = useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverCount(prev => prev + 1);
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverCount(prev => {
      const newCount = prev - 1;
      if (newCount <= 0) {
        setIsDragOver(false);
        return 0;
      }
      return newCount;
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragOver(false);
    setDragOverCount(0);

    const files = Array.from(e.dataTransfer.files);
    
    // 过滤文件类型
    const filteredFiles = accept.includes('*') 
      ? files 
      : files.filter(file => {
          const fileType = file.type;
          const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
          return accept.some(acceptedType => {
            if (acceptedType.startsWith('.')) {
              return fileExtension === acceptedType.toLowerCase();
            }
            return fileType === acceptedType;
          });
        });

    if (filteredFiles.length > 0) {
      onFileDrop(multiple ? filteredFiles : [filteredFiles[0]]);
    }
  }, [accept, multiple, onFileDrop]);

  const openFileDialog = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return {
    isDragOver,
    dragOverCount,
    fileInputProps: {
      onDrop: handleDrop,
      onDragOver: handleDragOver,
      onDragEnter: handleDragEnter,
      onDragLeave: handleDragLeave,
    },
    openFileDialog,
    inputRef,
  };
};

export default useFileDrop;