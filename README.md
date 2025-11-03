# AI Agent Workflow Builder

An interactive AI agent orchestration platform that lets you design, visualize, and execute AI agent workflows with real-time monitoring.

![AI Agent Workflow](https://img.shields.io/badge/AI-Agent%20Orchestration-blue)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

## Features

### 🎨 Visual Workflow Designer
- **Interactive Canvas**: Drag-and-drop nodes to design your agent workflows
- **Real-time Visualization**: See your agent architecture come to life
- **Multiple Edge Types**: Animated edges for active flows, temporary edges for conditional paths

### 🤖 AI-Powered Workflow Generation
- **Natural Language Input**: Describe your agent in plain English
- **Smart Templates**: Pre-built patterns for common use cases:
  - Customer Support Agents (sentiment analysis, routing)
  - Research Agents (search, extraction, synthesis)
  - E-commerce Multi-Agent Systems (recommendations, pricing, fraud detection)
  - Generic AI Agents (customizable workflows)

### ⚡ Real Agent Execution
- **Live Orchestration**: Execute your workflows with real AI models
- **Tool Integration**: Built-in tools for web search, calculations, weather, email, sentiment analysis
- **Streaming Updates**: Watch your agent work in real-time with step-by-step execution
- **State Tracking**: Monitor node status, tool calls, and outputs

### 🛠️ Built-in Tools
- `web_search`: Search the web for information
- `calculate`: Perform mathematical calculations
- `get_weather`: Get weather information
- `send_email`: Send emails
- `create_calendar_event`: Create calendar events
- `analyze_sentiment`: Analyze text sentiment

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or pnpm
- OpenAI API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd ai-workflow
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env.local` file in the root directory:
   ```bash
   cp .env.local.example .env.local
   ```
   
   Add your OpenAI API key:
   ```env
   OPENAI_API_KEY=sk-your-openai-api-key-here
   ```
   
   Get your API key from: https://platform.openai.com/api-keys

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

### Creating a Workflow

1. **Describe Your Agent**: In the left panel, describe the AI agent you want to build
   - Example: "Create a customer support AI agent with sentiment analysis and ticket routing"
   
2. **Visualize**: The workflow will be automatically generated and displayed on the right canvas

3. **Customize**: Drag nodes to rearrange them, zoom in/out, and pan around

### Executing a Workflow

1. **Generate a Workflow**: First, create a workflow using the chat interface

2. **Enter Input**: In the execution input field above the canvas, enter the task for your agent
   - Example: "I need help with my order #12345"

3. **Run**: Click "▶️ Execute Agent" to start the workflow

4. **Monitor**: Watch as:
   - Nodes light up and change status (running → completed)
   - Execution steps appear in the chat panel
   - Tool calls are displayed with their results
   - Final output is shown when complete

### Example Workflows

#### Customer Support Agent
```
"Create a customer support AI agent with sentiment analysis and ticket routing"
```
This generates a workflow with:
- Sentiment analysis
- Intent classification
- Smart routing to urgent/automated/standard queues
- Response generation

#### Research Agent
```
"Build a research AI agent that searches, summarizes, and reports findings"
```
This creates a workflow with:
- Query planning
- Multi-source search
- Content extraction
- Fact validation
- Synthesis and reporting

#### E-commerce System
```
"Design a multi-agent system for e-commerce with recommendation, inventory, and checkout agents"
```
This builds a multi-agent system with:
- Recommendation engine
- Inventory management
- Dynamic pricing
- Fraud detection
- Order fulfillment

## Architecture

### Frontend (`app/page.tsx`)
- React-based UI with split-view design
- Chat interface for workflow generation
- Interactive canvas for visualization
- Real-time execution monitoring

### Backend

#### API Routes
- `/api/generate-workflow`: Generates workflow structure from natural language
- `/api/execute-agent`: Executes agent workflows with streaming updates

#### Agent System
- `lib/agent-orchestrator.ts`: Core orchestration logic
  - Sequential node execution
  - LLM integration (OpenAI GPT-4o-mini)
  - Tool calling and state management
  
- `lib/agent-tools.ts`: Tool definitions and execution
  - Zod schemas for validation
  - Extensible tool framework

### Tech Stack
- **Framework**: Next.js 16 (App Router)
- **UI**: Tailwind CSS, shadcn/ui, AI Elements
- **Visualization**: React Flow (@xyflow/react)
- **AI**: OpenAI API, LangChain
- **Language**: TypeScript
- **Validation**: Zod

## Extending the System

### Adding New Tools

Edit `lib/agent-tools.ts`:

```typescript
{
  name: 'your_tool_name',
  description: 'What your tool does',
  parameters: z.object({
    param1: z.string().describe('Parameter description'),
    param2: z.number().optional(),
  }),
  execute: async (args) => {
    // Your tool logic here
    return { result: 'success' };
  },
}
```

### Adding New Workflow Templates

Edit `app/api/generate-workflow/route.ts` in the `generateWorkflowFromPrompt` function:

```typescript
if (lowerMessage.includes('your-trigger-word')) {
  return {
    nodes: [ /* your nodes */ ],
    edges: [ /* your edges */ ],
    description: 'Description of the workflow',
  };
}
```

### Customizing Agent Behavior

Modify `lib/agent-orchestrator.ts`:
- Change the LLM model in `callLLM()` method
- Adjust the prompt in `buildNodePrompt()` method
- Add custom execution logic in `executeNode()` method

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key for GPT models | Yes |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude models | No |

## Troubleshooting

### "OpenAI API key not configured"
- Make sure you created `.env.local` file
- Verify your API key is correctly set
- Restart the development server after adding the key

### Workflow not executing
- Check browser console for errors
- Verify your API key has credits
- Check network tab for API responses

### Nodes not updating during execution
- Ensure you're using a modern browser with EventSource support
- Check that streaming is working in the Network tab

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Acknowledgments

- Built with [AI Elements](https://ai-elements.dev)
- Powered by [OpenAI](https://openai.com)
- UI components from [shadcn/ui](https://ui.shadcn.com)
- Workflow visualization with [React Flow](https://reactflow.dev)

---

**Note**: This is a development tool. For production use, implement proper:
- Authentication and authorization
- Rate limiting
- Error handling and logging
- Tool safety and sandboxing
- Cost monitoring and limits
