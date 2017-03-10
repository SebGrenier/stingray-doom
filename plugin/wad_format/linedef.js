define(function (require) {
    "use strict";

    const _ = require('lodash');
    const utils = require('wad-importer/utils');
    const LumpEntry = require('wad-importer/wad_format/lump-entry');

    class Linedef extends LumpEntry {
        constructor () {
            super();

            this.startVertex = 0;
            this.endVertex = 0;
            this.flags = 0;
            this.lineType = 0;
            this.sectorTag = 0;
            this.rightSidedef = 0;
            this.leftSidedef = 0;
        }

        get blocking () {
            return utils.bitToBool(this.flags, 0);
        }

        get blockMonsters () {
            return utils.bitToBool(this.flags, 1);
        }

        get twoSided () {
            return utils.bitToBool(this.flags, 2);
        }

        get dontPegTop () {
            return utils.bitToBool(this.flags, 3);
        }

        get dontPegBottom () {
            return utils.bitToBool(this.flags, 4);
        }

        get secret () {
            return utils.bitToBool(this.flags, 5);
        }

        get soundBlock () {
            return utils.bitToBool(this.flags, 6);
        }

        get dontDraw () {
            return utils.bitToBool(this.flags, 7);
        }

        get mapped () {
            return utils.bitToBool(this.flags, 8);
        }

        static fromBinary (binaryData) {
            let linedef = new Linedef();
            linedef.startVertex = _.toInt16(binaryData[0], binaryData[1]);
            linedef.endVertex = _.toInt16(binaryData[2], binaryData[3]);
            linedef.flags = _.toInt16(binaryData[4], binaryData[5]);
            linedef.lineType = _.toInt16(binaryData[6], binaryData[7]);
            linedef.sectorTag = _.toInt16(binaryData[8], binaryData[9]);
            linedef.rightSidedef = _.toInt16(binaryData[10], binaryData[11]);
            linedef.leftSidedef = _.toInt16(binaryData[12], binaryData[13]);
            return linedef;
        }

        static get ENTRY_SIZE () {
            return 14;
        }

        static get NO_SIDEDEF () {
            return 0xffff;
        }
    }

    return Linedef;
});
