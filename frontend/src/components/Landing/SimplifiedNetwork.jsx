import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import * as d3 from 'd3';

export default function SimplifiedNetwork() {
  const fgRef = useRef();
  const containerRef = useRef();
  const [dimensions, setDimensions] = React.useState({
    width: 800,
    height: 600
  });

  // Generate graph data
  const { nodes, links } = useMemo(() => {
    // Colleges
    const colleges = [
      { 
        id: 'sjcit', 
        name: 'SJCIT', 
        type: 'college', 
        color: '#F59E0B',
        size: 20,
        fx: 300,
        fy: 100
      },
      { 
        id: 'msrit', 
        name: 'MSRIT', 
        type: 'college', 
        color: '#10B981',
        size: 20,
        fx: 600,
        fy: 300
      }
    ];

    // Departments
    const departments = [
      { 
        id: 'cse', 
        name: 'CSE', 
        college: 'sjcit', 
        type: 'dept', 
        color: '#3B82F6',
        size: 16
      },
      { 
        id: 'ece', 
        name: 'ECE', 
        college: 'sjcit', 
        type: 'dept', 
        color: '#8B5CF6',
        size: 16
      },
      { 
        id: 'msrit_cse', 
        name: 'CSE', 
        college: 'msrit', 
        type: 'dept', 
        color: '#10B981',
        size: 16
      }
    ];

    // Students
    const students = [
      { 
        id: 'aarav', 
        name: 'Aarav', 
        dept: 'cse', 
        college: 'sjcit', 
        type: 'student', 
        color: '#F97316',
        size: 12
      },
      { 
        id: 'priya', 
        name: 'Priya', 
        dept: 'ece', 
        college: 'sjcit', 
        type: 'student', 
        color: '#F97316',
        size: 12
      },
      { 
        id: 'neha', 
        name: 'Neha', 
        dept: 'msrit_cse', 
        college: 'msrit', 
        type: 'student', 
        color: '#F97316',
        size: 12
      }
    ];

    // Interests
    const interests = [
      { 
        id: 'coding', 
        name: 'Coding', 
        type: 'interest', 
        color: '#EC4899',
        size: 14
      },
      { 
        id: 'video', 
        name: 'Video Editing', 
        type: 'interest', 
        color: '#06B6D4',
        size: 14
      }
    ];

    // All nodes
    const allNodes = [...colleges, ...departments, ...students, ...interests];

    // Links with different colors and values for different connection types
    const allLinks = [
      // College to departments
      { source: 'sjcit', target: 'cse', value: 2, color: '#9CA3AF' },
      { source: 'sjcit', target: 'ece', value: 2, color: '#9CA3AF' },
      { source: 'msrit', target: 'msrit_cse', value: 2, color: '#9CA3AF' },
      
      // Departments to students
      { source: 'cse', target: 'aarav', value: 2, color: '#3B82F6' },
      { source: 'ece', target: 'priya', value: 2, color: '#8B5CF6' },
      { source: 'msrit_cse', target: 'neha', value: 2, color: '#10B981' },
      
      // Students to interests
      { source: 'aarav', target: 'coding', value: 3, color: '#EC4899' },
      { source: 'priya', target: 'coding', value: 3, color: '#EC4899' },
      { source: 'priya', target: 'video', value: 3, color: '#06B6D4' },
      { source: 'neha', target: 'video', value: 3, color: '#06B6D4' }
    ];

    return { 
      nodes: allNodes,
      links: allLinks.map(link => ({
        ...link,
        // Add curved paths for better visualization
        curve: 0.1,
        // Add arrow for direction
        markerEnd: {
          type: 'arrow',
          color: link.color
        }
      }))
    };
  }, []);

  // Handle node hover
  const handleNodeHover = (node) => {
    if (!node) {
      // Reset all nodes and links
      fgRef.current.nodeColor(n => n.color);
      fgRef.current.linkColor(l => l.color);
      fgRef.current.linkWidth(1);
      return;
    }

    // Highlight connected nodes and links
    const connectedNodes = new Set([node.id]);
    const connectedLinks = new Set();

    // Find all connected nodes and links
    links.forEach(link => {
      if (link.source.id === node.id || link.target.id === node.id) {
        connectedLinks.add(link);
        if (link.source.id !== node.id) connectedNodes.add(link.source.id);
        if (link.target.id !== node.id) connectedNodes.add(link.target.id);
      }
    });

    // Update node and link colors
    fgRef.current.nodeColor(n => 
      connectedNodes.has(n.id) ? n.color : 'rgba(200,200,200,0.2)'
    );
    
    fgRef.current.linkColor(l => 
      connectedLinks.has(l) ? l.color : 'rgba(200,200,200,0.1)'
    );
    
    fgRef.current.linkWidth(l => connectedLinks.has(l) ? 2 : 0.5);
  };

  // Custom node painting
  const paintNode = useCallback((node, ctx, globalScale) => {
    const label = node.name;
    const fontSize = 12 / globalScale;
    ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
    
    // Draw node circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.size, 0, 2 * Math.PI, false);
    ctx.fillStyle = node.color;
    ctx.fill();
    
    // Add white border
    ctx.lineWidth = 2 / globalScale;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    
    // Add text label
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(label, node.x, node.y);
    
    // Add glow effect for colleges
    if (node.type === 'college') {
      ctx.shadowColor = node.color;
      ctx.shadowBlur = 15;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.size + 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.shadowBlur = 0; // Reset shadow
    }
  }, []);

  // Custom link painting
  const paintLink = useCallback((link, ctx, globalScale) => {
    const start = link.source;
    const end = link.target;
    
    // Draw line
    ctx.beginPath();
    ctx.strokeStyle = link.color;
    ctx.lineWidth = link.value || 1;
    
    // Add some curve to the line
    const curve = link.curve || 0;
    const curveX = (start.x + end.x) / 2 + (start.y - end.y) * curve;
    const curveY = (start.y + end.y) / 2 + (end.x - start.x) * curve;
    
    ctx.moveTo(start.x, start.y);
    ctx.quadraticCurveTo(curveX, curveY, end.x, end.y);
    
    // Add arrow head
    const arrowSize = 4 / globalScale;
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    
    ctx.lineTo(
      end.x - arrowSize * Math.cos(angle - Math.PI / 6),
      end.y - arrowSize * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      end.x - arrowSize * Math.cos(angle + Math.PI / 6),
      end.y - arrowSize * Math.sin(angle + Math.PI / 6)
    );
    ctx.lineTo(end.x, end.y);
    
    // Fill the arrow head
    ctx.fillStyle = link.color;
    ctx.fill();
    
    // Draw the line
    ctx.stroke();
  }, []);

  // Handle window resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: 600
        });
      }
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  return (
    <div ref={containerRef} className="w-full h-[600px] bg-white rounded-xl shadow-lg overflow-hidden">
      <ForceGraph2D
        ref={fgRef}
        graphData={{ nodes, links }}
        width={dimensions.width}
        height={dimensions.height}
        nodeLabel="name"
        nodeRelSize={8}
        linkDirectionalParticles={2}
        linkDirectionalParticleWidth={2}
        linkDirectionalParticleSpeed={0.005}
        linkDirectionalParticleColor={link => link.color}
        linkColor={link => link.color}
        linkWidth={1}
        linkCurvature={0.1}
        linkDirectionalArrowLength={6}
        linkDirectionalArrowRelPos={0.99}
        linkDirectionalArrowColor={link => link.color}
        onNodeHover={handleNodeHover}
        nodeCanvasObject={paintNode}
        linkCanvasObject={paintLink}
        d3VelocityDecay={0.3}
        warmupTicks={100}
        cooldownTicks={0}
        onEngineStop={() => fgRef.current.zoomToFit(400, 100)}
      />
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow-md text-sm">
        <div className="flex items-center mb-2">
          <div className="w-4 h-4 rounded-full bg-yellow-500 mr-2"></div>
          <span>Colleges</span>
        </div>
        <div className="flex items-center mb-2">
          <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
          <span>Departments</span>
        </div>
        <div className="flex items-center mb-2">
          <div className="w-3 h-3 rounded-full bg-orange-500 mr-2"></div>
          <span>Students</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-pink-500 mr-2"></div>
          <span>Interests</span>
        </div>
      </div>
      
      {/* Connection Info */}
      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow-md text-sm">
        <div className="font-medium mb-2">Connections:</div>
        <div className="flex items-center mb-1">
          <div className="w-8 h-px bg-pink-500 mr-2"></div>
          <span>Coding</span>
        </div>
        <div className="flex items-center">
          <div className="w-8 h-px bg-cyan-500 mr-2"></div>
          <span>Video Editing</span>
        </div>
      </div>
    </div>
  );
}
