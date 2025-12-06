import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { ConceptNode } from '../types';

interface TreeVisualizerProps {
  data: ConceptNode;
  onNodeClick: (node: ConceptNode) => void;
  selectedNodeId?: string;
}

export const TreeVisualizer: React.FC<TreeVisualizerProps> = ({ data, onNodeClick, selectedNodeId }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (wrapperRef.current) {
        setDimensions({
          width: wrapperRef.current.clientWidth,
          height: wrapperRef.current.clientHeight,
        });
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    // Clear previous render
    const svgEl = d3.select(svgRef.current);
    svgEl.selectAll('*').remove();

    const { width, height } = dimensions;
    const margin = { top: 40, right: 120, bottom: 40, left: 120 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create container group
    const svg = svgEl
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // --- Definitions for Filters (Shadows & Glows) ---
    const defs = svg.append("defs");

    // Drop Shadow
    const filter = defs.append("filter")
        .attr("id", "drop-shadow")
        .attr("height", "130%");
    filter.append("feGaussianBlur")
        .attr("in", "SourceAlpha")
        .attr("stdDeviation", 3)
        .attr("result", "blur");
    filter.append("feOffset")
        .attr("in", "blur")
        .attr("dx", 2)
        .attr("dy", 2)
        .attr("result", "offsetBlur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "offsetBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Inner Glow (for hover/selection)
    const glow = defs.append("filter").attr("id", "glow");
    glow.append("feGaussianBlur").attr("stdDeviation", "2.5").attr("result", "coloredBlur");
    const glowMerge = glow.append("feMerge");
    glowMerge.append("feMergeNode").attr("in", "coloredBlur");
    glowMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // --- Data Processing ---
    const root = d3.hierarchy<ConceptNode>(data);
    
    // Color Scale: Distinct colors for main branches
    const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

    // Helper to identify which "Main Concept Branch" a node belongs to
    const getBranchId = (d: d3.HierarchyNode<ConceptNode>) => {
        if (d.depth === 0) return 'root';
        // Traverse up to find the immediate child of root (Depth 1)
        let curr = d;
        while (curr.depth > 1 && curr.parent) {
            curr = curr.parent;
        }
        return curr.data.id;
    };

    // Layout
    const treeLayout = d3.tree<ConceptNode>()
        .size([innerHeight, innerWidth])
        .separation((a, b) => (a.parent === b.parent ? 1.5 : 2.5)); // More space between different branches
        
    treeLayout(root);

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => {
            svg.attr('transform', event.transform);
        });

    svgEl.call(zoom)
       .call(zoom.transform, d3.zoomIdentity.translate(margin.left, height/2 - (root.x || 0)).scale(0.9));

    // --- Drawing ---

    // Links (Paths)
    svg.selectAll('.link')
      .data(root.links())
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('d', d3.linkHorizontal<d3.HierarchyPointLink<ConceptNode>, d3.HierarchyPointNode<ConceptNode>>()
        .x(d => d.y)
        .y(d => d.x)
      )
      .attr('stroke', d => {
          // Links inherit the color of the target node's branch
          const branchColor = d3.color(colorScale(getBranchId(d.target)));
          return branchColor ? branchColor.brighter(0.5).formatHex() : '#ccc';
      })
      .attr('stroke-width', d => Math.max(1, 4 - d.target.depth)); // Thicker lines near root

    // Nodes (Groups)
    const nodes = svg.selectAll('.node')
      .data(root.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.y},${d.x})`)
      .on('click', (event, d) => {
        event.stopPropagation();
        onNodeClick(d.data);
      });

    // Selection Halo (Ring behind the node)
    nodes.filter(d => d.data.id === selectedNodeId)
        .append('circle')
        .attr('r', d => (d.depth === 0 ? 24 : (d.children ? 16 : 12)) + 6)
        .attr('fill', 'none')
        .attr('stroke', '#3b82f6')
        .attr('stroke-width', 3)
        .attr('stroke-opacity', 0.5)
        .attr('class', 'animate-pulse');

    // Main Node Circles
    nodes.append('circle')
      .attr('r', d => d.depth === 0 ? 20 : (d.children ? 12 : 8))
      .style('fill', d => {
          if (d.depth === 0) return '#1e293b'; // Root is dark slate
          return colorScale(getBranchId(d));
      })
      .style('stroke', '#fff')
      .style('stroke-width', 3)
      .style('filter', 'url(#drop-shadow)');

    // Add a small dot inside leaf nodes for detail
    nodes.filter(d => !d.children && d.depth > 0)
        .append('circle')
        .attr('r', 2)
        .style('fill', '#fff')
        .style('opacity', 0.8);

    // Labels
    nodes.append('text')
      .attr('dy', '0.35em')
      .attr('x', d => d.children ? -18 : 18)
      .attr('text-anchor', d => d.children ? 'end' : 'start')
      .text(d => d.data.label)
      .style('font-size', d => d.depth === 0 ? '16px' : '13px')
      .style('fill', '#0f172a')
      .style('font-weight', d => d.data.id === selectedNodeId ? '700' : '500')
      .style('opacity', d => d.depth > 2 && d.data.id !== selectedNodeId ? 0.7 : 1); // Fade deep nodes slightly

  }, [data, dimensions, selectedNodeId, onNodeClick]);

  return (
    <div ref={wrapperRef} className="w-full h-full rounded-lg overflow-hidden relative">
       {/* Instructions Overlay */}
       <div className="absolute bottom-6 left-6 bg-white/90 backdrop-blur border border-slate-200 p-3 rounded-xl shadow-lg text-xs text-slate-500 z-10 pointer-events-none select-none">
          <div className="flex items-center space-x-4">
             <span className="flex items-center"><div className="w-3 h-3 rounded-full bg-[#1e293b] mr-2"></div> Main Topic</span>
             <span className="flex items-center"><div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div> Core Concepts</span>
             <span className="flex items-center"><div className="w-2 h-2 rounded-full border-2 border-orange-400 mr-2"></div> Details</span>
          </div>
       </div>
      <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing block"></svg>
    </div>
  );
};