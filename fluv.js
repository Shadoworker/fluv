// import SVG from './svg'
// -----------------------------
// Path Morphing
// -----------------------------
class PathMorpher {
  SVGNS = "http://www.w3.org/2000/svg";
  _sampler = null;
  DEFAULT_SEGMENTS = 220;

  constructor() {
    this._createSampler();
  }

  _createSampler()
  {
    if (typeof document !== "undefined")
      this._sampler = document.createElementNS(this.SVGNS, "path");
  }
  _parseNumbers(d) {
    return d.match(/[+-]?\d*\.?\d+(?:e[+-]?\d+)?/gi).map(Number);
  }

  _getCubicCount(d) {
    return (d.match(/[Cc]/g) || []).length;
  }

  _samplePath(d, segments = this.DEFAULT_SEGMENTS) {
    this._sampler.setAttribute("d", d);
    const len = this._sampler.getTotalLength();
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const p = this._sampler.getPointAtLength((i / segments) * len);
      pts.push([p.x, p.y]);
    }
    return pts;
  }

  _resample(points, targetCount) {
    const resampled = [];
    for (let i = 0; i < targetCount; i++) {
      const t = i / (targetCount - 1);
      const idx = t * (points.length - 1);
      const i0 = Math.floor(idx);
      const i1 = Math.min(points.length - 1, i0 + 1);
      const alpha = idx - i0;
      const x = points[i0][0] * (1 - alpha) + points[i1][0] * alpha;
      const y = points[i0][1] * (1 - alpha) + points[i1][1] * alpha;
      resampled.push([x, y]);
    }
    return resampled;
  }

  // Find best rotation offset to minimize total squared distance
  _alignByRotation(a, b) {
    const n = a.length;
    let bestShift = 0;
    let bestScore = Infinity;

    for (let shift = 0; shift < n; shift++) {
      let score = 0;
      for (let i = 0; i < n; i++) {
        const j = (i + shift) % n;
        const dx = a[i][0] - b[j][0];
        const dy = a[i][1] - b[j][1];
        score += dx * dx + dy * dy;
      }
      if (score < bestScore) {
        bestScore = score;
        bestShift = shift;
      }
    }

    return b.slice(bestShift).concat(b.slice(0, bestShift));
  }

  _pointsToPath(pts) {
    if (!pts.length) return "";
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      const prev = pts[i - 1];
      const c1x = (prev[0] * 2 + p[0]) / 3;
      const c1y = (prev[1] * 2 + p[1]) / 3;
      const c2x = (prev[0] + p[0] * 2) / 3;
      const c2y = (prev[1] + p[1] * 2) / 3;
      d += `C${c1x} ${c1y} ${c2x} ${c2y} ${p[0]} ${p[1]}`;
    }
    return d;
  }

  createPathMorph(d1, d2, { segments = this.DEFAULT_SEGMENTS } = {}) {
    const count1 = this._getCubicCount(d1);
    const count2 = this._getCubicCount(d2);

    // console.log({d1, d2})

    // CASE 1: Same structure
    if (count1 === count2) {
      const nums1 = this._parseNumbers(d1);
      const nums2 = this._parseNumbers(d2);
      const n = Math.min(nums1.length, nums2.length);

      // Build coordinate triplets for alignment
      const pts1 = [];
      for (let i = 2; i < n; i += 6) {
        pts1.push([nums1[i + 4], nums1[i + 5]]); // endpoints of each cubic
      }
      const pts2 = [];
      for (let i = 2; i < n; i += 6) {
        pts2.push([nums2[i + 4], nums2[i + 5]]);
      }

      const alignedPts2 = this._alignByRotation(pts1, pts2);

      // Reorder nums2 according to the alignment offset
      const shift = pts2.indexOf(alignedPts2[0]);
      const groupSize = 6;
      const segmentCount = count2;
      const shifted = [];

      // Reorder numeric groups (M stays the same)
      shifted.push(nums2[0], nums2[1]);
      for (let i = 0; i < segmentCount; i++) {
        const j = (i + shift) % segmentCount;
        const base = 2 + j * groupSize;
        shifted.push(
          nums2[base],
          nums2[base + 1],
          nums2[base + 2],
          nums2[base + 3],
          nums2[base + 4],
          nums2[base + 5]
        );
      }

      return (t) => {
        const interp = [];
        for (let i = 0; i < n; i++) {
          interp.push(nums1[i] + (shifted[i] - nums1[i]) * t);
        }

        let d = `M${interp[0]} ${interp[1]}`;
        for (let i = 2; i < n; i += 6) {
          d += `C${interp[i]} ${interp[i + 1]} ${interp[i + 2]} ${interp[i + 3]} ${interp[i + 4]} ${interp[i + 5]}`;
        }
        return d;
      };
    }

    // CASE 2: Fallback resampling
    let pts1 = this._samplePath(d1, segments);
    let pts2 = this._samplePath(d2, segments);
    pts2 = this._alignByRotation(pts1, pts2);

    return (t) => {
        
      var pts = pts1.map((p, i) => [
        p[0] + (pts2[i][0] - p[0]) * t,
        p[1] + (pts2[i][1] - p[1]) * t,
      ]);
      return this._pointsToPath(pts);
    };
  }
}



class PathReshaper {
  constructor() {
    this.SVGNS = "http://www.w3.org/2000/svg";
    this.commandsRegex = /([MC])([^MC]+)/gi;
    this._createSampler();
  }

  _createSampler() {
    if (typeof document !== "undefined") {
      this._sampler = document.createElementNS(this.SVGNS, "path");
    }
  }

  _samplePath(d) {
    this._sampler.setAttribute("d", d);
    const pts = this.getPointsAlongCurve(d);
    this._sampler.shapePoints = pts;
  }

  createPoint(x, y, cp0x = 0, cp0y = 0, cp1x = 0, cp1y = 0) {
    const cp0 = { x: cp0x, y: cp0y };
    const cp1 = { x: cp1x, y: cp1y };
    const point = { x, y, cp0, cp1 };
    cp0.ep = point;
    cp1.ep = point;
    return point;
  }

