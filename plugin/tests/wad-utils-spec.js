/* jshint jasmine: true */
/* global it, expect */
describe('WAD Importer: Utils', [
    'common/math-utils',
    'wad-importer/utils',
    'wad-importer/wad_format/map',
    'wad-importer/wad_format/vertex',
    'wad-importer/wad_format/segment'
], function(mathUtils, utils, Map, Vertex, Segment) {
    'use strict';

    let map = new Map();

    function initData () {
        for (let y = 1; y >= -1; y -= 2) {
            for (let x = -1; x <= 1; x += 2) {
                map.addVertex(x, y);
            }
        }

        for (let i = 0; i < 4; ++i) {
            let s = new Segment();
            s.startVertex = i;
            s.endVertex = (i + 1) % 4;
            map.segs.push(s);
        }
    }
    initData();

    describe('Utils', function () {
        it('is defined', function () {
            expect(utils).toBeDefined();
        });
    });

    describe('swap', function () {
        it('swaps correctly', function () {
            let a = 'val1';
            let b = ['someOtherVal'];

            let [newA, newB] = utils.swap(a, b);

            expect(newA).toEqual(b);
            expect(newB).toEqual(a);
        });
    });

    describe('add', function () {
        it('adds correctly', function () {
            let a = [1, 2, 3, 4];
            let b = [5, 6, 7, 8];
            let c = [6, 8, 10, 12];

            let test = utils.add(a, b);

            for (let i = 0; i < c.length; ++i) {
                expect(test[i]).toEqual(c[i]);
            }
        });
    });

    describe('sub', function () {
        it('subtracts correctly', function () {
            let a = [1, 2, 3, 4];
            let b = [5, 6, 7, 8];
            let c = [-4, -4, -4, -4];

            let test = utils.sub(a, b);

            for (let i = 0; i < c.length; ++i) {
                expect(test[i]).toEqual(c[i]);
            }
        });
    });

    describe('mult', function () {
        it('multiplies correctly', function () {
            let a = [1, 2, 3, 4];
            let b = 3;
            let c = [3, 6, 9, 12];

            let test = utils.mult(a, b);

            for (let i = 0; i < c.length; ++i) {
                expect(test[i]).toEqual(c[i]);
            }
        });
    });

    describe('dot', function () {
        it('works correctly', function () {
            let a = [1, 2, 3, 4];
            let b = [5, 6, 7, 8];
            let c = 5 + 12 + 21 + 32;

            let test = utils.dot(a, b);

            expect(test).toEqual(c);
        });
    });

    describe('length', function () {
        it('works correctly', function () {
            let a = [1, 2, 3, 4];
            let length = Math.sqrt(1 + 4 + 9 + 16);

            let test = utils.length(a);

            expect(test).toEqual(length);
        });
    });

    describe('distanceBetweenVertex', function () {
        it('works correctly', function () {
            let v1 = {x: 1, y: 1};
            let v2 = {x: 1, y: 2};
            let distance = 1;

            let test = utils.distanceBetweenVertex(v1, v2);

            expect(test).toEqual(distance);
        });
    });

    describe('convertNodeBBToAABB', function () {
        it('works correctly', function () {
            let bb = {
                left: -1,
                right: 3,
                bottom: -2,
                top: 2
            };

            let test = utils.convertNodeBBToAABB(bb);

            expect(test.center).toEqual({x: 1, y: 0});
            expect(test.extent).toEqual({x: 2, y: 2});
            expect(test.min).toEqual([-1, -2]);
            expect(test.max).toEqual([3, 2]);
        });
        it('grows correctly', function () {
            let bb = {
                left: -1,
                right: 3,
                bottom: -2,
                top: 2
            };

            let test = utils.convertNodeBBToAABB(bb);
            test.grow(2);

            expect(test.center).toEqual({x: 1, y: 0});
            expect(test.extent).toEqual({x: 4, y: 4});
            expect(test.min).toEqual([-3, -4]);
            expect(test.max).toEqual([5, 4]);
        });
    });

    describe('convertPartitionLineToRay', function () {
        it('works correctly', function () {
            let start = {x: 1, y: 1};
            let changes = {x: 0, y: 2};

            let test = utils.convertPartitionLineToRay(start, changes);

            expect(test.point).toEqual([start.x, start.y]);
            expect(test.dir).toEqual([changes.x, changes.y]);
        });
    });

    describe('intersectRayAABB', function () {
        describe('finite segment', function () {
            it('intersects two points crossing ray correctly', function () {
                let bb = {
                    left: 1,
                    right: 2,
                    bottom: 1,
                    top: 2
                };
                let aabb = utils.convertNodeBBToAABB(bb);

                let start = {x: 0.5, y: 1.5};
                let changes = {x: 2, y: 0};
                let ray = utils.convertPartitionLineToRay(start, changes);

                let intersections = utils.intersectRayAABB(ray.point, ray.dir, aabb, 0, 1);

                expect(intersections).toBeDefined();
                expect(intersections.length).toEqual(2);
                expect(intersections[0]).toEqual({x: 1, y: 1.5});
                expect(intersections[1]).toEqual({x: 2, y: 1.5});
            });
            it('intersects one points crossing ray correctly', function () {
                let bb = {
                    left: 1,
                    right: 2,
                    bottom: 1,
                    top: 2
                };
                let aabb = utils.convertNodeBBToAABB(bb);

                let start = {x: 0.5, y: 1.5};
                let changes = {x: 1, y: -1};
                let ray = utils.convertPartitionLineToRay(start, changes);

                let intersections = utils.intersectRayAABB(ray.point, ray.dir, aabb, 0, 1);

                expect(intersections).toBeDefined();
                expect(intersections.length).toEqual(1);
                expect(intersections[0]).toEqual({x: 1, y: 1});
            });
            it('intersects parallel crossing ray correctly', function () {
                let bb = {
                    left: 1,
                    right: 2,
                    bottom: 1,
                    top: 2
                };
                let aabb = utils.convertNodeBBToAABB(bb);

                let start = {x: 0.5, y: 1};
                let changes = {x: 1, y: 0};
                let ray = utils.convertPartitionLineToRay(start, changes);

                let intersections = utils.intersectRayAABB(ray.point, ray.dir, aabb, 0, 1);

                expect(intersections).toBeDefined();
                expect(intersections.length).toEqual(2);
                expect(intersections[0]).toEqual({x: 1, y: 1});
                expect(intersections[1]).toEqual({x: 1.5, y: 1});
            });
        });
        describe('infinite segment', function () {
            it('intersects two points crossing ray correctly', function () {
                let bb = {
                    left: 1,
                    right: 2,
                    bottom: 1,
                    top: 2
                };
                let aabb = utils.convertNodeBBToAABB(bb);

                let start = {x: 0.5, y: 1.5};
                let changes = {x: 2, y: 0};
                let ray = utils.convertPartitionLineToRay(start, changes);

                let intersections = utils.intersectRayAABB(ray.point, ray.dir, aabb, mathUtils.min32Bits, mathUtils.max32Bits);

                expect(intersections).toBeDefined();
                expect(intersections.length).toEqual(2);
                expect(intersections[0]).toEqual({x: 1, y: 1.5});
                expect(intersections[1]).toEqual({x: 2, y: 1.5});
            });
            it('intersects one points crossing ray correctly', function () {
                let bb = {
                    left: 1,
                    right: 2,
                    bottom: 1,
                    top: 2
                };
                let aabb = utils.convertNodeBBToAABB(bb);

                let start = {x: 0.5, y: 1.5};
                let changes = {x: 1, y: -1};
                let ray = utils.convertPartitionLineToRay(start, changes);

                let intersections = utils.intersectRayAABB(ray.point, ray.dir, aabb, mathUtils.min32Bits, mathUtils.max32Bits);

                expect(intersections).toBeDefined();
                expect(intersections.length).toEqual(1);
                expect(intersections[0]).toEqual({x: 1, y: 1});
            });
            it('intersects parallel crossing ray correctly', function () {
                let bb = {
                    left: 1,
                    right: 2,
                    bottom: 1,
                    top: 2
                };
                let aabb = utils.convertNodeBBToAABB(bb);

                let start = {x: 0.5, y: 1};
                let changes = {x: 1, y: 0};
                let ray = utils.convertPartitionLineToRay(start, changes);

                let intersections = utils.intersectRayAABB(ray.point, ray.dir, aabb, mathUtils.min32Bits, mathUtils.max32Bits);

                expect(intersections).toBeDefined();
                expect(intersections.length).toEqual(2);
                expect(intersections[0]).toEqual({x: 1, y: 1});
                expect(intersections[1]).toEqual({x: 2, y: 1});
            });
        });
    });

    describe('pointIsInsideAABB', function () {
        it('works correctly', function () {
            let bb = {
                left: -1,
                right: 3,
                bottom: -2,
                top: 2
            };
            let aabb = utils.convertNodeBBToAABB(bb);
            let p1 = [2, 0];
            let p2 = [-1, -2];
            let p3 = [4, 5];

            expect(utils.pointIsInsideAABB(p1, aabb)).toBeTruthy();
            expect(utils.pointIsInsideAABB(p2, aabb)).toBeTruthy();
            expect(utils.pointIsInsideAABB(p3, aabb)).toBeFalsy();
        });
    });

    describe('getVerticesInsideAABB', function () {
        it('works correctly', function () {
            let bb = {
                left: -1,
                right: 3,
                bottom: 0,
                top: 2
            };
            let aabb = utils.convertNodeBBToAABB(bb);

            let vertices = utils.getVerticesInsideAABB(map, aabb);

            expect(vertices).toBeDefined();
            expect(vertices.length).toEqual(2);
            expect(vertices[0]).toEqual(map.vertexes[0]);
            expect(vertices[1]).toEqual(map.vertexes[1]);
        });
    });

    describe('getSegmentInsideAABB', function () {
        it('works correctly', function () {
            let bb = {
                left: -1,
                right: 3,
                bottom: 0,
                top: 2
            };
            let aabb = utils.convertNodeBBToAABB(bb);

            let segs = utils.getSegmentInsideAABB(map, map.segs, aabb);

            expect(segs).toBeDefined();
            expect(segs.length).toEqual(3);
            expect(segs[0]).toEqual(map.segs[0]);
            expect(segs[1]).toEqual(map.segs[1]);
            expect(segs[2]).toEqual(map.segs[3]);
        });
    });

    describe('squaredDistancePointToSegment', function () {
        it('works correctly', function () {
            let a = [0, 0];
            let b = [2, 2];
            let c1 = [1, 1];
            let c2 = [2, 2];
            let c3 = [2, 3];

            expect(utils.squaredDistancePointToSegment(a, b, c1)).toEqual(0);
            expect(utils.squaredDistancePointToSegment(a, b, c2)).toEqual(0);
            expect(utils.squaredDistancePointToSegment(a, b, c3)).toEqual(1);
        });
    });

    describe('pointDistanceToSegment', function () {
        it('works correctly', function () {
            let a = [0, 0];
            let b = [2, 2];
            let c1 = [1, 1];
            let c2 = [2, 2];
            let c3 = [2, 3];

            expect(utils.pointDistanceToSegment(a, b, c1)).toEqual(0);
            expect(utils.pointDistanceToSegment(a, b, c2)).toEqual(0);
            expect(utils.pointDistanceToSegment(a, b, c3)).toEqual(1);
        });
    });
});
