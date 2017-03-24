define(function (require) {
    'use strict';

    const stingray = require('stingray');
    const projectService = require('services/project-service');
    const fileSystemUtils = require('common/file-system-utils');
    const documentEditing = require('foundation/document-editing');
    const mathUtils = require('common/math-utils');

    const WAD = require('wad-importer/wad_format/wad');
    const wadAssets = require('wad-importer/wad-assets');

    function fetchBinaryData (filePath) {
        return new Promise(function (resolve) {
            let req = new XMLHttpRequest();
            req.open('GET', filePath, true);
            req.responseType = 'arraybuffer';
            req.onload = function (e) {
                resolve(e.target.response);
            };
            req.send();
        });
    }

    function loadWad(filePath, loadMissingInfo = true) {
        return fetchBinaryData(filePath).then((binaryData) => {
            return WAD.fromBinary(binaryData, loadMissingInfo);
        });
    }

    function importWad (options, previousResult, asset, directory) {
        return loadWad(asset).then(wadData => {
            let baseName = fileSystemUtils.getFileName(asset, true);
            let basePath = fileSystemUtils.join(directory, baseName);
            return projectService.relativePathToAbsolute(basePath + '.swad').then(() => {
                // stingray.sjson.save(absWadFile, wadData);
                return wadData;
            });
        }).catch(err => {
            console.error("Failed to load " + asset, err);
        });
    }

    function wadToStingray (options, wadData, importWadFile, directory) {
        console.log('start asset generation: wadToStingray');
        let baseName = fileSystemUtils.getFileName(importWadFile, true);
        let basePath = fileSystemUtils.join(directory, baseName);
        return projectService.relativePathToAbsolute(basePath).then(abBasePath => {
            return wadAssets.wadToStingray(wadData, abBasePath);
        });
    }

    function openWadViewer (file) {
        return documentEditing.openResourceEditor('wad-viewer', file);
    }

    /*
    function compareJson(data1, data2, path = "", opts) {
        if (opts.logPath) {
            console.log(path);
        }

        if (typeof data1 !== typeof data2) {
            console.error('type does not match', typeof data1, typeof data2, 'at ', path);
            return false;
        }

        if (_.isNumber(data1)) {
            if (!mathUtils.nearlyEqual(data1, data2)) {
                console.error('Number not equal', data1, data2, 'at', path);
                return false;
            }

            return true;
        }

        if (_.isBoolean(data1)) {
            if (data1 !== data2) {
                console.error('Boolean not equal', data1, data2, 'at', path);
                return false;
            }

            return true;
        }

        if (_.isString(data1)) {
            if (data1 !== data2) {
                console.error('String not equal', data1, data2, 'at', path);
                return false;
            }
            return true;
        }

        if (_.isArray(data1)) {
            if (data1.length !== data2.length) {
                console.error('Array not same size', data1.length, data2.length, 'at', path);
            }

            for (let i = 0; i < data1.length; ++i) {
                if (!compareJson(data1[i], data1[i], path + '/' + i, opts)) {
                    return false;
                }
            }

            return true;
        }

        if (_.isPlainObject(data1)) {
            for (let key in data1) {
                if (!data1.hasOwnProperty(key) || key.startsWith('_'))
                    continue;
                if (!data2.hasOwnProperty(key)) {
                    console.error('Object doesn\'t contain same keys:', key, 'at', path);
                    return false;
                }

                if (!compareJson(data1[key], data2[key], path + '/' + key, opts)) {
                    return false;
                }
            }

            // Check for keys only in data2. no need to check their values:
            for (let key in data2) {
                if (!data2.hasOwnProperty(key) || key.startsWith('_'))
                    continue;
                if (!data1.hasOwnProperty(key)) {
                    console.error('Object doesn\'t contain same keys:', key, 'at', path);
                    return false;
                }
            }

            return true;
        }

        console.error('Invalid json type', typeof data1, 'at ', path);
        return false;
    }

    function testBsiWrite() {
        console.log('testBsiWrite');
        let filePath = 'D:\\builds\\stingray4\\core\\stingray_renderer\\proxy_geometry\\shadow_caster.bsi_test';


        let data = new bsi.Bsi();
        let geo = data.addGeometry('g_box');
        geo.setIndices(36)
            .addStream([3, 1, 0, 0, 2, 3, 7, 6, 4, 4, 5, 7, 5, 4, 0, 0, 1, 5, 7, 5, 1, 1, 3, 7, 6, 7, 3, 3, 2, 6, 4, 6, 2, 2, 0, 4])
            .addStream([0, 1, 2, 2, 3, 0, 4, 5, 6, 6, 7, 4, 7, 6, 2, 2, 1, 7, 4, 7, 1, 1, 0, 4, 5, 4, 0, 0, 3, 5, 6, 5, 3, 3, 2, 6]);
        geo.addMaterial('ColorMaterial', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
        geo.addStream(8, 12)
            .addChannel(bsi.ChannelName.position, bsi.ChannelType.float3)
            .setData([-0.5, -0, -0.5, 0.5, -0, -0.5, -0.5, 1, -0.5, 0.5, 1, -0.5, -0.5, 0, 0.5, 0.5, 0, 0.5, -0.5, 1, 0.5, 0.5, 1, 0.5]);
        geo.addStream(8, 12)
            .addChannel(bsi.ChannelName.normal, bsi.ChannelType.float3)
            .setData([0.57735, 0.57735, -0.57735, 0.57735, -0.57735, -0.57735, -0.57735, -0.57735, -0.57735, -0.57735, 0.57735, -0.57735, 0.57735, 0.57735, 0.57735, -0.57735, 0.57735, 0.57735, -0.57735, -0.57735, 0.57735, 0.57735, -0.57735, 0.57735]);

        let node = data.addNode('rp_box');
        node.addChild('g_box').addGeometry('g_box');

        stingray.sjson.save(filePath, data);

        let sourceData = stingray.sjson.load('D:\\builds\\stingray4\\core\\stingray_renderer\\proxy_geometry\\shadow_cutter.bsi');
        compareJson(sourceData, data, "", {logPath: true});
    }
    */

    return {
        importWad,
        wadToStingray,
        loadWad,
        openWadViewer
        // testBsiWrite,
    };
});
