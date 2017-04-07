define(function (require) {
    "use strict";

    const _ = require('lodash');
    const mathUtils = require('common/math-utils');

    let exports = {};

    /**
     * Calculate a signed integer value from an unsigned twos complement
     * @param value
     * @param numBits
     * @return {Number}
     */
    exports.fromTwosComplement = function (value, numBits) {
        let mask = 1 << (numBits - 1);
        return -(value & mask) + (value & ~mask);
    };

    /**
     * Converts an array of char codes to an array of characters
     * @param charCodes
     * @return {Array<String>}
     */
    exports.getCharArray = function (charCodes) {
        return _.map(charCodes, charCode => String.fromCharCode(charCode));
    };

    /**
     * Check if the bitfield has the bit N set to 1.
     * @param {Number} bitfield - Integer bit field.
     * @param bitNumber - 0-based index of the bit.
     * @return {boolean}
     */
    exports.bitToBool = function (bitfield, bitNumber) {
        return (bitfield & (1 << (bitNumber))) !== 0;
    };

    /**
     * Converts a byte array (containing char codes) into a string
     * @param bytes
     * @return {String}
     */
    exports.bytesToString = function (bytes) {
        let str = "";
        let index = 0;
        while (index < bytes.length) {
            let charCode = bytes[index];
            if (charCode === 0)
                break;
            str += String.fromCharCode(charCode);
            ++index;
        }
        return str;
    };

    exports.swap = function (a, b) {
        return [b, a];
    };

    /**
     * Transforms a vertex {x, y} into a point [x, y].
     * @param [Vertex] v
     * @returns {[Number, Number]}
     */
    exports.vertexToPoint = function (v) {
        return [v.x, v.y];
    };

    exports.pointToVertex = function (p) {
        return {x: p[0], y: p[1]};
    };

    exports.add = function (a, b) {
        let c = new Array(a.length);
        for (let i = 0; i < a.length; ++i) {
            c[i] = a[i] + b[i];
        }

        return c;
    };

    exports.sub = function (a, b) {
        let c = new Array(a.length);
        for (let i = 0; i < a.length; ++i) {
            c[i] = a[i] - b[i];
        }

        return c;
    };

    exports.mult = function (v, s) {
        let c = new Array(v.length);
        for (let i = 0; i < v.length; ++i) {
            c[i] = v[i] * s;
        }

        return c;
    };

    exports.div = function (v, s) {
        let c = new Array(v.length);
        for (let i = 0; i < v.length; ++i) {
            c[i] = v[i] / s;
        }

        return c;
    };

    exports.dot = function (a, b) {
        let c = 0;
        for (let i = 0; i < a.length; ++i) {
            c += a[i] * b[i];
        }

        return c;
    };

    exports.length = function (v) {
        return Math.sqrt(exports.dot(v, v));
    };

    exports.normalize = function (v) {
        let length = exports.length(v);
        return exports.div(v, length);
    };

    exports.perpVector = function (v) {
        return [-v[1], v[0]];
    };

    exports.distanceBetweenVertex = function (v1, v2) {
        let c1 = [v1.x, v1.y];
        let c2 = [v2.x, v2.y];
        return exports.length(exports.sub(c2, c1));
    };

    exports.convertNodeBBToAABB = function (bb) {
        let center = {
            x: (bb.left + bb.right) / 2,
            y: (bb.top + bb.bottom) / 2
        };
        let extent = {
            x: bb.right - center.x,
            y: bb.top - center.y
        };
        return {
            center,
            extent,
            min: [bb.left, bb.bottom],
            max: [bb.right, bb.top],
            grow: function (value) {
                this.extent.x = this.extent.x + value;
                this.extent.y = this.extent.y + value;
                this.min = exports.sub(this.min, [value, value]);
                this.max = exports.add(this.max, [value, value]);
            }
        };
    };

    exports.convertPartitionLineToRay = function (partitionLineStart, changes) {
        return {
            point: [partitionLineStart.x, partitionLineStart.y],
            dir: [changes.x, changes.y]
        };
    };

    // Intersect ray R(t) = p + t*d against AABB a.
    exports.intersectRayAABB = function (p, d, aabb, tmin, tmax) {
        //let tmin = mathUtils.min32Bits; // set to -FLT_MAX to get first hit on line
        //let tmax = mathUtils.max32Bits; // set to max distance ray can travel (for segment)

        let intersections = [];
        // For all three slabs
        for (let i = 0; i < p.length; ++i) {
            if (Math.abs(d[i]) < mathUtils.epsilon) { // Ray is parallel to slab. No hit if origin not within slab
                if (p[i] < aabb.min[i] || p[i] > aabb.max[i]) return intersections;
            } else { // Compute intersection t value of ray with near and far plane of slab
                let ood = 1.0 / d[i];
                let t1 = (aabb.min[i] - p[i]) * ood;
                let t2 = (aabb.max[i] - p[i]) * ood;
                // Make t1 be intersection with near plane, t2 with far plane
                if (t1 > t2)
                    [t1, t2] = exports.swap(t1, t2);
                // Compute the intersection of slab intersection intervals
                if (t1 > tmin) tmin = t1;
                if (t2 < tmax) tmax = t2;
                // Exit with no collision as soon as slab intersection becomes empty
                if (tmin > tmax) return intersections;
            }
        }
        // Ray intersects all 3 slabs. Add point (q) and intersection t value (tmin)
        intersections.push({x: p[0] + tmin *d[0], y: p[1] + tmin * d[1]});

        // If tmax is not equal to tmin, there is another intersection
        if (!mathUtils.nearlyEqual(tmin, tmax, mathUtils.epsilon)) {
            intersections.push({x: p[0] + tmax *d[0], y: p[1] + tmax * d[1]});
        }

        return intersections;
    };

    exports.getIntersectionPointsOnAABB = function (partitionRay, aabb, asInfiniteLine = false) {
        let tmin = 0; // set to -FLT_MAX to get first hit on line
        let tmax = 1; // set to max distance ray can travel (for segment)
        if (asInfiniteLine) {
            tmin = mathUtils.min32Bits;
            tmax = mathUtils.max32Bits;
        }

        return exports.intersectRayAABB(partitionRay.point, partitionRay.dir, aabb, tmin, tmax);
    };

    exports.pointIsInsideAABB = function (p, aabb) {
        for (let i = 0; i < p.length; ++i) {
            if (p[i] < aabb.min[i] || p[i] > aabb.max[i])
                return false;
        }
        return true;
    };

    exports.getVerticesInsideAABB = function (map, aabb) {
        let subSet = [];

        for (let v of map.vertexes) {
            if (exports.pointIsInsideAABB([v.x, v.y], aabb))
                subSet.push(v);
        }

        return subSet;
    };

    exports.getSegmentInsideAABB = function (map, segments, aabb) {
        let subSet = [];

        for (let s of segments) {
            let v1 = map.vertexes[s.startVertex];
            let v2 = map.vertexes[s.endVertex];
            if (exports.pointIsInsideAABB([v1.x, v1.y], aabb) || exports.pointIsInsideAABB([v2.x, v2.y], aabb))
                subSet.push(s);
            else {
                let changes = {
                    x: v2.x - v1.x,
                    y: v2.y - v1.y
                };

                let ray = exports.convertPartitionLineToRay(v1, changes);
                let intersections = exports.getIntersectionPointsOnAABB(ray, aabb, false);
                if (intersections.length > 0) {
                    subSet.push(s);
                }
            }
        }

        return subSet;
    };

    /**
     * Squared distance between point c and segment ab
     * @deprecated Too much unstable
     */
    exports.squaredDistancePointToSegment = function (a, b, c) {
        let ab = exports.sub(b, a);
        let ac = exports.sub(c, a);
        let bc = exports.sub(c, b);
        let e = exports.dot(ac, ab);

        // c projects outside ab
        if (e <= 0)
            return exports.dot(ac, ac);
        let f = exports.dot(ab, ab);
        if (e >= f)
            return exports.dot(bc, bc);

        // c projects onto ab
        return exports.dot(ac, ac) - (e * e) / f;
    };

    /**
     * @deprecated Too much unstable
     * @param a
     * @param b
     * @param c
     * @returns {number}
     */
    exports.pointDistanceToSegment = function (a, b, c) {
        return Math.sqrt(exports.squaredDistancePointToSegment(a, b, c));
    };

    exports.pointDistanceToSegmentStable = function (a, b, c) {
        let ab = exports.sub(b, a);
        let ac = exports.sub(c, a);
        let bc = exports.sub(c, b);
        let e = exports.dot(ac, ab);

        // c projects outside ab
        if (e <= 0)
            return exports.length(ac);
        let f = exports.dot(ab, ab);
        if (e >= f)
            return exports.length(bc);

        let num = Math.abs((b[0] - a[0])*(a[1] - c[1]) - (a[0] - c[0])*(b[1] - a[1]));
        let denum = exports.length(exports.sub(b, a));
        return num / denum;
    };

    exports.getVerticesCloseToSegment = function (vertices, startV, endV, distanceThreshold) {
        let subSet = [];
        let a = [startV.x, startV.y];
        let b = [endV.x, endV.y];


        for (let v of vertices) {
            let c = [v.x, v.y];
            let distance = exports.pointDistanceToSegmentStable(a, b, c);
            if (distance <= distanceThreshold)
                subSet.push(v);
        }

        return subSet;
    };

    // Returns 2 times the signed triangle area. The result is positive if
    // abc is ccw, negative if abc is cw, zero if abc is degenerate.
    exports.signed2DTriArea = function (a, b, c) {
        return (a[0] - c[0]) * (b[1] - c[1]) - (a[1] - c[1]) * (b[0] - c[0]);
    };

    exports.test2DSegmentSegmentIntersect = function (a, b, c, d) {
        let t = 0;
        let p = [0, 0];

        // Sign of areas correspond to which side of ab points c and d are
        let a1 = exports.signed2DTriArea(a, b, d);
        // Compute winding of abd (+ or -)
        let a2 = exports.signed2DTriArea(a, b, c);
        // To intersect, must have sign opposite of a1
        // If c and d are on different sides of ab, areas have different signs
        if (a1 * a2 < 0.0) {
            // Compute signs for a and b with respect to segment cd
            let a3 = exports.signed2DTriArea(c, d, a);
            // Compute winding of cda (+ or -)
            // Since area is constant a1 - a2 = a3 - a4, or a4 = a3 + a2 - a1
            // float a4 = Signed2DTriArea(c, d, b);
            // Must have opposite sign of a3
            let a4 = a3 + a2 - a1;
            // Points a and b on different sides of cd if areas have different signs
            if (a3 * a4 < 0.0) {
                // Segments intersect. Find intersection point along L(t) = a + t * (b - a).
                // Given height h1 of an over cd and height h2 of b over cd,
                // t = h1 / (h1 - h2) =(b*h1/2) / (b*h1/2 - b*h2/2) = a3 / (a3 - a4),
                // where b (the base of the triangles cda and cdb, i.e., the length
                // of cd) cancels out.
                t = a3 / (a3 - a4);
                p = exports.add(a, exports.mult(exports.sub(b, a), t));
                return p;
            }
        }
        return null;
    };

    // Test if segments ab and cd overlap. If they do, compute and return
    // intersection position p
    exports.test2DSegmentSegment = function (a, b, c, d, distanceThreshold = 0) {
        let intersection = exports.test2DSegmentSegmentIntersect(a, b, c, d);
        if (intersection)
            return intersection;

        if (exports.pointDistanceToSegmentStable(a, b, c) <= distanceThreshold)
            return c;

        if (exports.pointDistanceToSegmentStable(a, b, d) <= distanceThreshold)
            return d;

        if (exports.pointDistanceToSegmentStable(c, d, a) <= distanceThreshold)
            return a;

        if (exports.pointDistanceToSegmentStable(c, d, b) <= distanceThreshold)
            return b;

        // Segments not intersecting
        return null;
    };

    exports.getSegmentsCloseToSegment = function (map, segs, startV, endV, distanceThreshold, splitImplicit = true) {
        let subSet = [];
        let a = [startV.x, startV.y];
        let b = [endV.x, endV.y];


        for (let s of segs) {
            let v1 = map.vertexes[s.startVertex];
            let c1 = [v1.x, v1.y];
            let distance = exports.pointDistanceToSegmentStable(a, b, c1);
            if (distance <= distanceThreshold) {
                subSet.push(s);
                continue;
            }
            let v2 = map.vertexes[s.endVertex];
            let c2 = [v2.x, v2.y];
            distance = exports.pointDistanceToSegmentStable(a, b, c2);
            if (distance <= distanceThreshold) {
                subSet.push(s);
                continue;
            }

            // Check if the segment intersect and it is an implicit segment
            let intersect = exports.test2DSegmentSegment(a, b, c1, c2, distanceThreshold);
            if (intersect && s.implicit) {
                if (splitImplicit) {
                    if (_.isNaN(intersect[0]) || _.isNaN(intersect[1]))
                        throw new Error('NaN value!');
                    // Split the segment
                    let newSeg = map.splitImplicitSegment(s, intersect[0], intersect[1]);
                    subSet.push(s);
                    subSet.push(newSeg);
                } else {
                    subSet.push(s);
                }
            }
        }

        return subSet;
    };

    exports.getSegmentsCloseToPoint = function (map, segs, v, distanceThreshold) {
        let subSet = [];
        let a = [v.x, v.y];


        for (let s of segs) {
            let v1 = map.vertexes[s.startVertex];
            let c1 = [v1.x, v1.y];
            let v2 = map.vertexes[s.endVertex];
            let c2 = [v2.x, v2.y];
            let distance = exports.pointDistanceToSegmentStable(c1, c2, a);
            if (distance <= distanceThreshold) {
                subSet.push(s);
            }
        }

        return subSet;
    };

    exports.getPartitionLinesCloseToSegment = function (map, pLines, startV, endV, distanceThreshold) {
        let subSet = [];
        let a = [startV.x, startV.y];
        let b = [endV.x, endV.y];


        for (let line of pLines) {
            let v1 = line.start;
            let c1 = [v1.x, v1.y];
            let distance = exports.pointDistanceToSegmentStable(a, b, c1);
            if (distance <= distanceThreshold) {
                subSet.push(line);
                continue;
            }
            let v2 = line.end;
            let c2 = [v2.x, v2.y];
            distance = exports.pointDistanceToSegmentStable(a, b, c2);
            if (distance <= distanceThreshold) {
                subSet.push(line);
                continue;
            }

            // Check if the segment intersect and it is an implicit segment
            let intersect = exports.test2DSegmentSegment(a, b, c1, c2);
            if (intersect) {
                subSet.push(line);
            }
        }

        return subSet;
    };

    exports.getPartitionLinesCloseToPoint = function (map, pLines, v, distanceThreshold) {
        let subSet = [];
        let a = [v.x, v.y];


        for (let line of pLines) {
            let v1 = line.start;
            let c1 = [v1.x, v1.y];
            let v2 = line.end;
            let c2 = [v2.x, v2.y];
            let distance = exports.pointDistanceToSegmentStable(c1, c2, a);
            if (distance <= distanceThreshold) {
                subSet.push(line);
            }
        }

        return subSet;
    };

    exports.getVertexFromSegmentsCloseToSegment = function (map, segs, startV, endV, distanceThreshold) {
        let vertices = [];
        let a = [startV.x, startV.y];
        let b = [endV.x, endV.y];

        for (let s of segs) {
            let v1 = map.vertexes[s.startVertex];
            let c1 = [v1.x, v1.y];
            let distance = exports.pointDistanceToSegmentStable(a, b, c1);
            if (distance <= distanceThreshold) {
                vertices.push(v1);
            }
            let v2 = map.vertexes[s.endVertex];
            let c2 = [v2.x, v2.y];
            distance = exports.pointDistanceToSegmentStable(a, b, c2);
            if (distance <= distanceThreshold) {
                vertices.push(v2);
            }
        }

        return vertices;
    };

    /**
     * Projects a vertex onto a segment, i.e. drops the vertex on the segment
     * @param startV
     * @param endV
     * @param v
     * @param asReferenceFrame
     * @return {*}
     */
    exports.projectVertexOnSegment = function (startV, endV, v, asReferenceFrame) {
        let a = [startV.x, startV.y];
        let b = [endV.x, endV.y];
        let c = [v.x, v.y];

        let ab = exports.sub(b, a);
        let ac = exports.sub(c, a);
        let length = exports.length(ab);
        let unitDir = exports.mult(ab, 1 / length);

        let t = exports.dot(ac, unitDir);

        if (asReferenceFrame) {
            return {x: t, y: 0};
        }

        let projectedC = exports.add(a, exports.mult(unitDir, t));
        return {x: projectedC[0], y: projectedC[1]};
    };

    exports.toReferenceFrame = function (startV, endV, v) {
        let projectedVertex = exports.projectVertexOnSegment(startV, endV, v, false);
        let projectedReference = exports.projectVertexOnSegment(startV, endV, v, true);

        let c = [v.x, v.y];
        let projectedC = [projectedVertex.x, projectedVertex.y];
        projectedReference.y = exports.sub(c, projectedC);
        return projectedReference;
    };

    /**
     * The a Node::boundingBox englobing the vertices.
     * @param vertices
     */
    exports.getNodeBB = function (vertices) {
        let bb = {
            top: mathUtils.min32Bits,
            bottom: mathUtils.max32Bits,
            left: mathUtils.max32Bits,
            right: mathUtils.min32Bits
        };

        for (let v of vertices) {
            if (v.x < bb.left)
                bb.left = v.x;
            if (v.x > bb.right)
                bb.right = v.x;
            if (v.y < bb.bottom)
                bb.bottom = v.y;
            if (v.y > bb.top)
                bb.top = v.y;
        }

        return bb;
    };

    /**
     * Return the angle between the vertex v1v2 and v1v3
     * @param [Vertex] v1
     * @param [Vertex] v2
     * @param [Vertex] v3
     * @returns {number} Angle between 0 and pi
     */
    exports.angleBetweenSegments = function (v1, v2, v3) {
        let p1 = exports.vertexToPoint(v1);
        let p2 = exports.vertexToPoint(v2);
        let p3 = exports.vertexToPoint(v3);

        let p1p2 = exports.normalize(exports.sub(p2, p1));
        let p1p3 = exports.normalize(exports.sub(p3, p1));
        return Math.acos(exports.dot(p1p2, p1p3));
    };

    exports.segmentIsSegment = function (map, segment, startV, endV, threshold) {
        let sStart = map.vertexes[segment.startVertex];
        let sEnd = map.vertexes[segment.endVertex];
        return (exports.distanceBetweenVertex(startV, sStart) <= threshold && exports.distanceBetweenVertex(endV, sEnd) <= threshold) ||
            (exports.distanceBetweenVertex(startV, sEnd) <= threshold && exports.distanceBetweenVertex(endV, sStart) <= threshold);
    };

    exports.partitionLineIsSegment = function (pLine, startV, endV, threshold) {
        return (exports.distanceBetweenVertex(startV, pLine.start) <= threshold && exports.distanceBetweenVertex(endV, pLine.end) <= threshold) ||
            (exports.distanceBetweenVertex(startV, pLine.end) <= threshold && exports.distanceBetweenVertex(endV, pLine.start) <= threshold);
    };

    return exports;
});
