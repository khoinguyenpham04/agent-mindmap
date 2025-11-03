'use client';

import { useState } from 'react';
import { Canvas } from '@/components/ai-elements/canvas';
import { Connection } from '@/components/ai-elements/connection';
import { Controls } from '@/components/ai-elements/controls';
import { Edge } from '@/components/ai-elements/edge';
import {
  Node,
  NodeContent,
  NodeDescription,
  NodeFooter,
  NodeHeader,
  NodeTitle,
} from '@/components/ai-elements/node';
import { Panel } from '@/components/ai-elements/panel';
import { Toolbar } from '@/components/ai-elements/toolbar';
import { Button } from '@/components/ui/button';
import {
  PromptInput,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from '@/components/ai-elements/prompt-input';
import { Message, MessageContent } from '@/components/ai-elements/message';
import {
  Conversation,
  ConversationContent,
} from '@/components/ai-elements/conversation';
import { Loader } from '@/components/ai-elements/loader';
import { Suggestions, Suggestion } from '@/components/ai-elements/suggestion';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';

interface NodeData {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    description: string;
    handles: { target: boolean; source: boolean };
    content: string;
    footer: string;
    status?: 'pending' | 'running' | 'completed' | 'error';
  };
}

interface EdgeData {
  id: string;
  source: string;
  target: string;
  type: string;
}

interface AgentStep {
  id: string;
  nodeId: string;
  nodeName: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  input?: string;
  output?: string;
  toolCalls?: Array<{
    name: string;
    arguments: any;
    result: any;
  }>;
  timestamp: number;
  error?: string;
}

interface ExecutionState {
  executionId: string;
  status: 'initializing' | 'running' | 'completed' | 'error';
  steps: AgentStep[];
  currentNode: string | null;
  finalOutput?: string;
  error?: string;
}

