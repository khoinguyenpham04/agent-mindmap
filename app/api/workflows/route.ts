import { NextRequest, NextResponse } from 'next/server';
import {
  saveWorkflow,
  updateWorkflow,
  listWorkflows,
  deleteWorkflow,
  getWorkflow,
} from '@/lib/db';

// GET /api/workflows - List all workflows
export async function GET() {
  try {
    const workflows = listWorkflows();
    
    const workflowsWithParsedData = workflows.map(workflow => ({
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      nodes: JSON.parse(workflow.nodes),
      edges: JSON.parse(workflow.edges),
      created_at: workflow.created_at,
      updated_at: workflow.updated_at,
    }));

    return NextResponse.json({ workflows: workflowsWithParsedData });
  } catch (error) {
    console.error('Error listing workflows:', error);
    return NextResponse.json(
      { error: 'Failed to list workflows' },
      { status: 500 }
    );
  }
}

// POST /api/workflows - Save a new workflow
export async function POST(request: NextRequest) {
  try {
    const { name, description, nodes, edges, id } = await request.json();

    if (!name || !nodes || !edges) {
      return NextResponse.json(
        { error: 'Name, nodes, and edges are required' },
        { status: 400 }
      );
    }

    // If ID provided, update existing workflow
    if (id) {
      updateWorkflow(id, name, description || null, nodes, edges);
      return NextResponse.json({
        message: 'Workflow updated successfully',
        id,
      });
    }

    // Otherwise, create new workflow
    const workflowId = saveWorkflow(name, description || null, nodes, edges);

    return NextResponse.json({
      message: 'Workflow saved successfully',
      id: workflowId,
    });
  } catch (error) {
    console.error('Error saving workflow:', error);
    return NextResponse.json(
      { error: 'Failed to save workflow' },
      { status: 500 }
    );
  }
}

// DELETE /api/workflows?id=X - Delete a workflow
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Workflow ID is required' },
        { status: 400 }
      );
    }

    deleteWorkflow(parseInt(id));

    return NextResponse.json({
      message: 'Workflow deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting workflow:', error);
    return NextResponse.json(
      { error: 'Failed to delete workflow' },
      { status: 500 }
    );
  }
}

