define(function (require) {
    'use strict';

    const _ = require('lodash');
    const fileSystemUtils = require('common/file-system-utils');

    const NodeDefaults = {
        always_keep: false,
        culling: 'bounding_volume',
        generate_uv_unwrap: false,
        occluder: false,
        shadow_caster: true,
        surface_queries: false,
        viewport_visible: true
    };

    class Unit {
        constructor () {
            this.sections = {
                unit: {
                    renderables: {},
                    materials: {}
                }
            };
        }

        addRenderable (nodeId, nodeParams) {
            nodeParams = nodeParams || {};
            this.sections.unit.renderables[nodeId] = _.defaults(nodeParams, NodeDefaults);
        }

        addMaterial (slotName, materialName) {
            this.sections.unit.materials[slotName] = materialName;
        }

        save (baseFile) {
            baseFile = fileSystemUtils.getFilePathWithoutExtension(baseFile);
            _.forOwn(this.sections, (section, extension) => {
                stingray.sjson.save(baseFile + '.' + extension, section);
            });
        }
    }

    return Unit;
});