  getPointsFromPathData(d) {
    const commands = d.match(this.commandsRegex) || [];
    const points = [];
    let prev = null;

    for (const cmd of commands) {
      const type = cmd[0];
      const nums = cmd.slice(1).trim().split(/[ ,]+/).map(Number);

      if (type === "M") {
        const [x, y] = nums;
        const point = this.createPoint(x, y, x, y, x, y);
        points.push(point);
        prev = point;
      }

      if (type === "C") {
        for (let i = 0; i < nums.length; i += 6) {
          const [x1, y1, x2, y2, x, y] = nums.slice(i, i + 6);
          if (prev) {
            prev.cp1.x = x1;
            prev.cp1.y = y1;
          }
          const point = this.createPoint(x, y, x2, y2, x, y);
          points.push(point);
          prev = point;
        }
      }
    }
    return points;
  }

  render(points) {
    let ep, prev_ep;
    let pathStarted = false;
    let pathString = "";
    for (let i = 0; i < points.length; i++) {
      ep = points[i];
      if (!pathStarted) {
        pathString = `M${ep.x} ${ep.y}`;
        pathStarted = true;
      }
      if (i > 0) {
        prev_ep = points[i - 1];
        pathString += this.createBezier(prev_ep, ep);
      }
    }
    return pathString;
  }

  createBezier(prev_ep, ep) {
    return (
      "C" +
      prev_ep.cp1.x +
      " " +
      prev_ep.cp1.y +
      " " +
      ep.cp0.x +
      " " +
      ep.cp0.y +
      " " +
      ep.x +
      " " +
      ep.y
    );
  }

  sameEndPoint(p1, p2, eps = 0.001) {
    return Math.abs(p1.x - p2.x) < eps && Math.abs(p1.y - p2.y) < eps;
  }

  findAddedPoint(points1, points2) {
    for (let i = 0; i < points2.length; i++) {
      const exists = points1.some((p) => this.sameEndPoint(p, points2[i]));
      if (!exists) {
        return {
          added: points2[i],
          insertIndex: i,
          prevInsertIndex: i - 1,
          nextInsertIndex: i + 1,
        };
      }
    }
    return null;
  }

  getPointsAlongCurve(d) {
    const commands = d.match(this.commandsRegex) || [];
    const points = [];
    const NUMBER_OF_STEPS = 150;
    let currentX = 0,
      currentY = 0;
    const step = 1 / NUMBER_OF_STEPS;

    for (const command of commands) {
      const type = command[0];
      const values = command
        .substring(1)
        .trim()
        .split(/[\s,]+/)
        .map(parseFloat);

      switch (type) {
        case "M":
          currentX = values[0];
          currentY = values[1];
          break;

        case "C": {
          const [x1, y1, x2, y2, x, y] = values;
          for (let t = 0; t <= 1; t += step) {
            const xT =
              currentX * (1 - t) ** 3 +
              3 * x1 * t * (1 - t) ** 2 +
              3 * x2 * t ** 2 * (1 - t) +
              x * t ** 3;
            const yT =
              currentY * (1 - t) ** 3 +
              3 * y1 * t * (1 - t) ** 2 +
              3 * y2 * t ** 2 * (1 - t) +
              y * t ** 3;
            points.push({ x: xT, y: yT });
          }
          currentX = x;
          currentY = y;
          break;
        }
      }
    }
    return points;
  }

  getPointRelativeIndex(h, p1, p2) {
    const shapePoints = this._sampler.shapePoints;
    const findIndex = (p) =>
      shapePoints.findIndex((sp) => sp.x === p.x && sp.y === p.y);

    const p1Index = findIndex(p1);
    const p2Index = findIndex(p2);
    const hIndex = findIndex(h);

    return (hIndex - p1Index) / (p2Index - p1Index);
  }

  splitBezier(_startPoint, cp1, cp2, _endPoint, t = 0.5) {
    const B0 = [
      (1 - t) * _startPoint.x + t * cp1.x,
      (1 - t) * _startPoint.y + t * cp1.y,
    ];
    const B1 = [
      (1 - t) * cp1.x + t * cp2.x,
      (1 - t) * cp1.y + t * cp2.y,
    ];
    const B2 = [
      (1 - t) * cp2.x + t * _endPoint.x,
      (1 - t) * cp2.y + t * _endPoint.y,
    ];
    const B01 = [(1 - t) * B0[0] + t * B1[0], (1 - t) * B0[1] + t * B1[1]];
    const B12 = [(1 - t) * B1[0] + t * B2[0], (1 - t) * B1[1] + t * B2[1]];
    const B012 = [(1 - t) * B01[0] + t * B12[0], (1 - t) * B01[1] + t * B12[1]];

    return {
      newPoint: {
        ep: { x: B012[0], y: B012[1] },
        cp0: { x: B01[0], y: B01[1] },
        cp1: { x: B12[0], y: B12[1] },
      },
      startPoint: { cp: { x: B0[0], y: B0[1] } },
      endPoint: { cp: { x: B2[0], y: B2[1] } },
    };
  }

