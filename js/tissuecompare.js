
import {Flareplot} from "./flareplot/flareplot.js";
import {FingerprintPanel} from "./flareplot/fingerprintpanel.js";
import {Forceplot} from "./flareplot/forceplot.js";


export class TissueViewer {

  constructor(containerSelector, fingerprintSelector, size){
    this.width = size;
    this.height = size;
    const that = this;
    this.setupFlareplot(containerSelector)
      .then(function(){
        that.setupForceplot(containerSelector);
        that.setupFingerprints(fingerprintSelector);
      });
    this.setupSwitcher(containerSelector);
  }


  setupFlareplot(containerSelector) {
    this.flarediv = d3.select(containerSelector)
      .append("div")
      .style("width", this.width + "px")
      .style("height", this.width + "px")
      .style("position", "relative")
      .style("left", "50%")
      .style("top", "0px")
      .style("margin-left", (-this.width/2)+"px")
      .attr("id", "flareplotDiv");

    const that = this;
    return new Promise(resolve => {
      d3.json("gpcr_brain_track.json")
        .then(function (data) {
          that.flareplot = new Flareplot(data, that.width, "#flareplotDiv");
          that.flaremodel = that.flareplot.getModel();
          that.flaremodel.setFrames({ type: 'range', begin: 0, end: 23 });

          d3.selectAll(".vertex")
            .style("font-size", "12px")
            .style("font-family", "verdana");

          that.flarediv.style("display", "none")
          resolve();
        });
    });
  }

  setupForceplot(containerSelector) {
    this.forcediv = d3.select(containerSelector)
      .append("div")
      .style("width", this.width + "px")
      .style("height", this.width + "px")
      .style("position", "relative")
      .style("left", "50%")
      .style("top", "0px")
      .style("margin-left", (-this.width/2)+"px")
      .style("display", "block")
      .attr("id", "forceplotDiv");

    this.forceplot = new Forceplot(this.flaremodel, "auto", "#forceplotDiv");
  }

  setupSwitcher(containerSelector) {

    const switchbox = d3.select(containerSelector)
      .append("div")
      .attr("class", "switchcontainer");

    const that = this;

    const label = switchbox.append("span")
      .style("text-align", "center")
      .style("width", "20px")
      .style("user-select", "none")
      .style("cursor", "pointer")
      .html("&#x25CC;")
      .on("click", function(){
        if (this.flare) {
          that.forcediv.style("display", "block");
          that.flarediv.style("display", "none");
          d3.select(this).html("&#x25CC;")
          this.flare = false;
        } else {
          that.forcediv.style("display", "none");
          that.flarediv.style("display", "block");
          d3.select(this).html("\u29DF")
          this.flare = true;
        }
      })
      .node().flare = false;


  }

  setupFingerprints(fingerprintSelector) {
    this.fingerprintpanel = new FingerprintPanel(this.flaremodel, 20, fingerprintSelector);
    console.log(this.fingerprintpanel);
  }
}