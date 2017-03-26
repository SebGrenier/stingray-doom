define(function (require) {
    'use strict';

    const m = require('components/mithril-ext');
    const stingray = require('stingray');

    const Choice = require('components/choice');
    const Button = require('components/button');
    const Checkbox = require('components/checkbox');

    const wadAssets = require('wad-importer/wad-assets');
    const wadActions = require('wad-importer/wad-import-actions');
    const Node = require('wad-importer/wad_format/node');

    const fileSystemUtils = require('common/file-system-utils');
    const keyCodes = require('common/keycodes');
    const projectService = require('services/project-service');

    document.title = "Wad Viewer";

    // Initialize the application
    function intOptionModel (value, onChangeCb) {
        return function (newValue) {
            if (arguments.length > 0) {
                value = parseInt(newValue, 10);
                if (onChangeCb) {
                    onChangeCb(newValue);
                }
            }
            return value;
        };
    }

    const DrawMode = {
        'Lines': 0,
        'SubSectors' :1,
        'Partitions': 2,
        'Segments': 3,
        'Divisions': 4,
        'Regions': 5
    };

    function getRandomColor() {
        let letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++ ) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }

    function getRandomRGB () {
        return {
            r: Math.floor(Math.random() * 255),
            g: Math.floor(Math.random() * 255),
            b: Math.floor(Math.random() * 255)
        };
    }

    function scale (value, minSrc, maxSrc, minDst, maxDst) {
        return (value - minSrc) / (maxSrc - minSrc) * (maxDst - minDst) + minDst;
    }

    class WadViewerCtrl {
        constructor(opts) {
            this.wadFilePath = opts.wadFilePath;
            this.wadData = opts.wadData;
            this.mapModelIndex = intOptionModel(0, this.buildMapInfo.bind(this));
            this.buildMapInfo(0);
            this.mapOptions = {};
            for (let mapIndex = 0; mapIndex < this.wadData.maps.length; ++mapIndex) {
                let map = this.wadData.maps[mapIndex];
                this.mapOptions[map.name] = mapIndex;
            }
            this.getMapOptions = () => this.mapOptions;
            this.subSectorId = -1;
            this.nodeId = 0;

            this.drawModeModelIndex = intOptionModel(DrawMode.Lines);
            this.getDrawModeOptions = () => DrawMode;
            this.drawBoundingBoxModel = m.prop(true);

            this.drawAncestorsModel = m.prop(false);

            this.wadCanvasConfig = this.wadCanvasConfig.bind(this);
        }

        buildMapInfo (mapIndex) {
            let map = this.wadData.maps[mapIndex];
            map.buildMissingInfo();
        }

        view () {
            return m.layout.vertical({}, [
                m('div', {className: "toolbar"}, [
                    'Map',
                    Choice.component({
                        model: this.mapModelIndex,
                        getOptions: this.getMapOptions
                    }),
                    'Draw Mode',
                    Choice.component({
                        model: this.drawModeModelIndex,
                        getOptions: this.getDrawModeOptions
                    }),
                    'Bounding Boxes',
                    Checkbox.component({
                        model: this.drawBoundingBoxModel
                    }),
                    m.utils.if(this.drawModeModelIndex() === DrawMode.Divisions, () => {
                        return [
                            'Ancestors',
                            Checkbox.component({
                                model: this.drawAncestorsModel
                            })
                        ];
                    }),
                    Button.component({
                        text: 'Generate',
                        onclick: () => this.generateMapUnit()
                    })
                ]),
                m.layout.element({}, [
                    m('canvas', {id: 'wad-canvas', className: '', width: 800, height: 600, config: this.wadCanvasConfig})
                ])
            ]);
        }

        wadCanvasConfig (element, isInit) {
            if (!isInit) {
                console.log('canvas init', this.mapModelIndex());
                this.canvas = document.getElementById('wad-canvas');
                this.ctx = this.canvas.getContext("2d");
                this.ctx.imageSmoothingEnabled = true;
                this.ctx.fillStyle = 'black';

                window.addEventListener('keydown', e => {
                    if (e.keyCode === keyCodes.KEYCODE_PAGEUP)
                        ++this.subSectorId;
                    if (e.keyCode === keyCodes.KEYCODE_PAGEDOWN)
                        --this.subSectorId;

                    let map = this.wadData.maps[this.mapModelIndex()];
                    this.subSectorId = Math.max(-1, Math.min(this.subSectorId, map.ssectors.length - 1));

                    m.redraw(true);
                });
                window.addEventListener('mousewheel', e => {
                    let delta = Math.max(-1, Math.min(1, (e.wheelDelta || -e.detail)));
                    if (delta > 0)
                        ++this.nodeId;
                    else if (delta < 0)
                        --this.nodeId;

                    let map = this.wadData.maps[this.mapModelIndex()];
                    this.nodeId = Math.max(0, Math.min(this.nodeId, map.nodes.length - 1));
                    m.redraw(true);
                });
            }

            switch (this.drawModeModelIndex()) {
                case DrawMode.Lines:
                    this.drawMapLines();
                    break;
                case DrawMode.SubSectors:
                    this.drawMapSubSectors();
                    break;
                case DrawMode.Partitions:
                    this.drawMapPartitionLines();
                    break;
                case DrawMode.Segments:
                    this.drawMapSegments();
                    break;
                case DrawMode.Divisions:
                    this.drawDivisions();
                    break;
                case DrawMode.Regions:
                    this.drawSubSectorRegion();
                    break;
            }

        }

        generateMapUnit () {
            let map = this.wadData.maps[this.mapModelIndex()];
            let baseDir = fileSystemUtils.extractDir(this.wadFilePath);
            let baseFilePath = fileSystemUtils.join(baseDir, map.name);
            wadAssets.exportMap(map, this.wadData, baseFilePath);
        }

        getScaledVertices(start, end, bb) {
            let startVertexMod = {
                x: scale(start.x, bb.minX, bb.maxX, 0, this.canvas.width),
                y: this.canvas.height - scale(start.y, bb.minY, bb.maxY, 0, this.canvas.height)
            };

            let endVertexMod = {
                x: scale(end.x, bb.minX, bb.maxX, 0, this.canvas.width),
                y: this.canvas.height - scale(end.y, bb.minY, bb.maxY, 0, this.canvas.height)
            };

            return [startVertexMod, endVertexMod];
        }

        getScaledVertex (v, bb) {
            return {
                x: scale(v.x, bb.minX, bb.maxX, 0, this.canvas.width),
                y: this.canvas.height - scale(v.y, bb.minY, bb.maxY, 0, this.canvas.height)
            };
        }

        drawMapLines () {
            const lineColors = {
                oneSided: 'red',
                twoSided: 'white',
                special: '#66ff33'
            };

            this.ctx.fillStyle = `rgba(0, 0, 0, 1)`;
            this.ctx.fillRect(0,0, this.canvas.width, this.canvas.height);

            let map = this.wadData.maps[this.mapModelIndex()];
            let bb = wadAssets.getMapBB(map);

            for (let lineDef of map.linedefs) {
                let startVertex = map.vertexes[lineDef.startVertex];
                let endVertex = map.vertexes[lineDef.endVertex];

                let [startVertexMod, endVertexMod] = this.getScaledVertices(startVertex, endVertex, bb);

                if (lineDef.lineType > 0) {
                    this.ctx.strokeStyle = lineColors.special;
                } else if (lineDef.twoSided) {
                    this.ctx.strokeStyle = lineColors.twoSided;
                } else {
                    this.ctx.strokeStyle = lineColors.oneSided;
                }

                this.ctx.beginPath();
                this.ctx.moveTo(startVertexMod.x, startVertexMod.y);
                this.ctx.lineTo(endVertexMod.x, endVertexMod.y);
                this.ctx.stroke();
            }
        }

        drawMapSubSectors () {
            this.ctx.fillStyle = `rgba(0, 0, 0, 1)`;
            this.ctx.fillRect(0,0, this.canvas.width, this.canvas.height);
            let map = this.wadData.maps[this.mapModelIndex()];
            let bb = wadAssets.getMapBB(map);

            let i = 0;
            if (this.subSectorId === -1) {
                for (let subSector of map.ssectors) {
                    this.ctx.strokeStyle = getRandomColor();
                    for (let segOffset = 0; segOffset < subSector.numSegs; ++segOffset) {
                        let seg = map.segs[subSector.firstSeg + segOffset];

                        let startVertex = map.vertexes[seg.startVertex];
                        let endVertex = map.vertexes[seg.endVertex];

                        let [startVertexMod, endVertexMod] = this.getScaledVertices(startVertex, endVertex, bb);

                        this.ctx.beginPath();
                        this.ctx.moveTo(startVertexMod.x, startVertexMod.y);
                        this.ctx.lineTo(endVertexMod.x, endVertexMod.y);
                        this.ctx.stroke();
                    }

                    if (this.drawBoundingBoxModel()) {
                        let nodeRef = subSector.nodeRef;
                        if (Node.isChildSubSector(nodeRef.rightChild) &&
                            Node.childToIndex(nodeRef.rightChild) === i) {
                            this.drawBoundingBox(nodeRef.rightBB, bb);
                        }
                        if (Node.isChildSubSector(nodeRef.leftChild) &&
                            Node.childToIndex(nodeRef.leftChild) === i) {
                            this.drawBoundingBox(nodeRef.leftBB, bb);
                        }
                    }
                    ++i;
                }
            } else {
                let subSector = map.ssectors[this.subSectorId];
                this.ctx.strokeStyle = getRandomColor();

                // let partitionLines = [];
                // subSector.getAncestorsPartitionLines(partitionLines);
                // for (let pLine of partitionLines) {
                //     let startVertex = {
                //         x: pLine.start.x,
                //         y: pLine.start.y
                //     };
                //
                //     let endVertex = {
                //         x: pLine.end.x,
                //         y: pLine.end.y
                //     };
                //
                //     let [startVertexMod, endVertexMod] = this.getScaledVertices(startVertex, endVertex, bb);
                //
                //     this.ctx.strokeStyle = 'blue';
                //     this.ctx.beginPath();
                //     this.ctx.moveTo(startVertexMod.x, startVertexMod.y);
                //     this.ctx.lineTo(endVertexMod.x, endVertexMod.y);
                //     this.ctx.stroke();
                // }

                for (let segOffset = 0; segOffset < subSector.numSegs; ++segOffset) {
                    let seg = map.segs[subSector.firstSeg + segOffset];

                    let startVertex = map.vertexes[seg.startVertex];
                    let endVertex = map.vertexes[seg.endVertex];

                    let [startVertexMod, endVertexMod] = this.getScaledVertices(startVertex, endVertex, bb);

                    this.ctx.beginPath();
                    this.ctx.moveTo(startVertexMod.x, startVertexMod.y);
                    this.ctx.lineTo(endVertexMod.x, endVertexMod.y);
                    this.ctx.stroke();
                }

                subSector.addMissingImplicitSegments(map);
                for (let seg of subSector.completeSegments) {
                    if (!seg.implicit)
                        continue;
                    let startVertex = map.vertexes[seg.startVertex];
                    let endVertex = map.vertexes[seg.endVertex];

                    let [startVertexMod, endVertexMod] = this.getScaledVertices(startVertex, endVertex, bb);
                    this.ctx.strokeStyle = 'yellow';
                    this.ctx.beginPath();
                    this.ctx.moveTo(startVertexMod.x, startVertexMod.y);
                    this.ctx.lineTo(endVertexMod.x, endVertexMod.y);
                    this.ctx.stroke();
                }

                if (this.drawBoundingBoxModel()) {
                    let nodeRef = subSector.nodeRef;
                    if (Node.isChildSubSector(nodeRef.rightChild) &&
                        Node.childToIndex(nodeRef.rightChild) === this.subSectorId) {
                        this.drawBoundingBox(nodeRef.rightBB, bb);
                    }
                    if (Node.isChildSubSector(nodeRef.leftChild) &&
                        Node.childToIndex(nodeRef.leftChild) === this.subSectorId) {
                        this.drawBoundingBox(nodeRef.leftBB, bb);
                    }
                }
            }
        }

        drawMapPartitionLines () {
            this.ctx.fillStyle = `rgba(0, 0, 0, 1)`;
            this.ctx.fillRect(0,0, this.canvas.width, this.canvas.height);
            let map = this.wadData.maps[this.mapModelIndex()];
            let bb = wadAssets.getMapBB(map);

            for (let node of map.nodes) {
                let startVertex = {
                    x: node.partitionX,
                    y: node.partitionY
                };

                let endVertex = {
                    x: startVertex.x + node.changeX,
                    y: startVertex.y + node.changeY
                };

                if (this.drawBoundingBoxModel()) {
                    if (Node.isChildSubSector(node.rightChild)) {
                        this.drawBoundingBox(node.rightBB, bb);
                    }
                    if (Node.isChildSubSector(node.leftChild)) {
                        this.drawBoundingBox(node.leftBB, bb);
                    }
                }

                let [startVertexMod, endVertexMod] = this.getScaledVertices(startVertex, endVertex, bb);

                this.ctx.strokeStyle = 'white';
                this.ctx.beginPath();
                this.ctx.moveTo(startVertexMod.x, startVertexMod.y);
                this.ctx.lineTo(endVertexMod.x, endVertexMod.y);
                this.ctx.stroke();
            }
        }

        drawMapSegments () {
            this.ctx.fillStyle = `rgba(0, 0, 0, 1)`;
            this.ctx.fillRect(0,0, this.canvas.width, this.canvas.height);
            let map = this.wadData.maps[this.mapModelIndex()];
            let bb = wadAssets.getMapBB(map);

            for (let seg of map.segs.concat(map.implicitSegs)) {
                let startVertex = map.vertexes[seg.startVertex];
                let endVertex = map.vertexes[seg.endVertex];

                let [startVertexMod, endVertexMod] = this.getScaledVertices(startVertex, endVertex, bb);

                if (seg.implicit)
                    this.ctx.strokeStyle = 'yellow';
                else
                    this.ctx.strokeStyle = 'red';
                this.ctx.beginPath();
                this.ctx.moveTo(startVertexMod.x, startVertexMod.y);
                this.ctx.lineTo(endVertexMod.x, endVertexMod.y);
                this.ctx.stroke();
            }
        }

        drawDivisions () {
            this.ctx.fillStyle = `rgba(0, 0, 0, 1)`;
            this.ctx.fillRect(0,0, this.canvas.width, this.canvas.height);

            let map = this.wadData.maps[this.mapModelIndex()];
            let bb = wadAssets.getMapBB(map);

            // Draw map lines
            for (let lineDef of map.linedefs) {
                let startVertex = map.vertexes[lineDef.startVertex];
                let endVertex = map.vertexes[lineDef.endVertex];

                let [startVertexMod, endVertexMod] = this.getScaledVertices(startVertex, endVertex, bb);

                this.ctx.strokeStyle = 'white';
                this.ctx.beginPath();
                this.ctx.moveTo(startVertexMod.x, startVertexMod.y);
                this.ctx.lineTo(endVertexMod.x, endVertexMod.y);
                this.ctx.stroke();
            }

            // Draw a division (they are ordered bottom to top, so root is last)
            let node = map.nodes[map.nodes.length - 1 - this.nodeId];
            let startVertex = {
                x: node.completePartitionLine.start.x,
                y: node.completePartitionLine.start.y
            };

            let endVertex = {
                x: node.completePartitionLine.end.x,
                y: node.completePartitionLine.end.y
            };

            let startPartition = {
                x: node.partitionX,
                y: node.partitionY
            } ;
            let endPartition = {
                x: startPartition.x + node.changeX,
                y: startPartition.y + node.changeY
            };

            if (this.drawBoundingBoxModel()) {
                this.drawBoundingBox(node.rightBB, bb, 'green');
                this.drawBoundingBox(node.leftBB, bb, 'red');
                if (node.parent) {
                    let parentBB = node.parent.getBBForChild(node);
                    this.drawBoundingBox(parentBB, bb, 'blue');
                }
            }

            let [startVertexMod, endVertexMod] = this.getScaledVertices(startVertex, endVertex, bb);

            this.ctx.strokeStyle = 'blue';
            this.ctx.beginPath();
            this.ctx.moveTo(startVertexMod.x, startVertexMod.y);
            this.ctx.lineTo(endVertexMod.x, endVertexMod.y);
            this.ctx.stroke();

            let [startPartitionMod, endPartitionMod] = this.getScaledVertices(startPartition, endPartition, bb);
            this.ctx.strokeStyle = 'yellow';
            this.ctx.beginPath();
            this.ctx.moveTo(startPartitionMod.x, startPartitionMod.y);
            this.ctx.lineTo(endPartitionMod.x, endPartitionMod.y);
            this.ctx.stroke();

            if (this.drawAncestorsModel()) {
                let ancestorsPartitionLines = [];
                node.getAncestorsPartitionLines(ancestorsPartitionLines);

                for (let partitionLine of ancestorsPartitionLines) {
                    let start = {
                        x: partitionLine.start.x,
                        y: partitionLine.start.y
                    };

                    let end = {
                        x: partitionLine.end.x,
                        y: partitionLine.end.y
                    };

                    let [startMod, endMod] = this.getScaledVertices(start, end, bb);
                    this.ctx.strokeStyle = 'blue';
                    this.ctx.beginPath();
                    this.ctx.moveTo(startMod.x, startMod.y);
                    this.ctx.lineTo(endMod.x, endMod.y);
                    this.ctx.stroke();
                }
            }
        }

        drawSubSectorRegion () {
            this.ctx.fillStyle = `rgba(0, 0, 0, 1)`;
            this.ctx.fillRect(0,0, this.canvas.width, this.canvas.height);
            let map = this.wadData.maps[this.mapModelIndex()];
            let bb = wadAssets.getMapBB(map);

            let subSectorColors = [];
            for (let i = 0; i < map.ssectors.length; ++i) {
                subSectorColors.push(getRandomRGB());
            }

            let root = map.getRootNode();

            for (let x = bb.minX; x <= bb.maxX; ++x) {
                for (let y = bb.minY; y <= bb.maxY; ++y) {
                    let subSector = root.getSubSectorFromPoint(x, y);
                    if (subSector) {
                        let index = map.ssectors.indexOf(subSector);
                        if (index > -1) {
                            let color = subSectorColors[index];


                            let scaledPos = this.getScaledVertex({x, y}, bb);
                            this.ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 1)`;
                            this.ctx.fillRect(scaledPos.x, scaledPos.y, 1, 1);
                        }
                    }
                }
            }

        }

        drawBoundingBox (bb, mapBB, color) {
            let [topLeft, bottomRight] = this.getScaledVertices({x: bb.left, y: bb.top}, {x: bb.right, y: bb.bottom}, mapBB);
            // this.ctx.strokeStyle = getRandomColor();
            this.ctx.strokeStyle = color || 'green';
            this.ctx.beginPath();
            this.ctx.rect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
            this.ctx.stroke();
        }

    }

    let initialWad = stingray.getParameterByName('asset');
    if (!initialWad) {
        throw new Error('Must specify wad file');
    }

    projectService.relativePathToAbsolute(initialWad).then(wadFilePath => {
        console.time('load wad');
        wadActions.loadWad(wadFilePath, false).then(wadData => {
            console.timeEnd('load wad');
            console.log('wad', wadData);
            m.mount($('#mithril-root')[0], m.component({
                controller: () => new WadViewerCtrl({wadData, wadFilePath}),
                view: (ctrl, args) => ctrl.view(args)
            }));
        });
    });

    return {
        noAngular: true
    };
});
