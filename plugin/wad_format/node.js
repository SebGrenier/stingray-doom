define(function (require) {
    "use strict";

    const _ = require('lodash');
    const stingray = require('stingray');
    const utils = require('wad-importer/utils');
    const LumpEntry = require('wad-importer/wad_format/lump-entry');

    const DISTANCE_THRESHOLD = 5;
    const RIGHT_SIDE_SIGN = 1;
    const LEFT_SIDE_SIGN = -1;

    function getBoundingBox (data) {
        return {
            top: utils.fromTwosComplement(_.toInt16(data[0], data[1]), 16),
            bottom: utils.fromTwosComplement(_.toInt16(data[2], data[3]), 16),
            left: utils.fromTwosComplement(_.toInt16(data[4], data[5]), 16),
            right: utils.fromTwosComplement(_.toInt16(data[6], data[7]), 16)
        };
    }

    class Node extends LumpEntry{
        constructor () {
            super();

            this.partitionX = 0;
            this.partitionY = 0;
            this.changeX = 0;
            this.changeY = 0;
            this.rightBB = {};
            this.leftBB = {};
            this.rightChild = 0;
            this.leftChild = 0;

            this.rightChildRef = null;
            this.leftChildRef = null;
            this.parent = null;

            this.completePartitionLine = null;
            this.id = stingray.guid();
            this.implicitSegments = [];
        }

        buildCrossReferences (map) {
            let index = Node.childToIndex(this.rightChild);
            if (Node.isChildSubSector(this.rightChild)) {
                let subSector = map.ssectors[index];
                subSector.nodeRef = this;
                this.rightChildRef = subSector;
            } else {
                let node = map.nodes[index];
                node.parent = this;
                this.rightChildRef = node;
            }
            index = Node.childToIndex(this.leftChild);
            if (Node.isChildSubSector(this.leftChild)) {
                let subSector = map.ssectors[index];
                subSector.nodeRef = this;
                this.leftChildRef = subSector;
            } else {
                let node = map.nodes[index];
                node.parent = this;
                this.leftChildRef = node;
            }
        }

        getBBForChild (child, map, extended = false) {
            if (!extended) {
                if (child === this.rightChildRef) {
                    return this.rightBB;
                } else if (child === this.leftChildRef) {
                    return this.leftBB;
                }
            } else if (this.parent) {
                return this.parent.getBBForChild(this);
                // let splitBB = null;
                // if (child === this.rightChildRef) {
                //     splitBB = this.splitBB(bb, this.completePartitionLine, RIGHT_SIDE_SIGN);
                //     splitBB.bottom = Math.min(splitBB.bottom, this.rightBB.bottom);
                //     splitBB.top = Math.max(splitBB.top, this.rightBB.top);
                //     splitBB.left = Math.min(splitBB.left, this.rightBB.left);
                //     splitBB.right = Math.max(splitBB.right, this.rightBB.right);
                // } else if (child === this.leftChildRef) {
                //     splitBB = this.splitBB(bb, this.completePartitionLine, LEFT_SIDE_SIGN);
                //     splitBB.bottom = Math.min(splitBB.bottom, this.leftBB.bottom);
                //     splitBB.top = Math.max(splitBB.top, this.leftBB.top);
                //     splitBB.left = Math.min(splitBB.left, this.leftBB.left);
                //     splitBB.right = Math.max(splitBB.right, this.leftBB.right);
                // }
                // return splitBB;
            } else if (map) {
                let bb = {
                    top: 0,
                    bottom: 0,
                    left: 0,
                    right: 0
                };
                let mapBB = map.getBB();
                bb.top = mapBB.maxY;
                bb.bottom = mapBB.minY;
                bb.left = mapBB.minX;
                bb.right = mapBB.maxX;
                return bb;
            }

            return null;
        }

        splitBB(bb, partitionLine, side) {
            let vs = [{
                x: bb.left,
                y: bb.top
            },{
                x: bb.right,
                y: bb.top
            },{
                x: bb.left,
                y: bb.bottom
            }, {
                x: bb.right,
                y: bb.bottom
            }];

            let rightVs = [];
            let leftVs = [];
            for (let v of vs) {
                let referenceV = utils.toReferenceFrame(partitionLine.start, partitionLine.end, v);
                if (Math.sign(referenceV.y) === RIGHT_SIDE_SIGN)
                    rightVs.push(v);
                else
                    leftVs.push(v);
            }

            if (side === RIGHT_SIDE_SIGN) {
                let vertices = rightVs.concat([partitionLine.start, partitionLine.end]);
                return utils.getNodeBB(vertices);
            } else {
                let vertices = leftVs.concat([partitionLine.start, partitionLine.end]);
                return utils.getNodeBB(vertices);
            }
        }

        getAncestorsPartitionLines (partitionLines) {
            if (this.parent) {
                this.parent.getAncestorsPartitionLines(partitionLines);
                partitionLines.push(this.parent.completePartitionLine);
            }
        }

        getAncestorsImplicitSegments (implicitSegments) {
            if (this.parent) {
                this.parent.getAncestorsImplicitSegments(implicitSegments);
            }
            for (let seg of this.implicitSegments)
                implicitSegments.push(seg);
        }

        computeCompletePartitionLine (map) {
            let bb = {
                top: 0,
                bottom: 0,
                left: 0,
                right: 0
            };
            if (this.parent) {
                bb = this.parent.getBBForChild(this);
            } else {
                let mapBB = map.getBB();
                bb.top = mapBB.maxY;
                bb.bottom = mapBB.minY;
                bb.left = mapBB.minX;
                bb.right = mapBB.maxX;
            }

            // Get the splitting line of the bounding box
            let aabb = utils.convertNodeBBToAABB(bb);
            let partitionRay = utils.convertPartitionLineToRay({x: this.partitionX, y: this.partitionY}, {x: this.changeX, y: this.changeY});

            let intersections = utils.getIntersectionPointsOnAABB(partitionRay, aabb, true);
            if (intersections.length !== 2) {
                throw new Error ('Partition line could not split its bounding box');
            }

            let start = {
                x: intersections[0].x,
                y: intersections[0].y
            };
            let end = {
                x: intersections[1].x,
                y: intersections[1].y
            };

            // Get the real starting and ending point that are on parents' partition lines (or the outer bounding box for the root)
            if (this.parent) {
                // Find the intersection points on the outer bounding box
                let mapBB = map.getBB();
                mapBB.top = mapBB.maxY;
                mapBB.bottom = mapBB.minY;
                mapBB.left = mapBB.minX;
                mapBB.right = mapBB.maxX;
                let mapAABB = utils.convertNodeBBToAABB(mapBB);
                let mapIntersections = utils.getIntersectionPointsOnAABB(partitionRay, mapAABB, true);
                if (mapIntersections.length !== 2) {
                    throw new Error ('Partition line could not split its bounding box');
                }

                let mapStart = {
                    x: mapIntersections[0].x,
                    y: mapIntersections[0].y
                };
                let mapEnd = {
                    x: mapIntersections[1].x,
                    y: mapIntersections[1].y
                };

                // Find the partition lines that are closest outside of the bounding box
                // by finding the ones on the extended lines and sorting them according to start point
                let parentsPartitionLines = [];
                this.getAncestorsPartitionLines(parentsPartitionLines);
                //let allPartitionsCloseToLine = utils.getPartitionLinesCloseToSegment(map, parentsPartitionLines, mapStart, mapEnd, 0);
                let vertices = _.map(parentsPartitionLines, s => {
                    let a = [mapStart.x, mapStart.y];
                    let b = [mapEnd.x, mapEnd.y];
                    let startV = s.start;
                    let endV = s.end;
                    let c = [startV.x, startV.y];
                    let d = [endV.x, endV.y];
                    let intersection = utils.test2DSegmentSegment(a, b, c, d);
                    if (!intersection)
                        return null;
                    return {x: intersection[0], y: intersection[1]};
                });
                vertices = _.uniq(_.compact(vertices));

                if (vertices.length > 0) {
                    start = {x: this.partitionX, y: this.partitionY};
                    end = {x: start.x + this.changeX, y: start.y + this.changeY};
                    let length = utils.distanceBetweenVertex(start, end);

                    // Project the vertices on the partition line to be able to sort them easily.
                    let projectedVertices = _.map(vertices, v => {
                        return utils.projectVertexOnSegment(start, end, v, true);
                    });

                    // Sort the vertices with their x values (projected)
                    let [sortedProjected, sortedVertices] = _.unzip(_.sortBy(_.zip(projectedVertices, vertices), [pv => pv[0].x]));

                    // Get the greatest negative number
                    let negativesVertices = _.filter(sortedProjected, pv => pv.x < DISTANCE_THRESHOLD);
                    if (negativesVertices.length > 0) {
                        let projectedVertexBefore = _.last(negativesVertices);
                        let index = _.indexOf(sortedProjected, projectedVertexBefore);
                        start = sortedVertices[index];
                    } else {
                        start = {
                            x: intersections[0].x,
                            y: intersections[0].y
                        };
                    }

                    // Get the smallest positive number
                    let positiveVertices = _.filter(sortedProjected, pv => pv.x >= DISTANCE_THRESHOLD);
                    if (positiveVertices.length > 0) {
                        let projectedVertexAfter = _.first(positiveVertices);
                        let index = _.indexOf(sortedProjected, projectedVertexAfter);
                        end = sortedVertices[index];
                    } else {
                        end = {
                            x: intersections[1].x,
                            y: intersections[1].y
                        };
                    }
                }
            }

            this.completePartitionLine = {start, end};
        }

        addMissingImplicitSegments (map) {
            this.computeCompletePartitionLine(map);
            let start = this.completePartitionLine.start;
            let end = this.completePartitionLine.end;
            map.partitionLines.push(this.completePartitionLine);

            let aabb = utils.convertNodeBBToAABB(utils.getNodeBB([start, end]));
            aabb.grow(DISTANCE_THRESHOLD);

            // Get the segments that are connected to this partition line
            let segsInBB = utils.getSegmentInsideAABB(map, map.segs.concat(map.implicitSegs), aabb);
            let segsOnSegment = utils.getSegmentsCloseToSegment(map, segsInBB, start, end, DISTANCE_THRESHOLD);

            // Get the vertices for these segments
            let vertices = utils.getVertexFromSegmentsCloseToSegment(map, segsOnSegment, start, end, DISTANCE_THRESHOLD);
            vertices = _.uniq(vertices);

            if (vertices.length < 2)
                return;

            // Project the vertices on the partition line to be able to sort them easily.
            let projectedVertices = _.map(vertices, v => {
                return utils.projectVertexOnSegment(start, end, v, true);
            });

            // Sort the vertices with their x values (projected)
            let [sortedProjected, sortedVertices] = _.unzip(_.sortBy(_.zip(projectedVertices, vertices), [pv => pv[0].x]));

            // Between each pair of vertices, create a new segment.
            // TODO: Find a way to not create segment outside the map or inside walls
            for (let i = 1; i < sortedVertices.length; ++i) {
                let startIndex = map.vertexes.indexOf(sortedVertices[i - 1]);
                let endIndex = map.vertexes.indexOf(sortedVertices[i]);

                // Don't add an implicit segment if a real one already exists
                if (map.segmentExists(startIndex, endIndex))
                    continue;

                // Don't add an implicit segment if the two vertices lie on the same linedef
                if (map.isOnSameLineDef(startIndex, endIndex))
                    continue;

                let implicitSeg = map.addImplicitSegment(startIndex, endIndex);
                this.implicitSegments.push(implicitSeg);
            }
        }

        getSubSectorFromPoint (x, y) {
            let leftAABB = utils.convertNodeBBToAABB(this.leftBB);
            let rightAABB = utils.convertNodeBBToAABB(this.rightBB);
            let p = [x, y];

            let isInLeftBB = utils.pointIsInsideAABB(p, leftAABB);
            let isInRightBB = utils.pointIsInsideAABB(p, rightAABB);

            if (isInLeftBB && isInRightBB) {
                if (this.getVertexSideOfPartitionLine({x, y}, this.completePartitionLine) === LEFT_SIDE_SIGN)
                    isInRightBB = false;
                else
                    isInLeftBB = false;
            }

            if (isInLeftBB) {
                if (Node.isChildSubSector(this.leftChild)) {
                    let subSector = this.leftChildRef;

                    return subSector;
                } else {
                    return this.leftChildRef.getSubSectorFromPoint(x, y);
                }
            } else if (isInRightBB) {
                if (Node.isChildSubSector(this.rightChild)) {
                    let subSector = this.rightChildRef;

                    return subSector;
                } else {
                    return this.rightChildRef.getSubSectorFromPoint(x, y);
                }
            }

            return null;
        }

        getVertexSideOfPartitionLine (v, partitionLine) {
            let referenceP = utils.toReferenceFrame(partitionLine.start, partitionLine.end, v);
            return Math.sign(referenceP.y);
        }

        static fromBinary (binaryData) {
            let node = new Node();
            node.partitionX = utils.fromTwosComplement(_.toInt16(binaryData[0], binaryData[1]), 16);
            node.partitionY = utils.fromTwosComplement(_.toInt16(binaryData[2], binaryData[3]), 16);
            node.changeX = utils.fromTwosComplement(_.toInt16(binaryData[4], binaryData[5]), 16);
            node.changeY = utils.fromTwosComplement(_.toInt16(binaryData[6], binaryData[7]), 16);
            node.rightBB = getBoundingBox(binaryData.subarray(8, 16));
            node.leftBB = getBoundingBox(binaryData.subarray(16, 24));
            node.rightChild = _.toInt16(binaryData[24], binaryData[25]);
            node.leftChild = _.toInt16(binaryData[26], binaryData[27]);
            return node;
        }

        static get ENTRY_SIZE () {
            return 28;
        }

        static isChildSubSector (child) {
            return utils.bitToBool(child, 15);
        }

        static childToIndex (child) {
            return child & 0x7FFF;
        }
    }

    return Node;
});
