import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { 
  Brain, 
  Search, 
  FileText, 
  ExternalLink, 
  Loader2,
  AlertCircle,
  CheckCircle,
  BookOpen,
  Microscope
} from 'lucide-react';

// Context type options for scientific analysis
const contextTypes = [
  { value: 'general', label: 'General Analysis', description: 'Broad scientific context' },
  { value: 'pathway', label: 'Pathway Analysis', description: 'Focus on biological pathways' },
  { value: 'mechanism', label: 'Mechanism Study', description: 'Molecular mechanisms and interactions' },
  { value: 'toxicology', label: 'Toxicology Focus', description: 'Adverse outcome pathways and toxicity' },
  { value: 'disease', label: 'Disease Context', description: 'Disease associations and outcomes' },
  { value: 'regulation', label: 'Regulatory Science', description: 'Regulatory implications and guidelines' },
  { value: 'drug_analysis', label: 'Drug Analysis', description: 'Drug modulation of MIE, KE, and AOP pathways' }
];

const PerplexityAnalysisPanel = ({ 
  graphData = null,
  selectedNode = null,
  analysisResult = null,
  setAnalysisResult = () => {},
  analysisLoading = false,
  setAnalysisLoading = () => {},
  analysisError = null,
  setAnalysisError = () => {}
}) => {
  const [query, setQuery] = useState('');
  const [contextType, setContextType] = useState('general');
  const [showMoreAnalysis, setShowMoreAnalysis] = useState(false);
  const [moreAnalysisResult, setMoreAnalysisResult] = useState(null);
  const [moreAnalysisLoading, setMoreAnalysisLoading] = useState(false);

  // Function to parse and extract references from content
  const parseReferences = (content) => {
    if (!content) return { contentWithoutRefs: content, references: [] };
    
    // Extract references in format [1], [2], etc. and URLs
    const referencePattern = /\[(\d+)\]/g;
    const urlPattern = /(https?:\/\/[^\s\)\]]+)/g;
    
    const references = [];
    const urls = [];
    
    // Extract URLs
    let urlMatch;
    while ((urlMatch = urlPattern.exec(content)) !== null) {
      urls.push({
        url: urlMatch[1],
        index: urlMatch.index
      });
    }
    
    // Extract numbered references
    let refMatch;
    const refNumbers = new Set();
    while ((refMatch = referencePattern.exec(content)) !== null) {
      refNumbers.add(parseInt(refMatch[1]));
    }
    
    // Create reference objects
    Array.from(refNumbers).sort((a, b) => a - b).forEach((num, idx) => {
      references.push({
        number: num,
        title: `Reference ${num}`,
        url: urls[idx]?.url || `https://pubmed.ncbi.nlm.nih.gov/?term=reference+${num}`,
        searchTerm: query.split(' ').slice(0, 3).join(' ') // Use first 3 words of query
      });
    });
    
    return { contentWithoutRefs: content, references };
  };
  
  // Function to highlight bioentities in text
  const highlightBioentities = (text) => {
    if (!text) return text;
    
    // Define bioentity patterns
    const patterns = {
      genes: /\b([A-Z][A-Z0-9]{2,}|[A-Z][a-z]+[0-9]+|p53|BRCA[12]|TNF-α|IL-[0-9]+|NF-κB|PPAR-γ)\b/g,
      diseases: /\b(cancer|carcinoma|fibrosis|necrosis|apoptosis|inflammation|toxicity|hepatotoxicity|neurotoxicity|nephrotoxicity|cardiotoxicity|genotoxicity|mutagenicity|teratogenicity)\b/gi,
      compounds: /\b([A-Z][a-z]+-?[0-9]*|acetaminophen|paracetamol|benzene|toluene|formaldehyde|methanol|ethanol|glucose|ATP|NADH|glutathione)\b/g,
      pathways: /\b(oxidative phosphorylation|glycolysis|gluconeogenesis|fatty acid oxidation|electron transport chain|citric acid cycle|pentose phosphate pathway|ubiquitin-proteasome|autophagy|endoplasmic reticulum stress)\b/gi,
      verbs: /\b(activate|inhibit|induce|suppress|upregulate|downregulate|phosphorylate|dephosphorylate|methylate|acetylate|ubiquitinate|oxidize|reduce|metabolize|catalyze|bind|interact|regulate|modulate)\b/gi
    };
    
    const colors = {
      genes: 'bg-blue-100 text-blue-800 border-blue-200',
      diseases: 'bg-red-100 text-red-800 border-red-200', 
      compounds: 'bg-green-100 text-green-800 border-green-200',
      pathways: 'bg-purple-100 text-purple-800 border-purple-200',
      verbs: 'bg-orange-100 text-orange-800 border-orange-200'
    };
    
    let highlightedText = text;
    
    // Apply highlighting for each category
    Object.entries(patterns).forEach(([category, pattern]) => {
      highlightedText = highlightedText.replace(pattern, (match) => {
        return `<span class="inline-block px-1 py-0.5 text-xs rounded border ${colors[category]} font-medium" title="${category.slice(0, -1)}">${match}</span>`;
      });
    });
    
    return highlightedText;
  };
  
  // Function to render content with clickable reference links and bioentity highlighting
  const renderContentWithLinks = (content, citations = []) => {
    if (!content) return content;
    
    // First highlight bioentities
    const highlightedContent = highlightBioentities(content);
    
    // Replace [1], [2], etc. with clickable links
    const referencePattern = /\[(\d+)\]/g;
    const parts = highlightedContent.split(referencePattern);
    
    return parts.map((part, index) => {
      // Check if this part is a reference number
      if (index % 2 === 1) {
        const refNum = parseInt(part);
        
        // Try to get the actual citation URL (array is 0-indexed, references are 1-indexed)
        const citationUrl = citations[refNum - 1];
        const actualUrl = typeof citationUrl === 'string' ? citationUrl : citationUrl?.url;
        
        // If we have an actual citation URL, use it; otherwise fall back to keyword search
        const linkUrl = actualUrl || `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(query.split(' ').slice(0, 3).join(' ') + ' reference ' + refNum)}`;
        const linkTitle = actualUrl ? `View citation ${refNum}` : `Search PubMed for reference ${refNum}`;
        
        return (
          <a
            key={index}
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center px-1 py-0.5 text-xs rounded hover:bg-primary/20 transition-colors ${
              actualUrl ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-primary/10 text-primary'
            }`}
            title={linkTitle}
          >
            [{refNum}]
            <ExternalLink className="h-3 w-3 ml-0.5" />
          </a>
        );
      }
      // Return part with HTML (for bioentity highlights)
      return <span key={index} dangerouslySetInnerHTML={{ __html: part }} />;
    });
  };

  // Extract current AOP from graphData or selected node
  const currentAOP = graphData?.currentAOP || selectedNode?.aop || '';
  
  // Auto-generate query based on selected node
  useEffect(() => {
    if (selectedNode && !query) {
      const nodeLabel = selectedNode.label || selectedNode.id;
      const nodeType = selectedNode.type || 'element';
      const autoQuery = `Can you analyze the biological significance of ${nodeLabel} (${nodeType}) in the context of adverse outcome pathways? What AOPs is this element involved in and what are the key mechanisms?`;
      setQuery(autoQuery);
    }
  }, [selectedNode, query]);

  const performAnalysis = async () => {
    if (!query.trim()) {
      setAnalysisError('Please enter a query for analysis');
      return;
    }

    setAnalysisLoading(true);
    setAnalysisError(null);

    try {
      const nodeIds = selectedNode ? [selectedNode.id] : [];
      
      // Enhanced query for drug analysis context
      let enhancedQuery = query.trim();
      if (contextType === 'drug_analysis') {
        enhancedQuery = `${query.trim()} 

Please focus on:
1. Drugs that modulate the molecular initiating events (MIE)
2. Pharmaceutical compounds affecting key events (KE)
3. Therapeutic interventions targeting this AOP pathway
4. FDA-approved drugs and their mechanisms
5. Drug-target interactions relevant to this pathway
6. Potential drug repurposing opportunities`;
        
        // Add AOP context if available
        if (currentAOP) {
          enhancedQuery += `\n\nCurrent AOP context: ${currentAOP}`;
        }
        
        // Add selected node context for drug analysis
        if (selectedNode) {
          enhancedQuery += `\n\nFocus on drugs affecting: ${selectedNode.label || selectedNode.id} (${selectedNode.type || 'Unknown type'})`;
        }
      }

      console.log('Sending analysis request:', {
        query: enhancedQuery,
        node_ids: nodeIds,
        context_type: contextType,
        aop: currentAOP
      });

      const response = await fetch('http://localhost:5001/perplexity_analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: enhancedQuery,
          node_ids: nodeIds,
          context_type: contextType,
          aop: currentAOP
        })
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          console.log('Error response:', errorData);
        } catch (parseError) {
          console.log('Could not parse error response:', parseError);
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('Analysis result:', result);
      
      if (result.status === 'configuration_error') {
        setAnalysisError('AI API not configured. Please add your API key to the backend .env file.');
        return;
      }
      
      if (result.status === 'placeholder') {
        setAnalysisError('Backend is running in demo mode. Please restart the backend server to enable real AI analysis.');
        return;
      }
      
      if (result.status === 'success') {
        setAnalysisResult(result);
      } else {
        setAnalysisError(result.error || 'Analysis failed');
      }
      
    } catch (error) {
      console.error('Analysis error:', error);
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        setAnalysisError('Cannot connect to backend server. Please make sure the backend is running on http://localhost:5001');
      } else {
        setAnalysisError(error.message || 'Analysis failed. Please check your connection and try again.');
      }
    } finally {
      setAnalysisLoading(false);
    }
  };

  const clearAnalysis = () => {
    setAnalysisResult(null);
    setAnalysisError(null);
    setMoreAnalysisResult(null);
    setShowMoreAnalysis(false);
  };

  // More Analysis function for deeper insights
  const performMoreAnalysis = async () => {
    if (!analysisResult) return;
    
    setMoreAnalysisLoading(true);
    
    try {
      const nodeIds = selectedNode ? [selectedNode.id] : [];
      
      // Create a more detailed query based on the original analysis
      let moreQuery = `Based on the previous analysis, please provide deeper insights on:

1. Clinical trial data for drugs mentioned
2. Biomarkers associated with drug efficacy
3. Drug-drug interactions in this pathway
4. Dosage and administration considerations
5. Contraindications and side effects
6. Emerging therapies and pipeline drugs
7. Personalized medicine approaches
8. Regulatory status and approval timelines`;
      
      if (contextType === 'drug_analysis') {
        moreQuery += `\n\nOriginal query context: ${query}`;
        
        if (currentAOP) {
          moreQuery += `\n\nAOP: ${currentAOP}`;
        }
        
        if (selectedNode) {
          moreQuery += `\n\nFocus node: ${selectedNode.label || selectedNode.id} (${selectedNode.type || 'Unknown type'})`;
        }
      }
      
      const response = await fetch('http://localhost:5001/perplexity_analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: moreQuery,
          node_ids: nodeIds,
          context_type: contextType,
          aop: currentAOP
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.status === 'success') {
        setMoreAnalysisResult(result);
        setShowMoreAnalysis(true);
      } else {
        setAnalysisError(result.error || 'More analysis failed');
      }
      
    } catch (error) {
      console.error('More analysis error:', error);
      setAnalysisError(`More analysis failed: ${error.message}`);
    } finally {
      setMoreAnalysisLoading(false);
    }
  };

  // Export functions
  const exportAsJSON = () => {
    if (!analysisResult) return;

    const exportData = {
      query,
      contextType,
      selectedNode: selectedNode ? selectedNode.id : null,
      currentAOP,
      analysis: analysisResult,
      timestamp: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ai-analysis-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportAsCSV = () => {
    if (!analysisResult) return;

    const csvData = [
      ['Field', 'Value'],
      ['Query', query],
      ['Context Type', contextType],
      ['Selected Node', selectedNode ? selectedNode.id : 'None'],
      ['Current AOP', currentAOP || 'None'],
      ['Analysis Content', analysisResult.analysis?.content || ''],
      ['Model', analysisResult.analysis?.model || ''],
      ['Timestamp', analysisResult.timestamp || new Date().toISOString()],
      ['Status', analysisResult.status || '']
    ];

    // Add citations if available
    if (analysisResult.analysis?.citations && analysisResult.analysis.citations.length > 0) {
      csvData.push(['Citations', '']);
      analysisResult.analysis.citations.forEach((citation, index) => {
        const citationUrl = typeof citation === 'string' ? citation : citation.url;
        csvData.push([`Citation ${index + 1}`, citationUrl]);
      });
    }

    const csvContent = csvData.map(row => 
      row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ai-analysis-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="p-4 space-y-4 bg-card/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">AI Analysis</h3>
        </div>
        {analysisResult && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportAsJSON}>
              <FileText className="h-4 w-4 mr-1" />
              JSON
            </Button>
            <Button variant="outline" size="sm" onClick={exportAsCSV}>
              <FileText className="h-4 w-4 mr-1" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={clearAnalysis}>
              Clear
            </Button>
          </div>
        )}
      </div>

      {/* Selection Summary */}
      {selectedNode && (
        <div className="p-3 bg-muted/50 rounded-lg">
          <div className="text-sm font-medium mb-2">Current Selection:</div>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="secondary">
              {selectedNode.label || selectedNode.id}
            </Badge>
            <Badge variant="outline">
              {selectedNode.type || 'Unknown Type'}
            </Badge>
            {currentAOP && (
              <Badge variant="outline">AOP: {currentAOP}</Badge>
            )}
          </div>
        </div>
      )}

      {/* Query Input */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Analysis Query</label>
        <Textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Example: Can you analyze the biological significance of oxidative stress in the context of adverse outcome pathways? What AOPs involve oxidative stress and what are the key molecular mechanisms?"
          className="min-h-[100px]"
          disabled={analysisLoading}
        />
      </div>

      {/* Context Type Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Analysis Context</label>
        <Select value={contextType} onValueChange={setContextType} disabled={analysisLoading}>
          <SelectTrigger>
            <SelectValue placeholder="Select analysis context" />
          </SelectTrigger>
          <SelectContent>
            {contextTypes.map(type => (
              <SelectItem key={type.value} value={type.value}>
                <div>
                  <div className="font-medium">{type.label}</div>
                  <div className="text-xs text-muted-foreground">{type.description}</div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Analysis Button */}
      <Button 
        onClick={performAnalysis} 
        disabled={analysisLoading || !query.trim()}
        className="w-full"
      >
        {analysisLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Analyzing...
          </>
        ) : (
          <>
            <Search className="h-4 w-4 mr-2" />
            Analyze
          </>
        )}
      </Button>

      {/* Error Display */}
      {analysisError && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Analysis Error</span>
          </div>
          <p className="text-sm text-destructive/80 mt-1">{analysisError}</p>
        </div>
      )}

      {/* Analysis Results */}
      {analysisResult && (
        <div className="space-y-4">
          <Separator />
          
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <h4 className="font-semibold">Analysis Complete</h4>
          </div>

          {/* Main Analysis Content */}
          {analysisResult.analysis?.content && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Microscope className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Scientific Analysis</span>
              </div>
              <div className="p-4 bg-muted/30 rounded-lg text-sm whitespace-pre-wrap border">
                {renderContentWithLinks(analysisResult.analysis.content)}
              </div>
            </div>
          )}



          {/* More Analysis Button */}
          {!showMoreAnalysis && (
            <div className="flex justify-center pt-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={performMoreAnalysis}
                disabled={moreAnalysisLoading}
                className="bg-gradient-to-r from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100 border-blue-200"
              >
                {moreAnalysisLoading ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 mr-1" />
                )}
                More
              </Button>
            </div>
          )}



        </div>
      )}

      {/* More Analysis Results */}
      {moreAnalysisResult && showMoreAnalysis && (
        <div className="space-y-4 border-t pt-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"></div>
            <h4 className="font-semibold text-lg">Deeper Drug Analysis</h4>
            <Badge variant="outline" className="text-xs bg-gradient-to-r from-blue-50 to-purple-50">
              Enhanced Insights
            </Badge>
          </div>

          {/* More Analysis Content */}
          {moreAnalysisResult.analysis?.content && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Microscope className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Clinical & Therapeutic Insights</span>
              </div>
              <div className="p-4 bg-gradient-to-r from-blue-50/50 to-purple-50/50 rounded-lg text-sm whitespace-pre-wrap border border-blue-200/50">
                {renderContentWithLinks(moreAnalysisResult.analysis.content, moreAnalysisResult.analysis.citations)}
              </div>
            </div>
          )}



          {/* Collapse More Analysis Button */}
          <div className="flex justify-center">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowMoreAnalysis(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              Collapse Additional Analysis
            </Button>
          </div>
        </div>
      )}

      {/* Usage Instructions */}
      {!analysisResult && !analysisLoading && (
        <div className="p-3 bg-muted/20 rounded-lg text-xs text-muted-foreground">
          <div className="font-medium mb-1">💡 Tips for better analysis:</div>
          <ul className="space-y-1 list-disc list-inside">
            <li>Select specific nodes or edges before analyzing</li>
            <li>Use clear, scientific language in your queries</li>
            <li>Choose the appropriate context type for your research</li>
            <li>Include specific biological processes or pathways in your query</li>
            <li><strong>Drug Analysis:</strong> Use "Drug Analysis" context to find therapeutic interventions</li>
            <li><strong>More Button:</strong> Click "More" for deeper insights on clinical trials and drug interactions</li>
          </ul>
        </div>
      )}
    </Card>
  );
};

export default PerplexityAnalysisPanel;
