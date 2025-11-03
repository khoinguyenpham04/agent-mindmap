import { z } from 'zod';

// Define agent tools with Zod schemas for validation
export const agentTools = [
  {
    name: 'web_search',
    description:
      'Search the web for information. Use this when you need current information or facts.',
    parameters: z.object({
      query: z.string().describe('The search query'),
      num_results: z.number().optional().describe('Number of results to return (default: 5)'),
    }),
    execute: async (args: { query: string; num_results?: number }) => {
      // In production, integrate with a real search API (Serper, Brave, etc.)
      console.log('Searching web for:', args.query);
      return {
        results: [
          {
            title: 'Example Result',
            url: 'https://example.com',
            snippet: `Information about ${args.query}...`,
          },
        ],
        message: `Found results for "${args.query}"`,
      };
    },
  },
  {
    name: 'calculate',
    description: 'Perform mathematical calculations. Supports basic arithmetic and complex expressions.',
    parameters: z.object({
      expression: z.string().describe('The mathematical expression to evaluate'),
    }),
    execute: async (args: { expression: string }) => {
      try {
        // Simple eval for demo - use math.js or similar in production
        const result = eval(args.expression);
        return { result, message: `${args.expression} = ${result}` };
      } catch (error) {
        return { error: 'Invalid expression', message: 'Could not evaluate expression' };
      }
    },
  },
  {
    name: 'get_weather',
    description: 'Get current weather information for a location.',
    parameters: z.object({
      location: z.string().describe('City name or location'),
      units: z.enum(['celsius', 'fahrenheit']).optional().describe('Temperature units'),
    }),
    execute: async (args: { location: string; units?: string }) => {
      // In production, integrate with a weather API
      console.log('Getting weather for:', args.location);
      return {
        location: args.location,
        temperature: 72,
        conditions: 'Partly cloudy',
        humidity: 65,
        message: `Weather in ${args.location}: 72°F, Partly cloudy`,
      };
    },
  },
  {
    name: 'send_email',
    description: 'Send an email to a recipient. Use this for notifications or communications.',
    parameters: z.object({
      to: z.string().email().describe('Recipient email address'),
      subject: z.string().describe('Email subject'),
      body: z.string().describe('Email body content'),
    }),
    execute: async (args: { to: string; subject: string; body: string }) => {
      // In production, integrate with SendGrid, Resend, etc.
      console.log('Sending email to:', args.to);
      return {
        success: true,
        message: `Email sent to ${args.to} with subject "${args.subject}"`,
      };
    },
  },
  {
    name: 'create_calendar_event',
    description: 'Create a calendar event or reminder.',
    parameters: z.object({
      title: z.string().describe('Event title'),
      date: z.string().describe('Event date (YYYY-MM-DD format)'),
      time: z.string().describe('Event time (HH:MM format)'),
      duration: z.number().optional().describe('Duration in minutes'),
    }),
    execute: async (args: { title: string; date: string; time: string; duration?: number }) => {
      // In production, integrate with Google Calendar API
      console.log('Creating calendar event:', args.title);
      return {
        success: true,
        event_id: 'evt_' + Math.random().toString(36).substr(2, 9),
        message: `Created event "${args.title}" on ${args.date} at ${args.time}`,
      };
    },
  },
  {
    name: 'analyze_sentiment',
    description: 'Analyze the sentiment of text (positive, negative, or neutral).',
    parameters: z.object({
      text: z.string().describe('Text to analyze'),
    }),
    execute: async (args: { text: string }) => {
      // Simple sentiment analysis - use a proper model in production
      const text = args.text.toLowerCase();
      const positiveWords = ['good', 'great', 'excellent', 'happy', 'love', 'amazing'];
      const negativeWords = ['bad', 'terrible', 'hate', 'angry', 'sad', 'awful'];
      
      const positiveCount = positiveWords.filter(word => text.includes(word)).length;
      const negativeCount = negativeWords.filter(word => text.includes(word)).length;
      
      let sentiment = 'neutral';
      let score = 0;
      
      if (positiveCount > negativeCount) {
        sentiment = 'positive';
        score = 0.7;
      } else if (negativeCount > positiveCount) {
        sentiment = 'negative';
        score = -0.7;
      }
      
      return {
        sentiment,
        score,
        confidence: 0.85,
        message: `Sentiment: ${sentiment} (score: ${score})`,
      };
    },
  },
];

// Convert tools to OpenAI function format
export const getOpenAITools = () => {
  return agentTools.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: Object.entries(tool.parameters.shape).reduce((acc, [key, value]: [string, any]) => {
          acc[key] = {
            type: value._def.typeName === 'ZodString' ? 'string' : 
                  value._def.typeName === 'ZodNumber' ? 'number' : 
                  value._def.typeName === 'ZodEnum' ? 'string' : 'string',
            description: value.description || '',
            ...(value._def.typeName === 'ZodEnum' && {
              enum: value._def.values,
            }),
          };
          return acc;
        }, {} as Record<string, any>),
        required: Object.entries(tool.parameters.shape)
          .filter(([_, value]: [string, any]) => !value.isOptional())
          .map(([key]) => key),
      },
    },
  }));
};

// Execute a tool by name
export const executeTool = async (toolName: string, args: any) => {
  const tool = agentTools.find(t => t.name === toolName);
  if (!tool) {
    throw new Error(`Tool ${toolName} not found`);
  }
  return await tool.execute(args);
};

