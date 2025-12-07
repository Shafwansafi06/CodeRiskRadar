import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

/**
 * Radar Chart Component
 * Visualizes risk factors using D3.js radar/spider chart
 */
function Radar({ features }) {
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);

  useEffect(() => {
    if (!features || features.length === 0 || !svgRef.current) return;

    // Clear previous chart
    d3.select(svgRef.current).selectAll('*').remove();

    // Chart dimensions
    const width = 400;
    const height = 400;
    const radius = Math.min(width, height) / 2 - 60;
    const levels = 5;

    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', `Radar chart showing ${features.length} risk factors`);

    const g = svg.append('g')
      .attr('transform', `translate(${width / 2}, ${height / 2})`);

    // Prepare data
    const numAxes = features.length;
    const angleSlice = (Math.PI * 2) / numAxes;

    // Scales
    const rScale = d3.scaleLinear()
      .domain([0, 1])
      .range([0, radius]);

    // Draw circular grid
    const circularGrid = g.append('g').attr('class', 'grid');
    
    for (let i = 0; i < levels; i++) {
      const r = (radius / levels) * (i + 1);
      
      circularGrid.append('circle')
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('r', r)
        .attr('fill', 'none')
        .attr('stroke', '#e0e0e0')
        .attr('stroke-width', 1);
      
      // Add level labels
      if (i === levels - 1) {
        circularGrid.append('text')
          .attr('x', 5)
          .attr('y', -r)
          .attr('font-size', '10px')
          .attr('fill', '#666')
          .text('1.0');
      }
    }

    // Draw axes
    const axes = g.append('g').attr('class', 'axes');
    
    features.forEach((feature, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      // Axis line
      axes.append('line')
        .attr('x1', 0)
        .attr('y1', 0)
        .attr('x2', x)
        .attr('y2', y)
        .attr('stroke', '#999')
        .attr('stroke-width', 1);

      // Axis label
      const labelX = Math.cos(angle) * (radius + 30);
      const labelY = Math.sin(angle) * (radius + 30);
      
      const label = axes.append('text')
        .attr('x', labelX)
        .attr('y', labelY)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '12px')
        .attr('font-weight', '500')
        .attr('fill', '#333')
        .style('cursor', 'default');

      // Format label (split by underscore, capitalize)
      const formattedLabel = feature.name
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      // Wrap long labels
      const words = formattedLabel.split(' ');
      if (words.length > 2) {
        label.text('');
        label.append('tspan')
          .attr('x', labelX)
          .attr('dy', '-0.3em')
          .text(words.slice(0, 2).join(' '));
        label.append('tspan')
          .attr('x', labelX)
          .attr('dy', '1em')
          .text(words.slice(2).join(' '));
      } else {
        label.text(formattedLabel);
      }
    });

    // Draw radar area
    const radarLine = d3.lineRadial()
      .radius(d => rScale(d.importance))
      .angle((d, i) => angleSlice * i)
      .curve(d3.curveLinearClosed);

    const radarArea = g.append('g').attr('class', 'radar-area');

    // Area fill
    radarArea.append('path')
      .datum(features)
      .attr('d', radarLine)
      .attr('fill', 'rgba(255, 99, 71, 0.2)')
      .attr('stroke', 'rgba(255, 99, 71, 0.8)')
      .attr('stroke-width', 2);

    // Data points
    const points = radarArea.append('g').attr('class', 'points');
    
    features.forEach((feature, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      const x = Math.cos(angle) * rScale(feature.importance);
      const y = Math.sin(angle) * rScale(feature.importance);

      const point = points.append('circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', 5)
        .attr('fill', '#ff6347')
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .attr('role', 'button')
        .attr('tabindex', 0)
        .attr('aria-label', `${feature.name}: ${(feature.importance * 100).toFixed(0)}% importance`);

      // Tooltip on hover
      point
        .on('mouseenter', function(event) {
          d3.select(this)
            .transition()
            .duration(200)
            .attr('r', 7);

          showTooltip(event, feature);
        })
        .on('mouseleave', function() {
          d3.select(this)
            .transition()
            .duration(200)
            .attr('r', 5);

          hideTooltip();
        })
        .on('focus', function(event) {
          showTooltip(event, feature);
        })
        .on('blur', function() {
          hideTooltip();
        });
    });

    // Animate radar appearance
    radarArea.select('path')
      .attr('opacity', 0)
      .transition()
      .duration(800)
      .attr('opacity', 1);

    points.selectAll('circle')
      .attr('opacity', 0)
      .transition()
      .delay((d, i) => i * 100)
      .duration(500)
      .attr('opacity', 1);

  }, [features]);

  /**
   * Show tooltip
   */
  const showTooltip = (event, feature) => {
    if (!tooltipRef.current) return;

    const tooltip = d3.select(tooltipRef.current);
    
    tooltip
      .style('display', 'block')
      .style('left', `${event.pageX + 10}px`)
      .style('top', `${event.pageY - 28}px`)
      .html(`
        <strong>${feature.name.replace(/_/g, ' ')}</strong><br/>
        Importance: ${(feature.importance * 100).toFixed(1)}%
      `);
  };

  /**
   * Hide tooltip
   */
  const hideTooltip = () => {
    if (!tooltipRef.current) return;
    d3.select(tooltipRef.current).style('display', 'none');
  };

  return (
    <div className="radar-container">
      <svg ref={svgRef} className="radar-chart"></svg>
      <div ref={tooltipRef} className="radar-tooltip"></div>
    </div>
  );
}

export default Radar;
