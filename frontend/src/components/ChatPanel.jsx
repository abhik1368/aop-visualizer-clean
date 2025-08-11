import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Send, Bot, User, Trash2, Key, Eye, EyeOff } from 'lucide-react';

const ChatPanel = ({ selectedNode, selectedEdge, selectedNodeChain = [], context }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isApiKeySet, setIsApiKeySet] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load persisted chat state on component mount
  useEffect(() => {
    const savedApiKey = sessionStorage.getItem('aop_chat_api_key');
    const savedMessages = sessionStorage.getItem('aop_chat_messages');
    const savedIsApiKeySet = sessionStorage.getItem('aop_chat_api_key_set');

    if (savedApiKey) {
      setApiKey(savedApiKey);
    }
    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        setMessages(parsedMessages);
      } catch (e) {
        console.error('Failed to parse saved messages:', e);
      }
    }
    if (savedIsApiKeySet === 'true') {
      setIsApiKeySet(true);
    }
  }, []);

  // Save chat state to sessionStorage whenever it changes
  useEffect(() => {
    if (apiKey) {
      sessionStorage.setItem('aop_chat_api_key', apiKey);
    } else {
      sessionStorage.removeItem('aop_chat_api_key');
    }
  }, [apiKey]);

  useEffect(() => {
    if (messages.length > 0) {
      sessionStorage.setItem('aop_chat_messages', JSON.stringify(messages));
    } else {
      sessionStorage.removeItem('aop_chat_messages');
    }
  }, [messages]);

  useEffect(() => {
    sessionStorage.setItem('aop_chat_api_key_set', isApiKeySet.toString());
  }, [isApiKeySet]);

  // Clear API key only when browser window is actually closed (not on tab switch or navigation)
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      // Only clear on actual browser close/refresh, not tab switch
      // Tab switches don't trigger beforeunload
      if (e.type === 'beforeunload') {
        // Don't clear sessionStorage on beforeunload as it might be just a refresh
        // sessionStorage persists across page refreshes but not browser close
      }
    };

    const handleVisibilityChange = () => {
      // Don't clear on visibility change (tab switch)
      // sessionStorage will persist across tabs
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // Don't clear on component unmount (tab switch or navigation within app)
    };
  }, []);

  // Clear sessionStorage only when the browser tab is actually closed
  // This uses the Page Visibility API to detect when the page is hidden
  useEffect(() => {
    const handlePageHide = () => {
      // This fires when the page is actually being unloaded (browser close, navigate away)
      // But not on tab switches within the same origin
      if (document.visibilityState === 'hidden') {
        // Only clear if we're sure the page is being unloaded
        setTimeout(() => {
          if (document.visibilityState === 'hidden') {
            // Still hidden after timeout, likely a real page unload
            sessionStorage.removeItem('aop_chat_api_key');
            sessionStorage.removeItem('aop_chat_messages');
            sessionStorage.removeItem('aop_chat_api_key_set');
          }
        }, 1000); // Wait 1 second to see if page becomes visible again
      }
    };

    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, []);

  const handleApiKeySubmit = () => {
    if (apiKey.trim()) {
      setIsApiKeySet(true);
      const welcomeMessage = {
        type: 'bot',
        content: 'API key set successfully! I can now help you with questions about AOP networks. Your API key is stored only in this session and will be cleared when you close the browser.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, welcomeMessage]);
    }
  };

  const clearApiKey = () => {
    setApiKey('');
    setIsApiKeySet(false);
    setMessages([]);
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !isApiKeySet) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');

    // Add user message to chat
    const newMessages = [...messages, { type: 'user', content: userMessage, timestamp: new Date() }];
    setMessages(newMessages);

    setLoading(true);

    try {
      // Prepare context for LLM
      let contextPrompt = 'You are an expert in Adverse Outcome Pathways (AOPs) and toxicology. ';
      
      if (selectedNodeChain && selectedNodeChain.length > 0) {
        contextPrompt += `Selected node chain context: You are analyzing a pathway chain with ${selectedNodeChain.length} nodes: ${selectedNodeChain.join(' -> ')}. `;
        contextPrompt += 'Please provide insights about the relationships, mechanisms, and biological significance of this pathway chain. ';
      }
      
      if (selectedNode) {
        contextPrompt += `Current node context: ${selectedNode.label} (Type: ${selectedNode.type}`;
        if (selectedNode.aop) contextPrompt += `, AOP: ${selectedNode.aop}`;
        if (selectedNode.ontology_term) contextPrompt += `, Ontology: ${selectedNode.ontology_term}`;
        contextPrompt += '). ';
      }
      
      if (selectedEdge) {
        contextPrompt += `Current relationship context: ${selectedEdge.source} -> ${selectedEdge.target}`;
        if (selectedEdge.relationship) contextPrompt += ` (${selectedEdge.relationship})`;
        contextPrompt += '. ';
      }

      if (context?.currentAOP) {
        contextPrompt += `Current AOP context: ${context.currentAOP}. `;
      }

      contextPrompt += `Please provide a detailed, scientific response to the following question about AOP networks: ${userMessage}`;

      // Call OpenAI API directly from frontend (session-only, no server storage)
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are an expert in Adverse Outcome Pathways (AOPs), toxicology, and systems biology. Provide detailed, scientific responses about molecular mechanisms, biological pathways, and toxicological processes.'
            },
            {
              role: 'user',
              content: contextPrompt
            }
          ],
          max_tokens: 500,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const botResponse = data.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

      // Add bot response to chat
      setMessages(prev => [...prev, {
        type: 'bot',
        content: botResponse,
        timestamp: new Date()
      }]);

    } catch (error) {
      console.error('Chat error:', error);
      let errorMessage = 'Sorry, I encountered an error while processing your request.';
      
      if (error.message.includes('401')) {
        errorMessage = 'Invalid API key. Please check your OpenAI API key and try again.';
      } else if (error.message.includes('429')) {
        errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
      } else if (error.message.includes('403')) {
        errorMessage = 'Access denied. Please check your API key permissions.';
      }

      setMessages(prev => [...prev, {
        type: 'bot',
        content: errorMessage,
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isApiKeySet) {
        handleSendMessage();
      } else {
        handleApiKeySubmit();
      }
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  const formatTimestamp = (timestamp) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const suggestedQuestions = [
    "What is the biological mechanism behind this event?",
    "How does this relate to adverse outcomes?",
    "What evidence supports this relationship?",
    "What are the key molecular targets involved?",
    "How is this pathway regulated?",
    "What are potential therapeutic interventions?"
  ];

  if (!isApiKeySet) {
    return (
      <Card className="p-4 h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AOP Assistant
          </h3>
        </div>

        <div className="flex-1 flex flex-col justify-center items-center space-y-4">
          <Key className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h4 className="text-lg font-medium mb-2">OpenAI API Key Required</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Enter your OpenAI API key to start chatting with the AOP Assistant.
              Your key is stored only in this session and will be cleared when you close the browser.
            </p>
          </div>

          <div className="w-full max-w-md space-y-3">
            <div className="relative">
              <Input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="sk-..."
                className="pr-10"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            
            <Button
              onClick={handleApiKeySubmit}
              disabled={!apiKey.trim()}
              className="w-full"
            >
              Set API Key
            </Button>

            <div className="text-xs text-muted-foreground text-center">
              <p>🔒 Your API key is never stored on our servers</p>
              <p>🗑️ Key is automatically cleared when session ends</p>
              <p>🔑 Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">OpenAI Platform</a></p>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Bot className="h-5 w-5" />
          AOP Assistant
        </h3>
        <div className="flex gap-2">
          {messages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearChat}
              title="Clear chat"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={clearApiKey}
            title="Clear API key"
          >
            <Key className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Context Display */}
      {(selectedNode || selectedEdge) && (
        <div className="mb-4 p-3 bg-muted rounded-lg">
          <div className="text-sm font-medium mb-1">Current Context:</div>
          {selectedNode && (
            <div className="text-xs text-muted-foreground">
              Node: {selectedNode.label} ({selectedNode.type})
            </div>
          )}
          {selectedEdge && (
            <div className="text-xs text-muted-foreground">
              Edge: {selectedEdge.source} → {selectedEdge.target}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto mb-4 space-y-3 min-h-0">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="mb-4">Ask me anything about AOP networks!</p>
            
            {/* Suggested Questions */}
            <div className="text-left">
              <p className="text-sm font-medium mb-2">Suggested questions:</p>
              <div className="space-y-1">
                {suggestedQuestions.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => setInputMessage(question)}
                    className="block w-full text-left text-xs p-2 rounded bg-accent hover:bg-accent/80 transition-colors"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.type === 'bot' && (
                <div className="flex-shrink-0">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[80%] p-3 rounded-lg ${
                  message.type === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                <div className="text-xs opacity-70 mt-1">
                  {formatTimestamp(message.timestamp)}
                </div>
              </div>
              {message.type === 'user' && (
                <div className="flex-shrink-0">
                  <User className="h-6 w-6 text-primary" />
                </div>
              )}
            </div>
          ))
        )}
        {loading && (
          <div className="flex gap-3 justify-start">
            <Bot className="h-6 w-6 text-primary flex-shrink-0" />
            <div className="bg-muted p-3 rounded-lg">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <Input
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask about AOP networks, mechanisms, relationships..."
          disabled={loading}
          className="flex-1"
        />
        <Button
          onClick={handleSendMessage}
          disabled={loading || !inputMessage.trim()}
          size="sm"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
};

export default ChatPanel;

