define(function (require) {
    "use strict";

    const _ = require('lodash');
    const LumpEntry = require('wad-importer/wad_format/lump-entry');

    class SubSector extends LumpEntry {
        constructor () {
            super();

            this.numSegs = 0;
            this.firstSeg = 0;

            this.nodeRef = null;
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