  reshape(path1, path2) {
    const points1 = this.getPointsFromPathData(path1);
    const points2 = this.getPointsFromPathData(path2);

    const reshapedPointsIndex = points2.length > points1.length ? 0 : 1;
    const keptPointsIndex = 1 - reshapedPointsIndex;

    const pointsToReshape =
      reshapedPointsIndex === 0 ? points1 : points2;
    const pointsToKeep =
      keptPointsIndex === 0 ? points1 : points2;

    const pathToKeep = keptPointsIndex === 0 ? path1 : path2;
    const diff = this.findAddedPoint(pointsToReshape, pointsToKeep);

    if (!diff || points1.length === points2.length)
      return { 0: path1, 1: path2 };

    const { added, insertIndex, prevInsertIndex, nextInsertIndex } = diff;
    const start = pointsToKeep[prevInsertIndex];
    const end = pointsToKeep[nextInsertIndex];
    const start_ = pointsToReshape[prevInsertIndex];
    const end_ = pointsToReshape[insertIndex];

    this._samplePath(pathToKeep);
    const relativeIndex = this.getPointRelativeIndex(added, start, end);

    const result = this.splitBezier(start_, start_.cp1, end_.cp0, end_, relativeIndex);
    const newPoint = result.newPoint;
    const endPoint = result.endPoint;
    const startPoint = result.startPoint;

    const tPoint = this.createPoint(
      newPoint.ep.x,
      newPoint.ep.y,
      newPoint.cp0.x,
      newPoint.cp0.y,
      newPoint.cp1.x,
      newPoint.cp1.y
    );

    pointsToReshape.splice(insertIndex, 0, tPoint);
    const prevIndex = prevInsertIndex;
    const nextIndex = nextInsertIndex;

    pointsToReshape[prevIndex].cp1.x = startPoint.cp.x;
    pointsToReshape[prevIndex].cp1.y = startPoint.cp.y;
    pointsToReshape[nextIndex].cp0.x = endPoint.cp.x;
    pointsToReshape[nextIndex].cp0.y = endPoint.cp.y;

    const generatedPathString = this.render(pointsToReshape);
    return {
      [reshapedPointsIndex]: generatedPathString,
      [keptPointsIndex]: pathToKeep,
    };
  }
}

// Create path morpher instance
const pathMorpherIns = new PathMorpher();


