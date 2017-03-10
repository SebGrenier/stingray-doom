/*global $V, stingray*/
define(function (require) {
    'use strict';

    const _ = require('lodash');
    const bsi = require('wad-importer/bsi');
    const Unit = require('wad-importer/unit');
    const Linedef = require('wad-importer/wad_format/linedef');
    const Node = require('wad-importer/wad_format/node');
    const SideDef = require('wad-importer/wad_format/sidedef');
    require('sylvester');

    function exportFace (startVertex, endVertex, floorHeight, ceilingHeight, exportInfo) {
        let {outIndices, outVertices, outNormals, outTexCoords} = exportInfo;

        let v1 = $V([startVertex.x, startVertex.y, floorHeight]);
        let v2 = $V([endVertex.x, endVertex.y, floorHeight]);
        let v3 = $V([endVertex.x, endVertex.y, ceilingHeight]);
        let v4 = $V([startVertex.x, startVertex.y, ceilingHeight]);
        let up = $V([0, 0, 1]);

        let direction = v2.subtract(v1).toUnitVector();
        let normal = direction.cross(up).toUnitVector();

        let index = outVertices.length / 3;

        // Triangle 1
        outIndices.push(index);

        outVertices.push(v1.e(1));
        outVertices.push(v1.e(2));
        outVertices.push(v1.e(3));

        outNormals.push(normal.e(1));
        outNormals.push(normal.e(2));
        outNormals.push(normal.e(3));

        outTexCoords.push(0);
        outTexCoords.push(0);
        ++index;

        outIndices.push(index);

        outVertices.push(v2.e(1));
        outVertices.push(v2.e(2));
        outVertices.push(v2.e(3));

        outNormals.push(normal.e(1));
        outNormals.push(normal.e(2));
        outNormals.push(normal.e(3));

        outTexCoords.push(0);
        outTexCoords.push(0);
        ++index;

        outIndices.push(index);

        outVertices.push(v4.e(1));
        outVertices.push(v4.e(2));
        outVertices.push(v4.e(3));

        outNormals.push(normal.e(1));
        outNormals.push(normal.e(2));
        outNormals.push(normal.e(3));

        outTexCoords.push(0);
        outTexCoords.push(0);
        ++index;

        // Triangle 2
        outIndices.push(index);

        outVertices.push(v2.e(1));
        outVertices.push(v2.e(2));
        outVertices.push(v2.e(3));

        outNormals.push(normal.e(1));
        outNormals.push(normal.e(2));
        outNormals.push(normal.e(3));

        outTexCoords.push(0);
        outTexCoords.push(0);
        ++index;

        outIndices.push(index);

        outVertices.push(v3.e(1));
        outVertices.push(v3.e(2));
        outVertices.push(v3.e(3));

        outNormals.push(normal.e(1));
        outNormals.push(normal.e(2));
        outNormals.push(normal.e(3));

        outTexCoords.push(0);
        outTexCoords.push(0);
        ++index;

        outIndices.push(index);

        outVertices.push(v4.e(1));
        outVertices.push(v4.e(2));
        outVertices.push(v4.e(3));

        outNormals.push(normal.e(1));
        outNormals.push(normal.e(2));
        outNormals.push(normal.e(3));

        outTexCoords.push(0);
        outTexCoords.push(0);
    }

    function exportFloorPatch (vert1, vert2, vert3, height, exportInfo) {
        let {outIndices, outVertices, outNormals, outTexCoords} = exportInfo;

        let v1 = $V([vert1.x, vert1.y, height]);
        let v2 = $V([vert2.x, vert2.y, height]);
        let v3 = $V([vert3.x, vert3.y, height]);
        let normal = $V([0, 0, 1]);
        let verts = [v1, v2, v3];

        let index = outVertices.length / 3;

        for (let i = 0; i < 3; ++i) {
            outIndices.push(index);

            outVertices.push(verts[i].e(1));
            outVertices.push(verts[i].e(2));
            outVertices.push(verts[i].e(3));

            outNormals.push(normal.e(1));
            outNormals.push(normal.e(2));
            outNormals.push(normal.e(3));

            outTexCoords.push(0);
            outTexCoords.push(0);

            ++index;
        }
    }

    function exportCeilingPatch (vert1, vert2, vert3, height, exportInfo) {
        let {outIndices, outVertices, outNormals, outTexCoords} = exportInfo;

        let v1 = $V([vert1.x, vert1.y, height]);
        let v2 = $V([vert2.x, vert2.y, height]);
        let v3 = $V([vert3.x, vert3.y, height]);
        let normal = $V([0, 0, -1]);
        let verts = [v1, v2, v3];

        let index = outVertices.length / 3;

        for (let i = 0; i < 3; ++i) {
            outIndices.push(index);

            outVertices.push(verts[i].e(1));
            outVertices.push(verts[i].e(2));
            outVertices.push(verts[i].e(3));

            outNormals.push(normal.e(1));
            outNormals.push(normal.e(2));
            outNormals.push(normal.e(3));

            outTexCoords.push(0);
            outTexCoords.push(0);

            ++index;
        }
    }

    function exportWall (wallInfo) {
        let {startV: startVertex,
            endV: endVertex,
            linedef: linedef,
            frontDef: frontDef,
            backDef: backDef,
            frontSector: frontSector,
            backSector: backSector,
            //map: map,
            wadData: wadData,
            outIndices: outIndices,
            outVertices: outVertices,
            outNormals: outNormals,
            outTexCoords: outTexCoords} = wallInfo;

        if (_.every([frontDef.upperTexture, frontDef.lowerTexture, frontDef.middleTexture], tex => { return tex === '-'; }))
            return;

        let ceilingHeight = frontSector.ceillingHeight;
        let floorHeight = frontSector.floorHeight;
        let height = Math.abs(ceilingHeight - floorHeight);
        let hasSkyBox = false;
        if (backDef) {
            if (frontSector.ceillingTexture.indexOf('SKY') !== -1 && frontSector.ceillingTexture.indexOf('SKY') !== -1) {
                hasSkyBox = true;
            }
        }

        // Wall is one block
        if (!backDef && frontDef.middleTexture !== SideDef.NO_TEXTURE) {
            let midTexture = wadData.textures[frontDef.middleTexture];

            if (height > (midTexture.height - frontDef.yOffset)) {
                let bottomHeight = ceilingHeight - (midTexture.height - frontDef.yOffset);
                exportFace(startVertex, endVertex, bottomHeight, ceilingHeight, {outIndices, outVertices, outNormals, outTexCoords});
            } else {
                exportFace(startVertex, endVertex, floorHeight, ceilingHeight, {outIndices, outVertices, outNormals, outTexCoords});
            }
        } else {
            // Wall is defined by multiple blocks
            if (frontDef.lowerTexture !== SideDef.NO_TEXTURE) {
                let texture = wadData.textures[frontDef.lowerTexture];
                if (backDef) {
                    ceilingHeight = backSector.floorHeight;
                    height = Math.abs(ceilingHeight - floorHeight);
                }

                if (backDef && linedef.dontPegBottom && height < texture.height) {
                    exportFace(startVertex, endVertex, floorHeight, ceilingHeight, {outIndices, outVertices, outNormals, outTexCoords});
                } else if (height > (texture.height - frontDef.yOffset)) {
                    let bottomHeight = ceilingHeight - texture.height;
                    exportFace(startVertex, endVertex, bottomHeight, ceilingHeight, {outIndices, outVertices, outNormals, outTexCoords});
                } else {
                    exportFace(startVertex, endVertex, floorHeight, ceilingHeight, {outIndices, outVertices, outNormals, outTexCoords});
                }
            }

            if (frontDef.middleTexture !== SideDef.NO_TEXTURE) {
                //let texture = wadData.textures[frontDef.middleTexture];
                if (backDef) {
                    ceilingHeight = backSector.ceillingHeight;
                    floorHeight = backSector.floorHeight;
                    height = Math.abs(ceilingHeight - floorHeight);
                }

                exportFace(startVertex, endVertex, floorHeight, ceilingHeight, {outIndices, outVertices, outNormals, outTexCoords});
            }

            if (frontDef.upperTexture !== SideDef.NO_TEXTURE) {
                if (!hasSkyBox) {
                    let texture = wadData.textures[frontDef.upperTexture];
                    if (backDef) {
                        floorHeight = backSector.ceillingHeight;
                        height = Math.abs(ceilingHeight - floorHeight);
                    }

                    if (backDef && !linedef.dontPegTop && height > (texture.height - frontDef.yOffset)) {
                        let bottomHeight = ceilingHeight - texture.height;
                        exportFace(startVertex, endVertex, bottomHeight, ceilingHeight, {outIndices, outVertices, outNormals, outTexCoords});
                    } else if (height > (texture.height - frontDef.yOffset)) {
                        let bottomHeight = ceilingHeight - (texture.height - frontDef.yOffset);
                        exportFace(startVertex, endVertex, bottomHeight, ceilingHeight, {outIndices, outVertices, outNormals, outTexCoords});
                    } else {
                        exportFace(startVertex, endVertex, floorHeight, ceilingHeight, {outIndices, outVertices, outNormals, outTexCoords});
                    }
                }
            }
        }
    }

    function exportSubSector (subSector, map, wadData, outIndices, outVertices, outNormals, outTexCoords) {
        let center = getMapCenter(map);
        let offset = subSector.firstSeg;
        let lines = []; // Used for building floors and ceilings
        let floor = 0;
        let ceilling = 0;
        let ceillingTex = '-';
        for (let i = 0; i < subSector.numSegs; ++i) {
            let seg = map.segs[offset + i];
            lines.push(seg);
            let startV = subVertex(map.vertexes[seg.startVertex], center);
            let endV = subVertex(map.vertexes[seg.endVertex], center);

            if (seg.linedefRef >= map.linedefs.length)
                continue;

            let linedef = map.linedefs[seg.linedefRef];
            if (!linedef)
                continue;

            if (seg.direction === 0) {
                if (linedef.rightSidedef !== Linedef.NO_SIDEDEF) {
                    let frontDef = map.sidedefs[linedef.rightSidedef];
                    let backDef = linedef.leftSidedef !== Linedef.NO_SIDEDEF ? map.sidedefs[linedef.leftSidedef] : null;
                    let frontSector = map.sectors[frontDef.sectorRef];
                    floor = frontSector.floorHeight;
                    ceilling = frontSector.ceillingHeight;
                    ceillingTex = frontSector.ceillingTexture;
                    let backSector = backDef !== null ? map.sectors[backDef.sectorRef] : null;
                    exportWall({startV, endV, linedef, frontDef, backDef, frontSector, backSector, map, wadData, outIndices, outVertices, outNormals, outTexCoords});
                }
            } else {
                if (linedef.leftSidedef !== Linedef.NO_SIDEDEF) {
                    let frontDef = map.sidedefs[linedef.leftSidedef];
                    let backDef = linedef.rightSidedef !== Linedef.NO_SIDEDEF ? map.sidedefs[linedef.rightSidedef] : null;
                    let frontSector = map.sectors[frontDef.sectorRef];
                    floor = frontSector.floorHeight;
                    ceilling = frontSector.ceillingHeight;
                    ceillingTex = frontSector.ceillingTexture;
                    let backSector = backDef !== null ? map.sectors[backDef.sectorRef] : null;
                    exportWall({startV, endV, linedef, frontDef, backDef, frontSector, backSector, map, wadData, outIndices, outVertices, outNormals, outTexCoords});
                }
            }
        }

        // Build floor
        let sv = 0;
        let nv = 1;
        let itr = false;
        let ev = lines.length - 1;
        let tris = lines.length - 2;
        if (tris < 1)
            return;

        let v1 = subVertex(map.vertexes[lines[sv].startVertex], center);
        let v2 = subVertex(map.vertexes[lines[ev].startVertex], center);
        let v3 = subVertex(map.vertexes[lines[nv].startVertex], center);
        exportFloorPatch(v1, v2, v3, floor, {outIndices, outVertices, outNormals, outTexCoords});
        --tris;

        while (tris--) {
            if (itr) {
                sv=nv;
                nv++;
            } else {
                sv=ev;
                ev--;
            }
            let v1 = subVertex(map.vertexes[lines[sv].startVertex], center);
            let v2 = subVertex(map.vertexes[lines[ev].startVertex], center);
            let v3 = subVertex(map.vertexes[lines[nv].startVertex], center);

            exportFloorPatch(v1, v2, v3, floor, {outIndices, outVertices, outNormals, outTexCoords});
            itr=!itr;
        }

        // Build ceiling
        if (ceillingTex.indexOf('SKY') !== -1)
            return;

        sv = 0;
        nv = 1;
        itr = true;
        ev = lines.length-1;
        tris = lines.length-2;
        v1 = subVertex(map.vertexes[lines[sv].startVertex], center);
        v2 = subVertex(map.vertexes[lines[nv].startVertex], center);
        v3 = subVertex(map.vertexes[lines[ev].startVertex], center);
        exportCeilingPatch(v1, v2, v3, ceilling, {outIndices, outVertices, outNormals, outTexCoords});
        --tris;

        while(tris--){
            if(itr){
                sv=nv;
                nv++;
            } else {
                sv=ev;
                ev--;
            }
            v1 = subVertex(map.vertexes[lines[sv].startVertex], center);
            v2 = subVertex(map.vertexes[lines[nv].startVertex], center);
            v3 = subVertex(map.vertexes[lines[ev].startVertex], center);
            exportCeilingPatch(v1, v2, v3, ceilling, {outIndices, outVertices, outNormals, outTexCoords});
            itr=!itr;
        }
    }

    function getMapBB (map)  {
        let minX = 32767;
        let minY = 32767;
        let maxX = -32767;
        let maxY = -32767;

        for (let vertex of map.vertexes) {
            minX = Math.min(minX, vertex.x);
            minY = Math.min(minY, vertex.y);
            maxX = Math.max(maxX, vertex.x);
            maxY = Math.max(maxY, vertex.y);
        }

        return {
            minX, maxX, minY, maxY
        };
    }

    function getMapCenter (map)  {
        let totalX = 0;
        let totalY = 0;
        for (let vertex of map.vertexes) {
            totalX += vertex.x;
            totalY += vertex.y;
        }
        return {
            x: totalX / map.vertexes.length,
            y: totalY / map.vertexes.length
        };
    }

    function subVertex(v1, v2) {
        return {
            x: v1.x - v2.x,
            y: v1.y - v2.y
        };
    }

    function exportMap (map, wadData, basePath) {
        let unit = new Unit();
        unit.addRenderable('default');
        unit.addMaterial('default', 'content/materials/grey');

        let mesh = new bsi.Bsi();
        mesh.addNode('root')
            .addChild('default')
                .addGeometry('default');

        let geo = mesh.addGeometry('default');

        let vertices = [];
        let indices = [];
        let normals = [];
        let texCoords = [];

        for (let node of map.nodes) {
            if (Node.isChildSubSector(node.rightChild)) {
                exportSubSector(map.ssectors[Node.childToIndex(node.rightChild)], map, wadData, indices, vertices, normals, texCoords);
            }
            if (Node.isChildSubSector(node.leftChild)) {
                exportSubSector(map.ssectors[Node.childToIndex(node.leftChild)], map, wadData, indices, vertices, normals, texCoords);
            }
        }

        geo.addMaterial('default', Array.apply(null, {length: indices.length / 3}).map(Number.call, Number));
        geo.setIndices(indices.length)
            .addStream(indices)
            .addStream(indices)
            .addStream(indices);
        geo.addStream(vertices.length / 3, 12)
            .addChannel(bsi.ChannelName.position, bsi.ChannelType.float3)
            .setData(vertices);
        geo.addStream(normals.length / 3, 12)
            .addChannel(bsi.ChannelName.normal, bsi.ChannelType.float3)
            .setData(normals);
        geo.addStream(texCoords.length / 2, 8)
            .addChannel(bsi.ChannelName.texcoord, bsi.ChannelType.float2)
            .setData(texCoords);

        stingray.sjson.save(basePath + '.bsi', mesh);
        unit.save(basePath);
    }

    function wadToStingray (wadData, basePath) {
        console.log('ping');
        exportMap(wadData.maps[0], wadData, basePath);
    }

    return {
        exportMap,
        getMapBB,
        getMapCenter,
        wadToStingray
    };
});
