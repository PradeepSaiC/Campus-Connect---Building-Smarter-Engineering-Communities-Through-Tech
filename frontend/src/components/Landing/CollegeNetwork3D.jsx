import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';

const CollegeNetwork3D = () => {
  const fgRef = useRef();
  const [dimensions, setDimensions] = React.useState({
    width: typeof window !== 'undefined' ? Math.min(1000, window.innerWidth - 40) : 1000,
    height: 600,
  });

  // Update dimensions on window resize
  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: Math.min(1000, window.innerWidth - 40),
        height: 600,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Generate graph data
  const { nodes, links } = useMemo(() => {
    // Colleges in Karnataka
    const colleges = [
      { 
        id: 'sjcit', 
        name: 'SJCIT', 
        type: 'college', 
        city: 'Chikkaballapur', 
        color: '#4F46E5',
        symbol: '🏛️',
        size: 12,  // Increased size for SJCIT
        highlight: true  // Add highlight flag
      },
      { 
        id: 'rvce', 
        name: 'RVCE', 
        type: 'college', 
        city: 'Bangalore', 
        color: '#10B981',
        symbol: '🏛️',
        size: 8
      },
      { 
        id: 'msrit', 
        name: 'MSRIT', 
        type: 'college', 
        city: 'Bangalore', 
        color: '#F59E0B',
        symbol: '🏛️',
        size: 8
      },
      { 
        id: 'nie', 
        name: 'NIE', 
        type: 'college', 
        city: 'Mysore', 
        color: '#EC4899',
        symbol: '🏛️',
        size: 8
      },
    ];

    // Departments
    const departments = [
      // SJCIT departments
      { id: 'sjcit_cse', name: 'CSE', college: 'sjcit', type: 'dept', color: '#6366F1', size: 5 },
      { id: 'sjcit_ece', name: 'ECE', college: 'sjcit', type: 'dept', color: '#6366F1', size: 5 },
      { id: 'sjcit_mech', name: 'Mech', college: 'sjcit', type: 'dept', color: '#6366F1', size: 5 },
      
      // RVCE departments
      { id: 'rvce_cse', name: 'CSE', college: 'rvce', type: 'dept', color: '#34D399', size: 5 },
      { id: 'rvce_ece', name: 'ECE', college: 'rvce', type: 'dept', color: '#34D399', size: 5 },
      
      // MSRIT departments
      { id: 'msrit_cse', name: 'CSE', college: 'msrit', type: 'dept', color: '#FBBF24', size: 5 },
      { id: 'msrit_ise', name: 'ISE', college: 'msrit', type: 'dept', color: '#FBBF24', size: 5 },
      
      // NIE departments
      { id: 'nie_cse', name: 'CSE', college: 'nie', type: 'dept', color: '#F472B6', size: 5 },
      { id: 'nie_eee', name: 'EEE', college: 'nie', type: 'dept', color: '#F472B6', size: 5 },
    ];

    // Interests/Clubs/Projects with emojis
    const interests = [
      { 
        id: 'web', 
        name: 'Web Dev', 
        type: 'interest', 
        color: '#EC4899', 
        emoji: '💻', 
        size: 8,  // Increased size
        highlight: true  // Highlight coding interest
      },
      { 
        id: 'video', 
        name: 'Video Editing', 
        type: 'interest', 
        color: '#00B4D8', 
        emoji: '🎬', 
        size: 8,  // Increased size
        highlight: true  // Highlight video editing interest
      },
      { 
        id: 'ai', 
        name: 'AI/ML', 
        type: 'interest', 
        color: '#8B5CF6', 
        emoji: '🤖', 
        size: 6 
      },
      { 
        id: 'iot', 
        name: 'IoT', 
        type: 'interest', 
        color: '#3B82F6', 
        emoji: '🌐', 
        size: 6 
      },
      { 
        id: 'robotics', 
        name: 'Robotics', 
        type: 'interest', 
        color: '#10B981', 
        emoji: '🔧', 
        size: 6 
      },
      { 
        id: 'cyber', 
        name: 'Cyber Sec', 
        type: 'interest', 
        color: '#F59E0B', 
        emoji: '🔒', 
        size: 6 
      },
    ];

    // Students with realistic Indian names and interests
    const students = [
      // SJCIT students
      { 
        id: 's1', 
        name: 'Aarav', 
        dept: 'sjcit_cse', 
        type: 'student', 
        color: '#818CF8', 
        size: 4, 
        interests: ['web', 'cyber'],
        highlight: true  // Highlighted for coding connection
      },
      { 
        id: 's2', 
        name: 'Priya', 
        dept: 'sjcit_ece', 
        type: 'student', 
        color: '#818CF8', 
        size: 4, 
        interests: ['video', 'ai'],
        highlight: true  // Highlighted for video editing connection
      },
      { 
        id: 's3', 
        name: 'Rahul', 
        dept: 'sjcit_mech', 
        type: 'student', 
        color: '#818CF8', 
        size: 3, 
        interests: ['robotics'] 
      },
      
      // RVCE students
      { 
        id: 's4', 
        name: 'Ananya', 
        dept: 'rvce_cse', 
        type: 'student', 
        color: '#6EE7B7', 
        size: 4, 
        interests: ['web', 'cyber'],
        highlight: true,  // Highlighted for coding connection
        college: 'rvce'
      },
      { 
        id: 's5', 
        name: 'Vikram', 
        dept: 'rvce_ece', 
        type: 'student', 
        color: '#6EE7B7', 
        size: 3, 
        interests: ['iot', 'robotics'],
        college: 'rvce'
      },
      
      // MSRIT students
      { 
        id: 's6', 
        name: 'Neha', 
        dept: 'msrit_cse', 
        type: 'student', 
        color: '#FCD34D', 
        size: 4, 
        interests: ['video', 'ai'],
        highlight: true,  // Highlighted for video editing connection
        college: 'msrit'
      },
      { 
        id: 's7', 
        name: 'Arjun', 
        dept: 'msrit_ise', 
        type: 'student', 
        color: '#FCD34D', 
        size: 3, 
        interests: ['cyber', 'iot'],
        college: 'msrit'
      },
      
      // NIE students
      { id: 's8', name: 'Divya', dept: 'nie_cse', type: 'student', color: '#F9A8D4', size: 3, interests: ['web', 'ai'] },
      { id: 's9', name: 'Karthik', dept: 'nie_eee', type: 'student', color: '#F9A8D4', size: 3, interests: ['iot', 'robotics'] },
    ];

    // Create all nodes
    const allNodes = [
      ...colleges,
      ...departments,
      ...interests,
      ...students,
    ];

    // Create links
    const allLinks = [
      // College to department links
      ...departments.map(dept => ({
        source: dept.college,
        target: dept.id,
        value: 2,
        color: dept.color,
      })),
      
      // Department to student links
      ...students.map(student => ({
        source: student.dept,
        target: student.id,
        value: 1.5,
        color: student.color,
      })),
      
      // Student to interest links
      ...students.flatMap(student => 
        student.interests.map(interestId => {
          const interest = interests.find(i => i.id === interestId);
          return {
            source: student.id,
            target: interestId,
            value: 1,
            color: interest?.color || '#999',
          };
        })
      ),
    ];

    return { nodes: allNodes, links: allLinks };
  }, []);

  // Custom node three.js object with enhanced highlighting
  const nodeThreeObject = useCallback(node => {
    const group = new THREE.Group();
    
    // Determine node properties based on type and highlight status
    let geometry, material;
    const isHighlighted = node.highlight;
    const glowIntensity = isHighlighted ? 2 : 1;
    const nodeSize = node.size || 3;
    
    // Add glow effect for highlighted nodes
    if (isHighlighted) {
      const glowGeometry = new THREE.SphereGeometry(nodeSize * 1.5, 32, 32);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(node.color).offsetHSL(0, 0, 0.3),
        transparent: true,
        opacity: 0.5,
        side: THREE.BackSide
      });
      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      group.add(glow);
    }
    
    if (node.type === 'college') {
      // College nodes as text sprites with background
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      const size = 128;
      canvas.width = size * 2;
      canvas.height = size * 2;
      
      // Draw circle background
      context.beginPath();
      context.arc(size, size, size * 0.8, 0, 2 * Math.PI, false);
      context.fillStyle = node.color;
      context.fill();
      
      // Add shadow
      context.shadowColor = 'rgba(0, 0, 0, 0.5)';
      context.shadowBlur = 10;
      
      // Add text
      context.font = `Bold ${size * 0.5}px Arial`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillStyle = 'white';
      context.fillText(node.symbol, size, size * 0.9);
      
      // Create texture from canvas
      const texture = new THREE.CanvasTexture(canvas);
      
      // Create sprite material
      material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0.9,
      });
      
      // Create sprite
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(20, 20, 1);
      group.add(sprite);
      
      // Add college name label
      const nameCanvas = document.createElement('canvas');
      const nameCtx = nameCanvas.getContext('2d');
      const nameWidth = 200;
      const nameHeight = 60;
      nameCanvas.width = nameWidth;
      nameCanvas.height = nameHeight;
      
      // Draw background
      nameCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      nameCtx.fillRect(0, 0, nameWidth, nameHeight);
      
      // Draw text
      nameCtx.font = 'Bold 16px Arial';
      nameCtx.fillStyle = 'white';
      nameCtx.textAlign = 'center';
      nameCtx.fillText(node.name, nameWidth / 2, 22);
      
      nameCtx.font = '12px Arial';
      nameCtx.fillStyle = '#ccc';
      nameCtx.fillText(node.city, nameWidth / 2, 40);
      
      const nameTexture = new THREE.CanvasTexture(nameCanvas);
      const nameMaterial = new THREE.SpriteMaterial({
        map: nameTexture,
        transparent: true,
        opacity: 0.9,
      });
      
      const nameSprite = new THREE.Sprite(nameMaterial);
      nameSprite.position.y = 15;
      nameSprite.scale.set(40, 12, 1);
      group.add(nameSprite);
      
    } else if (node.type === 'interest') {
      // Enhanced interest nodes with glow effect
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      const size = node.highlight ? 150 : 128; // Larger for highlighted interests
      canvas.width = size * 2;
      canvas.height = size * 2;
      
      // Add glow effect for highlighted interests
      if (node.highlight) {
        context.shadowColor = node.color;
        context.shadowBlur = 30;
        context.shadowOffsetX = 0;
        context.shadowOffsetY = 0;
      }
      
      // Draw hexagon
      context.beginPath();
      const sides = 6;
      const x = size;
      const y = size;
      const radius = size * 0.8;
      
      for (let i = 0; i < sides; i++) {
        const angle = (i * 2 * Math.PI / sides) - Math.PI / 6;
        const xPos = x + radius * Math.cos(angle);
        const yPos = y + radius * Math.sin(angle);
        
        if (i === 0) {
          context.moveTo(xPos, yPos);
        } else {
          context.lineTo(xPos, yPos);
        }
      }
      
      context.closePath();
      context.fillStyle = node.color;
      context.fill();
      
      // Add emoji
      context.font = `Bold ${size * 0.6}px Arial`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(node.emoji, size, size * 0.95);
      
      // Create texture from canvas
      const texture = new THREE.CanvasTexture(canvas);
      
      // Create sprite material
      material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0.9,
      });
      
      // Create sprite
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(15, 15, 1);
      group.add(sprite);
      
    } else {
      // Other nodes as simple spheres
      geometry = new THREE.SphereGeometry(node.size || 3, 16, 16);
      material = new THREE.MeshPhongMaterial({
        color: node.color || '#666',
        shininess: 30,
        transparent: true,
        opacity: 0.9,
      });
      
      const sphere = new THREE.Mesh(geometry, material);
      group.add(sphere);
    }
    
    return group;
  }, []);

  // Handle node hover with enhanced highlighting
  const handleNodeHover = (node) => {
    if (!node) {
      // Reset all nodes and links when hovering out
      fgRef.current.nodeColor(n => n.color || '#666');
      fgRef.current.linkColor(link => link.color || 'rgba(200,200,200,0.2)');
      fgRef.current.linkWidth(0.5);
      return;
    }
    
    // Highlight connected nodes and links
    const highlightNodes = new Set([node.id]);
    const highlightLinks = new Set();
    
    // Always show connections for highlighted nodes (SJCIT, specific students, interests)
    const shouldShowAllConnections = node.highlight || node.type === 'college' || node.type === 'interest';
    
    if (fgRef.current) {
      // Get connected nodes
      links.forEach(link => {
        const isConnected = link.source.id === node.id || link.target.id === node.id;
        const otherNodeId = link.source.id === node.id ? link.target.id : link.source.id;
        
        if (isConnected) {
          highlightLinks.add(link);
          highlightNodes.add(otherNodeId);
          
          // For highlighted nodes or interests, show connections to related nodes
          if (shouldShowAllConnections) {
            const otherNode = [...colleges, ...departments, ...students, ...interests].find(n => n.id === otherNodeId);
            if (otherNode?.highlight) {
              highlightNodes.add(otherNodeId);
            }
          }
        }
      });
      
      // Update node and link colors with enhanced highlighting
      fgRef.current.nodeColor(n => {
        if (n.id === node.id) return '#FFFFFF'; // Highlight the hovered node
        if (highlightNodes.has(n.id)) return n.color || '#666';
        return 'rgba(100,100,100,0.3)';
      });
      
      fgRef.current.linkColor(link => {
        const isSpecialConnection = 
          (link.source.highlight && link.target.highlight) ||
          (link.source.id === 'web' || link.target.id === 'web') ||
          (link.source.id === 'video' || link.target.id === 'video');
          
        if (highlightLinks.has(link)) {
          return isSpecialConnection ? '#FFD700' : link.color || '#999';
        }
        return 'rgba(200,200,200,0.1)';
      });
      
      fgRef.current.linkWidth(link => {
        const isSpecialConnection = 
          (link.source.highlight && link.target.highlight) ||
          (link.source.id === 'web' || link.target.id === 'web') ||
          (link.source.id === 'video' || link.target.id === 'video');
          
        if (highlightLinks.has(link)) {
          return isSpecialConnection ? 3 : 1.5;
        }
        return 0.3;
      });
      
      // Auto-rotate to focus on the highlighted node
      if (node) {
        const distance = 200;
        const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
        fgRef.current.cameraPosition(
          { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
          node,
          2000
        );
      }
    }
  };

  // Custom link color and width
  const linkColor = useCallback(link => link.color || 'rgba(200,200,200,0.2)', []);
  const linkWidth = useCallback(link => link.value || 0.5, []);

  // Add post-processing effects
  const handleEngine = useCallback((engine) => {
    if (!engine) return;
    
    // Get the Three.js scene and camera
    const scene = engine.scene();
    const camera = engine.camera();
    const renderer = engine.renderer();
    
    // Create effect composer
    const composer = new EffectComposer(renderer);
    
    // Add render pass
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    
    // Add bloom pass for glow effect
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.5, // strength
      0.4, // radius
      0.85 // threshold
    );
    composer.addPass(bloomPass);
    
    // Override the render function to use our composer
    const originalRender = engine._renderer.render;
    engine._renderer.render = function(scene, camera) {
      composer.render();
      originalRender.call(this, scene, camera);
    };
    
    // Add lights
    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    scene.add(ambientLight);
    
    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight1.position.set(1, 1, 1).normalize();
    scene.add(directionalLight1);
    
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight2.position.set(-1, -1, -1).normalize();
    scene.add(directionalLight2);
    
    // Add fog for depth
    scene.fog = new THREE.FogExp2(0x000000, 0.002);
    
    return () => {
      // Cleanup
      scene.remove(ambientLight);
      scene.remove(directionalLight1);
      scene.remove(directionalLight2);
      
      // Restore original render function
      if (originalRender) {
        engine._renderer.render = originalRender;
      }
    };
  }, []);

  return (
    <div className="relative w-full h-[600px] bg-gray-900 rounded-xl overflow-hidden">
      <ForceGraph3D
        ref={fgRef}
        graphData={{ nodes, links }}
        width={dimensions.width}
        height={dimensions.height}
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend={true}
        nodeLabel={node => `${node.name}${node.city ? `, ${node.city}` : ''}`}
        linkColor={linkColor}
        linkWidth={linkWidth}
        linkOpacity={0.3}
        linkResolution={2}
        linkDirectionalParticles={2}
        linkDirectionalParticleWidth={1}
        linkDirectionalParticleSpeed={0.01}
        linkDirectionalParticleResolution={5}
        onNodeHover={handleNodeHover}
        onEngineStop={handleEngine}
        backgroundColor="#0F172A"
        showNavInfo={false}
        warmupTicks={100}
        cooldownTicks={0}
        enableNodeDrag={false}
        enableNavigationControls={true}
        controlType="trackball"
        rendererConfig={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        onBackgroundClick={() => {
          if (fgRef.current) {
            // Reset colors and highlighting
            fgRef.current.nodeColor(node => node.color || '#666');
            fgRef.current.linkColor(link => link.color || 'rgba(200,200,200,0.2)');
            fgRef.current.linkWidth(0.5);
          }
        }}
      />
      
      {/* Legend */}
      <div className="absolute bottom-6 left-6 bg-gray-900/80 backdrop-blur-sm text-white p-4 rounded-xl border border-gray-700 shadow-lg">
        <h3 className="text-lg font-bold mb-3 text-indigo-300">Network Legend</h3>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center">
            <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-xs">🏛️</div>
            <span className="ml-2">Colleges</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 rounded-full bg-blue-400 mr-2"></div>
            <span>Departments</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-purple-400 mr-2"></div>
            <span>Students</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-pink-500 mr-2 flex items-center justify-center text-xs">💡</div>
            <span>Interests</span>
          </div>
        </div>
        
        <div className="mt-4 pt-3 border-t border-gray-700">
          <div className="flex items-center mb-2">
            <div className="w-3 h-3 rounded-full bg-yellow-400 mr-2"></div>
            <span className="text-yellow-300">SJCIT</span>
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full bg-green-400 mr-2"></div>
            <span className="text-green-300">Connected Students</span>
          </div>
        </div>
      </div>
      
      {/* Controls */}
      <div className="absolute top-6 right-6 bg-gray-900/80 backdrop-blur-sm text-white p-4 rounded-xl border border-gray-700 shadow-lg">
        <h3 className="text-lg font-bold mb-3 text-blue-300">Controls</h3>
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center">
            <kbd className="bg-gray-700 px-2 py-1 rounded mr-2 text-xs">🖱️</kbd>
            <span>Click & Drag to Rotate</span>
          </div>
          <div className="flex items-center">
            <kbd className="bg-gray-700 px-2 py-1 rounded mr-2 text-xs">🖱️</kbd>
            <span>Scroll to Zoom</span>
          </div>
          <div className="flex items-center">
            <kbd className="bg-gray-700 px-2 py-1 rounded mr-2 text-xs">🖱️</kbd>
            <span>Right-click & Drag to Pan</span>
          </div>
          <div className="flex items-center">
            <kbd className="bg-gray-700 px-2 py-1 rounded mr-2 text-xs">👆</kbd>
            <span>Hover for Connections</span>
          </div>
          <div className="flex items-center">
            <kbd className="bg-gray-700 px-2 py-1 rounded mr-2 text-xs">💡</kbd>
            <span>Click to Focus</span>
          </div>
        </div>
        
        <div className="mt-4 pt-3 border-t border-gray-700">
          <div className="text-amber-300 text-sm font-medium">Highlighted Connections:</div>
          <ul className="list-disc list-inside text-xs mt-1 space-y-1">
            <li>Gold: Shared Interests</li>
            <li>Blue: Video Editing</li>
            <li>Pink: Web Development</li>
          </ul>
        </div>
      </div>
      
      {/* Connection Info */}
      <div className="absolute bottom-6 right-1/2 transform translate-x-1/2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-3 rounded-full shadow-lg flex items-center">
        <div className="animate-pulse mr-2">🔍</div>
        <span className="font-medium">Hover over nodes to explore connections</span>
      </div>
    </div>
  );
};

export default CollegeNetwork3D;
