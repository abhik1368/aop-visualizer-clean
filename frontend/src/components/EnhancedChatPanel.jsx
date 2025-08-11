import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  Send, 
  Bot, 
  User, 
  Download, 
  Copy, 
  RefreshCw,
  FileText,
  Table,
  ExternalLink,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import axios from 'axios';

const EnhancedChatPanel = ({ selectedNode, selectedEdge, selectedNodeChain = [], context, analysisResults }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysisData, setAnalysisData] = useState(null);
  const [exportFormat, setExportFormat] = useState('markdown');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Optimized Perplexity prompt templates
  const getOptimizedPrompt = (userQuery) => {
    const nodeContext = selectedNode ? `Selected Node: ${selectedNode.label} (${selectedNode.type})` : '';
    const chainContext = selectedNodeChain.length > 0 ? 
      `Selected Nodes Chain: ${selectedNodeChain.map(n => n.label || n.id).join(' → ')}` : '';
    
    return `
## AOP Network Analysis Request

**User Query:** ${userQuery}

**Context:**
${nodeContext}
${chainContext}
${context?.currentAOP ? `Current AOP: ${context.currentAOP}` : ''}

**Instructions for Response:**
1. Provide a comprehensive analysis in structured format
2. Include relevant molecular mechanisms and pathways
3. Present key findings in table format when applicable
4. Include confidence levels for your assessments
5. Provide specific scientific references and citations
6. Structure your response with clear sections and subsections
7. Use bullet points for key mechanisms and relationships
8. Include regulatory and safety implications when relevant

**Required Response Format:**
- Executive Summary (2-3 sentences)
- Detailed Analysis (structured sections)
- Key Mechanisms Table (if applicable)
- Confidence Assessment
- Scientific References
- Recommendations

Please ensure all information is scientifically accurate and include specific citations where possible.
    `.trim();
  };

  const handlePerplexityAnalysis = async () => {
    if (!inputMessage.trim()) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setLoading(true);

    // Add user message
    const newUserMessage = {
      type: 'user',
      content: userMessage,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newUserMessage]);

    try {
      // Prepare selected nodes for analysis
      const selectedNodes = selectedNodeChain.length > 0 
        ? selectedNodeChain 
        : (selectedNode ? [selectedNode] : []);

      const response = await axios.post('http://localhost:5001/perplexity_analysis', {
        selected_nodes: selectedNodes,
        query: getOptimizedPrompt(userMessage),
        include_web_search: true
      });

      const data = response.data;

      // Process and enhance the response
      const enhancedResponse = {
        type: 'bot',
        content: data.ai_analysis,
        timestamp: new Date(),
        confidence: data.confidence,
        references: data.references || [],
        model_used: data.model_used,
        search_enabled: data.search_enabled,
        raw_data: data
      };

      setMessages(prev => [...prev, enhancedResponse]);
      setAnalysisData(data);

    } catch (error) {
      console.error('Perplexity analysis error:', error);
      const errorMessage = {
        type: 'bot',
        content: `Error performing analysis: ${error.response?.data?.error || error.message}`,
        timestamp: new Date(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const exportAnalysis = () => {
    if (!analysisData) return;

    const timestamp = new Date().toISOString().split('T')[0];
    let content = '';
    let filename = '';

    if (exportFormat === 'markdown') {
      content = generateMarkdownExport();
      filename = `aop_analysis_${timestamp}.md`;
    } else if (exportFormat === 'csv') {
      content = generateCSVExport();
      filename = `aop_analysis_${timestamp}.csv`;
    } else if (exportFormat === 'json') {
      content = JSON.stringify(analysisData, null, 2);
      filename = `aop_analysis_${timestamp}.json`;
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const generateMarkdownExport = () => {
    const analysis = analysisData;
    const selectedNodes = selectedNodeChain.length > 0 
      ? selectedNodeChain 
      : (selectedNode ? [selectedNode] : []);

    return `# AOP Network Analysis Report

## Analysis Details
- **Date:** ${new Date().toISOString()}
- **Confidence:** ${(analysis.confidence * 100).toFixed(1)}%
- **Model:** ${analysis.model_used}
- **Web Search Enabled:** ${analysis.search_enabled ? 'Yes' : 'No'}

## Selected Nodes
${selectedNodes.map(node => `- **${node.label || node.id}** (${node.type}) - AOP: ${node.aop || 'N/A'}`).join('\n')}

## Analysis Results

${analysis.ai_analysis}

## References and Citations

${analysis.references && analysis.references.length > 0 
  ? analysis.references.map((ref, index) => `${index + 1}. **${ref.title}**\n   - URL: ${ref.url}\n   - Snippet: ${ref.snippet}`).join('\n\n')
  : 'No specific references provided.'}

## Technical Details
- **Query Timestamp:** ${analysis.timestamp}
- **Response Confidence:** ${(analysis.confidence * 100).toFixed(1)}%

---
*Generated by AOP Network Visualizer*
`;
  };

  const generateCSVExport = () => {
    const analysis = analysisData;
    const selectedNodes = selectedNodeChain.length > 0 
      ? selectedNodeChain 
      : (selectedNode ? [selectedNode] : []);

    let csv = 'Category,Item,Value,Confidence,Reference\n';
    
    // Add selected nodes
    selectedNodes.forEach(node => {
      csv += `Selected Node,"${node.label || node.id}","${node.type}",,"AOP: ${node.aop || 'N/A'}"\n`;
    });

    // Add analysis metadata
    csv += `Analysis,Date,"${new Date().toISOString()}",${analysis.confidence},\n`;
    csv += `Analysis,Model,"${analysis.model_used}",${analysis.confidence},\n`;
    csv += `Analysis,Web Search,"${analysis.search_enabled}",${analysis.confidence},\n`;

    // Add references
    if (analysis.references && analysis.references.length > 0) {
      analysis.references.forEach((ref, index) => {
        csv += `Reference,"${ref.title}","${ref.url}",,"${ref.snippet.replace(/"/g, '""')}"\n`;
      });
    }

    return csv;
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      // Could add a toast notification here
    });
  };

  const formatMessageContent = (message) => {
    if (message.type === 'bot' && !message.isError) {
      return (
        <div className="space-y-4">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <div className="whitespace-pre-wrap">{message.content}</div>
          </div>
          
          {message.confidence && (
            <div className="flex items-center gap-2 text-sm">
              <Badge variant={message.confidence > 0.8 ? "default" : message.confidence > 0.6 ? "secondary" : "outline"}>
                Confidence: {(message.confidence * 100).toFixed(1)}%
              </Badge>
              {message.search_enabled && (
                <Badge variant="outline">
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Web Search
                </Badge>
              )}
            </div>
          )}

          {message.references && message.references.length > 0 && (
            <div className="border-t pt-3">
              <h5 className="font-medium mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                References ({message.references.length})
              </h5>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {message.references.map((ref, index) => (
                  <div key={index} className="text-xs p-2 bg-muted rounded">
                    <div className="font-medium">
                      <a href={ref.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {ref.title}
                      </a>
                    </div>
                    <div className="text-muted-foreground mt-1">{ref.snippet}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyToClipboard(message.content)}
            >
              <Copy className="w-3 h-3 mr-1" />
              Copy
            </Button>
            {message.raw_data && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setAnalysisData(message.raw_data);
                  // Auto-export as markdown
                  setExportFormat('markdown');
                  setTimeout(exportAnalysis, 100);
                }}
              >
                <Download className="w-3 h-3 mr-1" />
                Export
              </Button>
            )}
          </div>
        </div>
      );
    }

    return <div className="whitespace-pre-wrap">{message.content}</div>;
  };

  return (
    <div className="h-full flex flex-col">
      <Card className="flex-1 flex flex-col">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold mb-2">AI Analysis Chat</h3>
          <p className="text-sm text-muted-foreground">
            Get comprehensive AOP analysis with scientific references and structured insights.
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Start a conversation to get AI-powered AOP analysis</p>
              <p className="text-xs mt-2">
                Select nodes and ask questions about pathways, mechanisms, or relationships
              </p>
            </div>
          )}
          
          {messages.map((message, index) => (
            <div key={index} className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] ${message.type === 'user' ? 'order-2' : 'order-1'}`}>
                <div className={`p-3 rounded-lg ${
                  message.type === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : message.isError
                    ? 'bg-destructive/10 text-destructive border border-destructive/20'
                    : 'bg-muted'
                }`}>
                  {formatMessageContent(message)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                message.type === 'user' ? 'bg-primary order-1' : 'bg-secondary order-2'
              }`}>
                {message.type === 'user' ? (
                  <User className="w-4 h-4 text-primary-foreground" />
                ) : (
                  <Bot className={`w-4 h-4 ${message.isError ? 'text-destructive' : 'text-secondary-foreground'}`} />
                )}
              </div>
            </div>
          ))}
          
          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-secondary-foreground" />
              </div>
              <div className="bg-muted p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Analyzing with AI...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Export Controls */}
        {analysisData && (
          <div className="p-3 border-t bg-muted/50">
            <div className="flex items-center gap-2 text-sm">
              <span>Export format:</span>
              <select 
                value={exportFormat} 
                onChange={(e) => setExportFormat(e.target.value)}
                className="px-2 py-1 border rounded text-xs"
              >
                <option value="markdown">Markdown</option>
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
              </select>
              <Button size="sm" variant="outline" onClick={exportAnalysis}>
                <Download className="w-3 h-3 mr-1" />
                Export
              </Button>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask about AOP mechanisms, pathways, relationships, or get detailed analysis..."
              className="flex-1 min-h-[80px] resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handlePerplexityAnalysis();
                }
              }}
            />
            <Button 
              onClick={handlePerplexityAnalysis} 
              disabled={loading || !inputMessage.trim()}
              className="self-end"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Press Enter to send, Shift+Enter for new line
          </div>
        </div>
      </Card>
    </div>
  );
};

export default EnhancedChatPanel;
