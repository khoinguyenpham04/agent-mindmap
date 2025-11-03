import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Create data directory if it doesn't exist
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'mindra.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS workflows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    nodes TEXT NOT NULL,
    edges TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id INTEGER,
    execution_id TEXT NOT NULL UNIQUE,
    input TEXT NOT NULL,
    output TEXT,
    status TEXT NOT NULL,
    steps TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_workflows_created_at ON workflows(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_executions_workflow_id ON executions(workflow_id);
  CREATE INDEX IF NOT EXISTS idx_executions_created_at ON executions(created_at DESC);
`);

export interface WorkflowRow {
  id: number;
  name: string;
  description: string | null;
  nodes: string;
  edges: string;
  created_at: string;
  updated_at: string;
}

export interface ExecutionRow {
  id: number;
  workflow_id: number | null;
  execution_id: string;
  input: string;
  output: string | null;
  status: string;
  steps: string | null;
  created_at: string;
}

// Workflow operations
export const saveWorkflow = (
  name: string,
  description: string | null,
  nodes: any[],
  edges: any[]
): number => {
  const stmt = db.prepare(`
    INSERT INTO workflows (name, description, nodes, edges)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(name, description, JSON.stringify(nodes), JSON.stringify(edges));
  return result.lastInsertRowid as number;
};

export const updateWorkflow = (
  id: number,
  name: string,
  description: string | null,
  nodes: any[],
  edges: any[]
): void => {
  const stmt = db.prepare(`
    UPDATE workflows
    SET name = ?, description = ?, nodes = ?, edges = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  stmt.run(name, description, JSON.stringify(nodes), JSON.stringify(edges), id);
};

export const getWorkflow = (id: number): WorkflowRow | undefined => {
  const stmt = db.prepare('SELECT * FROM workflows WHERE id = ?');
  return stmt.get(id) as WorkflowRow | undefined;
};

export const listWorkflows = (): WorkflowRow[] => {
  const stmt = db.prepare('SELECT * FROM workflows ORDER BY updated_at DESC');
  return stmt.all() as WorkflowRow[];
};

export const deleteWorkflow = (id: number): void => {
  const stmt = db.prepare('DELETE FROM workflows WHERE id = ?');
  stmt.run(id);
};

// Execution operations
export const saveExecution = (
  workflowId: number | null,
  executionId: string,
  input: string,
  output: string | null,
  status: string,
  steps: any[] | null
): number => {
  const stmt = db.prepare(`
    INSERT INTO executions (workflow_id, execution_id, input, output, status, steps)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    workflowId,
    executionId,
    input,
    output,
    status,
    steps ? JSON.stringify(steps) : null
  );
  return result.lastInsertRowid as number;
};

export const getExecution = (executionId: string): ExecutionRow | undefined => {
  const stmt = db.prepare('SELECT * FROM executions WHERE execution_id = ?');
  return stmt.get(executionId) as ExecutionRow | undefined;
};

export const listExecutions = (workflowId?: number): ExecutionRow[] => {
  if (workflowId) {
    const stmt = db.prepare('SELECT * FROM executions WHERE workflow_id = ? ORDER BY created_at DESC');
    return stmt.all(workflowId) as ExecutionRow[];
  }
  const stmt = db.prepare('SELECT * FROM executions ORDER BY created_at DESC LIMIT 100');
  return stmt.all() as ExecutionRow[];
};

export default db;

