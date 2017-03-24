define(function (require) {
    "use strict";

    const _ = require('lodash');
    const Map = require('wad-importer/wad_format/map');
    const Texture = require('wad-importer/wad_format/texture');

    const DIRECTORY_ENTRY_SIZE = 16;
    const lumpParsers = [
        {
            type: /^(e\d+m\d+)|^(MAP\d+)/i,
            parse: parseMap
        },
        {
            type: /^TEXTURE\d/i,
            parse: parseTextures
        }
    ];

    function getWADHeader (binaryData) {
        return {
            name: String.fromCharCode(binaryData[0]) + String.fromCharCode(binaryData[1]) + String.fromCharCode(binaryData[2]) + String.fromCharCode(binaryData[3]),
            entryCount: _.toInt32(binaryData[4], binaryData[5], binaryData[6], binaryData[7]),
            directoryPtr: _.toInt32(binaryData[8], binaryData[9], binaryData[10], binaryData[11])
        };
    }

    function getWADDirectory(binaryData, header) {
        let directorySize = header.entryCount * DIRECTORY_ENTRY_SIZE;
        let directoryStart = header.directoryPtr;
        let directoryEnd = directoryStart + directorySize;
        let directory = [];
        for (let i = directoryStart; i < directoryEnd; i += DIRECTORY_ENTRY_SIZE) {
            let lumpStart = _.toInt32(binaryData[i], binaryData[i + 1], binaryData[i + 2], binaryData[i + 3]);
            let lumpSize = _.toInt32(binaryData[i + 4], binaryData[i + 5], binaryData[i + 6], binaryData[i + 7]);

            let lumpName = "";
            let offset = 8;
            while (offset < 16) {
                let charCode = binaryData[i + offset];
                if (charCode === 0)
                    break;
                lumpName += String.fromCharCode(charCode);
                ++offset;
            }

            directory.push({lumpStart, lumpSize, lumpName});
        }

        return directory;
    }

    function parseMap (binaryData, directoryEntry, directory, WADData) {
        WADData.maps.push(Map.fromBinary(binaryData, directoryEntry, directory));
    }

    function parseTextures (binaryData, directoryEntry, directory, WADData) {
        let texturesData = binaryData.subarray(directoryEntry.lumpStart, directoryEntry.lumpStart + directoryEntry.lumpSize);
        let numTextures = _.toInt32(texturesData[0], texturesData[1], texturesData[2], texturesData[3]);
        let offsets = [];
        let index = 4;
        for (let i = 0; i < numTextures; ++i, index += 4) {
            offsets.push(_.toInt32(texturesData[index], texturesData[index + 1], texturesData[index + 2], texturesData[index + 3]));
        }
        for (let i = 0; i < numTextures; ++i) {
            let texture = Texture.fromBinary(texturesData.subarray(offsets[i])); // No end, because texture can be any size
            WADData.textures[texture.name] = texture;
        }
    }

    class WAD {
        constructor () {
            this.header = null;
            this.directory = null;
            this.maps = [];
            this.textures = {};
        }

        buildCrossReferences () {
            for (let map of this.maps) {
                map.buildCrossReferences(map);
            }
        }

        buildMissingImplicitSegments () {
            for (let map of this.maps) {
                map.buildMissingImplicitSegments();
            }
        }

        static fromBinary (binaryData, buildMissingInfo = true) {
            let WADData = new WAD();
            let uint8View = new Uint8Array(binaryData);
            WADData.header = getWADHeader(uint8View);
            WADData.directory = getWADDirectory(uint8View, WADData.header);

            for (let directory_entry of WADData.directory) {
                let lumpParser = _.find(lumpParsers, (parserObj) => {
                    return directory_entry.lumpName.match(parserObj.type) !== null;
                });
                if (lumpParser) {
                    lumpParser.parse(uint8View, directory_entry, WADData.directory, WADData);
                }
            }

            if (buildMissingInfo) {
                WADData.buildCrossReferences();
                WADData.buildMissingImplicitSegments();
            }

            return WADData;
        }
    }

    return WAD;
});
