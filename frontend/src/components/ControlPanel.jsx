import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './ui/collapsible';
import { ChevronsUpDown } from 'lucide-react';

const ControlPanel = ({
  hypergraphMode,
  handleHypergraphModeChange,
  applyLayeredLayout,
  applyCircleLayout,
  applyGridLayout,
  applyCoseLayout,
  cyRef,
}) => {
  const [isOpen, setIsOpen] = React.useState(true);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="w-full max-w-sm">
        <CardHeader className="p-4">
          <div className="flex items-center justify-between">
            <CardTitle>Controls</CardTitle>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-9 p-0">
                <ChevronsUpDown className="h-4 w-4" />
                <span className="sr-only">Toggle</span>
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="p-4">
            <div className="space-y-4">
              <div>
                <h4 className="mb-2 font-semibold">Hypergraph Mode</h4>
                <div className="flex space-x-2">
                  <Button
                    onClick={() => handleHypergraphModeChange('none')}
                    variant={hypergraphMode === 'none' ? 'secondary' : 'outline'}
                    size="sm"
                  >
                    None
                  </Button>
                  <Button
                    onClick={() => handleHypergraphModeChange('type')}
                    variant={hypergraphMode === 'type' ? 'secondary' : 'outline'}
                    size="sm"
                  >
                    Group by Type
                  </Button>
                  <Button
                    onClick={() => handleHypergraphModeChange('community')}
                    variant={hypergraphMode === 'community' ? 'secondary' : 'outline'}
                    size="sm"
                  >
                    Community
                  </Button>
                </div>
              </div>
              <div>
                <h4 className="mb-2 font-semibold">Layouts</h4>
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={() => applyLayeredLayout(cyRef.current)} variant="outline" size="sm">
                    Layered
                  </Button>
                  <Button onClick={() => applyCircleLayout(cyRef.current)} variant="outline" size="sm">
                    Circle
                  </Button>
                  <Button onClick={() => applyGridLayout(cyRef.current)} variant="outline" size="sm">
                    Grid
                  </Button>
                  <Button onClick={() => applyCoseLayout(cyRef.current)} variant="outline" size="sm">
                    Cose
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default ControlPanel;
