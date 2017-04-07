define(function (require) {
    "use strict";

    const _ = require('lodash');
    const LumpEntry = require('wad-importer/wad_format/lump-entry');

    class Segment extends LumpEntry{
        constructor () {
            super();

            this.startVertex = 0;
            this.endVertex = 0;
            this.angle = 0;
            this.linedefRef = 0;
            this.direction = 0;
            this.offset = 0;

            this.implicit = false;
        }

        invertDirection () {
            let temp = this.endVertex;
            this.endVertex = this.startVertex;
            this.startVertex = temp;
            this.direction = (this.direction + 1) % 2;
        }

        static fromBinary (binaryData) {
            let seg = new Segment();
            seg.startVertex = _.toInt16(binaryData[0], binaryData[1]);
            seg.endVertex = _.toInt16(binaryData[2], binaryData[3]);
            seg.angle = _.toInt16(binaryData[4], binaryData[5]);
            seg.linedefRef = _.toInt16(binaryData[6], binaryData[7]);
            seg.direction = _.toInt16(binaryData[8], binaryData[9]);
            seg.offset = _.toInt16(binaryData[10], binaryData[11]);
            return seg;
        }

        static get ENTRY_SIZE () {
            return 12;
        }

        static get EAST () {
            return 0x0000;
        }

        static get NORTH () {
            return 0x4000;
        }

        static get WEST () {
            return 0x8000;
        }

        static get SOUTH () {
            return 0xC000;
        }
    }

    return Segment;
});
