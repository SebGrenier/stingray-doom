define(function (require) {
    'use strict';

    const _ = require('lodash');

    const TriangleList = 'TRIANGLE_LIST';

    const ChannelName = {
        position: 'POSITION',
        normal: 'NORMAL',
        texcoord: 'TEXCOORD',
        tangent: 'TANGENT',
        binormal: 'BINORMAL',
        color: 'COLOR',
        blendweights: 'BLENDWEIGHTS',
        blendindices: 'BLENDINDICES',
        alpha: 'ALPHA'
    };

    const ChannelType = {
        float1: 'CT_FLOAT1',
        float2: 'CT_FLOAT2',
        float3: 'CT_FLOAT3',
        float4: 'CT_FLOAT4',
        matrix4x4: 'CT_MATRIX4x4',
        quaternion: 'CT_QUATERNION',
        float3_cmp_11_11_10: 'CT_FLOAT3_CMP_11_11_10',
        half1: 'CT_HALF1',
        half2: 'CT_HALF2',
        half3: 'CT_HALF3',
        half4: 'CT_HALF4',
        ubyte4: 'CT_UBYTE4',
        short1: 'CT_SHORT1',
        short2: 'CT_SHORT2',
        short3: 'CT_SHORT3',
        short4: 'CT_SHORT4'
    };

    const defaultLocal = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

    class Node {
        constructor(name, local, parent) {
            this.local = local || _.clone(defaultLocal);
            if (parent) {
                this.parent = parent;
            }
            this._name = name;
        }

        addGeometry (name) {
            if (!this.geometries)
                this.geometries = [];
            this.geometries.push(name);
            return this;
        }

        addChild (name, local) {
            if (!this.children)
                this.children = {};
            return this.children[name] = new Node(name, local, this._name);
        }
    }

    class Indices {
        constructor(size) {
            this.size = size;
            this.type = TriangleList;
        }

        addStream(stream) {
            if (!this.streams)
                this.streams = [];
            if (!_.isArray(stream)) {
                throw new Exception('Stream must be an array');
            }
            if (stream.length !== this.size) {
                throw new Exception('Stream size doesn\'t match');
            }
            this.streams.push(stream);
            return this;
        }
    }

    class Stream {
        constructor(size, stride) {
            this.size = size;
            this.stride = stride;
        }

        addChannel (name, type) {
            if (!this.channels)
                this.channels = [];

            this.channels.push({
                index: this.channels.length,
                name,
                type
            });
            return this;
        }

        setData(data) {
            this.data = data;
            return this;
        }
    }

    class Geometry {
        constructor() {
        }

        addMaterial (name, primitives) {
            if (!this.materials)
                this.materials = [];

            this.materials.push({
                name,
                primitives
            });
            return this;
        }

        addStream (size, stride) {
            if (!this.streams)
                this.streams = [];

            let stream = new Stream(size, stride);
            this.streams.push(stream);
            return stream;
        }

        setIndices(size) {
            return this.indices = new Indices(size);
        }
    }

    class Bsi {
        constructor () {
            this.source_path = "";
        }

        addGeometry (id) {
            if (!this.geometries)
                this.geometries = {};

            return this.geometries[id] = new Geometry();
        }

        addNode (name, local) {
            if (!this.nodes)
                this.nodes = {};

            return this.nodes[name] = new Node(name, local);
        }

        get sourcePath () {
            return this.source_path;
        }

        set sourcePath (path) {
            this.source_path = path;
        }
    }

    return {
        Bsi,
        ChannelName,
        ChannelType
    };
});
