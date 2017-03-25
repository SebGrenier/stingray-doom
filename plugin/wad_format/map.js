define(function (require) {
    "use strict";

    const _ = require('lodash');
    const LumpEntry = require('wad-importer/wad_format/lump-entry');
    const Thing = require('wad-importer/wad_format/thing');
    const LineDef = require('wad-importer/wad_format/linedef');
    const SideDef = require('wad-importer/wad_format/sidedef');
    const Vertex = require('wad-importer/wad_format/vertex');
    const Segment = require('wad-importer/wad_format/segment');
    const SubSector = require('wad-importer/wad_format/subsector');
    const Node = require('wad-importer/wad_format/node');
    const Sector = require('wad-importer/wad_format/sector');

    function getParseFunc (mapLump, lumpEntrySize, fromBinaryFunc) {
        return function (binaryData, directoryEntry) {
            let start = directoryEntry.lumpStart;
            let end = start + directoryEntry.lumpSize;

            mapLump = mapLump || [];

            for (let i = start; i < end; i += lumpEntrySize) {
                mapLump.push(fromBinaryFunc(binaryData.subarray(i, i + lumpEntrySize)));
            }
        };
    }

    class Map extends LumpEntry {
        constructor () {
            super();

            this.name = null;
            this.things = [];
            this.linedefs = [];
            this.sidedefs = [];
            this.vertexes = [];
            this.segs = [];
            this.ssectors = [];
            this.nodes = [];
            this.sectors = [];
            this.reject = [];
            this.blockmap = null;

            this.implicitSegs = [];
            this.partitionLines = [];
        }

        buildMissingInfo () {
            this.buildCrossReferences();
            this.buildMissingImplicitSegments();
        }

        buildCrossReferences () {
            function buildReferencesFor (lumps, map) {
                for (let lump of lumps) {
                    lump.buildCrossReferences(map);
                }
            }

            buildReferencesFor(this.things, this);
            buildReferencesFor(this.linedefs, this);
            buildReferencesFor(this.sidedefs, this);
            buildReferencesFor(this.vertexes, this);
            buildReferencesFor(this.segs, this);
            buildReferencesFor(this.ssectors, this);
            buildReferencesFor(this.nodes, this);
            buildReferencesFor(this.sectors, this);
        }

        getRootNode () {
            return this.nodes[this.nodes.length - 1];
        }

        buildMissingImplicitSegments () {
            let nodesToVisit = [this.getRootNode()];
            while (nodesToVisit.length > 0) {
                let nodesToAdd = [];
                let nodesToRemove = [];
                for (let node of nodesToVisit) {
                    //node.computeCompletePartitionLine(this);
                    node.addMissingImplicitSegments(this);

                    if (!Node.isChildSubSector(node.rightChild)) {
                        nodesToAdd.push(node.rightChildRef);
                    } else {
                        //node.rightChildRef.addMissingImplicitSegments(this);
                    }
                    if (!Node.isChildSubSector(node.leftChild)) {
                        nodesToAdd.push(node.leftChildRef);
                    } else {
                        //node.leftChildRef.addMissingImplicitSegments(this);
                    }
                    nodesToRemove.push(node);
                }

                _.pullAll(nodesToVisit, nodesToRemove);
                nodesToVisit = _.concat(nodesToVisit, nodesToAdd);
            }
        }

        getBB () {
            let minX = 32767;
            let minY = 32767;
            let maxX = -32767;
            let maxY = -32767;

            for (let vertex of this.vertexes) {
                minX = Math.min(minX, vertex.x);
                minY = Math.min(minY, vertex.y);
                maxX = Math.max(maxX, vertex.x);
                maxY = Math.max(maxY, vertex.y);
            }

            return {
                minX, maxX, minY, maxY
            };
        }

        addVertex (x, y) {
            if (_.isNaN(x) || _.isNaN(y))
                throw new Error('Nan value!');
            let v = new Vertex();
            v.x = x;
            v.y = y;
            this.vertexes.push(v);
            return v;
        }

        addImplicitSegment (startVertexIndex, endVertexIndex) {
            let newSeg = new Segment();
            newSeg.startVertex = startVertexIndex;
            newSeg.endVertex = endVertexIndex;
            newSeg.implicit = true;

            this.implicitSegs.push(newSeg);

            return newSeg;
        }

        splitImplicitSegment (seg, x, y) {
            let v = this.addVertex(x, y);
            let oldEndVertex = seg.endVertex;
            let index = this.vertexes.indexOf(v);
            seg.endVertex = index;

            return this.addImplicitSegment(index, oldEndVertex);
        }

        segmentExists (startVertexIndex, endVertexIndex, testOrder = false) {
            return _.some(_.concat(this.segs, this.implicitSegs), s => {
                if (!testOrder) {
                    return (s.startVertex === startVertexIndex && s.endVertex === endVertexIndex) ||
                        (s.startVertex === endVertexIndex && s.endVertex === startVertexIndex);
                }
                return s.startVertex === startVertexIndex && s.endVertex === endVertexIndex;
            });
        }

        static fromBinary(binaryData, directoryEntry, directory) {
            function checkAndParse (binaryData, directory, mapEntry) {
                if (mapEntry.index >= directory.length)
                    return;

                let entry = directory[mapEntry.index];
                if (entry.lumpName !== mapEntry.name)
                    return;

                if (mapEntry.parse)
                    mapEntry.parse(binaryData, entry);
            }

            let entryIndex = directory.indexOf(directoryEntry);

            if (entryIndex === -1) {
                return;
            }

            let mapObj = new Map();
            mapObj.name = directoryEntry.lumpName;

            let mapEntries = [];
            mapEntries.push({index: entryIndex + 1, name: "THINGS", parse: getParseFunc(mapObj.things, Thing.ENTRY_SIZE, Thing.fromBinary)});
            mapEntries.push({index: entryIndex + 2, name: "LINEDEFS", parse: getParseFunc(mapObj.linedefs, LineDef.ENTRY_SIZE, LineDef.fromBinary)});
            mapEntries.push({index: entryIndex + 3, name: "SIDEDEFS", parse: getParseFunc(mapObj.sidedefs, SideDef.ENTRY_SIZE, SideDef.fromBinary)});
            mapEntries.push({index: entryIndex + 4, name: "VERTEXES", parse: getParseFunc(mapObj.vertexes, Vertex.ENTRY_SIZE, Vertex.fromBinary)});
            mapEntries.push({index: entryIndex + 5, name: "SEGS", parse: getParseFunc(mapObj.segs, Segment.ENTRY_SIZE, Segment.fromBinary)});
            mapEntries.push({index: entryIndex + 6, name: "SSECTORS", parse: getParseFunc(mapObj.ssectors, SubSector.ENTRY_SIZE, SubSector.fromBinary)});
            mapEntries.push({index: entryIndex + 7, name: "NODES", parse: getParseFunc(mapObj.nodes, Node.ENTRY_SIZE, Node.fromBinary)});
            mapEntries.push({index: entryIndex + 8, name: "SECTORS", parse: getParseFunc(mapObj.sectors, Sector.ENTRY_SIZE, Sector.fromBinary)});
            mapEntries.push({index: entryIndex + 9, name: "REJECT", parse: null});
            mapEntries.push({index: entryIndex + 10, name: "BLOCKMAP", parse: null});

            for (let mapEntry of mapEntries) {
                checkAndParse(binaryData, directory, mapEntry);
            }

            return mapObj;
        }
    }

    return Map;
});
