import { NextRequest } from 'next/server';
import { AgentOrchestrator } from '@/lib/agent-orchestrator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  try {
    const { userInput, nodes, edges } = await request.json();

    if (!userInput || !nodes || !edges) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Create a streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const orchestrator = new AgentOrchestrator(apiKey, executionId);

        try {
          // Execute workflow with real-time updates
          await orchestrator.executeWorkflow(
            userInput,
            nodes,
            edges,
            (state) => {
              // Send state update as SSE
              const data = JSON.stringify(state);
              controller.enqueue(
                encoder.encode(`data: ${data}\n\n`),
              );
            },
          );

          // Send final completion message
          const finalState = orchestrator.getState();
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ ...finalState, done: true })}\n\n`),
          );

          controller.close();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: errorMessage, done: true })}\n\n`,
            ),
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Agent execution error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

