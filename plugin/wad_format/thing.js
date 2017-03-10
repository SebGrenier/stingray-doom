define(function (require) {
    "use strict";

    const _ = require('lodash');
    const utils = require('wad-importer/utils');
    const LumpEntry = require('wad-importer/wad_format/lump-entry');

    class Thing extends LumpEntry {
        constructor () {
            super();

            this.x = 0;
            this.y = 0;
            this.angle = 0;
            this.type = 0;
            this.flags = 0;
        }

        static fromBinary (binaryData) {
            let thing = new Thing();
            thing.x = utils.fromTwosComplement(_.toInt16(binaryData[0], binaryData[1]), 16);
            thing.y = utils.fromTwosComplement(_.toInt16(binaryData[2], binaryData[3]), 16);
            thing.angle = _.toInt16(binaryData[4], binaryData[5]);
            thing.type = _.toInt16(binaryData[6], binaryData[7]);
            thing.flags = _.toInt16(binaryData[8], binaryData[9]);
            return thing;
        }

        static get ENTRY_SIZE () {
            return 10;
        }
    }

    return Thing;
});
