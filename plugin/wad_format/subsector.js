define(function (require) {
    "use strict";

    const _ = require('lodash');
    const LumpEntry = require('wad-importer/wad_format/lump-entry');
    const Segment = require('wad-importer/wad_format/segment');
    const utils = require('wad-importer/utils');

    const DISTANCE_THRESHOLD = 5;
    const EPSILON = 0.0000001;

    class SubSector extends LumpEntry {
        constructor () {
            super();

            this.numSegs = 0;
            this.firstSeg = 0;

            this.nodeRef = null;

            this.completeSegments = [];
        }

        getOriginalSegments (map) {
            let segs = [];
            for (let offset = 0; offset < this.numSegs; ++offset) {
                let index = this.firstSeg + offset;
                let seg = map.segs[index];
                segs.push(seg);
            }
            return segs;
        }

        reorderSegments (segs) {
            let toProcess = _.clone(segs);
            let ordered = [];


            while (toProcess.length > 0) {

            }
        }

        getAncestorsPartitionLines (partitionLines) {
            if (!this.nodeRef)
                return;
            this.nodeRef.getAncestorsPartitionLines(partitionLines);
            partitionLines.push(this.nodeRef.completePartitionLine);
        }

        addMissingImplicitSegments (map) {
            if (!this.nodeRef)
                return;

            let partitionLines = [];
            this.getAncestorsPartitionLines(partitionLines);

            this.completeSegments = this.getOriginalSegments(map);

            let hasHole = true;
            let testCounter = 0;
            while (hasHole) {
                for (let i = 0; i < this.completeSegments.length; ++i) {
                    let index = i;
                    let nextIndex = (i + 1) % this.completeSegments.length;

                    let seg = this.completeSegments[index];
                    let nextSeg = this.completeSegments[nextIndex];

                    // Check if the two segments are not joined together
                    if (seg.endVertex !== nextSeg.startVertex) {
                        hasHole = true;

                        let startV = map.vertexes[seg.startVertex];
                        let endV = map.vertexes[seg.endVertex];
                        let a = [startV.x, startV.y];
                        let b = [endV.x, endV.y];
                        let partitionLinesOnEnd = utils.getPartitionLinesCloseToPoint(map, partitionLines, endV, DISTANCE_THRESHOLD);
                        let partitionLinesToRemove = _.clone(partitionLinesOnEnd);

                        // Remove partitions on current segment
                        partitionLinesOnEnd = _.filter(partitionLinesOnEnd, p => {
                            return Math.abs(utils.signed2DTriArea([p.start.x, p.start.y], [p.end.x, p.end.y], a)) >= EPSILON ||
                                Math.abs(utils.signed2DTriArea([p.start.x, p.start.y], [p.end.x, p.end.y], b)) > EPSILON;
                        });

                        // Remove partitions that don't split the segment in the same direction as the segment
                        let sign = seg.direction === 0 ? -1 : 1;
                        partitionLinesOnEnd = _.filter(partitionLinesOnEnd, p => {
                            return sign * utils.signed2DTriArea(a, b, [p.start.x, p.start.y]) > EPSILON ||
                                sign * utils.signed2DTriArea(a, b, [p.end.x, p.end.y]) > EPSILON;
                        });

                        if (partitionLinesOnEnd.length === 0) {
                            break;
                        }

                        // Get the point that forms the smallest angle
                        let validPoints = _.map(partitionLinesOnEnd, p => {
                            if (sign * utils.signed2DTriArea(a, b, [p.start.x, p.start.y]) > EPSILON)
                                return p.start;
                            return p.end;
                        });
                        let angles = _.map(validPoints, v => {
                            return utils.angleBetweenSegments(endV, v, startV);
                        });
                        let [sortedAngles, sortedPoints] = _.unzip(_.sortBy(_.zip(angles, validPoints), av => av[0]));
                        let bestPoint = _.first(sortedPoints);

                        // Generate a new segment
                        let segs = _.clone(this.completeSegments);
                        _.pull(segs, seg);
                        let otherPLines = _.pullAll(_.clone(partitionLines), partitionLinesToRemove);
                        let newSegment = this.getNewImplicitSegment(map, seg.endVertex, endV, bestPoint, segs, otherPLines);
                        newSegment.direction = seg.direction;

                        this.completeSegments.splice(index + 1, 0, newSegment);

                        break;
                    }
                    hasHole = false;
                }
                ++testCounter;
                if (testCounter > 100)
                    throw new Error('Probable infinite loop :(');
            }
        }

        getNewImplicitSegment (map, startVertexIndex, startV, endV, segs, pLines) {
            let a = [startV.x, startV.y];
            let b = [endV.x, endV.y];

            for (let seg of segs) {
                let v1 = map.vertexes[seg.startVertex];
                let v2 = map.vertexes[seg.endVertex];
                let c = [v1.x, v1.y];
                let d = [v2.x, v2.y];
                let intersection = utils.test2DSegmentSegment(a, b, c, d, DISTANCE_THRESHOLD);
                if (intersection) {
                    if (intersection === c) {
                        let newSeg = new Segment();
                        newSeg.implicit = true;
                        newSeg.startVertex = startVertexIndex;
                        newSeg.endVertex = seg.startVertex;
                        return newSeg;
                    }
                    if (intersection === d) {
                        let newSeg = new Segment();
                        newSeg.implicit = true;
                        newSeg.startVertex = startVertexIndex;
                        newSeg.endVertex = seg.endVertex;
                        return newSeg;
                    }

                    throw new Error('Intersection not on segments ends');
                }
            }

            let intersections = _.map(pLines, pLine => {
                let c = [pLine.start.x, pLine.start.y];
                let d = [pLine.end.x, pLine.end.y];
                return utils.test2DSegmentSegment(a, b, c, d, DISTANCE_THRESHOLD);
            });
            intersections = _.compact(intersections);

            if (intersections.length === 0)
                throw new Error('New implicit segment does not intersect with anything');

            let projectedPoints = _.map(intersections, p => {
                return utils.projectVertexOnSegment(startV, endV, {x: p[0], y: p[1]}, true);
            });
            let [sortedProjected, sortedPoints] = _.unzip(_.sortBy(_.zip(projectedPoints, intersections), pi => pi[0].x));
            let firstIntersection = _.first(sortedPoints);
            let newVertex = map.addVertex(firstIntersection[0], firstIntersection[1]);
            let newSeg = new Segment();
            newSeg.implicit = true;
            newSeg.startVertex = startVertexIndex;
            newSeg.endVertex = map.vertexes.indexOf(newVertex);
            return newSeg;
        }

        static fromBinary (binaryData) {
            let ssector = new SubSector();
            ssector.numSegs = _.toInt16(binaryData[0], binaryData[1]);
            ssector.firstSeg = _.toInt16(binaryData[2], binaryData[3]);
            return ssector;
        }

        static get ENTRY_SIZE () {
            return 4;
        }
    }

    return SubSector;
});
