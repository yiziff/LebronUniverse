import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { EventNodeData } from '../types';

function EventNode({ data }: NodeProps) {
  const d = data as unknown as EventNodeData;

  return (
    <>
      <Handle type="target" position={Position.Left} />
      <div
        className={`timeline-event-node ${
          d.isFork
            ? 'fork'
            : d.isDimmed
              ? 'dimmed'
              : d.isReal
                ? 'real'
                : d.isGenerated
                  ? 'generated'
                  : ''
        }`}
        onClick={d.onClick}
      >
        <div className="node-date">{d.timestamp}</div>
        <div className="node-title">{d.label}</div>
        {d.description && (
          <div className="node-desc">
            {d.description.length > 80
              ? d.description.slice(0, 80) + '...'
              : d.description}
          </div>
        )}
        {d.isGenerated && d.confidence && (
          <span className="confidence-badge">
            {Math.round(d.confidence * 100)}%
          </span>
        )}
        {d.isFork && (
          <div className="fork-hint">✦ 点击选择命运 ✦</div>
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </>
  );
}

export default memo(EventNode);
