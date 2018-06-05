
import { Flaremodel } from './flaremodel.js';

export class Forceplot {

  /**
   * Creates a forceplot svg in the container matched by the `containerSelector`, sets its width to `width` pixels,
   * and associates it with the contents of `flare`.
   *
   * @param {Object} flareModel - A flare model
   * @param {number|string} width - The horizontal extent of flareplot in pixels. If the value is 'auto' the width of
   * the container will be used.
   * @param {string} containerSelector - CSS selector for the container
   * @param {Object=} layoutOptions - Optional argument for defining the layout features. Following are the defaults
   *  - radiusScale: 10          // Pixel radius of vertices with track-width of 1
   *  - inactiveEdgeOpacity: 0.2 // Opacity of edges that are not highlighted
   */
  constructor(flareModel, width, containerSelector, layoutOptions) {
    this.flareModel = flareModel;
    this.width = width;
    if (width === 'auto' && window) {
      const containerStyle = window.getComputedStyle(d3.select(containerSelector).node());
      const containerPadding = parseFloat(containerStyle.paddingLeft) + parseFloat(containerStyle.paddingRight);

      this.width = d3.select(containerSelector).node().clientWidth - containerPadding;
    }
    this.height = this.width;
    layoutOptions = Forceplot._fillLayoutOptions(layoutOptions);
    this.inactiveEdgeOpacity = layoutOptions.inactiveEdgeOpacity;

    this.svg = d3.select(containerSelector)
      .append('svg')
      .attr('width', this.width)
      .attr('height', this.height);
    this.svgroot = this.svg;

    this.edgeGroup = this.svgroot.append("g");
    this.vertexGroup = this.svgroot.append("g");
    this.labelGroup = this.svgroot.append("g");

    this.flareModel.addVertexChangeListener(this);
    this.flareModel.addFrameListener(this);
    this.flareModel.addHighlightListener(this);
    this.flareModel.addToggleListener(this);

    this._updateView();
    // this._updateEdges();
  }

  fire(event) {
    // console.log('Flareplot.fire: Model fired');
    // console.log(event);
    switch (event.type) {
      case 'framesChange':
        this._updateFrames();
        break;

      case 'vertexHighlight':
        this._updateHighlight(event.data);
        break;

      case 'vertexToggle':
        this._updateToggle(event.data);
        break;

      case 'vertexChange':
        this._updateView();
        // this._updateEdges();
        break;
    }
  }

  _updateView() {
    const vertices = this.flareModel.getVertices()
      .filter((v) => v.edges.length > 0)
      .map((v) => {return {id: v.name, modelVertex: v};});

    const trackMap = this.flareModel.getTrack().properties;

    let vertexElements = this.vertexGroup
      .selectAll('.vertex')
      .data(vertices, function (d) { return d.id; });

    // Enter
    vertexElements
      .enter().append('circle')
      .attr('class', 'vertex')
      .attr("r", function(d){
        return 3 + trackMap.get(d.id).size * 10;
      })
      .attr("fill", function(d) {
        return trackMap.get(d.id).color;
      })
      // .attr('id', function (d) { return 'node-' + d.data.key; })
      .on('mouseenter', d => {
        this.flareModel.setVertexHighlighted(d.id, true);
      })
      .on('mouseleave', d => {
        this.flareModel.setVertexHighlighted(d.id, false);
      })
      .on('click', d => {
        const isToggled = this.flareModel.vertexToggled(d.id);
        this.flareModel.setVertexToggled(d.id, !isToggled);
      })
      .on('dblclick', doubleclicked)
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    //Update
    vertexElements
      .style("opacity", (d) => {
        console.log('update '+d)
        for (const e = 0; e < d.modelVertex.edges.length; e+=1) {
          const edge = d.modelVertex.edges[e];
          const count = this.flareModel.frameCount(edge);
          if (count > 0) {
            return 1;
          }
        }

        return 0.4;
      });

    // Exit
    vertexElements
      .exit().remove();

    vertexElements = this.vertexGroup.selectAll('.vertex');



    let labelElements = this.labelGroup
      .selectAll('.vertex-label')
      .data(vertices, function (d) { return d.id; });

    // Enter
    labelElements
      .enter().append('text')
      .attr('class', 'vertex-label')
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'hanging')
      .style('pointer-events', 'none')
      .style("font-size", function(d){
        return 10 + trackMap.get(d.id).size * 3;
      })
      .text((d) => d.id);


    // Exit
    labelElements
      .exit().remove();

    labelElements = this.labelGroup.selectAll('.vertex-label');

    ///////// Update edges \\\\\\\

    // Map edges in the model to edges ({source: .., target: ..}) connecting vertices in the hierarchy
    const edges = this.flareModel.getEdges()
      .map(function (e) {
        const hierarchySource = vertices.find(v => v.id === e.v1.name);
        const hierarchyTarget = vertices.find(v => v.id === e.v2.name);

        return {source: hierarchySource, target: hierarchyTarget, modelEdge: e};
      });

    let edgeElements = this.edgeGroup
      .selectAll('.edge')
      .data(edges, function (d) { return d.modelEdge.v1.name + '...' + d.modelEdge.v2.name; });

    // Enter
    edgeElements
      .enter().append('line')
      .attr('class', function (d) {
        return 'edge ' +
          'source-' + d.modelEdge.v1.name + ' ' +
          'target-' + d.modelEdge.v2.name;
      })
      .style('stroke-width', d => {
        const count = this.flareModel.frameCount(d.modelEdge);

        return count === 0 ? 0 : Math.sqrt(count * d.modelEdge.weight) + 2 ;
        // return count === 0 ? 0 : d.modelEdge.weight * 5 ;
      })
      .style('stroke', function (d) { return d.modelEdge.color; })
      .style('fill', 'none')
      .style('stroke-opacity', d => {
        const sourceToggled = this.flareModel.vertexToggled(d.modelEdge.v1.name);
        const targetToggled = this.flareModel.vertexToggled(d.modelEdge.v2.name);

        return (sourceToggled || targetToggled) ? 1.0 : this.inactiveEdgeOpacity;
      });

