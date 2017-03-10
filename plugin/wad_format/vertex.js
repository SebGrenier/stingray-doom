define(function (require) {
    "use strict";

    const _ = require('lodash');
    const utils = require('wad-importer/utils');
    const LumpEntry = require('wad-importer/wad_format/lump-entry');

    class Vertex extends LumpEntry {
        constructor () {
            super();

            this.x = 0;
            this.y = 0;
        }

        static fromBinary (binaryData) {
            let vertex = new Vertex();
            vertex.x = utils.fromTwosComplement(_.toInt16(binaryData[0], binaryData[1]), 16);
            vertex.y = utils.fromTwosComplement(_.toInt16(binaryData[2], binaryData[3]), 16);
            return vertex;
        }

        static get ENTRY_SIZE () {
            return 4;
        }
    }

    return Vertex;
});
