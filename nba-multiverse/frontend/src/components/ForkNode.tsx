import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { EventNodeData } from '../types';

function ForkNode({ data }: NodeProps) {
  const d = data as unknown as EventNodeData;

  return (
    <>
      <Handle type="target" position={Position.Left} />
      <div
        className="timeline-event-node fork"
        onClick={d.onClick}
        style={{ cursor: 'pointer' }}
      >
        <div className="node-date">{d.timestamp}</div>
        <div className="node-title">{d.label}</div>
        <div className="node-desc">{d.description?.slice(0, 80)}...</div>
        <div className="fork-hint">✦ 点击选择命运 ✦</div>
      </div>
      <Handle type="source" position={Position.Right} />
    </>
  );
}

export default memo(ForkNode);
