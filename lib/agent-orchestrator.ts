import OpenAI from 'openai';
import { executeTool, getOpenAITools } from './agent-tools';

export interface AgentStep {
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

export interface AgentExecutionState {
  executionId: string;
  status: 'initializing' | 'running' | 'completed' | 'error';
  steps: AgentStep[];
  currentNode: string | null;
  finalOutput?: string;
  error?: string;
}

export class AgentOrchestrator {
  private openai: OpenAI;
  private state: AgentExecutionState;

  constructor(apiKey: string, executionId: string) {
    this.openai = new OpenAI({ apiKey });
    this.state = {
      executionId,
      status: 'initializing',
      steps: [],
      currentNode: null,
    };
  }

  async executeWorkflow(
    userInput: string,
    nodes: any[],
    edges: any[],
    onUpdate?: (state: AgentExecutionState) => void,
  ): Promise<AgentExecutionState> {
    try {
      this.state.status = 'running';
      onUpdate?.(this.state);

      // Find the starting node (no incoming edges)
      const startNode = nodes.find(
        node => !edges.some(edge => edge.target === node.id),
      );

      if (!startNode) {
        throw new Error('No starting node found in workflow');
      }

      // Execute workflow sequentially through nodes
      await this.executeNode(startNode, userInput, nodes, edges, onUpdate);

      this.state.status = 'completed';
      onUpdate?.(this.state);

      return this.state;
    } catch (error) {
      this.state.status = 'error';
      this.state.error = error instanceof Error ? error.message : 'Unknown error';
      onUpdate?.(this.state);
      throw error;
    }
  }

  private async executeNode(
    node: any,
    input: string,
    nodes: any[],
    edges: any[],
    onUpdate?: (state: AgentExecutionState) => void,
  ): Promise<string> {
    const stepId = `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const step: AgentStep = {
      id: stepId,
      nodeId: node.id,
      nodeName: node.data.label,
      status: 'running',
      input,
      timestamp: Date.now(),
    };

    this.state.currentNode = node.id;
    this.state.steps.push(step);
    onUpdate?.(this.state);

    try {
      // Simulate node processing with AI
      const prompt = this.buildNodePrompt(node, input);
      const result = await this.callLLM(prompt, node);

      step.output = result.content;
      step.toolCalls = result.toolCalls;
      step.status = 'completed';
      onUpdate?.(this.state);

      // Find next nodes
      const nextEdges = edges.filter(edge => edge.source === node.id);
      
      if (nextEdges.length === 0) {
        // Terminal node - store final output
        this.state.finalOutput = result.content;
        return result.content;
      }

      // If multiple edges, execute all paths (simplified - just take first for now)
      const nextEdge = nextEdges[0];
      const nextNode = nodes.find(n => n.id === nextEdge.target);
      
      if (nextNode) {
        return await this.executeNode(nextNode, result.content, nodes, edges, onUpdate);
      }

      return result.content;
    } catch (error) {
      step.status = 'error';
      step.error = error instanceof Error ? error.message : 'Unknown error';
      onUpdate?.(this.state);
      throw error;
    }
  }

  private buildNodePrompt(node: any, input: string): string {
    const nodeDescription = node.data.description || '';
    const nodeContent = node.data.content || '';
    
    return `
You are executing a step in an AI agent workflow.

**Current Node**: ${node.data.label}
**Node Description**: ${nodeDescription}
**Node Purpose**: ${nodeContent}

**Input from Previous Step**: ${input}

Please process this input according to the node's purpose and provide the output for the next step.
If you need to use any tools, use them appropriately.
`.trim();
  }

  private async callLLM(
    prompt: string,
    node: any,
  ): Promise<{ content: string; toolCalls: any[] }> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content:
          'You are an AI agent executing a workflow. Process each step carefully and use tools when appropriate.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ];

    const tools = getOpenAITools();
    const toolCalls: any[] = [];

    // First call to LLM (may request tool calls)
    let response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: 'auto',
      temperature: 0.7,
    });

    let assistantMessage = response.choices[0].message;

    // Handle tool calls if any
    while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      messages.push(assistantMessage);

      // Execute each tool call
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);

        try {
          const toolResult = await executeTool(toolName, toolArgs);
          
          toolCalls.push({
            name: toolName,
            arguments: toolArgs,
            result: toolResult,
          });

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult),
          });
        } catch (error) {
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: 'Tool execution failed' }),
          });
        }
      }

      // Call LLM again with tool results
      response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: 'auto',
        temperature: 0.7,
      });

      assistantMessage = response.choices[0].message;
    }

    return {
      content: assistantMessage.content || 'No response generated',
      toolCalls,
    };
  }

  getState(): AgentExecutionState {
    return this.state;
  }
}

