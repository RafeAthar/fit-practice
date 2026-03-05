export type NodeType = 'root' | 'topic' | 'idea' | 'question' | 'action';
export type EdgeType = 'hierarchical' | 'associative' | 'causal' | 'contradicts';
export type InputSource = 'voice' | 'text' | 'ai-generated';

export interface MindMapNode {
  id: string;
  label: string;
  type: NodeType;
  position: { x: number; y: number };
  isPositionedByUser: boolean;
  metadata: {
    createdAt: number;
    source: InputSource;
    confidence?: number;
    originalTranscript?: string;
  };
}

export interface MindMapEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type: EdgeType;
}

export type GraphOperation =
  | { type: 'ADD_NODE'; payload: { id?: string; label: string; nodeType?: NodeType; parentId?: string; relationship?: string; confidence?: number; source?: InputSource } }
  | { type: 'ADD_EDGE'; payload: { sourceId: string; targetId: string; label?: string; edgeType?: EdgeType } }
  | { type: 'UPDATE_NODE'; payload: { nodeId: string; label?: string; nodeType?: NodeType } }
  | { type: 'DELETE_NODE'; payload: { nodeId: string; deleteChildren: boolean } };

export interface GraphState {
  nodes: Record<string, MindMapNode>;
  edges: Record<string, MindMapEdge>;
  rootNodeId: string;
  version: number;
}

export interface PendingOperation {
  id: string;
  operation: GraphOperation;
  reason: string;
}
