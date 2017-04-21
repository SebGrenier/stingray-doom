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
    const utils = require('wad-importer/utils');

    const fileSystemUtils = require('common/file-system-utils');
    const keyCodes = require('common/keycodes');
    const projectService = require('services/project-service');

    const glUtils = require('wad-importer/gl-utils');
    require('sylvester');

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

    const COLORS = {
        'White': [1, 1, 1],
        'Black': [0, 0, 0],
        'Red': [1, 0, 0],
        'Green': [0, 1, 0],
        'Blue': [0, 0, 1],
        'Yellow': [1, 1, 0],
        'Special': [0.4, 1, 0.2]
    };

    const DrawMode = {
        'Lines':
            {
                index:0,
                onKeyDown: function () {}
            },
        'SubSectors':
            {
                index:1,
                subSectorId: -1,
                onKeyDown: function (e, ctrl) {
                    if (e.keyCode === keyCodes.KEYCODE_PAGEUP)
                        ++this.subSectorId;
                    if (e.keyCode === keyCodes.KEYCODE_PAGEDOWN)
                        --this.subSectorId;

                    let map = ctrl.wadData.maps[ctrl.mapModelIndex()];
                    this.subSectorId = Math.max(-1, Math.min(this.subSectorId, map.ssectors.length - 1));

                    m.redraw(true);
                }
            },
        'Partitions':
            {
                index:2,
                onKeyDown: function () {}
            },
        'Segments':
            {
                index:3,
                onKeyDown: function () {}
            },
        'Divisions':
            {
                index:4,
                nodeId: 0,
                onKeyDown: function (e, ctrl) {
                    if (e.keyCode === keyCodes.KEYCODE_PAGEUP)
                        ++this.nodeId;
                    if (e.keyCode === keyCodes.KEYCODE_PAGEDOWN)
                        --this.nodeId;

                    let map = ctrl.wadData.maps[ctrl.mapModelIndex()];
                    this.nodeId = Math.max(0, Math.min(this.nodeId, map.nodes.length - 1));
                    m.redraw(true);
                }
            },
        // 'Regions':
        //     {
        //         index:5,
        //         onKeyDown: function () {}
        //     }
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

    function getRandomRGBFloat () {
        return {
            r: Math.random(),
            g: Math.random(),
            b: Math.random()
        };
    }

    function scale (value, minSrc, maxSrc, minDst, maxDst) {
        return (value - minSrc) / (maxSrc - minSrc) * (maxDst - minDst) + minDst;
    }

    class Buffer {
        constructor (gl) {
            this.gl = gl;
            this.vertices = [];
            this.colors = [];
            this.indices = [];

            this.vertexBuffer = null;
            this.colorBuffer = null;
            this.indexBuffer = null;
        }

        pushVertex (position, color) {
            this.vertices.push(position.x);
            this.vertices.push(position.y);
            this.vertices.push(0);
            this.colors.push(color[0]);
            this.colors.push(color[1]);
            this.colors.push(color[2]);
        }

        endShape () {
            this.vertexBuffer = this.gl.createBuffer();
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
            this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.vertices), this.gl.DYNAMIC_DRAW);

            this.colorBuffer = this.gl.createBuffer();
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.colorBuffer);
            this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.colors), this.gl.DYNAMIC_DRAW);

            this.indexBuffer = this.gl.createBuffer();
            this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
            this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.indices), this.gl.STATIC_DRAW);
        }

        draw (shader) {
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
            this.gl.vertexAttribPointer(shader.attributeLocations['aVertexPosition'], 3, this.gl.FLOAT, false, 0, 0);

            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.colorBuffer);
            this.gl.vertexAttribPointer(shader.attributeLocations['aVertexColor'], 3, this.gl.FLOAT, false, 0, 0);
        }
    }

    class LineBuffer extends Buffer {
        constructor (gl) {
            super(gl);
        }

        endShape () {
            this.indices = [0, 1];
            super.endShape();
        }

        draw (shader) {
            super.draw(shader);

            this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
            this.gl.drawElements(this.gl.LINES, this.indices.length, this.gl.UNSIGNED_SHORT, 0);
        }
    }

    class QuadBuffer extends Buffer {
        constructor (gl) {
            super(gl);
        }

        endShape () {
            this.indices = [0, 1, 2, 3];
            super.endShape();
        }

        draw (shader) {
            super.draw(shader);

            this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
            this.gl.drawElements(this.gl.LINE_LOOP, this.indices.length, this.gl.UNSIGNED_SHORT, 0);
        }
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

            this.drawModeModelIndex = intOptionModel(DrawMode.Lines.index);
            this.getDrawModeOptions = () => _.mapValues(DrawMode, 'index');
            this.drawBoundingBoxModel = m.prop(true);

            this.drawAncestorsModel = m.prop(false);

            this.wadCanvasConfig = this.wadCanvasConfig.bind(this);
            this.draw = this.draw.bind(this);

            this.cameraOptions = {
                targetElement: null,
                isInsideView: false,
                translateMatrix: [0, 0, 0],
                zoom: 1.0,
                extend: [0, 0, 0],
                originalExtend: [0, 0, 0],
                isDragging: false,
                lastMousePosition: {
                    x: 0,
                    y: 0
                },
                lastGlobalMousePosition: {
                    x: 0,
                    y: 0
                },
                cameraViewPosition: {
                    x: 0,
                    y: 0
                }
            };

            this.buffers = [];
        }

        buildMapInfo (mapIndex) {
            let map = this.wadData.maps[mapIndex];
            map.buildMissingInfo();
        }

        getCurrentDrawMode () {
            let index = this.drawModeModelIndex();
            return _.find(DrawMode, dm => dm.index === index);
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
                    m.utils.if(this.drawModeModelIndex() === DrawMode.Divisions.index, () => {
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
                this.gl = this.canvas.getContext("webgl");

                //this.cameraOptions.extend = [this.canvas.width / 2, this.canvas.height / 2, 0];
                this.setCameraOnMap();

                window.addEventListener('keydown', e => {
                    let drawMode = this.getCurrentDrawMode();
                    drawMode.onKeyDown(e, this);
                });

                this.gl.clearColor(0, 0, 0, 1.0);  // Clear to black
                this.gl.clearDepth(1.0);           // Clear everything

                this.initShaders();
                this.initMouseHandlers(element);

                requestAnimationFrame(this.draw);
            }

            this.buffers = [];
            switch (this.drawModeModelIndex()) {
                case DrawMode.Lines.index:
                    this.drawMapLines();
                    break;
                case DrawMode.SubSectors.index:
                    this.drawMapSubSectors();
                    break;
                case DrawMode.Partitions.index:
                    this.drawMapPartitionLines();
                    break;
                case DrawMode.Segments.index:
                    this.drawMapSegments();
                    break;
                case DrawMode.Divisions.index:
                    this.drawDivisions();
                    break;
                case DrawMode.Regions.index:
                    this.drawSubSectorRegion();
                    break;
            }
        }

        initShaders () {
            this.shader = glUtils.initShader(this.gl, "shader-vs", "shader-fs", null, ['aVertexPosition', 'aVertexColor']);
        }

        initMouseHandlers (domElement) {
            window.document.addEventListener('mousemove', event => {
                this.cameraOptions.isInsideView = event.toElement === this.cameraOptions.targetElement;

                if (this.cameraOptions.isDragging) {
                    let translation = [event.x - this.cameraOptions.lastGlobalMousePosition.x, this.cameraOptions.lastGlobalMousePosition.y - event.y, 0];
                    translation = [translation[0] * this.cameraOptions.zoom, translation[1] * this.cameraOptions.zoom, 0];
                    this.cameraOptions.translateMatrix = [
                        this.cameraOptions.translateMatrix[0] + translation[0],
                        this.cameraOptions.translateMatrix[1] + translation[1],
                        this.cameraOptions.translateMatrix[2] + translation[2]];

                    this.cameraOptions.lastMousePosition = {
                        x: event.offsetX,
                        y: event.offsetY
                    };
                }

                this.cameraOptions.lastGlobalMousePosition = {
                    x: event.x,
                    y: event.y
                };

                if (this.cameraOptions.isInsideView) {
                    let offsetFromCenter = {
                        x: event.offsetX - this.canvas.width / 2,
                        y: this.canvas.height / 2 - event.offsetY
                    };
                    offsetFromCenter.x = offsetFromCenter.x * this.cameraOptions.zoom;
                    offsetFromCenter.y = offsetFromCenter.y * this.cameraOptions.zoom;
                    this.cameraOptions.cameraViewPosition = {
                        x: -this.cameraOptions.translateMatrix[0] + offsetFromCenter.x,
                        y: -this.cameraOptions.translateMatrix[1] + offsetFromCenter.y
                    };
                }
            }, true);
            domElement.addEventListener('mousedown', event => {
                console.log("mouse down");

                this.cameraOptions.lastMousePosition = {
                    x: event.offsetX,
                    y: event.offsetY
                };

                this.cameraOptions.isDragging = true;
                this.cameraOptions.isInsideView = true;
            }, true);
            domElement.addEventListener('mouseout', () => {}, true);
            domElement.addEventListener('mousewheel', event => {
                let delta = Math.max(-1, Math.min(1, event.wheelDelta));

                if (delta > 0) {
                    this.cameraOptions.zoom *= 0.9;
                }
                if (delta < 0) {
                    this.cameraOptions.zoom /= 0.9;
                }

                this.cameraOptions.zoom = Math.max(0.001, Math.min(2, this.cameraOptions.zoom));

                this.cameraOptions.extend = [
                    this.cameraOptions.originalExtend[0] * this.cameraOptions.zoom,
                    this.cameraOptions.originalExtend[1] * this.cameraOptions.zoom,
                    this.cameraOptions.originalExtend[2] * this.cameraOptions.zoom];

                event.stopPropagation();
                event.preventDefault();
            }, true);
            window.addEventListener('mouseup', () => {
                this.cameraOptions.isDragging = false;
            }, true);
            this.cameraOptions.targetElement = domElement;
        }

        draw () {
            // Clear the canvas before we start drawing on it.
            this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

            let perspectiveMatrix = glUtils.makeOrtho(-this.cameraOptions.extend[0], this.cameraOptions.extend[0], -this.cameraOptions.extend[1], this.cameraOptions.extend[1], 0.0, 1.0);

            let mvMatrix = glUtils.loadIdentity();
            mvMatrix = glUtils.mvTranslate(mvMatrix, this.cameraOptions.translateMatrix);

            this.gl.useProgram(this.shader.shaderProgram);

            let pUniform = this.gl.getUniformLocation(this.shader.shaderProgram, "uPMatrix");
            this.gl.uniformMatrix4fv(pUniform, false, new Float32Array(perspectiveMatrix.flatten()));

            let mvUniform = this.gl.getUniformLocation(this.shader.shaderProgram, "uMVMatrix");
            this.gl.uniformMatrix4fv(mvUniform, false, new Float32Array(mvMatrix.flatten()));

            for (let buffer of this.buffers) {
                buffer.draw(this.shader);
            }

            requestAnimationFrame(this.draw);
        }

        setCameraOnMap () {
            let map = this.wadData.maps[this.mapModelIndex()];
            let bb = utils.getNodeBB(map.vertexes);
            let aabb = utils.convertNodeBBToAABB(bb);
            this.cameraOptions.extend = [aabb.extent.x, aabb.extent.y, 0];
            this.cameraOptions.originalExtend = [aabb.extent.x, aabb.extent.y, 0];
            this.cameraOptions.translateMatrix = [-aabb.center.x, -aabb.center.y, 0];
            this.cameraOptions.zoom = 1.0;
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
            let map = this.wadData.maps[this.mapModelIndex()];

            for (let lineDef of map.linedefs) {
                let startVertex = map.vertexes[lineDef.startVertex];
                let endVertex = map.vertexes[lineDef.endVertex];

                let lineBuffer = new LineBuffer(this.gl);
                let color = [];
                if (lineDef.lineType > 0) {
                    color = COLORS.Special;
                } else if (lineDef.twoSided) {
                    color = COLORS.White;
                } else {
                    color = COLORS.Red;
                }
                lineBuffer.pushVertex(startVertex, color);
                lineBuffer.pushVertex(endVertex, color);
                lineBuffer.endShape();
                this.buffers.push(lineBuffer);
            }
        }

        drawMapSubSectors () {
            let map = this.wadData.maps[this.mapModelIndex()];

            let i = 0;
            let drawMode = DrawMode.SubSectors;
            if (drawMode.subSectorId === -1) {
                for (let subSector of map.ssectors) {
                    let color = getRandomRGBFloat();
                    for (let segOffset = 0; segOffset < subSector.numSegs; ++segOffset) {
                        let seg = map.segs[subSector.firstSeg + segOffset];

                        let startVertex = map.vertexes[seg.startVertex];
                        let endVertex = map.vertexes[seg.endVertex];

                        let buffer = new LineBuffer(this.gl);
                        buffer.pushVertex(startVertex, [color.r, color.g, color.b]);
                        buffer.pushVertex(endVertex, [color.r, color.g, color.b]);
                        buffer.endShape();
                        this.buffers.push(buffer);
                    }

                    if (this.drawBoundingBoxModel()) {
                        let nodeRef = subSector.nodeRef;
                        if (Node.isChildSubSector(nodeRef.rightChild) &&
                            Node.childToIndex(nodeRef.rightChild) === i) {
                            this.drawBoundingBox(nodeRef.rightBB);
                        }
                        if (Node.isChildSubSector(nodeRef.leftChild) &&
                            Node.childToIndex(nodeRef.leftChild) === i) {
                            this.drawBoundingBox(nodeRef.leftBB);
                        }
                    }
                    ++i;
                }
            } else {
                let subSector = map.ssectors[drawMode.subSectorId];
                let color = getRandomRGBFloat();

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

                    let buffer = new LineBuffer(this.gl);
                    buffer.pushVertex(startVertex, [color.r, color.g, color.b]);
                    buffer.pushVertex(endVertex, [color.r, color.g, color.b]);
                    buffer.endShape();
                    this.buffers.push(buffer);
                }

                subSector.addMissingImplicitSegments(map);
                for (let seg of subSector.completeSegments) {
                    if (!seg.implicit)
                        continue;
                    let startVertex = map.vertexes[seg.startVertex];
                    let endVertex = map.vertexes[seg.endVertex];

                    let buffer = new LineBuffer(this.gl);
                    buffer.pushVertex(startVertex, COLORS.Yellow);
                    buffer.pushVertex(endVertex, COLORS.Yellow);
                    buffer.endShape();
                    this.buffers.push(buffer);
                }

                if (this.drawBoundingBoxModel()) {
                    let nodeRef = subSector.nodeRef;
                    if (Node.isChildSubSector(nodeRef.rightChild) &&
                        Node.childToIndex(nodeRef.rightChild) === this.subSectorId) {
                        this.drawBoundingBox(nodeRef.rightBB);
                    }
                    if (Node.isChildSubSector(nodeRef.leftChild) &&
                        Node.childToIndex(nodeRef.leftChild) === this.subSectorId) {
                        this.drawBoundingBox(nodeRef.leftBB);
                    }
                }
            }
        }

        drawMapPartitionLines () {
            let map = this.wadData.maps[this.mapModelIndex()];

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
                        this.drawBoundingBox(node.rightBB);
                    }
                    if (Node.isChildSubSector(node.leftChild)) {
                        this.drawBoundingBox(node.leftBB);
                    }
                }

                let buffer = new LineBuffer(this.gl);
                buffer.pushVertex(startVertex, COLORS.White);
                buffer.pushVertex(endVertex, COLORS.White);
                buffer.endShape();
                this.buffers.push(buffer);
            }
        }

        drawMapSegments () {
            let map = this.wadData.maps[this.mapModelIndex()];

            for (let seg of map.segs.concat(map.implicitSegs)) {
                let startVertex = map.vertexes[seg.startVertex];
                let endVertex = map.vertexes[seg.endVertex];
                let color = null;

                if (seg.implicit)
                    color = COLORS.Yellow;
                else
                    color = COLORS.Red;

                let buffer = new LineBuffer(this.gl);
                buffer.pushVertex(startVertex, color);
                buffer.pushVertex(endVertex, color);
                buffer.endShape();
                this.buffers.push(buffer);
            }
        }

        drawDivisions () {
            let map = this.wadData.maps[this.mapModelIndex()];
            let bb = wadAssets.getMapBB(map);

            // Draw map lines
            for (let lineDef of map.linedefs) {
                let startVertex = map.vertexes[lineDef.startVertex];
                let endVertex = map.vertexes[lineDef.endVertex];

                let buffer = new LineBuffer(this.gl);
                buffer.pushVertex(startVertex, COLORS.White);
                buffer.pushVertex(endVertex, COLORS.White);
                buffer.endShape();
                this.buffers.push(buffer);
            }

            // Draw a division (they are ordered bottom to top, so root is last)
            let drawMode = DrawMode.Divisions;
            let node = map.nodes[map.nodes.length - 1 - drawMode.nodeId];
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
                this.drawBoundingBox(node.rightBB, COLORS.Green);
                this.drawBoundingBox(node.leftBB, COLORS.Red);
                if (node.parent) {
                    let parentBB = node.parent.getBBForChild(node);
                    this.drawBoundingBox(parentBB, COLORS.Blue);
                }
            }

            let buffer = new LineBuffer(this.gl);
            buffer.pushVertex(startVertex, COLORS.Blue);
            buffer.pushVertex(endVertex, COLORS.Blue);
            buffer.endShape();
            this.buffers.push(buffer);

            buffer = new LineBuffer(this.gl);
            buffer.pushVertex(startPartition, COLORS.Yellow);
            buffer.pushVertex(endPartition, COLORS.Yellow);
            buffer.endShape();
            this.buffers.push(buffer);

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

                    buffer = new LineBuffer(this.gl);
                    buffer.pushVertex(start, COLORS.Blue);
                    buffer.pushVertex(end, COLORS.Blue);
                    buffer.endShape();
                    this.buffers.push(buffer);
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

        drawBoundingBox (bb, color) {
            color = color || [0, 1, 0];
            let buffer = new QuadBuffer(this.gl);
            buffer.pushVertex({x: bb.left, y: bb.top}, color);
            buffer.pushVertex({x: bb.right, y: bb.top}, color);
            buffer.pushVertex({x: bb.right, y: bb.bottom}, color);
            buffer.pushVertex({x: bb.left, y: bb.bottom}, color);
            buffer.endShape();
            this.buffers.push(buffer);
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
