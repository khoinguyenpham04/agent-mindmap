'use client';

import { useState, useCallback } from 'react';
import type { Connection as FlowConnection, Edge as FlowEdge, EdgeChange, NodeChange, OnConnect } from '@xyflow/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  IconBrain,
  IconTrash,
  IconDownload,
  IconPhoto,
  IconPlayerPlay,
  IconNetwork,
  IconMessageCircle,
  IconGitBranch,
  IconBolt,
  IconEdit,
  IconPlus,
  IconClock,
  IconCheck,
  IconAlertCircle,
  IconChevronDown,
  IconChevronUp,
  IconFileText,
  IconX,
} from '@tabler/icons-react';

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

  // Node editing state
  const [editingNode, setEditingNode] = useState<NodeData | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    label: '',
    description: '',
    content: '',
    footer: '',
  });

  // Inline editing state
  const [editingInline, setEditingInline] = useState<{
    nodeId: string;
    field: 'label' | 'description';
  } | null>(null);

  // Execution panel state
  const [showExecutionPanel, setShowExecutionPanel] = useState(true);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [showReport, setShowReport] = useState(false);
  const [executionReport, setExecutionReport] = useState<string>('');

  const nodeTypes = {
    workflow: ({
      id,
      data,
    }: {
      id: string;
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

      const isEditingLabel = editingInline?.nodeId === id && editingInline?.field === 'label';
      const isEditingDesc = editingInline?.nodeId === id && editingInline?.field === 'description';

      return (
        <Node handles={data.handles} className={getStatusColor()}>
          <NodeHeader>
            <div className="flex items-center justify-between w-full">
              {isEditingLabel ? (
                <Input
                  autoFocus
                  value={data.label}
                  onChange={(e) => handleInlineEdit(id, 'label', e.target.value)}
                  onBlur={() => setEditingInline(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === 'Escape') {
                      setEditingInline(null);
                    }
                  }}
                  className="h-7 text-sm font-semibold"
                />
              ) : (
                <NodeTitle 
                  className="cursor-text hover:bg-muted/50 px-1 -mx-1 rounded"
                  onClick={() => setEditingInline({ nodeId: id, field: 'label' })}
                  title="Click to edit"
                >
                  {data.label}
                </NodeTitle>
              )}
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
            {isEditingDesc ? (
              <Input
                autoFocus
                value={data.description}
                onChange={(e) => handleInlineEdit(id, 'description', e.target.value)}
                onBlur={() => setEditingInline(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Escape') {
                    setEditingInline(null);
                  }
                }}
                className="h-6 text-xs"
              />
            ) : (
              <NodeDescription
                className="cursor-text hover:bg-muted/50 px-1 -mx-1 rounded"
                onClick={() => setEditingInline({ nodeId: id, field: 'description' })}
                title="Click to edit"
              >
                {data.description}
              </NodeDescription>
            )}
          </NodeHeader>
          <NodeContent>
            <p className="text-sm">{data.content}</p>
          </NodeContent>
          <NodeFooter>
            <p className="text-muted-foreground text-xs">{data.footer}</p>
          </NodeFooter>
          <Toolbar>
            <Button 
              size="sm" 
              variant="ghost"
              onClick={() => handleEditNode(id)}
            >
              <IconEdit className="h-3 w-3 mr-1" stroke={1.5} />
              Edit
            </Button>
            <Button 
              size="sm" 
              variant="ghost"
              onClick={() => handleDeleteNode(id)}
            >
              <IconTrash className="h-3 w-3 mr-1" stroke={1.5} />
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
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || errorData.details || 'Failed to generate workflow');
      }

      const data = await response.json();
      
      if (!data.nodes || !Array.isArray(data.nodes)) {
        throw new Error('Invalid workflow data received');
      }
      
      setNodes(data.nodes);
      setEdges(data.edges || []);
      setChatHistory((prev) => [
        ...prev,
        {
          type: 'assistant',
          content: data.description || 'Generated workflow updated!',
        },
      ]);
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      let userMessage = 'Sorry, there was an error generating the workflow.';
      
      if (errorMessage.includes('API key not configured')) {
        userMessage = '⚠️ OpenAI API key not configured. Please add your OPENAI_API_KEY to the .env.local file and restart the server.';
      } else if (errorMessage.includes('quota')) {
        userMessage = '⚠️ OpenAI API quota exceeded. Please check your API key credits.';
      } else {
        userMessage = `⚠️ Error: ${errorMessage}`;
      }
      
      setChatHistory((prev) => [
        ...prev,
        {
          type: 'assistant',
          content: userMessage,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Node management functions
  const handleEditNode = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    setEditingNode(node);
    setEditForm({
      label: node.data.label,
      description: node.data.description,
      content: node.data.content,
      footer: node.data.footer,
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingNode) return;

    setNodes(prevNodes =>
      prevNodes.map(node =>
        node.id === editingNode.id
          ? {
              ...node,
              data: {
                ...node.data,
                label: editForm.label,
                description: editForm.description,
                content: editForm.content,
                footer: editForm.footer,
              },
            }
          : node
      )
    );

    setIsEditDialogOpen(false);
    setEditingNode(null);
    
    setChatHistory(prev => [
      ...prev,
      {
        type: 'assistant',
        content: `✏️ Updated node: "${editForm.label}"`,
      },
    ]);
  };

  const handleDeleteNode = (nodeId: string) => {
    const nodeToDelete = nodes.find(n => n.id === nodeId);
    if (!nodeToDelete) return;

    // Find edges connected to this node
    const incomingEdges = edges.filter(e => e.target === nodeId);
    const outgoingEdges = edges.filter(e => e.source === nodeId);

    // Remove the node
    setNodes(prevNodes => prevNodes.filter(n => n.id !== nodeId));

    // Intelligent edge reconnection
    const newEdges = edges.filter(e => e.source !== nodeId && e.target !== nodeId);
    
    // If node has both incoming and outgoing edges, reconnect them
    if (incomingEdges.length > 0 && outgoingEdges.length > 0) {
      incomingEdges.forEach(inEdge => {
        outgoingEdges.forEach(outEdge => {
          newEdges.push({
            id: `reconnect_${inEdge.source}_${outEdge.target}`,
            source: inEdge.source,
            target: outEdge.target,
            type: inEdge.type,
          });
        });
      });
    }

    setEdges(newEdges);
    
    setChatHistory(prev => [
      ...prev,
      {
        type: 'assistant',
        content: `🗑️ Deleted node: "${nodeToDelete.data.label}"${
          incomingEdges.length > 0 && outgoingEdges.length > 0
            ? ' and reconnected edges'
            : ''
        }`,
      },
    ]);
  };

  const handleAddNode = () => {
    const newNode: NodeData = {
      id: `custom_${Date.now()}`,
      type: 'workflow',
      position: { 
        x: nodes.length > 0 ? Math.max(...nodes.map(n => n.position.x)) + 450 : 0,
        y: 0 
      },
      data: {
        label: 'New Node',
        description: 'Custom step',
        handles: { target: true, source: true },
        content: 'Add your custom logic here',
        footer: 'Custom node',
      },
    };

    setNodes(prev => [...prev, newNode]);
    
    // Auto-connect to last node if exists
    if (nodes.length > 0) {
      const lastNode = nodes[nodes.length - 1];
      setEdges(prev => [
        ...prev,
        {
          id: `edge_${lastNode.id}_${newNode.id}`,
          source: lastNode.id,
          target: newNode.id,
          type: 'animated',
        },
      ]);
    }
    
    setChatHistory(prev => [
      ...prev,
      {
        type: 'assistant',
        content: '➕ Added new custom node to workflow',
      },
    ]);
  };

  // Manual edge creation
  const onConnect: OnConnect = useCallback((connection: FlowConnection) => {
    const newEdge: EdgeData = {
      id: `edge_${connection.source}_${connection.target}_${Date.now()}`,
      source: connection.source!,
      target: connection.target!,
      type: 'animated',
    };
    
    setEdges(prev => [...prev, newEdge]);
    
    setChatHistory(prev => [
      ...prev,
      {
        type: 'assistant',
        content: '🔗 Connected nodes manually',
      },
    ]);
  }, []);

  // Node position updates when dragging
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes(prevNodes => {
      const updatedNodes = [...prevNodes];
      
      changes.forEach(change => {
        if (change.type === 'position' && change.position) {
          const nodeIndex = updatedNodes.findIndex(n => n.id === change.id);
          if (nodeIndex !== -1) {
            updatedNodes[nodeIndex] = {
              ...updatedNodes[nodeIndex],
              position: change.position,
            };
          }
        }
      });
      
      return updatedNodes;
    });
  }, []);

  // Edge deletion
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    changes.forEach(change => {
      if (change.type === 'remove') {
        setEdges(prev => prev.filter(edge => edge.id !== change.id));
        setChatHistory(prev => [
          ...prev,
          {
            type: 'assistant',
            content: '✂️ Removed connection',
          },
        ]);
      }
    });
  }, []);

  // Inline editing handlers
  const handleInlineEdit = (nodeId: string, field: 'label' | 'description', value: string) => {
    setNodes(prevNodes =>
      prevNodes.map(node =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                [field]: value,
              },
            }
          : node
      )
    );
  };

  // Generate markdown report from execution state
  const generateExecutionReport = (state: ExecutionState, input: string): string => {
    const timestamp = new Date().toLocaleString();
    const duration = state.steps.length > 0 
      ? ((state.steps[state.steps.length - 1]?.timestamp || 0) - (state.steps[0]?.timestamp || 0)) / 1000
      : 0;

    let report = `# 🤖 Agent Execution Report\n\n`;
    report += `**Execution ID:** \`${state.executionId}\`  \n`;
    report += `**Date:** ${timestamp}  \n`;
    report += `**Status:** ${state.status === 'completed' ? '✅ Completed' : state.status === 'error' ? '❌ Error' : '⏳ Running'}  \n`;
    report += `**Duration:** ${duration.toFixed(2)}s  \n`;
    report += `**Total Steps:** ${state.steps.length}  \n\n`;

    report += `---\n\n`;

    report += `## 📝 Input\n\n`;
    report += `\`\`\`\n${input}\n\`\`\`\n\n`;

    report += `---\n\n`;

    report += `## 🎯 Final Output\n\n`;
    if (state.finalOutput) {
      report += `${state.finalOutput}\n\n`;
    } else {
      report += `*No final output available*\n\n`;
    }

    report += `---\n\n`;

    report += `## 📊 Execution Timeline\n\n`;
    
    state.steps.forEach((step, index) => {
      const statusEmoji = step.status === 'completed' ? '✅' : 
                         step.status === 'running' ? '⏳' : 
                         step.status === 'error' ? '❌' : '⏸️';
      
      report += `### ${index + 1}. ${statusEmoji} ${step.nodeName}\n\n`;
      report += `**Status:** ${step.status}  \n`;
      
      if (step.input) {
        report += `\n**Input:**\n\`\`\`\n${step.input.substring(0, 300)}${step.input.length > 300 ? '...' : ''}\n\`\`\`\n\n`;
      }
      
      if (step.output) {
        report += `**Output:**\n\n${step.output}\n\n`;
      }
      
      if (step.toolCalls && step.toolCalls.length > 0) {
        report += `**🔧 Tools Used:**\n\n`;
        step.toolCalls.forEach(tool => {
          report += `- **${tool.name}**\n`;
          if (tool.arguments) {
            report += `  - Arguments: \`${JSON.stringify(tool.arguments)}\`\n`;
          }
          if (tool.result) {
            report += `  - Result: ${JSON.stringify(tool.result).substring(0, 150)}...\n`;
          }
        });
        report += `\n`;
      }
      
      if (step.error) {
        report += `**⚠️ Error:** ${step.error}\n\n`;
      }
      
      report += `---\n\n`;
    });

    report += `## 📈 Summary\n\n`;
    const completedSteps = state.steps.filter(s => s.status === 'completed').length;
    const errorSteps = state.steps.filter(s => s.status === 'error').length;
    
    report += `- **Completed Steps:** ${completedSteps} / ${state.steps.length}\n`;
    report += `- **Failed Steps:** ${errorSteps}\n`;
    report += `- **Success Rate:** ${((completedSteps / state.steps.length) * 100).toFixed(1)}%\n\n`;

    const totalToolCalls = state.steps.reduce((acc, step) => acc + (step.toolCalls?.length || 0), 0);
    if (totalToolCalls > 0) {
      report += `- **Total Tool Calls:** ${totalToolCalls}\n`;
    }

    report += `\n---\n\n`;
    report += `*Generated by Mindra AI Agent Platform*\n`;

    return report;
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
              
              // Generate execution report
              const report = generateExecutionReport(data, executionInput);
              setExecutionReport(report);
              setShowReport(true);
              
              if (data.finalOutput) {
                setChatHistory(prev => [
                  ...prev,
                  {
                    type: 'assistant',
                    content: `✅ Agent execution completed! Click "View Report" to see the full execution report.`,
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
          <div className="flex items-center gap-2">
            <IconBrain className="h-6 w-6 text-primary" stroke={1.5} />
            <h1 className="text-lg font-semibold">Mindra</h1>
          </div>
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
            <IconTrash className="h-4 w-4 mr-1" stroke={1.5} />
            Clear All
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {chatHistory.length === 0 ? (
            <div className="text-center font-semibold mt-8">
              <div className="flex justify-center mb-4">
                <IconBrain className="h-16 w-16 text-primary" stroke={1.5} />
              </div>
              <p className="text-3xl mt-4">
                What AI agent would you like to build?
              </p>
              <p className="text-muted-foreground text-base mt-4 font-normal flex items-center justify-center gap-2">
                <IconMessageCircle className="h-4 w-4" stroke={1.5} />
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

          {/* Execution Steps Display - Enhanced */}
          {executionState && executionState.steps.length > 0 && (
            <Card className="p-4 border-primary/20">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <IconGitBranch className="h-4 w-4" stroke={1.5} />
                  <span>Execution Timeline</span>
                  {isExecuting && <Loader />}
                </h3>
                <div className="text-xs text-muted-foreground">
                  {executionState.steps.filter(s => s.status === 'completed').length} / {executionState.steps.length} completed
                </div>
              </div>
              <ScrollArea className="h-[250px]">
                <div className="space-y-2">
                  {executionState.steps.map((step, index) => {
                    const isExpanded = expandedSteps.has(step.id);
                    const stepIcon = step.status === 'completed' ? IconCheck : 
                                    step.status === 'running' ? IconClock : 
                                    step.status === 'error' ? IconAlertCircle : IconClock;
                    const StepIcon = stepIcon;
                    
                    return (
                      <div
                        key={step.id}
                        className={`border rounded-lg overflow-hidden transition-all ${
                          step.status === 'running' ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20' :
                          step.status === 'completed' ? 'border-green-500/30 bg-green-50/30 dark:bg-green-950/10' :
                          step.status === 'error' ? 'border-red-500/30 bg-red-50/30 dark:bg-red-950/10' :
                          'border-border'
                        }`}
                      >
                        <div 
                          className="p-3 cursor-pointer hover:bg-muted/50"
                          onClick={() => {
                            const newExpanded = new Set(expandedSteps);
                            if (isExpanded) {
                              newExpanded.delete(step.id);
                            } else {
                              newExpanded.add(step.id);
                            }
                            setExpandedSteps(newExpanded);
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted">
                                <span className="text-xs font-medium">{index + 1}</span>
                              </div>
                              <StepIcon className={`h-4 w-4 ${
                                step.status === 'running' ? 'text-blue-500' :
                                step.status === 'completed' ? 'text-green-500' :
                                step.status === 'error' ? 'text-red-500' :
                                'text-muted-foreground'
                              }`} stroke={1.5} />
                              <span className="font-medium text-sm">{step.nodeName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  step.status === 'completed' ? 'default' :
                                  step.status === 'running' ? 'secondary' :
                                  step.status === 'error' ? 'destructive' : 'outline'
                                }
                                className="text-[10px]"
                              >
                                {step.status}
                              </Badge>
                              {isExpanded ? <IconChevronUp className="h-3 w-3" /> : <IconChevronDown className="h-3 w-3" />}
                            </div>
                          </div>
                        </div>
                        
                        {isExpanded && (
                          <div className="px-3 pb-3 space-y-2 border-t pt-2">
                            {step.input && (
                              <div className="text-xs">
                                <div className="font-medium text-muted-foreground mb-1">Input:</div>
                                <div className="bg-muted/50 p-2 rounded text-xs">
                                  {step.input.substring(0, 200)}
                                  {step.input.length > 200 ? '...' : ''}
                                </div>
                              </div>
                            )}
                            {step.output && (
                              <div className="text-xs">
                                <div className="font-medium text-muted-foreground mb-1">Output:</div>
                                <div className="bg-muted/50 p-2 rounded text-xs">
                                  {step.output}
                                </div>
                              </div>
                            )}
                            {step.toolCalls && step.toolCalls.length > 0 && (
                              <div className="text-xs">
                                <div className="font-medium text-muted-foreground mb-1">Tools Used:</div>
                                {step.toolCalls.map((tool, i) => (
                                  <div key={i} className="bg-blue-50 dark:bg-blue-950/20 p-2 rounded mb-1">
                                    <div className="font-medium text-blue-600 dark:text-blue-400">
                                      🔧 {tool.name}
                                    </div>
                                    {tool.result && (
                                      <div className="text-[10px] mt-1 text-muted-foreground">
                                        {JSON.stringify(tool.result).substring(0, 150)}...
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
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
          <div className="flex items-center gap-2">
            <IconNetwork className="h-5 w-5 text-primary" stroke={1.5} />
            <h2 className="text-lg font-semibold">Workflow Canvas</h2>
          </div>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="default"
              onClick={handleAddNode}
            >
              <IconPlus className="h-4 w-4 mr-1" stroke={1.5} />
              Add Node
            </Button>
            <Button size="sm" variant="outline">
              <IconDownload className="h-4 w-4 mr-1" stroke={1.5} />
              JSON
            </Button>
            <Button size="sm" variant="outline">
              <IconPhoto className="h-4 w-4 mr-1" stroke={1.5} />
              Image
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
                  <>
                    <IconPlayerPlay className="h-4 w-4 mr-1" stroke={1.5} />
                    Execute Agent
                  </>
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
                <IconNetwork className="h-12 w-12 mx-auto mb-4 opacity-50" stroke={1.5} />
                <p className="text-lg">Your workflow will appear here</p>
                <p className="text-sm mt-2 flex items-center justify-center gap-1">
                  <IconMessageCircle className="h-3 w-3" stroke={1.5} />
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
              panOnDrag={[1, 2]}
              selectionOnDrag={false}
              onConnect={onConnect}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              edgesReconnectable={true}
              edgesFocusable={true}
            >
              <Controls />
              <Panel position="top-left">
                <div className="bg-card border rounded-lg p-2 text-xs space-y-2 shadow-sm max-w-[200px]">
                  <div className="font-semibold flex items-center gap-1 border-b pb-1">
                    <IconBolt className="h-3 w-3" stroke={1.5} />
                    Quick Guide
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-0.5 bg-primary animate-pulse" />
                      <span>Active flow</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-0.5 bg-muted-foreground" />
                      <span>Conditional</span>
                    </div>
                  </div>
                  <div className="border-t pt-2 space-y-1 text-[10px] text-muted-foreground">
                    <div>• Drag nodes to move</div>
                    <div>• Click text to edit</div>
                    <div>• Drag from circles to connect</div>
                    <div>• Select edge & Del to remove</div>
                  </div>
                </div>
              </Panel>
              
              {/* Execution Status Overlay */}
              {isExecuting && executionState && (
                <Panel position="bottom-right">
                  <div className="bg-card border-2 border-primary rounded-lg p-3 shadow-lg max-w-[280px]">
                    <div className="flex items-center gap-2 mb-2">
                      <Loader />
                      <span className="font-semibold text-sm">Agent Executing</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">
                          {executionState.steps.filter(s => s.status === 'completed').length} / {executionState.steps.length}
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div 
                          className="bg-primary h-1.5 rounded-full transition-all"
                          style={{ 
                            width: `${(executionState.steps.filter(s => s.status === 'completed').length / executionState.steps.length) * 100}%` 
                          }}
                        />
                      </div>
                      {executionState.currentNode && (
                        <div className="text-xs pt-1 border-t">
                          <div className="text-muted-foreground mb-1">Current:</div>
                          <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                            <IconClock className="h-3 w-3" stroke={1.5} />
                            {nodes.find(n => n.id === executionState.currentNode)?.data.label || 'Processing...'}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Panel>
              )}
              
              {/* Execution Complete Overlay */}
              {executionState && !isExecuting && executionState.status === 'completed' && (
                <Panel position="bottom-right">
                  <div className="bg-card border-2 border-green-500 rounded-lg p-3 shadow-lg max-w-[280px]">
                    <div className="flex items-center gap-2 mb-2">
                      <IconCheck className="h-5 w-5 text-green-500" stroke={1.5} />
                      <div>
                        <div className="font-semibold text-sm">Execution Complete</div>
                        <div className="text-xs text-muted-foreground">
                          {executionState.steps.length} steps completed successfully
                        </div>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      className="w-full mt-2"
                      onClick={() => setShowReport(true)}
                    >
                      <IconFileText className="h-4 w-4 mr-1" stroke={1.5} />
                      View Report
                    </Button>
                  </div>
                </Panel>
              )}
            </Canvas>
          )}
        </div>
      </div>

      {/* Edit Node Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconEdit className="h-5 w-5" stroke={1.5} />
              Edit Node
            </DialogTitle>
            <DialogDescription>
              Modify the properties of this workflow node.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="label" className="text-sm font-medium">
                Node Label
              </label>
              <Input
                id="label"
                value={editForm.label}
                onChange={(e) => setEditForm(prev => ({ ...prev, label: e.target.value }))}
                placeholder="e.g., Data Processing"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="description" className="text-sm font-medium">
                Description
              </label>
              <Input
                id="description"
                value={editForm.description}
                onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="e.g., Processes incoming data"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="content" className="text-sm font-medium">
                Content
              </label>
              <Textarea
                id="content"
                value={editForm.content}
                onChange={(e) => setEditForm(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Detailed explanation of what this node does..."
                rows={4}
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="footer" className="text-sm font-medium">
                Footer
              </label>
              <Input
                id="footer"
                value={editForm.footer}
                onChange={(e) => setEditForm(prev => ({ ...prev, footer: e.target.value }))}
                placeholder="e.g., AI Model: GPT-4"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>
              <IconEdit className="h-4 w-4 mr-1" stroke={1.5} />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Execution Report Modal */}
      <Dialog open={showReport} onOpenChange={setShowReport}>
        <DialogContent className="sm:max-w-[900px] max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IconFileText className="h-5 w-5" stroke={1.5} />
                Execution Report
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(executionReport);
                  setChatHistory(prev => [
                    ...prev,
                    {
                      type: 'assistant',
                      content: '📋 Report copied to clipboard!',
                    },
                  ]);
                }}
              >
                <IconDownload className="h-4 w-4 mr-1" stroke={1.5} />
                Copy Markdown
              </Button>
            </DialogTitle>
            <DialogDescription>
              Comprehensive execution report with all steps, outputs, and tool usage
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[calc(85vh-140px)] pr-4">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {executionReport}
              </ReactMarkdown>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReport(false)}>
              <IconX className="h-4 w-4 mr-1" stroke={1.5} />
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