export default function Home() {
  const [message, setMessage] = useState('');
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [edges, setEdges] = useState<EdgeData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<
    Array<{
      type: 'user' | 'assistant';
      content: string;
    }>
  >([]);
  
  // Agent execution state
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionState, setExecutionState] = useState<ExecutionState | null>(null);
  const [executionInput, setExecutionInput] = useState('');

  const nodeTypes = {
    workflow: ({
      data,
    }: {
      data: {
        label: string;
        description: string;
        handles: { target: boolean; source: boolean };
        content: string;
        footer: string;
        status?: 'pending' | 'running' | 'completed' | 'error';
      };
    }) => {
      const getStatusColor = () => {
        switch (data.status) {
          case 'running':
            return 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20';
          case 'completed':
            return 'border-green-500 bg-green-50/50 dark:bg-green-950/20';
          case 'error':
            return 'border-red-500 bg-red-50/50 dark:bg-red-950/20';
          default:
            return '';
        }
      };

      return (
        <Node handles={data.handles} className={getStatusColor()}>
          <NodeHeader>
            <div className="flex items-center justify-between w-full">
              <NodeTitle>{data.label}</NodeTitle>
              {data.status && (
                <Badge
                  variant={
                    data.status === 'completed'
                      ? 'default'
                      : data.status === 'running'
                      ? 'secondary'
                      : 'destructive'
                  }
                  className="ml-2"
                >
                  {data.status === 'running' && '⏳'}
                  {data.status === 'completed' && '✓'}
                  {data.status === 'error' && '✗'}
                </Badge>
              )}
            </div>
            <NodeDescription>{data.description}</NodeDescription>
          </NodeHeader>
          <NodeContent>
            <p className="text-sm">{data.content}</p>
          </NodeContent>
          <NodeFooter>
            <p className="text-muted-foreground text-xs">{data.footer}</p>
          </NodeFooter>
          <Toolbar>
            <Button size="sm" variant="ghost">
              Edit
            </Button>
            <Button size="sm" variant="ghost">
              Delete
            </Button>
          </Toolbar>
        </Node>
      );
    },
  };

  const edgeTypes = {
    animated: Edge.Animated,
    temporary: Edge.Temporary,
  };

  const handleSendMessage = async (promptMessage: PromptInputMessage) => {
    const hasText = Boolean(promptMessage.text);
    const hasAttachments = Boolean(promptMessage.files?.length);

    if (!(hasText || hasAttachments) || isLoading) return;

    const userMessage = promptMessage.text?.trim() || 'Sent with attachments';
    setMessage('');
    setIsLoading(true);
    setChatHistory((prev) => [...prev, { type: 'user', content: userMessage }]);

    try {
      const response = await fetch('/api/generate-workflow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          currentNodes: nodes,
          currentEdges: edges,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate workflow');
      }

      const data = await response.json();
      setNodes(data.nodes);
      setEdges(data.edges);
      setChatHistory((prev) => [
        ...prev,
        {
          type: 'assistant',
          content: data.description || 'Generated workflow updated!',
        },
      ]);
    } catch (error) {
      console.error('Error:', error);
      setChatHistory((prev) => [
        ...prev,
        {
          type: 'assistant',
          content:
            'Sorry, there was an error generating the workflow. Please try again.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const executeAgent = async () => {
    if (!executionInput.trim() || nodes.length === 0 || isExecuting) return;

    setIsExecuting(true);
    setExecutionState(null);
    
    // Reset node statuses
    setNodes(nodes.map(node => ({ ...node, data: { ...node.data, status: undefined } })));

    try {
      const response = await fetch('/api/execute-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userInput: executionInput,
          nodes,
          edges,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to execute agent');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            setExecutionState(data);

            // Update node statuses based on execution state
            setNodes(prevNodes =>
              prevNodes.map(node => {
                const step = data.steps.find((s: AgentStep) => s.nodeId === node.id);
                return {
                  ...node,
                  data: {
                    ...node.data,
                    status: step?.status,
                  },
                };
              }),
            );

            if (data.done) {
              setIsExecuting(false);
              if (data.finalOutput) {
                setChatHistory(prev => [
                  ...prev,
                  {
                    type: 'assistant',
                    content: `✅ Agent execution completed!\n\n${data.finalOutput}`,
                  },
                ]);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Execution error:', error);
      setIsExecuting(false);
      setChatHistory(prev => [
        ...prev,
        {
          type: 'assistant',
          content: '❌ Agent execution failed. Please check your API key configuration.',
        },
      ]);
    }
  };

  return (
    <div className="h-screen flex">
      {/* Chat Panel */}
      <div className="w-1/2 flex flex-col border-r">
        {/* Header */}
        <div className="border-b p-3 h-14 flex items-center justify-between">
          <h1 className="text-lg font-semibold">AI Agent Mind Map</h1>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setNodes([]);
              setEdges([]);
              setChatHistory([]);
              setExecutionState(null);
            }}
          >
            Clear All
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {chatHistory.length === 0 ? (
            <div className="text-center font-semibold mt-8">
              <p className="text-3xl mt-4">
                What AI agent would you like to build?
              </p>
              <p className="text-muted-foreground text-base mt-4 font-normal">
                Describe your AI agent workflow and I'll help you visualize it
              </p>
            </div>
          ) : (
            <>
              <Conversation>
                <ConversationContent>
                  {chatHistory.map((msg, index) => (
                    <Message from={msg.type} key={index}>
                      <MessageContent className="whitespace-pre-wrap">
                        {msg.content}
                      </MessageContent>
                    </Message>
                  ))}
                </ConversationContent>
              </Conversation>
              {isLoading && (
                <Message from="assistant">
                  <MessageContent>
                    <div className="flex items-center gap-2">
                      <Loader />
                      Generating your AI agent workflow...
                    </div>
                  </MessageContent>
                </Message>
              )}
            </>
          )}

          {/* Execution Steps Display */}
          {executionState && executionState.steps.length > 0 && (
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <span>Execution Steps</span>
                {isExecuting && <Loader />}
              </h3>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {executionState.steps.map((step) => (
                    <div
                      key={step.id}
                      className="border rounded-lg p-3 text-sm space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{step.nodeName}</span>
                        <Badge
                          variant={
                            step.status === 'completed'
                              ? 'default'
                              : step.status === 'running'
                              ? 'secondary'
                              : step.status === 'error'
                              ? 'destructive'
                              : 'outline'
                          }
                        >
                          {step.status}
                        </Badge>
                      </div>
                      {step.output && (
                        <p className="text-muted-foreground text-xs">
                          {step.output.substring(0, 150)}
                          {step.output.length > 150 ? '...' : ''}
                        </p>
                      )}
                      {step.toolCalls && step.toolCalls.length > 0 && (
                        <div className="text-xs text-blue-600 dark:text-blue-400">
                          🔧 Used tools: {step.toolCalls.map(t => t.name).join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          )}
        </div>

        {/* Input */}
        <div className="border-t p-4">
          {chatHistory.length === 0 && (
            <Suggestions>
              <Suggestion
                onClick={() =>
                  setMessage(
                    'Create a customer support AI agent with sentiment analysis and ticket routing',
                  )
                }
                suggestion="Customer support AI agent"
              />
              <Suggestion
                onClick={() =>
                  setMessage(
                    'Build a research AI agent that searches, summarizes, and reports findings',
                  )
                }
                suggestion="Research AI agent"
              />
              <Suggestion
                onClick={() =>
                  setMessage(
                    'Design a multi-agent system for e-commerce with recommendation, inventory, and checkout agents',
                  )
                }
                suggestion="E-commerce multi-agent system"
              />
            </Suggestions>
          )}
          <div className="flex gap-2">
            <PromptInput
              onSubmit={handleSendMessage}
              className="mt-4 w-full max-w-2xl mx-auto relative"
            >
              <PromptInputTextarea
                onChange={(e) => setMessage(e.target.value)}
                value={message}
                placeholder="Describe your AI agent workflow..."
                className="pr-12 min-h-[60px]"
              />
              <PromptInputSubmit
                className="absolute bottom-1 right-1"
                disabled={!message}
                status={isLoading ? 'streaming' : 'ready'}
              />
            </PromptInput>
          </div>
        </div>
      </div>

      {/* Canvas Panel */}
      <div className="w-1/2 flex flex-col">
        <div className="border-b p-3 h-14 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Workflow Visualization</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="outline">
              Export JSON
            </Button>
            <Button size="sm" variant="outline">
              Export Image
            </Button>
          </div>
        </div>

        {/* Agent Execution Input */}
        {nodes.length > 0 && (
          <div className="border-b p-3 bg-muted/30">
            <div className="flex gap-2 items-center">
              <Input
                placeholder="Enter input to execute the agent workflow..."
                value={executionInput}
                onChange={(e) => setExecutionInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    executeAgent();
                  }
                }}
                disabled={isExecuting}
              />
              <Button
                onClick={executeAgent}
                disabled={!executionInput.trim() || isExecuting}
                className="whitespace-nowrap"
              >
                {isExecuting ? (
                  <>
                    <Loader /> Running...
                  </>
                ) : (
                  '▶️ Execute Agent'
                )}
              </Button>
            </div>
            {executionState && (
              <div className="mt-2 text-xs text-muted-foreground">
                Status: <Badge variant="outline">{executionState.status}</Badge>
                {executionState.currentNode && (
                  <span className="ml-2">
                    Current: {nodes.find(n => n.id === executionState.currentNode)?.data.label}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex-1 relative">
          {nodes.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <p className="text-lg">Your workflow will appear here</p>
                <p className="text-sm mt-2">
                  Start by describing your AI agent in the chat
                </p>
              </div>
            </div>
          ) : (
            <Canvas
              edges={edges}
              edgeTypes={edgeTypes}
              fitView
              nodes={nodes}
              nodeTypes={nodeTypes}
              connectionLineComponent={Connection}
              nodesDraggable={true}
              panOnDrag={true}
              selectionOnDrag={false}
            >
              <Controls />
              <Panel position="top-left">
                <div className="bg-card border rounded-lg p-2 text-xs space-y-1">
                  <div className="font-semibold">Legend</div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-0.5 bg-primary animate-pulse" />
                    <span>Active flow</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-0.5 bg-muted-foreground" />
                    <span>Conditional</span>
                  </div>
                </div>
              </Panel>
            </Canvas>
          )}
        </div>
      </div>
    </div>
  );
}
