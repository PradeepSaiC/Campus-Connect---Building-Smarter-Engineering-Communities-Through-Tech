import React, { useCallback, useMemo } from 'react';
import {
  ForceGraph,
  ForceGraphNode,
  ForceGraphLink,
} from 'react-vis-force';

const CollegeNetwork = () => {
  // Generate graph data
  const { nodes, links } = useMemo(() => {
    // Colleges in Karnataka
    const colleges = [
      { id: 'sjcit', name: 'SJCIT', type: 'college', city: 'Chikkaballapur', color: '#4F46E5' },
      { id: 'rvce', name: 'RVCE', type: 'college', city: 'Bangalore', color: '#10B981' },
      { id: 'msrit', name: 'MSRIT', type: 'college', city: 'Bangalore', color: '#F59E0B' },
      { id: 'nie', name: 'NIE', type: 'college', city: 'Mysore', color: '#EC4899' },
    ];

    // Departments
    const departments = [
      // SJCIT departments
      { id: 'sjcit_cse', name: 'CSE', college: 'sjcit', type: 'dept', color: '#6366F1' },
      { id: 'sjcit_ece', name: 'ECE', college: 'sjcit', type: 'dept', color: '#6366F1' },
      { id: 'sjcit_mech', name: 'Mech', college: 'sjcit', type: 'dept', color: '#6366F1' },
      
      // RVCE departments
      { id: 'rvce_cse', name: 'CSE', college: 'rvce', type: 'dept', color: '#34D399' },
      { id: 'rvce_ece', name: 'ECE', college: 'rvce', type: 'dept', color: '#34D399' },
      
      // MSRIT departments
      { id: 'msrit_cse', name: 'CSE', college: 'msrit', type: 'dept', color: '#FBBF24' },
      { id: 'msrit_ise', name: 'ISE', college: 'msrit', type: 'dept', color: '#FBBF24' },
      
      // NIE departments
      { id: 'nie_cse', name: 'CSE', college: 'nie', type: 'dept', color: '#EC4899' },
      { id: 'nie_eee', name: 'EEE', college: 'nie', type: 'dept', color: '#EC4899' },
    ];

    // Interests/Clubs/Projects with emojis
    const interests = [
      { id: 'web', name: 'Web Dev', type: 'interest', color: '#EC4899', emoji: '💻' },
      { id: 'ai', name: 'AI/ML', type: 'interest', color: '#8B5CF6', emoji: '🤖' },
      { id: 'iot', name: 'IoT', type: 'interest', color: '#3B82F6', emoji: '🌐' },
      { id: 'robotics', name: 'Robotics', type: 'interest', color: '#10B981', emoji: '🔧' },
      { id: 'cyber', name: 'Cyber Sec', type: 'interest', color: '#F59E0B', emoji: '🔒' },
    ];

    // Students with realistic Indian names and interests
    const students = [
      // SJCIT students
      { id: 's1', name: 'Aarav', dept: 'sjcit_cse', type: 'student', interests: ['web', 'cyber'] },
      { id: 's2', name: 'Priya', dept: 'sjcit_ece', type: 'student', interests: ['iot', 'ai'] },
      { id: 's3', name: 'Rahul', dept: 'sjcit_mech', type: 'student', interests: ['robotics'] },
      
      // RVCE students
      { id: 's4', name: 'Ananya', dept: 'rvce_cse', type: 'student', interests: ['ai', 'cyber'] },
      { id: 's5', name: 'Vikram', dept: 'rvce_ece', type: 'student', interests: ['iot', 'robotics'] },
      
      // MSRIT students
      { id: 's6', name: 'Neha', dept: 'msrit_cse', type: 'student', interests: ['web', 'ai'] },
      { id: 's7', name: 'Arjun', dept: 'msrit_ise', type: 'student', interests: ['cyber', 'iot'] },
      
      // NIE students
      { id: 's8', name: 'Divya', dept: 'nie_cse', type: 'student', interests: ['web', 'ai'] },
      { id: 's9', name: 'Karthik', dept: 'nie_eee', type: 'student', interests: ['iot', 'robotics'] },
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
      })),
      
      // Department to student links
      ...students.map(student => ({
        source: student.dept,
        target: student.id,
        value: 1.5,
      })),
      
      // Student to interest links
      ...students.flatMap(student => 
        student.interests.map(interestId => ({
          source: student.id,
          target: interestId,
          value: 1,
        }))
      ),
    ];

    return { nodes: allNodes, links: allLinks, interests };
  }, []);

  // Get node color based on type
  const getNodeColor = (node) => {
    if (node.type === 'college') return node.color || '#4F46E5';
    if (node.type === 'dept') return node.color || '#6366F1';
    if (node.type === 'interest') return node.color || '#8B5CF6';
    return '#818CF8'; // student
  };

  // Get node radius based on type
  const getNodeRadius = (node) => {
    if (node.type === 'college') return 35;
    if (node.type === 'dept') return 20;
    if (node.type === 'interest') return 25;
    return 14; // student
  };

  // Render node label
  const renderNodeLabel = (node) => {
    if (node.type === 'interest') return node.emoji;
    if (node.type === 'college') return node.name[0];
    if (node.type === 'dept') return node.name[0];
    return node.name[0];
  };

  return (
    <div className="relative w-full h-[600px] bg-gray-800/50 rounded-xl overflow-hidden">
      <ForceGraph
        simulationOptions={{
          height: 600,
          width: '100%',
          animate: true,
          strength: {
            charge: -500,
            linkDistance: 100,
          },
        }}
        labelAttr="id"
        onSelectNode={(node) => console.log('Selected node:', node)}
        highlightDependencies={true}
      >
        {nodes.map((node) => (
          <ForceGraphNode
            key={node.id}
            node={{ id: node.id, radius: getNodeRadius(node) }}
            fill={getNodeColor(node)}
            stroke="#1F2937"
            strokeWidth={2}
            label={renderNodeLabel(node)}
            labelColor="white"
            labelFontSize={node.type === 'college' ? 16 : 12}
          />
        ))}
        
        {links.map((link, index) => (
          <ForceGraphLink
            key={`${link.source}-${link.target}-${index}`}
            link={{
              source: link.source,
              target: link.target,
              value: link.value,
            }}
            stroke="rgba(200, 200, 200, 0.3)"
            strokeWidth={1}
          />
        ))}
      </ForceGraph>
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-gray-900/80 backdrop-blur-sm p-4 rounded-lg text-sm text-white">
        <div className="font-medium mb-2">Legend</div>
        <div className="space-y-2">
          <div className="flex items-center">
            <div className="w-4 h-4 rounded-full bg-indigo-500 mr-2"></div>
            <span>Colleges</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 rounded-full bg-emerald-400 mr-2"></div>
            <span>Departments</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 rounded-full bg-purple-500 mr-2"></div>
            <span>Interests</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 rounded-full bg-blue-400 mr-2"></div>
            <span>Students</span>
          </div>
        </div>
      </div>
      
      {/* Hover Info */}
      <div className="absolute top-4 right-4 bg-gray-900/80 backdrop-blur-sm p-4 rounded-lg text-sm text-white max-w-xs">
        <div className="font-medium mb-2">How It Works</div>
        <p className="text-gray-300 text-xs">
          This network shows how students from different colleges connect through shared interests.
          Hover over nodes to see connections and relationships.
        </p>
      </div>
    </div>
  );
};

export default CollegeNetwork;
