import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

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
  };
}

interface EdgeData {
  id: string;
  source: string;
  target: string;
  type: string;
}

interface WorkflowResponse {
  nodes: NodeData[];
  edges: EdgeData[];
  description: string;
}

const WORKFLOW_SYSTEM_PROMPT = `You are an expert AI workflow architect. Your job is to design intelligent, well-structured AI agent workflows based on user requirements.

When a user describes what they want to build, analyze their needs and create a comprehensive workflow with nodes and edges.

CRITICAL: Edge source and target MUST exactly match node IDs. Double-check that every edge references valid node IDs.

GUIDELINES:
1. Create 4-10 nodes depending on complexity
2. Each node should represent a distinct step or agent in the workflow
3. Use clear, descriptive names for each node
4. Position nodes logically (left to right, top to bottom for branches)
5. Create appropriate connections (edges) between nodes
6. Use "animated" edge type for primary/active flows
7. Use "temporary" edge type for conditional/error/fallback paths
8. Include practical implementation details in each node's content

NODE STRUCTURE:
- id: unique identifier (lowercase, underscore separated, e.g., "input_node", "processing_step")
- label: Clear, concise name (2-4 words)
- description: What this node does (5-10 words)
- content: Detailed explanation of implementation (20-50 words)
- footer: Technical details, model names, or status info
- handles: { target: true/false, source: true/false } - target for incoming, source for outgoing
- position: { x: number, y: number } - space nodes 400-500 pixels apart horizontally, use vertical spacing for branches

EDGE STRUCTURE:
- id: unique identifier (e.g., "e1", "e2", "e3")
- source: MUST exactly match a node's id
- target: MUST exactly match a node's id
- type: "animated" or "temporary"

EDGE TYPES:
- "animated": Primary execution paths, main workflow flow
- "temporary": Conditional branches, error handlers, optional paths

POSITIONING TIPS:
- Start at x: 0, y: 0 for first node
- Space horizontally by 400-500px for sequential steps
- Use vertical offsets (-300, -150, 150, 300) for parallel branches
- Keep related nodes close together

Return ONLY valid JSON in this exact format:
{
  "nodes": [
    {
      "id": "input_node",
      "type": "workflow",
      "position": { "x": 0, "y": 0 },
      "data": {
        "label": "Input Handler",
        "description": "Receives and validates user input",
        "handles": { "target": false, "source": true },
        "content": "Accepts user requests via API, validates format and content, sanitizes input data",
        "footer": "Entry point"
      }
    },
    {
      "id": "processing_node",
      "type": "workflow",
      "position": { "x": 450, "y": 0 },
      "data": {
        "label": "Data Processing",
        "description": "Processes the validated input",
        "handles": { "target": true, "source": true },
        "content": "Transforms data using business rules, enriches with additional context",
        "footer": "Core logic"
      }
    },
    {
      "id": "output_node",
      "type": "workflow",
      "position": { "x": 900, "y": 0 },
      "data": {
        "label": "Output Generator",
        "description": "Generates final response",
        "handles": { "target": true, "source": false },
        "content": "Formats processed data into response, adds metadata and timestamps",
        "footer": "Final step"
      }
    }
  ],
  "edges": [
    {
      "id": "e1",
      "source": "input_node",
      "target": "processing_node",
      "type": "animated"
    },
    {
      "id": "e2",
      "source": "processing_node",
      "target": "output_node",
      "type": "animated"
    }
  ],
  "description": "A simple three-step workflow that processes user input"
}

REMEMBER: Every edge's "source" and "target" must EXACTLY match an existing node's "id". Example: if you have a node with id "input_node", edges must reference "input_node" exactly.`;

export async function POST(request: NextRequest) {
  try {
    const { message, currentNodes, currentEdges } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 },
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to your .env.local file' },
        { status: 500 },
      );
    }

    const openai = new OpenAI({ apiKey });

    // Build context from existing workflow if any
    let contextMessage = '';
    if (currentNodes && currentNodes.length > 0) {
      contextMessage = `\n\nCURRENT WORKFLOW CONTEXT:
The user already has a workflow with ${currentNodes.length} nodes. 
Current nodes: ${currentNodes.map((n: any) => n.data.label).join(', ')}

The user's message might be asking to:
- Modify the existing workflow
- Add new nodes
- Redesign it entirely
- Extend it with new capabilities

Consider their existing workflow when designing the new one.`;
    }

    const userPrompt = `Design an AI agent workflow for the following requirement:

"${message}"
${contextMessage}

Create a complete workflow with nodes and edges that implement this requirement. Be creative, practical, and include all necessary steps for a production-ready AI agent system.

Return ONLY the JSON response, no other text.`;

    console.log('Generating workflow with LLM...');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: WORKFLOW_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response from LLM');
    }

    console.log('LLM Response:', content);

    const workflow: WorkflowResponse = JSON.parse(content);

    // Validate the response structure
    if (!workflow.nodes || !Array.isArray(workflow.nodes) || workflow.nodes.length === 0) {
      throw new Error('Invalid workflow structure: nodes array is missing or empty');
    }

    if (!workflow.edges || !Array.isArray(workflow.edges)) {
      throw new Error('Invalid workflow structure: edges array is missing');
    }

    // Ensure all nodes have the required structure
    workflow.nodes = workflow.nodes.map((node, index) => ({
      id: node.id || `node_${index}`,
      type: 'workflow',
      position: node.position || { x: index * 400, y: 0 },
      data: {
        label: node.data?.label || `Node ${index + 1}`,
        description: node.data?.description || 'Processing step',
        handles: node.data?.handles || { target: index > 0, source: index < workflow.nodes.length - 1 },
        content: node.data?.content || 'Processing data',
        footer: node.data?.footer || 'Agent step',
      },
    }));

    // Create a map of valid node IDs
    const nodeIds = new Set(workflow.nodes.map(n => n.id));
    
    // Filter and validate edges - only keep edges where both source and target exist
    workflow.edges = workflow.edges
      .filter(edge => {
        const hasValidSource = nodeIds.has(edge.source);
        const hasValidTarget = nodeIds.has(edge.target);
        
        if (!hasValidSource) {
          console.warn(`Edge ${edge.id} has invalid source: ${edge.source}`);
        }
        if (!hasValidTarget) {
          console.warn(`Edge ${edge.id} has invalid target: ${edge.target}`);
        }
        
        return hasValidSource && hasValidTarget;
      })
      .map((edge, index) => ({
        id: edge.id || `e${index + 1}`,
        source: edge.source,
        target: edge.target,
        type: edge.type || 'animated',
      }));

    // If no valid edges, create a simple sequential flow as fallback
    if (workflow.edges.length === 0 && workflow.nodes.length > 1) {
      console.log('No valid edges found, creating sequential flow as fallback');
      workflow.edges = workflow.nodes.slice(0, -1).map((node, index) => ({
        id: `e${index + 1}`,
        source: node.id,
        target: workflow.nodes[index + 1].id,
        type: 'animated',
      }));
    }

    // Log the node IDs and edges for debugging
    console.log('Node IDs:', Array.from(nodeIds));
    console.log('Edges:', workflow.edges.map(e => `${e.source} -> ${e.target}`));

    console.log('Generated workflow:', {
      nodeCount: workflow.nodes.length,
      edgeCount: workflow.edges.length,
    });

    return NextResponse.json({
      nodes: workflow.nodes,
      edges: workflow.edges,
      description: workflow.description || 'Workflow generated successfully',
    });
  } catch (error) {
    console.error('Workflow generation error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate workflow',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