/* export default  */class Fluv {
    static ANIMATBLES_ORDER = ["translateX", "translateY", "anchor", "scaleX", "scaleY", "rotate", "width", "height", "strokeDashoffset"];
    static VALID_TRANSFORMS = ['translateX', 'translateY', 'translateZ', 'rotate', 'rotateX', 'rotateY', 'rotateZ', 'scaleX', 'scaleY', 'anchor', 'anchorX', 'anchorY', 'skew', 'skewX', 'skewY', 'perspective', 'matrix', 'matrix3d'];
    static VALID_SCALE_ATTRIBUTES = ['scaleX', 'scaleY'];
    static COLOR_ATTRIBUTES = {'fill' : 'fill', 'stroke' : 'stroke'};
    static VALID_SIZE_ATTRIBUTES = ['width', 'height'];
    static PATH_TRANSFORMS = {'followPath' : 'followPath', 'morphTo' : 'morphTo', 'd': 'd'};
    static STROKE_TRANSFORMS = {'strokeWidth': 'stroke-width' ,'strokeDasharray' : 'stroke-dasharray', 'strokeDashoffset':'stroke-dashoffset'};
    static EFFECTS_PROPERTIES = {"effectX" : "effectX", "effectY" : "effectY", "effectBlur" : "effectBlur", "effectColor" : "effectColor"};


    static GEOMETRY_ALTERING_PROPERTIES = ['d', 'points', 'text'];

    static EASINGS = {
        linear: [0.0, 0.0, 1.0, 1.0],
        easeInQuad: [0.55, 0.085, 0.68, 0.53],
        easeOutQuad: [0.25, 0.46, 0.45, 0.94],
        easeInOutQuad: [0.455, 0.03, 0.515, 0.955],

        easeInCubic: [0.55, 0.055, 0.675, 0.19],
        easeOutCubic: [0.215, 0.61, 0.355, 1.0],
        easeInOutCubic: [0.645, 0.045, 0.355, 1.0],

        easeInQuart: [0.895, 0.03, 0.685, 0.22],
        easeOutQuart: [0.165, 0.84, 0.44, 1.0],
        easeInOutQuart: [0.77, 0.0, 0.175, 1.0],

        easeInQuint: [0.755, 0.05, 0.855, 0.06],
        easeOutQuint: [0.23, 1.0, 0.32, 1.0],
        easeInOutQuint: [0.86, 0.0, 0.07, 1.0],

        easeInSine: [0.47, 0.0, 0.745, 0.715],
        easeOutSine: [0.39, 0.575, 0.565, 1.0],
        easeInOutSine: [0.445, 0.05, 0.55, 0.95],

        easeInExpo: [0.95, 0.05, 0.795, 0.035],
        easeOutExpo: [0.19, 1.0, 0.22, 1.0],
        easeInOutExpo: [1.0, 0.0, 0.0, 1.0],

        easeInCirc: [0.6, 0.04, 0.98, 0.335],
        easeOutCirc: [0.075, 0.82, 0.165, 1.0],
        easeInOutCirc: [0.785, 0.135, 0.15, 0.86],

        easeInElastic: [0.47, -0.03, 0.745, 0.715],
        easeOutElastic: [0.39, 0.575, 0.565, 1.425],
        easeInOutElastic: [0.68, -0.55, 0.265, 1.55],

        easeInBounce: [0.6, -0.28, 0.735, 0.045],
        easeOutBounce: [0.175, 0.885, 0.32, 1.275],
        easeInOutBounce: [0.68, -0.55, 0.265, 1.55],
    };


    static utils = {

        getDistance(p1, p2) {
            return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        },

        getDashoffset(el) {
            const pathLength = Fluv.utils.getTotalLength(el);
            return pathLength;
        },

        getCircleLength(el) {
            return Math.PI * 2 * el.attr('r');
        },

        getRectLength(el) {
            return (el.attr('width') * 2) + (el.attr('height') * 2);
        },

        getLineLength(el) {
            return Fluv.utils.getDistance(
                {x: el.attr('x1'), y: el.attr('y1')}, 
                {x: el.attr('x2'), y: el.attr('y2')}
            );
        },

        getPolylineLength(el) {
            const points = el.node.points;
            let totalLength = 0;
            let previousPos;
            for (let i = 0 ; i < points.numberOfItems; i++) {
                const currentPos = points.getItem(i);
                if (i > 0) totalLength += Fluv.utils.getDistance(previousPos, currentPos);
                previousPos = currentPos;
            }
            return totalLength;
        },

        getPolygonLength(el) {
            const points = el.points;
            return Fluv.utils.getPolylineLength(el) + Fluv.utils.getDistance(points.getItem(points.numberOfItems - 1), points.getItem(0));
        },

        // Path animation
        getTotalLength(el) {
            if (el.node.getTotalLength) return el.node.getTotalLength();
            switch(el.type) {
                case 'circle': return Fluv.utils.getCircleLength(el);
                case 'rect': return Fluv.utils.getRectLength(el);
                case 'line': return Fluv.utils.getLineLength(el);
                case 'polyline': return Fluv.utils.getPolylineLength(el);
                case 'polygon': return Fluv.utils.getPolygonLength(el);
            }
        },

        getFollowPathTweenValue(followPathTween, progress)
        { 
            const runner = followPathTween.runner;
            const path = followPathTween.runner.followedPath;
            var centered = runner.params.centered; // Whether the element is centered on path or not
            var rotated = runner.params.rotated; // Whether the element must be rotated or not
            
            function point(offset = 0) 
            {
                const l = progress + offset >= 1 ? progress + offset : 0;
                return path.node.getPointAtLength(l);
            }
            
            var p = point();
            const p0 = point(-1);
            const p1 = point(+1);
            var angle = Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180 / Math.PI;

            // Create _followghost just once ... and update its properties on need
            if(!path._followghost) path._followghost = path.clone();
            path._followghost._bbox = path.bbox();
            path._followghost.transform(path.transform());
            path._followghost.bbox = () => {return path._followghost._bbox} // Override bbox() method to avoid appending of element to the dom


            path._followghost.translate(p.x, p.y)
            const pathTransform = path._followghost.transform();

            return {transform : pathTransform, angle : angle, rotated, centered }
         
        },


        hexToRgba(hex) {
          // remove invalid characters
          hex = hex.replace(/[^0-9a-fA-F]/g, '');
        
          if (hex.length < 5) { 
            // 3, 4 characters double-up
            hex = hex.split('').map((s) => s + s).join('');
          }
          // parse pairs of two
          let rgba = hex.match(/.{1,2}/g).map((s)=> parseInt(s, 16));
        
          // alpha code between 0 & 1 / default 1
          rgba[3] = rgba.length > 3 ? parseFloat(rgba[3] / 255+"").toFixed(2): 1;
        
          return {r:rgba[0], g:rgba[1], b:rgba[2], a:rgba[3]}
        },
        
        isGradient(_colorString)
        {
          return _colorString.includes && _colorString.includes('%');
        },

        formatSolidAndGradient(initialColor, targetColor) 
        {
            const rgbaRegex = /rgba?(\(\s*\d+\s*,\s*\d+\s*,\s*\d+)(?:\s*,.+?)?\)/g;
        
            if(this.isGradient(targetColor) && !this.isGradient(initialColor))
            {
                var targetColorTemp = targetColor.toLowerCase();

                if(initialColor[0]=='#') 
                {   
                    const c = this.hexToRgba(initialColor);
                    initialColor = `rgba(${c.r},${c.g},${c.b},${c.a})`
                }
                initialColor = targetColorTemp.replaceAll(rgbaRegex, initialColor);
            }
        
            else if(this.isGradient(initialColor) && !this.isGradient(targetColor))
            {
                var initialColorTemp = initialColor.toLowerCase();
                
                if(targetColor[0]=='#')
                {   
                    const c = this.hexToRgba(targetColor);
                    targetColor = `rgba(${c.r},${c.g},${c.b},${c.a})`
                }
                targetColor = initialColorTemp.replaceAll(rgbaRegex, targetColor);
            }
        
            return {initialColor, targetColor}
        },
    
        getGradientValues(_colorString)
        {
          var type = _colorString.split("-gradient")[0];
          var part1 = _colorString.split("gradient(")[1];
          var part11 = (part1.split("%)")[0] + "%").toLowerCase();
        
          var segments = part11.split(", rgba")
        
          var angle = segments[0].split('deg')[0];
        
          var values = []
        
          for (let i = 1; i < segments.length; i++) {
            const seg = segments[i];
        
            var color = 'rgba'+seg.split(') ')[0]+')'
            var percentage = seg.split(') ')[1]
        
            values.push({color : color, percentage:percentage})
          }
        
          var data = {type : type, angle : angle, values : values};
        
          return data;
        },

        gradientDataToArray(data)
        {
          const {type, angle, values } = data;

          var arr = [parseInt(angle)]

          for (let i = 0; i < values.length; i++) {
            const stop = values[i];
            const {color, percentage} = stop;
            const rgba = color.replace(/^rgba?\(|\s+|\)$/g,'').split(',');
            
            const stopSeq = [parseInt(rgba[0]), parseInt(rgba[1]), parseInt(rgba[2]), parseInt(rgba[3]), parseInt(percentage)]

            arr = [...arr, ...stopSeq]
          }

          return arr;

        },

        parseGradientArray(data){
            const angle = data[0];
            const stops = [];
            
            // Start at index 1, jump by 5
            for (let i = 1; i < data.length; i += 5) {
                stops.push({
                    color: `rgba(${data[i]},${data[i+1]},${data[i+2]},${data[i+3]})`,
                    offset: data[i+4]
                });
            }

            return { angle, stops };
        },

        setGradientElement(flInstance, el, _baseColorType="fill", _gradientType=null, _gradientAngle=null, _stopPoints=null)
        {
            var _elemId = el.id();

            var svgInstance = el.node.ownerSVGElement.instance;
 
            var gradientId = `${_elemId}-${_baseColorType}-gradient`; // Default gradient id
            if(flInstance.config.gradientIdCb)
                gradientId = flInstance.config.gradientIdCb(el);

            var gradient = svgInstance.findOne(`#${gradientId}`);

            if(gradient) gradient.remove();

                
            gradient = svgInstance.gradient(_gradientType).attr({id : gradientId});

            for (let i = 0; i < _stopPoints.length; i++)
            {
                const _vals = _stopPoints[i];
                var stopPoint = parseInt(_vals.offset)/100;
                gradient.stop(stopPoint, _vals.color)
            }

            if(_gradientType == "linear")
            {
                // +90 to correct the css-math coordinates mismatch
                const radians = (parseInt(_gradientAngle)+90) * Math.PI / 180; // Convert degrees to radians
                const x1 = 0.5 + 0.5 * Math.cos(radians);
                const y1 = 0.5 + 0.5 * Math.sin(radians);
                const x2 = 0.5 - 0.5 * Math.cos(radians);
                const y2 = 0.5 - 0.5 * Math.sin(radians);

                gradient.from(x1, y1).to(x2, y2);
            }
            
            if(flInstance.config.gradientSetterCb)
            {
                flInstance.config.gradientSetterCb(el, gradient, _baseColorType);
            }
            else
            {
                if(_baseColorType == Fluv.COLOR_ATTRIBUTES.fill)
                    el.fill(gradient)
                else
                    el.stroke(gradient) 
            }

            return gradientId;

        },
 

    }

    constructor(options = {duration : null, easing : 'linear', loop: false, autoplay : false, delay : 0, managedState : false, update : null, complete : null, gradientIdCb : null, gradientSetterCb : null, updateImagePatternCb : null, getManagedState : null, updateAnchorCb : null}) {
        this.animations = [];
        this._allTweens = [];
        // Options
        this.config = {
            duration: options.duration || null, // Manual override for maxDuration
            speed : options.speed || 1,
            easing: options.easing || 'linear',
            loop: options.loop || false,
            autoplay: options.autoplay !== undefined ? options.autoplay : false,
            delay: options.delay || 0, // Global timeline delay
            managedState : options.managedState || false, // Whether the initial state of elements is managed externally or not
            onUpdate: options.update || null,
            onComplete: options.complete || null,

            // inner callbacks
            gradientIdCb : options.gradientIdCb || null,
            gradientSetterCb : options.gradientSetterCb || null,

            updateImagePatternCb : options.updateImagePatternCb || null, // cb to update the rect-as-image-holder element's pattern image
            getManagedState : options.getManagedState || null, // cb to get the managed state of a given el's property
            updateAnchorCb : options.updateAnchorCb || null, // cb to handle what happen to our element (visually?) when the anchor is animated
            
          };

        this.maxDuration = 0;
        this.lastElapsed = 0;
        this.rafId = null;
        this.isPlaying = false;
        this.isCompleted = false;
        this.progress = 0;

        this.dirtyProperties = new Set(); // Holds the list of properties which must be reseted on play

    }

  

    add(data) {
        data = this._reorderKeys(data);
        const found = SVG.find(data.targets);
        const elements = Array.isArray(found) ? found : [found];

        elements.forEach((el, i) => {
            // Virtual ghost for matrix math (not added to DOM)
            const snapshot = el.clone(true); // initial unanimated state
            const ghost = el.clone(); // animation tracking state
            ghost._bbox = el.bbox();
            ghost.bbox = () => {return ghost._bbox} // Override bbox() method to avoid appending of element to the dom
            const anchor = this.config.managedState ? [el.anchor()?.x, el.anchor()?.y] : [0.5, 0.5]; // get or set default anchor
            ghost._anchor = anchor; // save inside ghost

            const item = { el, targets : data.targets, _ghost: ghost, _snapshot : snapshot, animatables: {} };

            for (const prop in data) {
                if (prop === 'targets' || !data[prop]) continue;

                item.animatables[prop] = [];

                let startValue = this._getInitialState(el, prop);
                let startAnchor = ghost._anchor; // get from ghost

                const steps = data[prop];
 

                steps?.forEach((step, j) => {
                    const localDelay = Array.isArray(step.delay) 
                        ? this._calculateStagger(step.delay, elements.length, i)
                        : (step.delay || 0);
                    
                    // Add global timeline delay
                    const finalDelay = localDelay + this.config.delay;

                    var runner = new SVG.Morphable();
                    runner.from(startValue);

                    let finalValue = step.value;
                    let finalAnchor = step.value;

                    if (Fluv.VALID_TRANSFORMS.includes(prop)) 
                    {
                      var val = step.value - startValue.decompose()[prop];

                      if (prop === "translateX" || prop === "translateY") {
                          const dx = prop === "translateX" ? val : 0;
                          const dy = prop === "translateY" ? val : 0;
                          finalValue = startValue.clone().transform({ translate: [dx, dy] }, true);
                      } 
                      else 
                      {
                        if(prop == "anchor") // set new morphable type for anchor
                        {
                          var runner = new SVG.Morphable();
                          runner.from(startAnchor);
                        }
                        else
                        {
                          if(prop == 'scaleX' || prop == 'scaleY')
                            val = step.value / startValue.decompose()[prop];
  
                          const tObj = { [prop]: val };

                          finalValue = startValue.clone().transform(tObj, true);

                        }

                      }

                      startValue = finalValue;
                      startAnchor = finalAnchor;

                    }
                    else if(Object.keys(Fluv.COLOR_ATTRIBUTES).includes(prop))
                    {
                        if(Fluv.utils.isGradient(finalValue))
                        {
                          // Reset runner to avoid previous value type conflict with new
                          runner = new SVG.Morphable();
                          // Setup values for gradient (array of numbers)
                          const formattedcolors = Fluv.utils.formatSolidAndGradient(startValue, finalValue)
                          
                          const initialValueGradientValues = Fluv.utils.getGradientValues(formattedcolors.initialColor);
                          const finalValueGradientValues = Fluv.utils.getGradientValues(formattedcolors.targetColor);

                          const initialGradientDataArray = Fluv.utils.gradientDataToArray(initialValueGradientValues)
                          finalValue = Fluv.utils.gradientDataToArray(finalValueGradientValues).toLocaleString()
                          
                          runner.from(initialGradientDataArray.toLocaleString())
                          runner.gradientType = finalValueGradientValues.type;
                        }
                    }
                    else if(prop == Fluv.PATH_TRANSFORMS.morphTo) // morphTo
                    {
                        // d values are computed otherwise they change over tweening and will cause unwanted behaviour
                        const toPathSelector = finalValue; //

                        const fromPathEl = el;
                        const toPathEl = SVG.find(toPathSelector)[0];

                        runner.fromPath = {d : fromPathEl.attr('d')};
                        runner.toPath = {d : toPathEl.attr('d')};

                        // Get source path
                        const source = el;
                        // Get target path
                        const target = toPathEl;
                        // Get destination path 
                        // Clone the dest to be moved at the source center
                        var destClone = target.clone();
                        target.pathString = target.attr('d');
                        destClone.pathString = target.pathString; // the 'pathString' used for path move() method is not copied as the other properties
                        
                        // Get the source center point
                        var sourceCenterX = source.x() + source.width() * 0.5;
                        var sourceCenterY = source.y() + source.height() * 0.5;
                        // Center
                        destClone.center(sourceCenterX, sourceCenterY);
                        // Update toPath d attribute
                        runner.toPath.d = destClone.attr('d');
                        var interpolator = pathMorpherIns.createPathMorph(runner.fromPath.d, runner.toPath.d)
                        runner.interpolator = interpolator;

                        finalValue = runner.toPath.d;
                    }
                    else if(prop == Fluv.PATH_TRANSFORMS.d)
                    {
                        // Get real interpolation values
                        const reshaper = new PathReshaper();
                        const reshapResult = reshaper.reshape(startValue, finalValue)
                        
                        var interpolator = pathMorpherIns.createPathMorph(reshapResult[0], reshapResult[1])
                        runner.interpolator = interpolator;
                    }
                    else if(prop == Fluv.PATH_TRANSFORMS.followPath)
                    {
                        const followedPathId = finalValue;
                        const followedPath = SVG.find(followedPathId)[0];
                        const pathTotalLength = followedPath.node.getTotalLength();

                        finalValue = pathTotalLength;

                        runner.followedPath = followedPath;
                        runner.params = {centered : step.params?.centered||false,rotated : step.params?.rotated||false}

                    }
                    else if(Object.keys(Fluv.EFFECTS_PROPERTIES).includes(prop)) // effect/filters
                    {
                        // Reset runner to avoid previous value type conflict with new
                        runner = new SVG.Morphable();

                        const params = step.params;
                        const { effectSelector, filterSelector, filterProperty } = params;
                        
                        if(!this.config.managedState)
                        {
                          const effectEl = SVG.find(`${effectSelector}`)[0];
                          const propertyHandlerEl = effectEl?.findOne(filterSelector);
  
                          if(propertyHandlerEl && startValue == null) // the first time only among steps
                              startValue = propertyHandlerEl?.attr(filterProperty);
                        }
                        else
                        {
                          startValue = this.config.getManagedState(el, prop, {effectSelector, filterSelector, filterProperty});
                        }

                        runner.from(startValue);

                        runner.params = step.params;
                    }


                    /** Set to value */
                    if(prop == "anchor")
                      runner.to(finalAnchor);
                    else
                      runner.to(finalValue);

                    runner.staggered = Array.isArray(step.delay) ? localDelay : false;
                    // Easing logic
                    const easingName = step.easing || this.config.easing;
                    const b = Fluv.EASINGS[easingName] || Fluv.EASINGS.linear;
                    runner.stepper(new SVG.Ease(SVG.easing.bezier(b[0], b[1], b[2], b[3])));

                    // IMPORTANT: Update startValue for the next step in the sequence
                    // For non-transforms, we grab the constructor to ensure value type compatibility
                    if (!Fluv.VALID_TRANSFORMS.includes(prop)) {
                        startValue = new runner._morphObj.constructor(runner.to());
                    }

                    // strokeDasharray specific case
                    if(prop == Fluv.STROKE_TRANSFORMS.strokeDashoffset)
                    {
                        const dashoffsetLength = Fluv.utils.getDashoffset(el);
                        runner.dashoffsetLength = dashoffsetLength;
                    }
 
                    // Add to prop tweens
                    item.animatables[prop].push({
                      el,
                      _ghost: ghost,
                      prop,
                      runner,
                      duration: step.duration || 0,
                      delay: finalDelay
                    });


                });
            }
            this.animations.push(item);
        });

        this._compileTimeline();
        if (this.config.autoplay) this.play();
        return this;
    }

    _compileTimeline() {
      const tweens = [];
      let calcMax = 0;
      for (let i = 0; i < this.animations.length; i++) {
          const animatables = this.animations[i].animatables;
          for (const prop in animatables) {
              const stepTweens = animatables[prop];
              for (let k = 0; k < stepTweens.length; k++) {
                  const tw = stepTweens[k];
                  tweens.push(tw);
                  calcMax = Math.max(calcMax, tw.delay + tw.duration);
              }
          }
      }
      this._allTweens = tweens;
      this.maxDuration = this.config.duration || calcMax;
    }
    
    _hasElementPropertiesAnimations(el, props) {

      const thisAnimationItem = this.animations.find(a=>a.el.id() == el.id())
      const thisAnimatables = thisAnimationItem.animatables;

      return props.some(prop => prop in thisAnimatables);
    }

    _render(elapsed) {
        const tweens = [...this._allTweens];
        const len = tweens.length;
         
        for (let i = 0; i < len; i++) {
            const tween = tweens[i];

            /**********RESET OPTS************* */
            if(this.fullReset && tween.runner.staggered) 
            {
                if(!tween.delayTemp) tween.delayTemp = tween.delay;
                tween.delay = 0
            }
            else if(!this.fullReset && tween.delayTemp)
            {
                tween.delay = tween.delayTemp;
            }
            /********************************* */
            const localProgress = Math.max(0, Math.min(1, (elapsed - tween.delay) / (tween.duration || 1)));
            
            /** * PERFORMANCE GATE: 
             * We skip the heavy runner calculation if the playhead hasn't reached the tween's delay yet.
             * EXCEPTION: If we are seeking (!isPlaying), we MUST process staggered elements 
             * even before their delay to ensure their initial state is rendered correctly.
             */
            const isPreDelay = elapsed < tween.delay && localProgress === 0;
            const shouldSkip = this.isPlaying ? isPreDelay : (isPreDelay && !tween.runner.staggered);

            if (shouldSkip) continue;
            
            /************************************************** */
           
            var val;
            var prop = tween.prop;
            
            if (!Object.keys(Fluv.PATH_TRANSFORMS).includes(prop) || prop == Fluv.PATH_TRANSFORMS.followPath) // Dont get value from runner directly for these types
                val = tween.runner.at(localProgress);

            if (Fluv.VALID_TRANSFORMS.includes(prop)) 
            {
                // process eventual anchor point for transforms
                const ox = tween._ghost.bbox().x + tween._ghost.bbox().width * tween._ghost._anchor[0]
                const oy = tween._ghost.bbox().y + tween._ghost.bbox().height * tween._ghost._anchor[1]
                //----------------------------------------------

                if (prop === "translateX" || prop === "translateY") {
                    tween.el.transform(val);
                    tween._ghost.transform(val);
                } 
                else if(prop === "anchor")
                { 
                  tween._ghost._anchor = val; // save inside el's ghost

                  if(this.config.updateAnchorCb) this.config.updateAnchorCb(tween.el, tween._ghost._anchor)
                }
                else if (Fluv.VALID_SCALE_ATTRIBUTES.includes(prop)) {
                    const tsX = val.decompose().scaleX;
                    const tsY = val.decompose().scaleY;
                  
                    tween._ghost.transform({scale : [tsX, tsY], ox, oy}, true);

                    tween.el.transform(tween._ghost.transform());
                } else if (prop === "rotate") {
                    let curRot = tween._ghost.transform().rotate;
                    const tarRot = val.decompose().rotate;

                    tween._ghost.transform({rotate : tarRot - curRot, ox, oy}, true);
                    
                    tween.el.transform(tween._ghost.transform());
                }
            }
            else if(prop == Fluv.PATH_TRANSFORMS.morphTo || prop == Fluv.PATH_TRANSFORMS.d)
            {
                const morph = tween.runner.interpolator(localProgress);
                // Set attribute value
                tween.el.attr({ 'd': morph });
            }
            else if(prop == Fluv.PATH_TRANSFORMS.followPath)
            {
                const followValue = Fluv.utils.getFollowPathTweenValue(tween, val)

                var 
                pathCurrentTransform = followValue.transform, 
                angle = followValue.angle, 
                centered = followValue.centered, 
                rotated = followValue.rotated;

                var cx = tween.el.bbox().cx
                var cy = tween.el.bbox().cy;

                tween.el.transform(pathCurrentTransform);
                
                if(centered)
                    tween.el.translate(-cx, -cy);

                if(rotated)
                {
                    let curRot = tween.el.transform().rotate;
                    const tarRot = angle;
                    tween.el.rotate(tarRot - curRot);
                }

            }
            else if(Object.keys(Fluv.COLOR_ATTRIBUTES).includes(prop))
            {
                if(prop == Fluv.COLOR_ATTRIBUTES.fill)
                {

                    if(Array.isArray(val)) // Set the color in the case of gradient value
                    {
                        var gradientData = Fluv.utils.parseGradientArray(val);
                        const gradientType = tween.runner.gradientType;
                        
                        Fluv.utils.setGradientElement(this, tween.el, Fluv.COLOR_ATTRIBUTES.fill, gradientType, gradientData.angle, gradientData.stops)
                    }
                    else // Solid color value
                    {
                        (tween.el.baseRefEl ? tween.el.baseRefEl() : tween.el).fill(val) 
                    }
                    // This set the reference for the initialValue to be used for the next tween
                    tween.el.baseFill ? tween.el.baseFill(null, val) : null; // in animation mode gradient id is not important
                
                }
                else if(prop == Fluv.COLOR_ATTRIBUTES.stroke)
                {
                    if(Array.isArray(val)) // Set the color in the case of gradient value
                    {
                        var gradientData = Fluv.utils.parseGradientArray(val);
                        const gradientType = tween.runner.gradientType;
                        
                        Fluv.utils.setGradientElement(this, tween.el, Fluv.COLOR_ATTRIBUTES.stroke, gradientType, gradientData.angle, gradientData.stops)
                    }
                    else // Solid color value
                    {
                        tween.el.stroke({color : val}) 
                    }
                    // This set the reference for the initialValue to be used for the next tween
                    tween.el.baseStroke ? tween.el.baseStroke(null, val) : null; // in animation mode gradient id is not important
                }
            }
            else if(Fluv.VALID_SIZE_ATTRIBUTES.includes(prop))
            {
                var box = tween.el.bbox();
                box.width = prop == 'width' ? val : box.width;
                box.height = prop == 'height' ? val : box.height;

                if(tween.el.type == 'text')
                {
                    const fontStyle = {size : val}
                    tween.el.font(fontStyle) 
                } 
                else // Anything else
                {
                    tween.el.size(box.width, box.height);
                }
            
                /* This is another scope */
                if(this.config.updateImagePatternCb)
                    this.config.updateImagePatternCb(tween.el, box.width, box.height)
                
            }
            else if(Object.keys(Fluv.EFFECTS_PROPERTIES).includes(prop)) // effect/filters
            {
                const params = tween.runner.params;
                const { effectSelector,
                        filterSelector,
                        filterProperty } = params;

                const effectEl = SVG.find(`${effectSelector}`)[0];
                const propertyHandlerEl = effectEl?.findOne(filterSelector);

                if(propertyHandlerEl)
                    propertyHandlerEl?.attr(filterProperty, val.toString());

            }
            else 
            {
                if(Object.keys(Fluv.STROKE_TRANSFORMS).includes(prop))
                    prop = Fluv.STROKE_TRANSFORMS[prop]; // Get valid attribute value


                if(prop == Fluv.STROKE_TRANSFORMS.strokeDashoffset)
                {
                    const percentValue = val; // save tweening value
                    // Get the element dashoffset (numeric value)
                    var dashoffsetLength = tween.runner.dashoffsetLength;
                    // Get the dashoffset at each frame if one of the transform animation below exist (these change the element size, so dashoffsetLength)
                    const targetSizeChanged = this._hasElementPropertiesAnimations(tween.el, [...Fluv.VALID_SIZE_ATTRIBUTES, ...Fluv.VALID_SCALE_ATTRIBUTES])
                    if(targetSizeChanged)
                    {
                        dashoffsetLength = Fluv.utils.getDashoffset(tween.el);
                    }
                    // Calculate the value according to the percentage sent
                    val = dashoffsetLength * (percentValue / 100);

                    /* Dashoffset works only if dasharray is set : if not exist set to the default value (i.e:full length)
                    ** if targetSizeChanged also, we update the dasharray */
                    if(!tween.el.attr(Fluv.STROKE_TRANSFORMS.strokeDasharray) || targetSizeChanged)
                    {
                        if(!tween.el.attr(Fluv.STROKE_TRANSFORMS.strokeDasharray))
                        {
                            this.dirtyProperties.add({el:tween.el, property: Fluv.STROKE_TRANSFORMS.strokeDasharray})
                        }
                        tween.el.attr({[Fluv.STROKE_TRANSFORMS.strokeDasharray] : dashoffsetLength})
                    }


                }
                 
                // Set attribute value
                tween.el.attr({ [prop]: val });
 
            }

            // In order to reflect the new bbox on the ghost element
            // Check for fail-cases (Geometry-altering properties)
            if (Fluv.GEOMETRY_ALTERING_PROPERTIES.includes(prop))
            {
                // Apply on ghost
                tween._ghost.attr({ [prop]: val }); 
                // Only re-measure if we absolutely have to
                const newBox = tween.el.bbox();
                tween._ghost._bbox = newBox;
            }
        }
    }


    _cleanDirtyProperties()
    {
        this.dirtyProperties.forEach(d=>{
            d.el.attr(d.property, null)
        })
        this.dirtyProperties.clear()
    }

    _fullReset(percent = 0) {
        this.fullReset = true;
        this.seek(percent)
        this.fullReset = false;
    }


    play(direction = 1, restart = false, reversing = false) {
        this.pause();
        if(restart || (this.isCompleted && !reversing)) this._fullReset();
        
        setTimeout(() => {
            
            this._cleanDirtyProperties();

            this.isPlaying = true;
            this.isCompleted = false;

            if (direction === 1 && this.lastElapsed >= this.maxDuration) this.lastElapsed = 0;
            if (direction === -1 && this.lastElapsed <= 0) this.lastElapsed = this.maxDuration;

            let startTime = null;
            const initialElapsed = this.lastElapsed;

            const tick = (now) => {
                if (!startTime) startTime = now;
                const delta = now - startTime;
                // SPEED MANAGEMENT: 
                // Calculate how much % progress to add based on speed and time delta
                const progressDelta = delta * this.config.speed;
                
                let elapsed = direction === 1 ? initialElapsed + progressDelta : initialElapsed - progressDelta;

                // Boundary Logic
                if (elapsed > this.maxDuration || elapsed < 0) {
                    if (this.config.loop) {
                        this.lastElapsed = elapsed > this.maxDuration ? 0 : this.maxDuration;
                        startTime = now; // Reset timer for loop
                        this.play(direction);
                        return;
                    } else {
                        this.lastElapsed = elapsed > this.maxDuration ? this.maxDuration : 0;
                        this._render(this.lastElapsed);
                        if (this.config.onComplete) this.config.onComplete();
                        this.pause();
                        if(this.lastElapsed == this.maxDuration) this.isCompleted = true;

                        if(reversing && this.lastElapsed == 0)
                          this._fullReset() // to enforce staggered element to return to their initial values

                        return;
                    }
                }

                this.lastElapsed = elapsed;
                this._render(elapsed);
                this.progress = (elapsed / this.maxDuration * 100);

                if (this.config.onUpdate) this.config.onUpdate();
                this.rafId = requestAnimationFrame(tick);
            };
            this.rafId = requestAnimationFrame(tick);

        }, 100);

    }

    restart()
    {
      this.play(1, true)
    }

    pause() {
      this.isPlaying = false;
      if (this.rafId) cancelAnimationFrame(this.rafId);
    }

    reverse() {
      this.play(-1, false, true);
    }

    seek(percent) {
      this.pause();
      this._cleanDirtyProperties();
      this.progress = percent;
      this.lastElapsed = (percent / 100) * this.maxDuration;
      this._render(this.lastElapsed);
    }

    time(time)
    {
      const percent = time / this.maxDuration * 100;
      this.seek(percent)
    }

    remove(targets) {
        
      /** Get initial value and reset to it */
      const itemsToRemove = this.animations.filter(a=>a.targets == targets);
      itemsToRemove.forEach(item => {
          item.el.transform(item._snapshot.transform())
          item.el.attr(item._snapshot.attr())
      });

      /** Remove definitively animations and re-compile the timeline */
      this.animations = this.animations.filter(a=>a.targets != targets)
      this._compileTimeline()
    }

    _getInitialState(el, prop) {
      
      if(!this.config.managedState)
      {
        if (Fluv.VALID_TRANSFORMS.includes(prop)) return new SVG.Matrix(el);
        if (Object.keys(Fluv.COLOR_ATTRIBUTES).includes(prop)) return el.attr(prop) || "#000";
        if (prop == Fluv.PATH_TRANSFORMS.followPath) return 0;
        if (Object.keys(Fluv.PATH_TRANSFORMS).includes(prop)) return el.attr("d")
        if(Object.keys(Fluv.EFFECTS_PROPERTIES).includes(prop)) return null; // effect/filters

        return el.attr(prop) || 0;
      }
      else // managed state
      {
        return this.config.getManagedState(el, prop)
      }
          
    }

    _reorderKeys(obj) {
      const result = {};
      Fluv.ANIMATBLES_ORDER.forEach(key => { if (key in obj) result[key] = obj[key]; });
      Object.keys(obj).forEach(key => { if (!(key in result)) result[key] = obj[key]; });
      return result;
    }

    _calculateStagger(delayArr, totalElements, index) {
      let [s, r, g] = delayArr;
      if (typeof s === "string" && s.includes("%")) s = (totalElements * parseInt(s)) / 100;
      if (typeof r === "string" && r.includes("%")) r = (totalElements * parseInt(r)) / 100;
      return index < s ? 0 : Math.floor((index - s) / r) * g;
    }
}




