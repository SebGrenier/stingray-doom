define(function (require) {
    "use strict";

    const _ = require('lodash');
    const mathUtils = require('common/math-utils');
    const LumpEntry = require('wad-importer/wad_format/lump-entry');
    const Segment = require('wad-importer/wad_format/segment');
    const utils = require('wad-importer/utils');

    const DISTANCE_THRESHOLD = 5;
    const EPSILON = 0.0000001;

    class Node {
        constructor (seg) {
            this.seg = seg;
            this.previous = null;
            this.next = null;
        }
    }

    class Graph {
        constructor () {
            this.nodes = [];
        }

        addNode (node) {
            this.nodes.push(node);
        }

        canJoinGraph (graph) {
            let withoutNext = _.filter(this.nodes, n => !n.next);
            let withoutPrevious = _.filter(this.nodes, n => !n.previous);

            let otherWithoutNext = _.filter(graph.nodes, n => !n.next);
            let otherWithoutPrevious = _.filter(graph.nodes, n => !n.previous);

            let canConnectNext = _.some(withoutNext, node => {
                return !!_.find(otherWithoutPrevious, otherNode => node.seg.endVertex === otherNode.seg.startVertex);
            });
            if (canConnectNext)
                return true;

            let canConnectPrevious = _.some(withoutPrevious, node => {
                return !!_.find(otherWithoutNext, otherNode => node.seg.startVertex === otherNode.seg.endVertex);
            });
            if (canConnectPrevious)
                return true;

            return false;
        }

        joinGraph (graph) {
            let withoutNext = _.filter(this.nodes, n => !n.next);
            let withoutPrevious = _.filter(this.nodes, n => !n.previous);

            let otherWithoutNext = _.filter(graph.nodes, n => !n.next);
            let otherWithoutPrevious = _.filter(graph.nodes, n => !n.previous);

            for (let node of withoutNext) {
                let otherNode = _.find(otherWithoutPrevious, n => node.seg.endVertex === n.seg.startVertex);
                if (!otherNode)
                    continue;
                node.next = otherNode;
                otherNode.previous = node;
                _.pull(otherWithoutPrevious, otherNode);
            }

            for (let node of withoutPrevious) {
                let otherNode = _.find(otherWithoutNext, n => node.seg.startVertex === n.seg.endVertex);
                if (!otherNode)
                    continue;
                node.previous = otherNode;
                otherNode.next = node;
                _.pull(otherWithoutNext, otherNode);
            }

            this.nodes = this.nodes.concat(graph.nodes);
        }

        first () {
            let first = _.first(this.nodes);
            for (let node of this.nodes) {
                if (!node.previous)
                    first = node;
            }

            return first;
        }

        toSegList () {
            let first = this.first();
            let node = first;
            let segs = [first.seg];

            while (node.next && node.next !== first) {
                node = node.next;
                segs.push(node.seg);
            }

            return segs;
        }
    }

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
            let toOrder = _.clone(segs);
            for (let i = 0; i < toOrder.length; ++i) {
                let index = i;
                for (let j = i + 1; j < toOrder.length; ++j) {
                    if (toOrder[j].endVertex === toOrder[i].startVertex) {
                        index = j + 1;
                        break;
                    } else if (toOrder[j].startVertex === toOrder[i].endVertex) {
                        index = j;
                        break;
                    }
                }
                if (index !== i && index !== i + 1) {
                    toOrder.splice(index, 0, toOrder[i]);
                    toOrder.splice(i, 1);
                    --i;
                }
            }

            return toOrder;
        }

        reorderSegments2 (segs) {
            let nodes = _.map(segs, s => new Node(s));
            let graphs = _.map(nodes, n => {
                let g = new Graph();
                g.addNode(n);
                return g;
            });
            let ordered = [];

            let changes = true;
            while (graphs.length > 1 && changes) {
                changes = false;
                let toRemove = [];
                for (let i = 0; i < graphs.length - 1; ++i) {
                    let g = graphs[i];
                    for (let j = i + 1; j < graphs.length; ++j) {
                        let otherG = graphs[j];
                        if (otherG.canJoinGraph(g)) {
                            otherG.joinGraph(g);
                            toRemove.push(g);
                            changes = true;
                            break;
                        }
                    }
                }

                _.pullAll(graphs, toRemove);
            }

            for (let g of graphs) {
                ordered = ordered.concat(g.toSegList());
            }
            return ordered;
        }

        getAncestorsPartitionLines (partitionLines) {
            if (!this.nodeRef)
                return;
            this.nodeRef.getAncestorsPartitionLines(partitionLines);
            partitionLines.push(this.nodeRef.completePartitionLine);
        }

        getAncestorsImplicitSegments (implicitSegments) {
            if (!this.nodeRef)
                return;
            this.nodeRef.getAncestorsImplicitSegments(implicitSegments);
            for (let seg of this.nodeRef.implicitSegments)
                implicitSegments.push(seg);
        }

        addMissingImplicitSegments (map) {
            if (!this.nodeRef)
                return;

            let partitionLines = [];
            this.getAncestorsPartitionLines(partitionLines);

            this.completeSegments = this.reorderSegments2(this.getOriginalSegments(map));

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
                        let length = utils.distanceBetweenVertex(endV, startV);
                        let partitionLinesOnEnd = utils.getPartitionLinesCloseToPoint(map, partitionLines, endV, DISTANCE_THRESHOLD);
                        let partitionLinesToRemove = _.clone(partitionLinesOnEnd);

                        // Remove partitions on current segment
                        // partitionLinesOnEnd = _.filter(partitionLinesOnEnd, p => {
                        //     return Math.abs(utils.signed2DTriArea([p.start.x, p.start.y], [p.end.x, p.end.y], a)) >= EPSILON ||
                        //         Math.abs(utils.signed2DTriArea([p.start.x, p.start.y], [p.end.x, p.end.y], b)) >= EPSILON;
                        // });

                        // Remove partitions that are the current segment
                        partitionLinesOnEnd = _.filter(partitionLinesOnEnd, p => !utils.partitionLineIsSegment(p, startV, endV, EPSILON));

                        // Remove partition lines that do not continue ahead of segment
                        partitionLinesOnEnd = _.filter(partitionLinesOnEnd, p => {
                            if (Math.abs(utils.signed2DTriArea([p.start.x, p.start.y], [p.end.x, p.end.y], a)) >= EPSILON ||
                                Math.abs(utils.signed2DTriArea([p.start.x, p.start.y], [p.end.x, p.end.y], b)) >= EPSILON)
                                return true;
                            return utils.projectVertexOnSegment(startV, endV, p.start, true).x > length ||
                                utils.projectVertexOnSegment(startV, endV, p.end, true).x > length;
                        });

                        // Remove partitions that don't split the segment in the same direction as the segment
                        let sign = -1;//seg.direction === 0 ? -1 : 1;
                        partitionLinesOnEnd = _.filter(partitionLinesOnEnd, p => {
                            return sign * utils.signed2DTriArea(a, b, [p.start.x, p.start.y]) >= 0 ||
                                sign * utils.signed2DTriArea(a, b, [p.end.x, p.end.y]) >= 0;
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

        addMissingImplicitSegments2 (map) {
            if (!this.nodeRef)
                return;

            let implicitSegments = [];
            this.getAncestorsImplicitSegments(implicitSegments);

            this.completeSegments = this.reorderSegments2(this.getOriginalSegments(map));

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
                        let length = utils.distanceBetweenVertex(endV, startV);

                        // Get implicit segments that start on endVertex
                        let implicitSegsOnEnd = _.filter(map.implicitSegs, s => {
                            return s.startVertex === seg.endVertex;
                        });
                        let implicitSegsToRemove = _.clone(implicitSegsOnEnd);

                        // Remove partitions that don't split the segment in the same direction as the segment
                        let sign = -1;//seg.direction === 0 ? -1 : 1;
                        implicitSegsOnEnd = _.filter(implicitSegsOnEnd, s => {
                            let sStart = map.vertexes[s.startVertex];
                            let sEnd = map.vertexes[s.endVertex];
                            return sign * utils.signed2DTriArea(a, b, [sStart.x, sStart.y]) >= 0 ||
                                sign * utils.signed2DTriArea(a, b, [sEnd.x, sEnd.y]) >= 0;
                        });

                        if (implicitSegsOnEnd.length === 0) {
                            throw new Error('No implicit segment connected found');
                        }

                        // Get the point that forms the smallest angle
                        let validPoints = _.map(implicitSegsOnEnd, s => {
                            let sStart = map.vertexes[s.startVertex];
                            let sEnd = map.vertexes[s.endVertex];
                            if (sign * utils.signed2DTriArea(a, b, [sStart.x, sStart.y]) > EPSILON)
                                return sStart;
                            return sEnd;
                        });
                        let angles = _.map(validPoints, v => {
                            return utils.angleBetweenSegments(endV, v, startV);
                        });
                        let [sortedAngles, sortedSegs] = _.unzip(_.sortBy(_.zip(angles, implicitSegsOnEnd), av => av[0]));
                        let bestSeg = _.first(sortedSegs);

                        // Generate a new segment
                        this.completeSegments.splice(index + 1, 0, bestSeg);

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
                    if (utils.distanceBetweenVertex({x: intersection[0], y: intersection[1]}, v1) <= EPSILON) {
                        let newSeg = new Segment();
                        newSeg.implicit = true;
                        newSeg.startVertex = startVertexIndex;
                        newSeg.endVertex = seg.startVertex;
                        return newSeg;
                    }
                    if (utils.distanceBetweenVertex({x: intersection[0], y: intersection[1]}, v2) <= EPSILON) {
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
