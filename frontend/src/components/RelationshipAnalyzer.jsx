import React, { useState } from 'react';
import { Download, FileText, Database } from 'lucide-react';

const RelationshipAnalyzer = ({ nodes = [], onAnalysisResult }) => {
  const [selectedNodes, setSelectedNodes] = useState([]);
  const [analysisQuery, setAnalysisQuery] = useState('');
  const [analysisResults, setAnalysisResults] = useState(null);
  const [nodeSearchTerm, setNodeSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    nodes: true,
    analysis: true
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const addNode = (node) => {
    if (!selectedNodes.find(n => n.id === node.id)) {
      setSelectedNodes(prev => [...prev, node]);
    }
  };

  const removeNode = (nodeId) => {
    setSelectedNodes(prev => prev.filter(n => n.id !== nodeId));
  };

  const filteredNodes = Array.isArray(nodes) ? nodes.filter(node =>
    node.label?.toLowerCase().includes(nodeSearchTerm.toLowerCase()) ||
    node.type?.toLowerCase().includes(nodeSearchTerm.toLowerCase())
  ).slice(0, 20) : [];

  const performAdvancedAnalysis = async () => {
    if (selectedNodes.length === 0 || !analysisQuery.trim()) return;

    setLoading(true);
    try {
      const response = await fetch('http://localhost:5001/perplexity_analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selected_nodes: selectedNodes,
          query: analysisQuery.trim(),
          include_web_search: true
        }),
      });

      const data = await response.json();
      
      if (data.error) {
        setAnalysisResults({
          error: data.error,
          timestamp: new Date().toISOString()
        });
      } else {
        setAnalysisResults({
          ...data,
          selected_nodes: selectedNodes,
          query: analysisQuery.trim(),
          timestamp: new Date().toISOString()
        });
      }
      
      if (onAnalysisResult) {
        onAnalysisResult(data);
      }
    } catch (error) {
      console.error('Analysis error:', error);
      setAnalysisResults({
        error: `Failed to perform analysis: ${error.message}`,
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  // Export functions
  const exportToMarkdown = () => {
    if (!analysisResults) return;
    
    let markdown = `# AOP Analysis Report\n\n`;
    markdown += `**Generated:** ${new Date(analysisResults.timestamp).toLocaleString()}\n\n`;
    markdown += `**Query:** ${analysisResults.query}\n\n`;
    
    if (analysisResults.selected_nodes && analysisResults.selected_nodes.length > 0) {
      markdown += `## Selected Nodes\n\n`;
      analysisResults.selected_nodes.forEach(node => {
        markdown += `- **${node.label}** (${node.type})\n`;
      });
      markdown += `\n`;
    }
    
    if (analysisResults.ai_analysis) {
      markdown += `## Analysis\n\n${analysisResults.ai_analysis}\n\n`;
    }
    
    if (analysisResults.references && analysisResults.references.length > 0) {
      markdown += `## References\n\n`;
      analysisResults.references.forEach((ref, index) => {
        markdown += `${index + 1}. [${ref.title}](${ref.url})\n`;
      });
    }
    
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aop-analysis-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportToJSON = () => {
    if (!analysisResults) return;
    
    const exportData = {
      ...analysisResults,
      exported_at: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aop-analysis-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full p-4 border rounded-lg">
      <div className="mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          🔬 AOP Intelligence Analyzer
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Advanced AI-powered analysis of AOP networks and molecular pathways
        </p>
      </div>
      
      {/* Status */}
      <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
        <p className="text-sm text-green-700">
          ✅ Component Active - Available nodes: {nodes.length}
        </p>
      </div>

      {/* Node Selection */}
      <div className="mb-4 border rounded-lg p-3">
        <div 
          className="flex items-center justify-between cursor-pointer mb-3"
          onClick={() => toggleSection('nodes')}
        >
          <h4 className="font-medium">Selected Nodes ({selectedNodes.length})</h4>
          <span className={`text-sm ${expandedSections.nodes ? '▼' : '▶'}`}>
            {expandedSections.nodes ? '▼' : '▶'}
          </span>
        </div>
        
        {expandedSections.nodes && (
          <div className="space-y-3">
            {/* Selected nodes display */}
            <div className="flex flex-wrap gap-2">
              {selectedNodes.map(node => (
                <span 
                  key={node.id} 
                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm"
                >
                  {node.label}
                  <button 
                    className="text-red-600 hover:text-red-800 ml-1"
                    onClick={() => removeNode(node.id)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            
            {/* Search and add nodes */}
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Search nodes..."
                value={nodeSearchTerm}
                onChange={(e) => setNodeSearchTerm(e.target.value)}
                className="w-full p-2 border rounded text-sm"
              />
              <div className="max-h-32 overflow-y-auto border rounded p-2 space-y-1">
                {filteredNodes.map(node => (
                  <div 
                    key={node.id}
                    className="flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer"
                    onClick={() => addNode(node)}
                  >
                    <div className="flex-1">
                      <div className="font-medium text-sm">{node.label}</div>
                      <div className="text-xs text-gray-500">{node.type}</div>
                    </div>
                    <span className="text-gray-400">+</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Analysis Query */}
      <div className="mb-4 border rounded-lg p-3">
        <div 
          className="flex items-center justify-between cursor-pointer mb-3"
          onClick={() => toggleSection('analysis')}
        >
          <h4 className="font-medium">Analysis Query</h4>
          <span className={`text-sm ${expandedSections.analysis ? '▼' : '▶'}`}>
            {expandedSections.analysis ? '▼' : '▶'}
          </span>
        </div>
        
        {expandedSections.analysis && (
          <div className="space-y-3">
            <textarea
              placeholder="Ask about molecular mechanisms, pathways, or research..."
              value={analysisQuery}
              onChange={(e) => setAnalysisQuery(e.target.value)}
              rows={3}
              className="w-full p-2 border rounded text-sm"
            />
            
            <button 
              onClick={performAdvancedAnalysis}
              disabled={loading || selectedNodes.length === 0 || !analysisQuery.trim()}
              className={`w-full p-2 rounded text-white flex items-center justify-center gap-2 ${
                loading || selectedNodes.length === 0 || !analysisQuery.trim()
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading ? (
                <>
                  ⏳ Analyzing...
                </>
              ) : (
                <>
                  🚀 🌐 Analyze with AI
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      {analysisResults && (
        <div className="border rounded-lg p-4 bg-blue-50">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium flex items-center gap-2">
              📊 Analysis Results
            </h4>
            
            {/* Export Buttons */}
            {!analysisResults.error && (
              <div className="flex gap-2">
                <button
                  onClick={exportToMarkdown}
                  className="flex items-center gap-1 px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  title="Export as Markdown"
                >
                  <FileText className="w-3 h-3" />
                  MD
                </button>
                <button
                  onClick={exportToJSON}
                  className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  title="Export as JSON"
                >
                  <Database className="w-3 h-3" />
                  JSON
                </button>
              </div>
            )}
          </div>
          
          {analysisResults.error ? (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              <strong>Error:</strong> {analysisResults.error}
            </div>
          ) : (
            <div className="space-y-4">
              {analysisResults.ai_analysis && (
                <div className="text-sm whitespace-pre-wrap p-3 bg-white rounded border">
                  {analysisResults.ai_analysis}
                </div>
              )}

              {analysisResults.references && analysisResults.references.length > 0 && (
                <div>
                  <h5 className="font-medium text-sm mb-2">🔗 References:</h5>
                  <div className="space-y-2">
                    {analysisResults.references.map((ref, index) => (
                      <div key={index} className="p-2 bg-white rounded border">
                        <a 
                          href={ref.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 text-sm hover:underline"
                        >
                          {ref.title} 🔗
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RelationshipAnalyzer;
