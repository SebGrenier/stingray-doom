define(function (require) {
    "use strict";

    const _ = require('lodash');
    const LumpEntry = require('wad-importer/wad_format/lump-entry');

    class Patch extends LumpEntry {
        constructor () {
            super();

            this.originX = 0;
            this.originY = 0;
            this.patch = 0;
            this.stepDir = 0;
            this.colorMap = 0;
        }

        static fromBinary (binaryData) {
            let patch = new Patch();
            patch.originX = _.toInt16(binaryData[0], binaryData[1]);
            patch.originY = _.toInt16(binaryData[2], binaryData[3]);
            patch.patch = _.toInt16(binaryData[4], binaryData[5]);
            patch.stepDir = _.toInt16(binaryData[6], binaryData[7]);
            patch.colorMap = _.toInt16(binaryData[8], binaryData[9]);
        }

        static get ENTRY_SIZE () {
            return 10;
        }
    }

    return Patch;
});
