define(function (require) {
    "use strict";

    const _ = require('lodash');
    const utils = require('wad-importer/utils');
    const LumpEntry = require('wad-importer/wad_format/lump-entry');

    class Sector extends LumpEntry {
        constructor () {
            super();

            this.floorHeight = 0;
            this.ceillingHeight = 0;
            this.floorTexture = '';
            this.ceillingTexture = '';
            this.lightLevel = 0;
            this.sectorSpecial = 0;
            this.sectorTag = 0;
        }

        static fromBinary (binaryData) {
            let sector = new Sector();
            sector.floorHeight = utils.fromTwosComplement(_.toInt16(binaryData[0], binaryData[1]), 16);
            sector.ceillingHeight = utils.fromTwosComplement(_.toInt16(binaryData[2], binaryData[3]), 16);
            sector.floorTexture = utils.bytesToString(binaryData.subarray(4, 12));
            sector.ceillingTexture = utils.bytesToString(binaryData.subarray(12, 20));
            sector.lightLevel = utils.fromTwosComplement(_.toInt16(binaryData[20], binaryData[21]), 16);
            sector.sectorSpecial = _.toInt16(binaryData[22], binaryData[23]);
            sector.sectorTag = _.toInt16(binaryData[24], binaryData[25]);
            return sector;
        }

        static get ENTRY_SIZE () {
            return 26;
        }
    }

    return Sector;
});
