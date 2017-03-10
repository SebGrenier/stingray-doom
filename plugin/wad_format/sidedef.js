define(function (require) {
    "use strict";

    const _ = require('lodash');
    const utils = require('wad-importer/utils');
    const LumpEntry = require('wad-importer/wad_format/lump-entry');

    class Sidedef extends LumpEntry {
        constructor () {
            super();

            this.xOffset = 0;
            this.yOffset = 0;
            this.upperTexture = '';
            this.lowerTexture = '';
            this.middleTexture = '';
            this.sectorRef = 0;
        }

        static fromBinary (binaryData) {
            let sidedef = new Sidedef();
            sidedef.xOffset = utils.fromTwosComplement(_.toInt16(binaryData[0], binaryData[1]), 16);
            sidedef.yOffset = utils.fromTwosComplement(_.toInt16(binaryData[2], binaryData[3]), 16);
            sidedef.upperTexture = _.toUpper(utils.bytesToString(binaryData.subarray(4, 12)));
            sidedef.lowerTexture = _.toUpper(utils.bytesToString(binaryData.subarray(12, 20)));
            sidedef.middleTexture = _.toUpper(utils.bytesToString(binaryData.subarray(20, 28)));
            sidedef.sectorRef = _.toInt16(binaryData[28], binaryData[29]);
            return sidedef;
        }

        static get ENTRY_SIZE () {
            return 30;
        }

        static get NO_TEXTURE () {
            return '-';
        }
    }

    return Sidedef;
});
