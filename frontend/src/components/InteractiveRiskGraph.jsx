import React, { useCallback, useMemo } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { motion } from 'framer-motion';
import { cn, getRiskLevel, getRiskColor } from '../lib/utils';
import { Badge } from './ui/badge';
import { GitBranch, FileCode, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

// Custom node component for files
const FileNode = ({ data }) => {
  const { level, label: riskLabel } = getRiskLevel(data.riskScore || 0);
  const riskColor = getRiskColor(data.riskScore || 0);

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.05 }}
      className={cn(
        "px-4 py-3 rounded-lg shadow-lg border-2 min-w-[200px] bg-card cursor-pointer transition-all",
        data.isModified && "border-primary",
        !data.isModified && "border-border"
      )}
      style={{
        borderColor: data.isModified ? riskColor : undefined,
      }}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      
      <div className="flex items-start gap-2">
        <FileCode className="w-4 h-4 mt-0.5 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate text-foreground">
            {data.label}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {data.linesChanged ? `${data.linesChanged} lines` : 'No changes'}
          </div>
          {data.isModified && data.riskScore !== undefined && (
            <Badge variant={level} className="mt-2 text-xs">
              {riskLabel} Risk: {(data.riskScore * 100).toFixed(0)}%
            </Badge>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </motion.div>
  );
};

// Custom node for PR info
const PRNode = ({ data }) => {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="px-6 py-4 rounded-lg shadow-xl border-2 border-primary bg-gradient-to-br from-primary/10 to-purple-500/10 min-w-[250px]"
    >
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
      
      <div className="flex items-center gap-3 mb-2">
        <GitBranch className="w-5 h-5 text-primary" />
        <div className="font-semibold text-foreground">{data.label}</div>
      </div>
      
      <div className="text-sm text-muted-foreground">
        {data.filesChanged} files • {data.linesAdded}+ {data.linesRemoved}-
      </div>
      
      {data.overallRisk && (
        <Badge variant={getRiskLevel(data.overallRisk).level} className="mt-3">
          Overall Risk: {(data.overallRisk * 100).toFixed(0)}%
        </Badge>
      )}
    </motion.div>
  );
};

// Custom node for impact/fix suggestions
const ImpactNode = ({ data }) => {
  const Icon = data.type === 'fix' ? CheckCircle : 
               data.type === 'warning' ? AlertTriangle : XCircle;
  
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.05 }}
      onClick={data.onClick}
      className={cn(
        "px-4 py-3 rounded-lg shadow-lg border-2 min-w-[220px] cursor-pointer transition-all",
        data.type === 'fix' && "bg-low/10 border-low hover:bg-low/20",
        data.type === 'warning' && "bg-medium/10 border-medium hover:bg-medium/20",
        data.type === 'error' && "bg-critical/10 border-critical hover:bg-critical/20"
      )}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      
      <div className="flex items-start gap-2">
        <Icon className={cn(
          "w-4 h-4 mt-0.5",
          data.type === 'fix' && "text-low",
          data.type === 'warning' && "text-medium",
          data.type === 'error' && "text-critical"
        )} />
        <div className="flex-1">
          <div className="font-medium text-sm text-foreground">{data.label}</div>
          {data.description && (
            <div className="text-xs text-muted-foreground mt-1">{data.description}</div>
          )}
          {data.type === 'fix' && (
            <div className="text-xs text-low mt-2 font-medium">Click to apply →</div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const nodeTypes = {
  file: FileNode,
  pr: PRNode,
  impact: ImpactNode,
};

export const InteractiveRiskGraph = ({ riskData, onFixClick }) => {
  const initialNodes = useMemo(() => {
    if (!riskData) return [];

    const nodes = [];
    const ySpacing = 120;
    const xSpacing = 280;

    // PR Node at top
    nodes.push({
      id: 'pr',
      type: 'pr',
      position: { x: 400, y: 0 },
      data: {
        label: riskData.prTitle || 'Pull Request',
        filesChanged: riskData.filesChanged?.length || 0,
        linesAdded: riskData.stats?.additions || 0,
        linesRemoved: riskData.stats?.deletions || 0,
        overallRisk: riskData.risk_score,
      },
    });

    // File nodes in the middle
    const files = riskData.filesChanged || [];
    files.forEach((file, idx) => {
      const xPos = 200 + (idx % 3) * xSpacing;
      const yPos = ySpacing + Math.floor(idx / 3) * ySpacing;
      
      nodes.push({
        id: `file-${idx}`,
        type: 'file',
        position: { x: xPos, y: yPos },
        data: {
          label: file.filename || file,
          linesChanged: file.changes || 0,
          isModified: true,
          riskScore: file.risk_score || riskData.risk_score || 0,
        },
      });
    });

    // Impact/Fix nodes at bottom
    const impacts = [];
    
    if (riskData.risk_score >= 0.7) {
      impacts.push({
        id: 'impact-critical',
        type: 'impact',
        subtype: 'warning',
        position: { x: 150, y: ySpacing * 2.5 },
        data: {
          type: 'warning',
          label: 'High Risk Detected',
          description: 'This PR requires senior review',
        },
      });
    }

    if (riskData.suggestions?.length) {
      riskData.suggestions.forEach((suggestion, idx) => {
        impacts.push({
          id: `fix-${idx}`,
          type: 'impact',
          subtype: 'fix',
          position: { x: 150 + (idx + 1) * xSpacing, y: ySpacing * 2.5 },
          data: {
            type: 'fix',
            label: suggestion.title || 'AI Suggested Fix',
            description: suggestion.description || 'Click to apply this fix',
            onClick: () => onFixClick?.(suggestion),
          },
        });
      });
    }

    nodes.push(...impacts);

    return nodes;
  }, [riskData, onFixClick]);

  const initialEdges = useMemo(() => {
    if (!riskData) return [];

    const edges = [];
    const files = riskData.filesChanged || [];

    // Connect PR to all files
    files.forEach((_, idx) => {
      edges.push({
        id: `pr-file-${idx}`,
        source: 'pr',
        target: `file-${idx}`,
        animated: true,
        style: { stroke: getRiskColor(riskData.risk_score) },
      });
    });

    // Connect files to impacts
    files.forEach((_, fileIdx) => {
      if (riskData.risk_score >= 0.7) {
        edges.push({
          id: `file-${fileIdx}-impact-critical`,
          source: `file-${fileIdx}`,
          target: 'impact-critical',
          style: { stroke: 'hsl(var(--critical))' },
        });
      }

      riskData.suggestions?.forEach((_, fixIdx) => {
        edges.push({
          id: `file-${fileIdx}-fix-${fixIdx}`,
          source: `file-${fileIdx}`,
          target: `fix-${fixIdx}`,
          animated: true,
          style: { stroke: 'hsl(var(--low))', strokeDasharray: '5,5' },
        });
      });
    });

    return edges;
  }, [riskData]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  if (!riskData) {
    return (
      <div className="flex items-center justify-center h-[500px] text-muted-foreground">
        <div className="text-center">
          <GitBranch className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No PR data to visualize</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[600px] rounded-lg border bg-card overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
      >
        <Controls className="bg-card border border-border rounded-lg shadow-lg" />
        <MiniMap
          className="bg-card border border-border rounded-lg"
          nodeColor={(node) => {
            if (node.type === 'pr') return 'hsl(var(--primary))';
            if (node.type === 'file') return getRiskColor(node.data.riskScore);
            if (node.data.type === 'fix') return 'hsl(var(--low))';
            return 'hsl(var(--muted))';
          }}
        />
        <Background color="hsl(var(--border))" gap={16} />
      </ReactFlow>
    </div>
  );
};
