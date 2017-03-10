define(function (require) {
    "use strict";

    const _ = require('lodash');
    const utils = require('wad-importer/utils');
    const LumpEntry = require('wad-importer/wad_format/lump-entry');
    const Patch = require('wad-importer/wad_format/patch');

    class Texture extends LumpEntry {
        constructor () {
            super();

            this.name = '';
            this.masked = false;
            this.width = 0;
            this.height = 0;
            this.columnDirectory = 0;
            this.patchCount = 0;
            this.patches = [];
        }

        static fromBinary (binaryData) {
            let texture = new Texture();
            texture.name = utils.bytesToString(binaryData.subarray(0, 8));
            texture.masked = _.toInt32(binaryData[8], binaryData[9], binaryData[10], binaryData[11]) === 1;
            texture.width = _.toInt16(binaryData[12], binaryData[13]);
            texture.height = _.toInt16(binaryData[14], binaryData[15]);
            texture.columnDirectory = _.toInt32(binaryData[16], binaryData[17], binaryData[18], binaryData[19]);
            texture.patchCount = _.toInt16(binaryData[20], binaryData[21]);

            for (let i = 0, offset = 22; i < texture.patchCount; ++i, offset += Patch.ENTRY_SIZE) {
                texture.patches.push(Patch.fromBinary(binaryData.subarray(offset, offset + Patch.ENTRY_SIZE)));
            }

            return texture;
        }

        static get ENTRY_SIZE () {
            return LumpEntry.VARIABLE_ENTRY_SIZE;
        }
    }

    return Texture;
});
