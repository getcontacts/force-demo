
import {Flareplot} from "./flareplot/flareplot.js";
import {Forceplot} from "./flareplot/forceplot.js";


export class TissueViewer {

  constructor(containerSelector, size){
    this.width = size;
    this.height = size;
    const that = this;
    this.setupFlareplot(containerSelector)
      .then(function(){
        that.setupForceplot(containerSelector);
        that.setupFingerprints();
      });
  }

  setupFlareplot(containerSelector) {
    const div = d3.select(containerSelector)
      .append("div")
      .style("width", this.size + "px")
      .style("height", this.size + "px")
      .style("position", "absolute")
      .style("left", "0px")
      .style("top", "0px")
      .attr("id", "flareplotDiv");

    const that = this;
    return new Promise(resolve => {
      d3.json("gpcr_brain.json")
        .then(function (data) {
          that.flareplot = new Flareplot(data, that.width, "#flareplotDiv");
          that.flaremodel = that.flareplot.getModel();

          d3.selectAll(".vertex")
            .style("font-size", "12px")
            .style("font-family", "verdana");

          resolve();
        });
    });
  }

  setupForceplot(containerSelector) {
    const div = d3.select(containerSelector)
      .append("div")
      .style("width", this.size + "px")
      .style("height", this.size + "px")
      .style("position", "absolute")
      .style("left", "0px")
      .style("top", "0px")
      .attr("id", "forceplotDiv");

    this.forceplot = new Forceplot(this.flaremodel, "auto", "#forceplotDiv");
  }

  setupFingerprints() {

  }
}