    // // Update
    // edgeElements
    //   .attr('d', function (d) { return lineGenerator(d.source.path(d.target)); });

    // Exit
    edgeElements
      .exit().remove();

    edgeElements = this.edgeGroup.selectAll('.edge');

    const simulation = d3.forceSimulation()
      .force("collide", d3.forceCollide().radius(18))
      .force("link", d3.forceLink().id(function(d) { return d.id; }))
      .force("charge", d3.forceManyBody().strength(-80))
      .force("center", d3.forceCenter(this.width / 2, this.height / 2));

    simulation
      .nodes(vertices)
      .alphaDecay(0.0045945826)
      .on("tick", ticked);

    simulation.force("link")
      .links(edges);

    function ticked() {
      edgeElements
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      vertexElements
        .attr("cx", (d) => d.x)
        .attr("cy", (d) => d.y);

      labelElements
        .attr("x", (d) => d.x)
        .attr("y", (d) => d.y + 4 + trackMap.get(d.id).size * 10);
    }

    function dragstarted(d) {
      if (!d3.event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(d) {
      d.fx = d3.event.x;
      d.fy = d3.event.y;
    }

    function dragended(d) {
      if (!d3.event.active) simulation.alphaTarget(0);
      d3.select(this).attr("stroke-dasharray", "5,5")
      // d.fx = null;
      // d.fy = null;
      // d.fx = d.x;
      // d.fy = d.y;
    }
    function doubleclicked(d) {
      d3.select(this).attr("stroke-dasharray", null)
      d.fx = null;
      d.fy = null;
    }
  }

  _updateFrames() {
    this.edgeGroup
      .selectAll('.edge')
      .style('stroke-width', d => {
        const count = this.flareModel.frameCount(d.modelEdge);

        return count === 0 ? 0 : Math.sqrt(count * d.modelEdge.weight) + 2;
      });

    this.vertexGroup
      .selectAll('.vertex')
      .style("opacity", (d) => {
        for (let e = 0; e < d.modelVertex.edges.length; e+=1) {
          const edge = d.modelVertex.edges[e];
          const count = this.flareModel.frameCount(edge);
          if (count > 0) {
            return 1;
          }
        }

        return 0.2;
      });

    this.labelGroup
      .selectAll('.vertex-label')
      .style("opacity", (d) => {
        for (let e = 0; e < d.modelVertex.edges.length; e+=1) {
          const edge = d.modelVertex.edges[e];
          const count = this.flareModel.frameCount(edge);
          if (count > 0) {
            return 1;
          }
        }

        return 0.2;
      });

  }

  _updateHighlight(highlightedNames) {
    const toggledAndHighlighted = new Set(this.getModel().getToggledVertices().concat(highlightedNames));
    this.vertexGroup
      .selectAll('g.vertex')
      .select('text')
      .style('font-weight', function (d) {
        if (toggledAndHighlighted.has(d.data.name)) {
          return 'bold';
        }
        return 'normal';
      })
      .style('fill', function (d) {
        if (toggledAndHighlighted.has(d.data.name)) {
          return '#4f57a5';
        }
        return null;
      });
  }

  _updateToggle(toggledNames) {
    this.vertexGroup
      .selectAll('g.vertex')
      .select('text')
      .style('font-weight', function (d) {
        if (toggledNames.indexOf(d.data.name) >= 0) {
          return 'bold';
        }
        return null;
      });

    this.edgeGroup
      .selectAll('.edge')
      .style('stroke-opacity', d => {
        const sourceToggled = this.flareModel.vertexToggled(d.modelEdge.v1.name);
        const targetToggled = this.flareModel.vertexToggled(d.modelEdge.v2.name);

        return (sourceToggled || targetToggled) ? 1.0 : this.inactiveEdgeOpacity;
      });
  }

  _computeVertexTextWidth() {
    const fontHeight = this._computeVertexTextHeight();
    const leaves = this.flareModel.getVertices();
    const tmpText = this.vertexGroup
      .selectAll('g.tmpVertex')
      .data(leaves, function (d) { return d.name; })
      .enter().append('g')
      .attr('class', 'vertex')
      .style('font-size', fontHeight + 'px');

    tmpText
      .append('text')
      .text(function (d) { return d.name; });
    const maxWidth = d3.max(tmpText.nodes(), n => n.firstChild.clientWidth);

    // TODO: This width is sometimes slightly smaller than the actual textwidth. Not sure why

    tmpText.remove();
    return maxWidth;
  }

  _computeVertexTextHeight() {
    const leaves = this.flareModel.getVertices();

    return Math.min(0.8 * Math.PI * this.width / leaves.length, 20);
  }

  static _fillLayoutOptions(layoutOptions) {
    if (layoutOptions === undefined) {
      layoutOptions = {};
    }
    if (layoutOptions.radiusScale === undefined) {
      layoutOptions.radiusScale = 10;
    }
    if (layoutOptions.inactiveEdgeOpacity === undefined) {
      layoutOptions.inactiveEdgeOpacity = 0.3;
    }

    return layoutOptions;
  }

  getModel() {
    return this.flareModel;
  }

  setFrame(frame) {
    this.flareModel.setFrames({type: 'single', frame: frame});
  }

  rangeSum(first, last) {
    this.flareModel.setFrames({type: 'range', begin: first, end: last});
  }
}

