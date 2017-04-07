define(function (require) {
    "use strict";

    const _ = require('lodash');
    const LumpEntry = require('wad-importer/wad_format/lump-entry');
    const utils = require('wad-importer/utils');

    const DISTANCE_THRESHOLD = 5;
    const EPSILON = 0.0000001;

    class Node {
        constructor (vertex) {
            this.vertex = vertex;
            this.connectedEdges = [];
        }

        addEdge (edge) {
            if (this.connectedEdges.indexOf(edge) === -1)
                this.connectedEdges.push(edge);
        }

        merge (node) {
            this.connectedEdges = _.unionWith(this.connectedEdges, node.connectedEdges, Edge.isEqual);
        }

        getNextEdge (edge) {
            for (let e of this.connectedEdges) {
                if (!Edge.isEqual(e, edge))
                    return e;
            }
            return null;
        }

        static isEqual (node1, node2) {
            return node1.vertex === node2.vertex;
        }
    }

    class Edge {
        constructor (seg) {
            this.seg = seg;
            this.startVertex = this.seg.startVertex;
            this.endVertex = this.seg.endVertex;
            this.nodes = {};
            this.nodes[this.startVertex] = null;
            this.nodes[this.endVertex] = null;
        }

        getOtherNode (node) {
            if (node.vertex === this.startVertex)
                return this.nodes[this.endVertex];
            return this.nodes[this.startVertex];
        }

        static isEqual(edge1, edge2) {
            if (!edge1 || !edge2)
                return false;
            return (Node.isEqual(edge1.nodes[edge1.startVertex], edge2.nodes[edge2.startVertex]) && Node.isEqual(edge1.nodes[edge1.endVertex], edge2.nodes[edge2.endVertex])) ||
                (Node.isEqual(edge1.nodes[edge1.startVertex], edge2.nodes[edge2.endVertex]) && Node.isEqual(edge1.nodes[edge1.endVertex], edge2.nodes[edge2.startVertex]));
        }
    }

    class Graph {
        constructor () {
            this.nodes = [];
            this.edges = [];
        }

        addNode (node) {
            this.nodes.push(node);
        }

        addEdge (edge) {
            if (_.find(this.edges, e => Edge.isEqual(e, edge)))
                return;

            let vertices = [edge.startVertex, edge.endVertex];
            for (let vertex of vertices) {
                let node = this._findVertexNode(vertex);
                if (!node) {
                    node = new Node(vertex);
                    this.addNode(node);
                }
                node.addEdge(edge);
                edge.nodes[vertex] = node;
            }
            this.edges.push(edge);
        }

        canJoinGraph (graph) {
            return _.intersectionWith(this.nodes, graph.nodes, Node.isEqual).length > 0;
        }

        joinGraph (graph) {
            this.nodes = _.unionWith(this.nodes, graph.nodes, Node.isEqual);
            for (let edge of graph.edges) {
                this.addEdge(edge);
            }
        }

        first () {
            let first = _.first(this.nodes);
            for (let node of this.nodes) {
                if (node.connectedEdges.length <= 1)
                    first = node;
            }

            return first;
        }

        toSegList () {
            return _.map(this.toEdgeList(), 'seg');
        }

        toEdgeList () {
            let first = this.first();
            let node = first;
            let edges = [];
            let nextEdge = node.getNextEdge(null);
            while (nextEdge) {
                edges.push(nextEdge);
                node = nextEdge.getOtherNode(node);
                if (node === first)
                    break;
                nextEdge = node.getNextEdge(nextEdge);
            }

            return edges;
        }

        getEndPoints () {
            let endPoints = [];
            for (let node of this.nodes) {
                if (node.connectedEdges.length <= 1)
                    endPoints.push(node);
            }
            return endPoints;
        }

        isClosed () {
            return this.getEndPoints().length === 0;
        }

        _findVertexNode (vertex) {
            return _.find(this.nodes, n => n.vertex === vertex);
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

        getOrderedGraphs (segs) {
            let edges = _.map(segs, s => new Edge(s));
            let graphs = _.map(edges, e => {
                let g = new Graph();
                g.addEdge(e);
                return g;
            });

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

            return graphs;
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

            let originalSegments = this.getOriginalSegments(map);
            let centerPoint = [0, 0];
            let nbPoint = 0;
            for (let seg of originalSegments) {
                let perp = seg.getPerpendicular(map);
                let a = utils.vertexToPoint(map.vertexes[seg.startVertex]);
                let b = utils.vertexToPoint(map.vertexes[seg.endVertex]);
                let ab = utils.sub(b, a);
                let halfPoint = utils.add(a, utils.div(ab, 2));
                let halfPointOffseted = utils.add(halfPoint, perp);
                centerPoint = utils.add(centerPoint, halfPointOffseted);
                nbPoint++;
            }
            centerPoint = utils.div(centerPoint, nbPoint);
            let centerVertex = utils.pointToVertex(centerPoint);

            let graphs = this.getOrderedGraphs(this.getOriginalSegments(map));

            let testCounter = 0;
            let changes = false;
            while (graphs.length > 1 || !graphs[0].isClosed()) {
                changes = false;
                for (let g of graphs) {
                    let endPoints = g.getEndPoints();
                    for (let endPoint of endPoints) {
                        let seg = endPoint.connectedEdges[0].seg;
                        let unconnectedVertex = endPoint.vertex;
                        let startV = map.vertexes[seg.startVertex];
                        let endV = map.vertexes[seg.endVertex];

                        if (seg.endVertex !== unconnectedVertex) {
                            let temp = startV;
                            startV = endV;
                            endV = temp;
                        }

                        let a = [startV.x, startV.y];
                        let b = [endV.x, endV.y];

                        // Get implicit segments that start or end on vertex
                        let implicitSegsOnEnd = _.filter(map.implicitSegs, s => {
                            return s.startVertex === unconnectedVertex || s.endVertex === unconnectedVertex;
                        });

                        if (implicitSegsOnEnd.length === 0)
                            continue;

                        // Remove current segment
                        implicitSegsOnEnd = _.filter(implicitSegsOnEnd, s => s !== seg);

                        // Remove partitions that don't have direct line of site with center point
                        implicitSegsOnEnd = _.filter(implicitSegsOnEnd, s => {
                            let sStart = s.startVertex === unconnectedVertex ? map.vertexes[s.endVertex] : map.vertexes[s.startVertex];
                            let a = utils.vertexToPoint(sStart);
                            return !_.some(map.segs.concat(map.implicitSegs), os => {
                                let c = utils.vertexToPoint(map.vertexes[os.startVertex]);
                                let d = utils.vertexToPoint(map.vertexes[os.endVertex]);
                                let intersection = utils.test2DSegmentSegmentIntersect(a, centerPoint, c, d);
                                return intersection !== null;
                            });

                        });

                        if (implicitSegsOnEnd.length === 0) {
                            throw new Error('No implicit segment connected found');
                        }

                        // Get the point that forms the smallest angle
                        let validPoints = _.map(implicitSegsOnEnd, s => {
                            return s.startVertex === unconnectedVertex ? map.vertexes[s.endVertex] : map.vertexes[s.startVertex];
                        });
                        let angles = _.map(validPoints, v => {
                            return utils.angleBetweenSegments(endV, v, startV);
                        });
                        let [sortedAngles, sortedSegs] = _.unzip(_.sortBy(_.zip(angles, implicitSegsOnEnd), av => av[0]));
                        let bestSeg = _.first(sortedSegs);
                        let newEdge = new Edge(bestSeg);
                        let newGraph = new Graph();
                        newGraph.addEdge(newEdge);
                        g.joinGraph(newGraph);
                        changes = true;
                        break;
                    }
                    if (changes)
                        break;
                }

                let graphMerged = true;
                while (graphs.length > 1 && graphMerged) {
                    graphMerged = false;
                    let toRemove = [];
                    for (let i = 0; i < graphs.length - 1; ++i) {
                        let g = graphs[i];
                        for (let j = i + 1; j < graphs.length; ++j) {
                            let otherG = graphs[j];
                            if (otherG.canJoinGraph(g)) {
                                otherG.joinGraph(g);
                                toRemove.push(g);
                                graphMerged = true;
                                break;
                            }
                        }
                    }

                    _.pullAll(graphs, toRemove);
                }

                ++testCounter;
                if (testCounter > 100)
                    throw new Error('Probable infinite loop :(');
            }

            this.completeSegments = graphs[0].toSegList();
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
