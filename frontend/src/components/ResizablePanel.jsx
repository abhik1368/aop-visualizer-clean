import React, { useState, useRef, useEffect } from 'react';

const ResizablePanel = ({ 
  children, 
  side = 'left', // 'left' or 'right'
  initialWidth = 300,
  minWidth = 200,
  maxWidth = 600,
  className = ''
}) => {
  const [width, setWidth] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = (e) => {
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = width;
    
    // Prevent text selection during resize
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  };

  const handleMouseMove = (e) => {
    if (!isResizing) return;

    const deltaX = e.clientX - startXRef.current;
    let newWidth;

    if (side === 'left') {
      newWidth = startWidthRef.current + deltaX;
    } else {
      newWidth = startWidthRef.current - deltaX;
    }

    // Apply constraints
    newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
    setWidth(newWidth);
  };

  const handleMouseUp = () => {
    setIsResizing(false);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  };

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, width]);

  const resizerStyle = side === 'left' 
    ? { right: -2, cursor: 'col-resize' }
    : { left: -2, cursor: 'col-resize' };

  return (
    <div 
      ref={panelRef}
      className={`relative ${className}`}
      style={{ width: `${width}px`, flexShrink: 0 }}
    >
      {children}
      
      {/* Resize handle */}
      <div
        className={`absolute top-0 bottom-0 w-1 bg-gray-300 hover:bg-blue-500 transition-colors duration-200 ${
          isResizing ? 'bg-blue-500' : ''
        }`}
        style={resizerStyle}
        onMouseDown={handleMouseDown}
      >
        {/* Visual indicator */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1 h-8 bg-gray-400 rounded-full opacity-60" />
      </div>
    </div>
  );
};

export default ResizablePanel;
