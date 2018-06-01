
// import '../../vendor/d3v5.2/d3.js';

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

    this.svg = d3.select(containerSelector)
      .append('svg')
      .style('overflow', 'visible')
      .attr('width', this.width)
      .attr('height', this.height);
    this.svgroot = this.svg;

    this.vertexGroup = this.svgroot.append("g");
    this.edgeGroup = this.svgroot.append("g");

    this.flareModel.addVertexChangeListener(this);
    this.flareModel.addFrameListener(this);
    this.flareModel.addHighlightListener(this);
    this.flareModel.addToggleListener(this);

    this._updateVertices();
    this._updateEdges();
    this._updateTracks();
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
        this._updateVertices();
        this._updateEdges();
        this._updateTracks();
        break;
    }
  }

  _updateVertices() {
    const vertices = this.flareModel.getVertices();
    console.log(vertices);

    const vertexElements = this.vertexGroup
      .selectAll('g.vertex')
      .data(vertices, function (d) { return d.data.name; });

    // Enter
    vertexElements
      .enter().append('g')
      .attr('class', 'vertex')
      // .attr('id', function (d) { return 'node-' + d.data.key; })
      .style('font-size', (textHeight * 1.2) + 'px')
      .style('cursor', 'pointer')
      .attr('transform', d => { return 'rotate(' + (d.x - 90) + ')translate(' + this.textR + ')'; })
      .append('text')
      .style('user-select', 'none')
      .attr('dy', '.31em')
      .attr('text-anchor', function (d) { return d.x < 180 ? 'start' : 'end'; })
      .attr('transform', function (d) { return d.x < 180 ? null : 'rotate(180)'; })
      .text(function (d) { return d.data.name; })
      .on('mouseenter', d => {
        this.flareModel.setVertexHighlighted(d.data.name, true);
      })
      .on('mouseleave', d => {
        this.flareModel.setVertexHighlighted(d.data.name, false);
      })
      .on('click', d => {
        const isToggled = this.flareModel.vertexToggled(d.data.name);

        this.flareModel.setVertexToggled(d.data.name, !isToggled);
      });

    // Update
    vertexElements
      .attr('transform', d => { return 'rotate(' + (d.x - 90) + ')translate(' + this.textR + ')'; })
      .select('text')
      .attr('text-anchor', function (d) { return d.x < 180 ? 'start' : 'end'; })
      .attr('transform', function (d) { return d.x < 180 ? null : 'rotate(180)'; });

    // Exit
    vertexElements
      .exit().remove();
  }

  _updateEdges() {
    // Map edges in the model to edges ({source: .., target: ..}) connecting vertices in the hierarchy
    const leaves = this.hierarchy.leaves();
    const edges = this.flareModel.getEdges()
      .map(function (e) {
        const hierarchySource = leaves.find(l => l.data.name === e.v1.name);
        const hierarchyTarget = leaves.find(l => l.data.name === e.v2.name);

        return {source: hierarchySource, target: hierarchyTarget, modelEdge: e};
      });

    const lineGenerator = d3.radialLine()
      .curve(d3.curveBundle.beta(0.85))
      .radius(function (d) { return d.y; })
      .angle(function (d) { return d.x / 180 * Math.PI; });

    const edgeElements = this.edgeGroup
      .selectAll('.edge')
      .data(edges, function (d) { return d.modelEdge.v1.name + '...' + d.modelEdge.v2.name; });

    // Enter
    edgeElements
      .enter().append('path')
      .attr('class', function (d) {
        return 'edge ' +
          'source-' + d.modelEdge.v1.name + ' ' +
          'target-' + d.modelEdge.v2.name;
      })
      .style('stroke-width', d => {
        const count = this.flareModel.frameCount(d.modelEdge);

        return count === 0 ? 0 : count * d.modelEdge.weight;
      })
      .style('stroke', function (d) { return d.modelEdge.color; })
      .style('fill', 'none')
      .style('stroke-opacity', d => {
        const sourceToggled = this.flareModel.vertexToggled(d.modelEdge.v1.name);
        const targetToggled = this.flareModel.vertexToggled(d.modelEdge.v2.name);

        return (sourceToggled || targetToggled) ? 1.0 : this.inactiveEdgeOpacity;
      })
      .attr('d', function (d) { return lineGenerator(d.source.path(d.target)); });

    // Update
    edgeElements
      .attr('d', function (d) { return lineGenerator(d.source.path(d.target)); });

    // Exit
    edgeElements
      .exit().remove();
  }

  _updateFrames() {
    this.edgeGroup
      .selectAll('.edge')
      .style('stroke-width', d => {
        const count = this.flareModel.frameCount(d.modelEdge);

        return count === 0 ? 0 : count * d.modelEdge.weight;
      });
  }

  _updateTracks() {
    const leaves = this.hierarchy.leaves();
    const textHeight = this._computeVertexTextHeight();
    const arcAngle = Math.asin(textHeight / (2 * this.textR));
    // const arcAngle = 0.8 * 2 * Math.PI / leaves.length;
    const track = this.flareModel.getTrack().properties;

    const arc = d3.arc()
      .innerRadius(d => {
        const trackSize = track.get(d.data.name).size;

        return this.trackR + this.trackWidth * (1 - trackSize) / 2;
      })
      .outerRadius(d => {
        const trackSize = track.get(d.data.name).size;

        return this.trackR + this.trackWidth * (1 + trackSize) / 2;
      })
      .startAngle(d => (d.x * Math.PI / 180) - arcAngle)
      .endAngle(d => (d.x * Math.PI / 180) + arcAngle);

    const trackElements = this.trackGroup
      .selectAll('path')
      .data(leaves, function (d) { return d.data.name; });

    // Enter
    trackElements
      .enter().append('path')
      .style('cursor', 'pointer')
      .style('fill', d => track.get(d.data.name).color)
      .attr('d', arc)
      .on('mouseenter', d => {
        this.flareModel.setVertexHighlighted(d.data.name, true);
      })
      .on('mouseleave', d => {
        this.flareModel.setVertexHighlighted(d.data.name, false);
      })
      .on('click', d => {
        const isToggled = this.flareModel.vertexToggled(d.data.name);

        this.flareModel.setVertexToggled(d.data.name, !isToggled);
      });

    // Update
    trackElements
      .attr('d', arc);

    // Exit
    trackElements
      .exit().remove();
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
      layoutOptions.inactiveEdgeOpacity = 0.2;
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

  /**
   * Read a flare JSON from a file and return a promise that delivers a Flareplot object using the additional
   * parameters.
   *
   * @param {string} fname
   * @param {number|string} width
   * @param {string} containerSelector
   * @param {Object} layoutOptions
   * @returns {Promise<Flareplot, Error>}
   */
  static createFlareplotFromFile(fname, width, containerSelector, layoutOptions) {
    if (width === 'auto' && window) {
      const containerStyle = window.getComputedStyle(d3.select(containerSelector).node());
      const containerPadding = parseFloat(containerStyle.paddingLeft) + parseFloat(containerStyle.paddingRight);

      width = d3.select(containerSelector).node().clientWidth - containerPadding;
    }

    let height = width;
    let svg = d3.select(containerSelector)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    svg
      .append('g')
      .attr('transform', 'translate(' + width / 2 + ',' + height / 2 + ')')
      .append('text')
      .attr('text-anchor', 'middle')
      .style('font-size', '1.7em')
      .style('fill', '#acacac')
      .text('Loading ' + fname);

    return new Promise(function (resolve, reject) {
      d3.json(fname, function (error, flare) {
        if (error) {
          let reason = '';

          if (error.currentTarget && error.currentTarget.statusText) {
            reason = error.currentTarget.statusText;
          } else if (error instanceof SyntaxError) {
            reason = 'Syntax error: ' + error.message;
          }

          svg.style('background', '#EEE');
          svg.select('text')
            .text('Error parsing ' + fname);
          svg.select('g').append('text')
            .attr('dy', '2rem')
            .attr('text-anchor', 'middle')
            .style('font-size', '1.5em')
            .style('fill', '#acacac')
            .text(reason);

          reject(error);
        } else {
          svg.remove();
          resolve(new Flareplot(flare, width, containerSelector, layoutOptions));
        }
      });
    });
  }
}

