import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const TopStatusBar = ({ 
  sidebarOpen, 
  onToggleSidebar, 
  theme, 
  onThemeToggle, 
  currentAOP, 
  visibleNodes = [], 
  visibleEdges = []
}) => {
  // Calculate counts from visible nodes/edges since graphData is not passed
  const displayNodes = visibleNodes.length;
  const displayEdges = visibleEdges.length;

  return (
    <Card className="mx-4 mt-4 p-3">
      <div className="flex items-center justify-between">
        {/* Left side - Current AOP */}
        <div className="flex items-center space-x-4">
          <div className="text-sm font-medium text-gray-600">
            Current AOP: <span className="font-bold text-gray-900">{currentAOP || 'None'}</span>
          </div>
          {/* Network Stats */}
          <div className="flex items-center space-x-2 text-sm">
            <span className="text-gray-600">
              Nodes: <span className="font-semibold">{displayNodes}</span>
            </span>
            <span>•</span>
            <span className="text-gray-600">
              Edges: <span className="font-semibold">{displayEdges}</span>
            </span>
          </div>
        </div>

        {/* Right side - Status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm">
              {currentAOP ? `AOP: ${currentAOP}` : 'No AOP Selected'}
            </span>
            <span className="text-xs text-muted-foreground">
              ({displayNodes} nodes, {displayEdges} edges)
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default TopStatusBar;
