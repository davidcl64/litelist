var ViewBuffer = require('../src/viewbuffer');

describe("ViewBuffer", function() {
    var data;
    var buf;

    beforeEach(function () {
        data = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        buf = new ViewBuffer(data, 3);

        expect(buf.head).to.equal(0);
        expect(buf.tail).to.equal(2);
        expect(buf.data.length).to.equal(data.length);
        expect(buf.view.length).to.equal(3);
        expect(buf.size).to.equal(3);
    });

    function mapIdx(view) {
        "use strict";
        return view.map(function (val) {
            return val.idx;
        });
    }

    function mapData(view) {
        "use strict";
        return view.map(function (val) {
            return val.data;
        });
    }

    describe("initialization", function () {
        it("should construct a view buffer with no data", function () {
            var buf = new ViewBuffer();

            expect(buf.tail).to.equal(-1);
            expect(buf.head).to.equal(-1);
            expect(buf.data.length).to.equal(0);
            expect(buf.view.length).to.equal(0);
        });

        it("should construct a view buffer with data only", function () {
            var buf = new ViewBuffer(data);

            expect(buf.tail).to.equal(-1);
            expect(buf.head).to.equal(-1);
            expect(buf.data.length).to.equal(data.length);
            expect(buf.view.length).to.equal(0);
        });

        it("should construct a view buffer with data and initial size", function () {
            var buf = new ViewBuffer(data, data.length);

            expect(buf.head).to.equal(0);
            expect(buf.tail).to.equal(data.length - 1);
            expect(buf.data.length).to.equal(data.length);
            expect(buf.view.length).to.equal(data.length);
            expect(buf.size).to.equal(buf.view.length);

            buf.view.forEach(function (viewItem, idx) {
                expect(viewItem.idx).to.equal(idx);
                expect(viewItem.data).to.equal(data[idx]);
            });
        });
    });

    describe("clear()", function () {
        it("should reset to empty after calling clear", function () {
            var buf2 = new ViewBuffer();

            buf.clear();

            expect(buf).to.deep.equal(buf2);
        });

    });

    describe("shift()", function () {
        it("should shift toward the end when at beginning of data", function () {
            var result = buf.shift();
            expect(mapData(buf.view)).to.deep.equal([3, 1, 2]);

            expect(result.length).to.equal(1);
            expect(mapData(result)).to.deep.equal([3]);
            expect(mapIdx(result)).to.deep.equal([3]);
        });

        it("should shift toward the end two places", function () {
            var result = buf.shift(2);
            expect(mapData(buf.view)).to.deep.equal([3, 4, 2]);
            expect(mapIdx(buf.view)).to.deep.equal([3, 4, 2]);

            expect(result.length).to.equal(2);
            expect(mapData(result)).to.deep.equal([3, 4]);
            expect(mapIdx(result)).to.deep.equal([3, 4]);
        });

        it("should not shift off the end of data", function () {
            var result = buf.shift(10);

            expect(mapData(buf.view)).to.deep.equal([9, 7, 8]);
            expect(mapIdx(buf.view)).to.deep.equal([9, 7, 8]);

            expect(result.length).to.equal(3);
            expect(mapData(result)).to.deep.equal([7, 8, 9]);
            expect(mapIdx(result)).to.deep.equal([7, 8, 9]);
        });

        it("should not shift toward the front when at beginning of data", function () {
            var result = buf.shift(-1);
            expect(mapData(buf.view)).to.deep.equal([0, 1, 2]);
            expect(mapIdx(buf.view)).to.deep.equal([0, 1, 2]);

            expect(result.length).to.equal(0);
        });

        it("should shift to front after shift toward end", function () {
            buf.shift(2);

            var result = buf.shift(-2);

            expect(mapData(buf.view)).to.deep.equal([0, 1, 2]);
            expect(mapIdx(buf.view)).to.deep.equal([0, 1, 2]);

            expect(result.length).to.equal(2);
            expect(mapData(result)).to.deep.equal([1, 0]);
            expect(mapIdx(result)).to.deep.equal([1, 0]);
        });

        it("should shift to front 10x after shift to end 10x", function () {
            buf.shift(10);
            var result = buf.shift(-10);

            expect(mapData(buf.view)).to.deep.equal([0, 1, 2]);
            expect(mapIdx(buf.view)).to.deep.equal([0, 1, 2]);

            expect(result.length).to.equal(3);
            expect(mapData(result)).to.deep.equal([2, 1, 0]);
            expect(mapIdx(result)).to.deep.equal([2, 1, 0]);
        });
    });

    describe("resize()", function () {
        describe("grow from tail when head is 0", function () {
            it("should grow the view by 1 from the tail", function () {
                var result = buf.resize(buf.size + 1);

                expect(mapData(buf.view)).to.deep.equal([0, 1, 2, 3]);
                expect(mapIdx(buf.view)).to.deep.equal([0, 1, 2, 3]);

                expect(buf.head).to.equal(0);
                expect(buf.tail).to.equal(3);
                expect(buf.size).to.equal(4);

                expect(result.length).to.equal(1);
                expect(mapData(result)).to.deep.equal([3]);
                expect(mapIdx(result)).to.deep.equal([3]);
            });

            it("should grow the view by 2 from the tail", function () {
                var result = buf.resize(buf.size + 2);

                expect(mapData(buf.view)).to.deep.equal([0, 1, 2, 3, 4]);
                expect(mapIdx(buf.view)).to.deep.equal([0, 1, 2, 3, 4]);

                expect(buf.head).to.equal(0);
                expect(buf.tail).to.equal(4);
                expect(buf.size).to.equal(5);

                expect(result.length).to.equal(2);
                expect(mapData(result)).to.deep.equal([3, 4]);
                expect(mapIdx(result)).to.deep.equal([3, 4]);
            });

            it("should grow the view to a max of data.length from the tail", function () {
                var result = buf.resize(buf.data.length);

                expect(mapData(buf.view)).to.deep.equal([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
                expect(mapIdx(buf.view)).to.deep.equal([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

                expect(buf.head).to.equal(0);
                expect(buf.tail).to.equal(9);
                expect(buf.size).to.equal(10);

                expect(result.length).to.equal(7);
                expect(mapData(result)).to.deep.equal([3, 4, 5, 6, 7, 8, 9]);
                expect(mapIdx(result)).to.deep.equal([3, 4, 5, 6, 7, 8, 9]);
            });

            it("should grow the view by 1 from the tail when head is true but unshifted", function () {
                var result = buf.resize(buf.size + 1, true);

                expect(mapData(buf.view)).to.deep.equal([0, 1, 2, 3]);
                expect(mapIdx(buf.view)).to.deep.equal([0, 1, 2, 3]);

                expect(buf.head).to.equal(0);
                expect(buf.tail).to.equal(3);
                expect(buf.size).to.equal(4);

                expect(result.length).to.equal(1);
                expect(mapData(result)).to.deep.equal([3]);
                expect(mapIdx(result)).to.deep.equal([3]);
            });

            it("should grow the view by 1 from the head", function () {
                buf.shift(3);  //[3,4,5]
                expect(buf.head).to.equal(0);

                var result = buf.resize(buf.size + 1, true);

                expect(mapData(buf.view)).to.deep.equal([2, 3, 4, 5]);
                expect(mapIdx(buf.view)).to.deep.equal([2, 3, 4, 5]);

                expect(buf.head).to.equal(0);
                expect(buf.tail).to.equal(3);
                expect(buf.size).to.equal(4);

                expect(result.length).to.equal(1);
                expect(mapData(result)).to.deep.equal([2]);
                expect(mapIdx(result)).to.deep.equal([2]);
            });

            it("should grow the view by 2 from the head", function () {
                buf.shift(3);
                expect(buf.head).to.equal(0);

                var result = buf.resize(buf.size + 2, true);

                expect(mapData(buf.view)).to.deep.equal([1, 2, 3, 4, 5]);
                expect(mapIdx(buf.view)).to.deep.equal([1, 2, 3, 4, 5]);

                expect(buf.head).to.equal(0);
                expect(buf.tail).to.equal(4);
                expect(buf.size).to.equal(5);

                expect(result.length).to.equal(2);
                expect(mapData(result)).to.deep.equal([2, 1]);
                expect(mapIdx(result)).to.deep.equal([2, 1]);
            });

            it("should grow the view to a max of data.length from the head then tail", function () {
                buf.shift(3);
                expect(buf.head).to.equal(0);

                var result = buf.resize(buf.data.length, true);

                expect(mapData(buf.view)).to.deep.equal([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
                expect(mapIdx(buf.view)).to.deep.equal([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

                expect(buf.head).to.equal(0);
                expect(buf.tail).to.equal(9);
                expect(buf.size).to.equal(10);

                expect(result.length).to.equal(7);
                expect(mapData(result)).to.deep.equal([2, 1, 0, 6, 7, 8, 9]);
                expect(mapIdx(result)).to.deep.equal([2, 1, 0, 6, 7, 8, 9]);
            });

            it("should throw an error when growing more than data.length", function () {
                var err;
                try {
                    buf.resize(buf.data.length + 1);
                } catch (e) {
                    err = e;
                }

                expect(err).to.exist;
            });
        });

        // Tail is now zero
        describe("grow from tail when head is 1", function () {
            beforeEach(function () {
                buf.shift(1);
                expect(mapData(buf.view)).to.deep.equal([3, 1, 2]);
                expect(mapIdx(buf.view)).to.deep.equal([3, 1, 2]);
            });

            it("should grow the view by 1 from the tail", function () {
                var result = buf.resize(buf.size + 1);
                expect(mapData(buf.view)).to.deep.equal([3, 4, 1, 2]);
                expect(mapIdx(buf.view)).to.deep.equal([3, 4, 1, 2]);

                expect(result.length).to.equal(1);
                expect(mapData(result)).to.deep.equal([4]);
                expect(mapIdx(result)).to.deep.equal([4]);

                expect(buf.head).to.equal(2);
                expect(buf.tail).to.equal(1);
                expect(buf.size).to.equal(4);
            });

            it("should grow the view by 2 from the tail", function () {
                var result = buf.resize(buf.size + 2);
                expect(mapData(buf.view)).to.deep.equal([3, 4, 5, 1, 2]);
                expect(mapIdx(buf.view)).to.deep.equal([3, 4, 5, 1, 2]);

                expect(buf.head).to.equal(3);
                expect(buf.tail).to.equal(2);
                expect(buf.size).to.equal(5);

                expect(result.length).to.equal(2);
                expect(mapData(result)).to.deep.equal([4, 5]);
                expect(mapIdx(result)).to.deep.equal([4, 5]);
            });

            it("should grow the view to a max of data.length from the tail then head", function () {
                var result = buf.resize(buf.data.length);
                expect(mapData(buf.view)).to.deep.equal([3, 4, 5, 6, 7, 8, 9, 0, 1, 2]);
                expect(mapIdx(buf.view)).to.deep.equal([3, 4, 5, 6, 7, 8, 9, 0, 1, 2]);

                expect(buf.head).to.equal(7);
                expect(buf.tail).to.equal(6);
                expect(buf.size).to.equal(10);

                expect(result.length).to.equal(7);
                expect(mapData(result)).to.deep.equal([4, 5, 6, 7, 8, 9, 0]);
                expect(mapIdx(result)).to.deep.equal([4, 5, 6, 7, 8, 9, 0]);
            });

            // [3,1,2]
            it("should grow the view by 1 from the head", function () {
                var result = buf.resize(buf.size + 1, true);
                expect(mapData(buf.view)).to.deep.equal([3, 0, 1, 2]);
                expect(mapIdx(buf.view)).to.deep.equal([3, 0, 1, 2]);

                expect(result.length).to.equal(1);
                expect(mapData(result)).to.deep.equal([0]);
                expect(mapIdx(result)).to.deep.equal([0]);

                expect(buf.head).to.equal(1);
                expect(buf.tail).to.equal(0);
                expect(buf.size).to.equal(4);
            });

            it("should grow the view by 2 from the head", function () {
                var result = buf.resize(buf.size + 2, true);
                expect(mapData(buf.view)).to.deep.equal([3, 4, 0, 1, 2]);
                expect(mapIdx(buf.view)).to.deep.equal([3, 4, 0, 1, 2]);

                expect(result.length).to.equal(2);
                expect(mapData(result)).to.deep.equal([0, 4]);
                expect(mapIdx(result)).to.deep.equal([0, 4]);

                expect(buf.head).to.equal(2);
                expect(buf.tail).to.equal(1);
                expect(buf.size).to.equal(5);
            });

            it("should grow the view to a max of data.length from the head then tail", function () {
                var result = buf.resize(buf.data.length, true);
                expect(mapData(buf.view)).to.deep.equal([3, 4, 5, 6, 7, 8, 9, 0, 1, 2]);
                expect(mapIdx(buf.view)).to.deep.equal([3, 4, 5, 6, 7, 8, 9, 0, 1, 2]);

                expect(buf.head).to.equal(7);
                expect(buf.tail).to.equal(6);
                expect(buf.size).to.equal(10);

                expect(result.length).to.equal(7);
                expect(mapData(result)).to.deep.equal([0, 4, 5, 6, 7, 8, 9]);
                expect(mapIdx(result)).to.deep.equal([0, 4, 5, 6, 7, 8, 9]);
            });
        });

        // Tail is now 1
        describe("grow from tail when head is 2", function () {
            beforeEach(function () {
                buf.shift(2);
                expect(buf.head).to.equal(2);
                expect(mapData(buf.view)).to.deep.equal([3, 4, 2]);
                expect(mapIdx(buf.view)).to.deep.equal([3, 4, 2]);
            });

            it("should grow the view by 1 from the tail", function () {
                var result = buf.resize(buf.size + 1);
                expect(mapData(buf.view)).to.deep.equal([3, 4, 5, 2]);
                expect(mapIdx(buf.view)).to.deep.equal([3, 4, 5, 2]);
                expect(mapData(result)).to.deep.equal([5]);
                expect(mapIdx(result)).to.deep.equal([5]);

                expect(buf.head).to.equal(3);
                expect(buf.tail).to.equal(2);
                expect(buf.size).to.equal(4);
            });

            it("should grow the view by 2 from the tail", function () {
                var result = buf.resize(buf.size + 2);
                expect(mapData(buf.view)).to.deep.equal([3, 4, 5, 6, 2]);
                expect(mapIdx(buf.view)).to.deep.equal([3, 4, 5, 6, 2]);

                expect(buf.head).to.equal(4);
                expect(buf.tail).to.equal(3);
                expect(buf.size).to.equal(5);

                expect(result.length).to.equal(2);
                expect(mapData(result)).to.deep.equal([5, 6]);
                expect(mapIdx(result)).to.deep.equal([5, 6]);
            });

            it("should grow the view to a max of data.length from the tail then head", function () {
                var result = buf.resize(buf.data.length);
                expect(mapData(buf.view)).to.deep.equal([3, 4, 5, 6, 7, 8, 9, 0, 1, 2]);
                expect(mapIdx(buf.view)).to.deep.equal([3, 4, 5, 6, 7, 8, 9, 0, 1, 2]);

                expect(buf.head).to.equal(7);
                expect(buf.tail).to.equal(6);
                expect(buf.size).to.equal(10);

                expect(result.length).to.equal(7);
                expect(mapData(result)).to.deep.equal([5, 6, 7, 8, 9, 1, 0]);
                expect(mapIdx(result)).to.deep.equal([5, 6, 7, 8, 9, 1, 0]);
            });

            it("should grow the view by 1 from the head", function () {
                buf.shift(3); // [6,7,5]
                expect(buf.head).to.equal(2);

                var result = buf.resize(buf.size + 1, true);
                expect(mapData(buf.view)).to.deep.equal([6, 7, 4, 5]);
                expect(mapIdx(buf.view)).to.deep.equal([6, 7, 4, 5]);
                expect(mapData(result)).to.deep.equal([4]);
                expect(mapIdx(result)).to.deep.equal([4]);

                expect(buf.head).to.equal(2);
                expect(buf.tail).to.equal(1);
                expect(buf.size).to.equal(4);
            });

            it("should grow the view by 2 from the head", function () {
                buf.shift(3); // [6,7,5]
                expect(buf.head).to.equal(2);

                var result = buf.resize(buf.size + 2, true);
                expect(mapData(buf.view)).to.deep.equal([6, 7, 3, 4, 5]);
                expect(mapIdx(buf.view)).to.deep.equal([6, 7, 3, 4, 5]);

                expect(buf.head).to.equal(2);
                expect(buf.tail).to.equal(1);
                expect(buf.size).to.equal(5);

                expect(result.length).to.equal(2);
                expect(mapData(result)).to.deep.equal([4, 3]);
                expect(mapIdx(result)).to.deep.equal([4, 3]);
            });

            it("should grow the view to a max of data.length from the head then tail", function () {
                buf.shift(3); // [6,7,5]
                expect(buf.head).to.equal(2);

                var result = buf.resize(buf.data.length, true);
                expect(mapData(buf.view)).to.deep.equal([6, 7, 8, 9, 0, 1, 2, 3, 4, 5]);
                expect(mapIdx(buf.view)).to.deep.equal([6, 7, 8, 9, 0, 1, 2, 3, 4, 5]);

                expect(buf.head).to.equal(4);
                expect(buf.tail).to.equal(3);
                expect(buf.size).to.equal(10);

                expect(result.length).to.equal(7);
                expect(mapData(result)).to.deep.equal([4, 3, 2, 1, 0, 8, 9]);
                expect(mapIdx(result)).to.deep.equal([4, 3, 2, 1, 0, 8, 9]);
            });
        });

        describe("grow from tail when view is at end of data", function () {
            beforeEach(function () {
                buf.shift(10);
                expect(mapData(buf.view)).to.deep.equal([9, 7, 8]);
                expect(mapIdx(buf.view)).to.deep.equal([9, 7, 8]);
            });

            it("should grow the view by 1 from the tail", function () {
                var result = buf.resize(buf.size + 1);
                expect(mapData(buf.view)).to.deep.equal([9, 6, 7, 8]);
                expect(mapIdx(buf.view)).to.deep.equal([9, 6, 7, 8]);

                expect(buf.head).to.equal(1);
                expect(buf.tail).to.equal(0);
                expect(buf.size).to.equal(4);

                expect(mapData(result)).to.deep.equal([6]);
                expect(mapIdx(result)).to.deep.equal([6]);
            });

            it("should grow the view by 2 from the tail", function () {
                var result = buf.resize(buf.size + 2);
                expect(mapData(buf.view)).to.deep.equal([9, 5, 6, 7, 8]);
                expect(mapIdx(buf.view)).to.deep.equal([9, 5, 6, 7, 8]);

                expect(buf.head).to.equal(1);
                expect(buf.tail).to.equal(0);
                expect(buf.size).to.equal(5);

                expect(result.length).to.equal(2);

                expect(mapData(result)).to.deep.equal([6, 5]);
                expect(mapIdx(result)).to.deep.equal([6, 5]);
            });

            it("should grow the view to a max of data.length from the tail then head", function () {
                var result = buf.resize(buf.data.length);
                expect(mapData(buf.view)).to.deep.equal([9, 0, 1, 2, 3, 4, 5, 6, 7, 8]);
                expect(mapIdx(buf.view)).to.deep.equal([9, 0, 1, 2, 3, 4, 5, 6, 7, 8]);

                expect(buf.head).to.equal(1);
                expect(buf.tail).to.equal(0);
                expect(buf.size).to.equal(10);

                expect(result.length).to.equal(7);
                expect(mapData(result)).to.deep.equal([6, 5, 4, 3, 2, 1, 0]);
                expect(mapIdx(result)).to.deep.equal([6, 5, 4, 3, 2, 1, 0]);
            });
        });

        describe("shrink when head is 0", function () {
            beforeEach(function () {
                buf.shift(3);
                expect(buf.head).to.equal(0);
                expect(mapData(buf.view)).to.deep.equal([3, 4, 5]);
                expect(mapIdx(buf.view)).to.deep.equal([3, 4, 5]);
            });

            it("should shrink the view by 1 from the tail", function () {
                var result = buf.resize(buf.size - 1);

                expect(mapData(buf.view)).to.deep.equal([3, 4]);
                expect(mapIdx(buf.view)).to.deep.equal([3, 4]);

                expect(buf.head).to.equal(0);
                expect(buf.tail).to.equal(1);
                expect(buf.size).to.equal(2);

                expect(result.length).to.equal(1);
                expect(mapData(result)).to.deep.equal([5]);
                expect(mapIdx(result)).to.deep.equal([5]);
            });

            it("should shrink the view by 2 from the tail", function () {
                var result = buf.resize(buf.size - 2);

                expect(mapData(buf.view)).to.deep.equal([3]);
                expect(mapIdx(buf.view)).to.deep.equal([3]);

                expect(buf.head).to.equal(0);
                expect(buf.tail).to.equal(0);
                expect(buf.size).to.equal(1);

                expect(result.length).to.equal(2);
                expect(mapData(result)).to.deep.equal([5, 4]);
                expect(mapIdx(result)).to.deep.equal([5, 4]);
            });

            it("should shrink to zero from the tail", function () {
                var result = buf.resize(0);

                expect(buf.view).to.be.empty;

                expect(buf.head).to.equal(-1);
                expect(buf.tail).to.equal(-1);
                expect(buf.size).to.equal(0);

                expect(result.length).to.equal(3);
                expect(mapData(result)).to.deep.equal([5, 4, 3]);
                expect(mapIdx(result)).to.deep.equal([5, 4, 3]);
            });

            it("should shrink the view by 1 from the head", function () {
                var result = buf.resize(buf.size - 1, true);

                expect(mapData(buf.view)).to.deep.equal([4, 5]);
                expect(mapIdx(buf.view)).to.deep.equal([4, 5]);

                expect(buf.head).to.equal(0);
                expect(buf.tail).to.equal(1);
                expect(buf.size).to.equal(2);

                expect(result.length).to.equal(1);
                expect(mapData(result)).to.deep.equal([3]);
                expect(mapIdx(result)).to.deep.equal([3]);
            });

            it("should shrink the view by 2 from the head", function () {
                var result = buf.resize(buf.size - 2, true);

                expect(mapData(buf.view)).to.deep.equal([5]);
                expect(mapIdx(buf.view)).to.deep.equal([5]);

                expect(buf.head).to.equal(0);
                expect(buf.tail).to.equal(0);
                expect(buf.size).to.equal(1);

                expect(result.length).to.equal(2);
                expect(mapData(result)).to.deep.equal([3, 4]);
                expect(mapIdx(result)).to.deep.equal([3, 4]);
            });

            it("should shrink to zero from the head", function () {
                var result = buf.resize(0, true);

                expect(buf.view).to.be.empty;

                expect(buf.head).to.equal(-1);
                expect(buf.tail).to.equal(-1);
                expect(buf.size).to.equal(0);

                expect(result.length).to.equal(3);
                expect(mapData(result)).to.deep.equal([3, 4, 5]);
                expect(mapIdx(result)).to.deep.equal([3, 4, 5]);
            });

            it("should error when shrinking to a larger size", function () {
                var err;

                try {
                    buf.resize(buf.data.length + 1);
                } catch (e) {
                    err = e;
                }

                expect(err).to.exist;
            });
        });

        // Tail is now zero
        describe("shrink from tail when head is 1", function () {
            beforeEach(function () {
                buf.shift(4);
                expect(buf.head).to.equal(1);
                expect(mapData(buf.view)).to.deep.equal([6, 4, 5]);
                expect(mapIdx(buf.view)).to.deep.equal([6, 4, 5]);
            });

            it("should shrink the view by 1 from the tail", function () {
                var result = buf.resize(buf.size - 1);
                expect(mapData(buf.view)).to.deep.equal([4, 5]);
                expect(mapIdx(buf.view)).to.deep.equal([4, 5]);

                expect(result.length).to.equal(1);
                expect(mapData(result)).to.deep.equal([6]);
                expect(mapIdx(result)).to.deep.equal([6]);

                expect(buf.head).to.equal(0);
                expect(buf.tail).to.equal(1);
                expect(buf.size).to.equal(2);
            });

            it("should shrink the view by 2 from the tail", function () {
                var result = buf.resize(buf.size - 2);
                expect(mapData(buf.view)).to.deep.equal([4]);
                expect(mapIdx(buf.view)).to.deep.equal([4]);

                expect(buf.head).to.equal(0);
                expect(buf.tail).to.equal(0);
                expect(buf.size).to.equal(1);

                expect(result.length).to.equal(2);
                expect(mapData(result)).to.deep.equal([6, 5]);
                expect(mapIdx(result)).to.deep.equal([6, 5]);
            });

            it("should shrink to zero from the tail", function () {
                var result = buf.resize(0);
                expect(buf.view).to.be.empty;

                expect(buf.head).to.equal(-1);
                expect(buf.tail).to.equal(-1);
                expect(buf.size).to.equal(0);

                expect(result.length).to.equal(3);
                expect(mapData(result)).to.deep.equal([6, 5, 4]);
                expect(mapIdx(result)).to.deep.equal([6, 5, 4]);
            });

            // [6,4,5]
            it("should shrink the view by 1 from the head", function () {
                var result = buf.resize(buf.size - 1, true);

                expect(mapData(buf.view)).to.deep.equal([6, 5]);
                expect(mapIdx(buf.view)).to.deep.equal([6, 5]);

                expect(buf.head).to.equal(1);
                expect(buf.tail).to.equal(0);
                expect(buf.size).to.equal(2);

                expect(result.length).to.equal(1);
                expect(mapData(result)).to.deep.equal([4]);
                expect(mapIdx(result)).to.deep.equal([4]);
            });

            it("should shrink the view by 2 from the head", function () {
                var result = buf.resize(buf.size - 2, true);

                expect(mapData(buf.view)).to.deep.equal([6]);
                expect(mapIdx(buf.view)).to.deep.equal([6]);

                expect(buf.head).to.equal(0);
                expect(buf.tail).to.equal(0);
                expect(buf.size).to.equal(1);

                expect(result.length).to.equal(2);
                expect(mapData(result)).to.deep.equal([4, 5]);
                expect(mapIdx(result)).to.deep.equal([4, 5]);
            });

            it("should shrink to zero from the head", function () {
                var result = buf.resize(0, true);

                expect(buf.view).to.be.empty;

                expect(buf.head).to.equal(-1);
                expect(buf.tail).to.equal(-1);
                expect(buf.size).to.equal(0);

                expect(result.length).to.equal(3);
                expect(mapData(result)).to.deep.equal([4, 5, 6]);
                expect(mapIdx(result)).to.deep.equal([4, 5, 6]);
            });
        });

        // Tail is now 1
        describe("shrink from tail when head is 2", function () {
            beforeEach(function () {
                buf.shift(5);
                expect(buf.head).to.equal(2);
                expect(mapData(buf.view)).to.deep.equal([6, 7, 5]);
                expect(mapIdx(buf.view)).to.deep.equal([6, 7, 5]);
            });

            it("should shrink the view by 1 from the tail", function () {
                var result = buf.resize(buf.size - 1);
                expect(mapData(buf.view)).to.deep.equal([6, 5]);
                expect(mapIdx(buf.view)).to.deep.equal([6, 5]);

                expect(buf.head).to.equal(1);
                expect(buf.tail).to.equal(0);
                expect(buf.size).to.equal(2);

                expect(mapData(result)).to.deep.equal([7]);
                expect(mapIdx(result)).to.deep.equal([7]);
            });

            it("should shrink the view by 2 from the tail", function () {
                var result = buf.resize(buf.size - 2);
                expect(mapData(buf.view)).to.deep.equal([5]);
                expect(mapIdx(buf.view)).to.deep.equal([5]);

                expect(buf.head).to.equal(0);
                expect(buf.tail).to.equal(0);
                expect(buf.size).to.equal(1);

                expect(result.length).to.equal(2);
                expect(mapData(result)).to.deep.equal([7, 6]);
                expect(mapIdx(result)).to.deep.equal([7, 6]);
            });

            it("should shrink to zero from the tail", function () {
                var result = buf.resize(0);
                expect(buf.view).to.be.empty;

                expect(buf.head).to.equal(-1);
                expect(buf.tail).to.equal(-1);
                expect(buf.size).to.equal(0);

                expect(result.length).to.equal(3);
                expect(mapData(result)).to.deep.equal([7, 6, 5]);
                expect(mapIdx(result)).to.deep.equal([7, 6, 5]);
            });

            // [6,7,5]
            it("should shrink the view by 1 from the head", function () {
                var result = buf.resize(buf.size - 1, true);

                expect(mapData(buf.view)).to.deep.equal([6, 7]);
                expect(mapIdx(buf.view)).to.deep.equal([6, 7]);

                expect(buf.head).to.equal(0);
                expect(buf.tail).to.equal(1);
                expect(buf.size).to.equal(2);

                expect(result.length).to.equal(1);
                expect(mapData(result)).to.deep.equal([5]);
                expect(mapIdx(result)).to.deep.equal([5]);
            });

            it("should shrink the view by 2 from the head", function () {
                var result = buf.resize(buf.size - 2, true);

                expect(mapData(buf.view)).to.deep.equal([7]);
                expect(mapIdx(buf.view)).to.deep.equal([7]);

                expect(buf.head).to.equal(0);
                expect(buf.tail).to.equal(0);
                expect(buf.size).to.equal(1);

                expect(result.length).to.equal(2);
                expect(mapData(result)).to.deep.equal([5, 6]);
                expect(mapIdx(result)).to.deep.equal([5, 6]);
            });

            it("should shrink to zero from the head", function () {
                var result = buf.resize(0, true);

                expect(buf.view).to.be.empty;

                expect(buf.head).to.equal(-1);
                expect(buf.tail).to.equal(-1);
                expect(buf.size).to.equal(0);

                expect(result.length).to.equal(3);
                expect(mapData(result)).to.deep.equal([5, 6, 7]);
                expect(mapIdx(result)).to.deep.equal([5, 6, 7]);
            });
        });

        describe("shrink from tail when view is at end of data", function () {
            beforeEach(function () {
                buf.shift(10);

                expect(mapData(buf.view)).to.deep.equal([9, 7, 8]);
                expect(mapIdx(buf.view)).to.deep.equal([9, 7, 8]);
            });

            it("should shrink the view by 1 from the tail", function () {
                var result = buf.resize(buf.size - 1);
                expect(mapData(buf.view)).to.deep.equal([7, 8]);
                expect(mapIdx(buf.view)).to.deep.equal([7, 8]);

                expect(buf.head).to.equal(0);
                expect(buf.tail).to.equal(1);
                expect(buf.size).to.equal(2);

                expect(mapData(result)).to.deep.equal([9]);
                expect(mapIdx(result)).to.deep.equal([9]);
            });

            it("should shrink the view by 2 from the tail", function () {
                var result = buf.resize(buf.size - 2);
                expect(mapData(buf.view)).to.deep.equal([7]);
                expect(mapIdx(buf.view)).to.deep.equal([7]);

                expect(buf.head).to.equal(0);
                expect(buf.tail).to.equal(0);
                expect(buf.size).to.equal(1);

                expect(result.length).to.equal(2);

                expect(mapData(result)).to.deep.equal([9, 8]);
                expect(mapIdx(result)).to.deep.equal([9, 8]);
            });

            it("should shrink to zero from the tail", function () {
                var result = buf.resize(0);
                expect(buf.view).to.be.empty;

                expect(buf.head).to.equal(-1);
                expect(buf.tail).to.equal(-1);
                expect(buf.size).to.equal(0);

                expect(result.length).to.equal(3);
                expect(mapData(result)).to.deep.equal([9, 8, 7]);
                expect(mapIdx(result)).to.deep.equal([9, 8, 7]);
            });
        });
    });

    describe("remove()", function () {
        describe("when removing the data item at head", function () {
            it("should remove the head item when at the beginning", function () {
                var result = buf.remove(buf.view[buf.head].idx);

                expect(mapIdx(buf.view)).to.deep.equal([0, 1, 2]);
                expect(mapData(buf.view)).to.deep.equal([1, 2, 3]);
                expect(buf.head).to.equal(0);
                expect(buf.tail).to.equal(2);

                expect(result.newInView.length).to.equal(1);
                expect(result.removed.length).to.equal(1);
                expect(result.updated.length).to.equal(2);
            });

            it("should remove the head item when at the end", function () {
                buf.data.push(10);
                buf.shift(10);

                // Expect head to be at the end of the view and tail to be at
                // the end of data for this test to be setup properly
                expect(buf.head).to.equal(buf.size - 1);
                expect(buf.view[buf.tail].idx).to.equal(buf.data.length - 1);

                var result = buf.remove(buf.view[buf.head].idx);

                expect(result.newInView.length).to.equal(1);
                expect(result.removed.length).to.equal(1);
                expect(result.updated.length).to.equal(2);

                expect(mapIdx(buf.view)).to.deep.equal([7, 8, 9]);
                expect(mapData(buf.view)).to.deep.equal([7, 9, 10]);
            });

            it("should remove the head item when in mid-view", function () {
                buf.shift(1); // [3,1,2]

                expect(buf.head).to.equal(1);

                var result = buf.remove(buf.view[buf.head].idx);

                expect(result.newInView.length).to.equal(1);
                expect(result.removed.length).to.equal(1);
                expect(result.updated.length).to.equal(2);

                expect(mapIdx(buf.view)).to.deep.equal([2, 3, 1]);
                expect(mapData(buf.view)).to.deep.equal([3, 4, 2]);
            });
        });

        describe("when removing the data item at tail", function () {
            it("should remove an item when tail is at the end of the view", function () {
                var result = buf.remove(buf.view[buf.tail].idx);

                expect(mapIdx(buf.view)).to.deep.equal([0, 1, 2]);
                expect(mapData(buf.view)).to.deep.equal([0, 1, 3]);
                expect(buf.head).to.equal(0);
                expect(buf.tail).to.equal(2);

                expect(result.newInView.length).to.equal(1);
                expect(result.removed.length).to.equal(1);
                expect(result.updated.length).to.equal(0);
            });

            it("should remove an item when tail is at the beginning of the view", function () {
                buf.shift(1); // [0,1,2] => [3,1,2]

                expect(buf.tail).to.equal(0);

                var result = buf.remove(buf.view[buf.tail].idx); // [1,2] after removal then resize [1,2,4]

                expect(mapIdx(buf.view)).to.deep.equal([1, 2, 3]);
                expect(mapData(buf.view)).to.deep.equal([1, 2, 4]);
                expect(buf.head).to.equal(0);
                expect(buf.tail).to.equal(2);

                expect(result.newInView.length).to.equal(1);
                expect(result.removed.length).to.equal(1);
                expect(result.updated.length).to.equal(0);
            });

            it("should remove an item when tail is in the middle of the view", function () {
                buf.shift(2); // [0,1,2] => [3,1,2] => [3,4,2]

                expect(buf.tail).to.equal(1);

                var result = buf.remove(buf.view[buf.tail].idx); // [3,2] after removal then resize [3,5,2]

                expect(mapIdx(buf.view)).to.deep.equal([3, 4, 2]);
                expect(mapData(buf.view)).to.deep.equal([3, 5, 2]);
                expect(buf.head).to.equal(2);
                expect(buf.tail).to.equal(1);

                expect(result.newInView.length).to.equal(1);
                expect(result.removed.length).to.equal(1);
                expect(result.updated.length).to.equal(0);
            });
        });

        describe("when not removing the head or tail", function () {
            it("should remove an item when its view index is smaller than head and tail", function () {
                buf.shift(2); // [0,1,2] => [3,1,2] => [3,4,2]

                expect(buf.head).to.equal(2);
                expect(buf.tail).to.equal(1);

                var result = buf.remove(buf.view[0].idx); // [4,2] after removal then resize [4,5,2]

                expect(mapIdx(buf.view)).to.deep.equal([3, 4, 2]);
                expect(mapData(buf.view)).to.deep.equal([4, 5, 2]);
                expect(buf.head).to.equal(2);
                expect(buf.tail).to.equal(1);

                expect(result.newInView.length).to.equal(1);
                expect(result.removed.length).to.equal(1);
                expect(result.updated.length).to.equal(1);
            });

            it("should remove an item when its view index is between head and tail", function () {
                expect(buf.head).to.equal(0);
                expect(buf.tail).to.equal(2);

                var result = buf.remove(buf.view[1].idx); // [0,2] after removal then resize [0,2,3]

                expect(mapIdx(buf.view)).to.deep.equal([0, 1, 2]);
                expect(mapData(buf.view)).to.deep.equal([0, 2, 3]);
                expect(buf.head).to.equal(0);
                expect(buf.tail).to.equal(2);

                expect(result.newInView.length).to.equal(1);
                expect(result.removed.length).to.equal(1);
                expect(result.updated.length).to.equal(1);
            });

            it("should remove an item when its view index is larger than head and tail", function () {
                buf.shift(1); // [3,1,2]
                expect(buf.head).to.equal(1);
                expect(buf.tail).to.equal(0);

                var result = buf.remove(buf.view[2].idx); // [3,1] after removal then resize [3,4,1]

                expect(mapIdx(buf.view)).to.deep.equal([2, 3, 1]);
                expect(mapData(buf.view)).to.deep.equal([3, 4, 1]);
                expect(buf.head).to.equal(2);
                expect(buf.tail).to.equal(1);

                expect(result.newInView.length).to.equal(1);
                expect(result.removed.length).to.equal(1);
                expect(result.updated.length).to.equal(1);
            });
        });

        describe("when removing an item that isn't in the view", function () {
            it("should remove an item when it is before the view", function () {
                buf.shift(1);

                var result = buf.remove(0);

                expect(mapIdx(buf.view)).to.deep.equal([2, 0, 1]);
                expect(mapData(buf.view)).to.deep.equal([3, 1, 2]);
                expect(buf.head).to.equal(1);
                expect(buf.tail).to.equal(0);

                expect(result.newInView.length).to.equal(0);
                expect(result.removed.length).to.equal(0);
                expect(result.updated.length).to.equal(3);
            });

            it("should remove an item when it is after the view", function () {
                var result = buf.remove(6);

                expect(mapIdx(buf.view)).to.deep.equal([0, 1, 2]);
                expect(mapData(buf.view)).to.deep.equal([0, 1, 2]);
                expect(buf.head).to.equal(0);
                expect(buf.tail).to.equal(2);

                expect(result.newInView.length).to.equal(0);
                expect(result.removed.length).to.equal(0);
                expect(result.updated.length).to.equal(0);
            });
        });
    });

    describe("forEachInView()", function () {
        var physicalIdx, logicalIdx, itemIdx;

        beforeEach(function() {
            physicalIdx = [];
            logicalIdx = [];
            itemIdx = [];
            console.log("BEGIN TEST");
        });

        function commonCB(item, lIdx, pIdx, view) {
            itemIdx.push(item.idx);
            logicalIdx.push(lIdx);
            physicalIdx.push(pIdx);

            expect(view).to.equal(buf.view);
        }

        it('should iterate through all items in view when head is at start of view', function() {
            buf.forEachInView(commonCB);

            expect(itemIdx    ).to.deep.equal([0,1,2]);
            expect(logicalIdx ).to.deep.equal([0,1,2]);
            expect(physicalIdx).to.deep.equal([0,1,2]);
        });

        it('should iterate through all items in view when head is midway in view', function() {
            buf.shift(1);
            buf.forEachInView(commonCB);

            expect(itemIdx    ).to.deep.equal([1,2,3]);
            expect(logicalIdx ).to.deep.equal([0,1,2]);
            expect(physicalIdx).to.deep.equal([1,2,0]);
        });

        it('should iterate through all items in view when head is at end of view', function() {
            buf.shift(2);
            buf.forEachInView(commonCB);

            expect(itemIdx    ).to.deep.equal([2,3,4]);
            expect(logicalIdx ).to.deep.equal([0,1,2]);
            expect(physicalIdx).to.deep.equal([2,0,1]);
        });

        it('should iterate with the passed in thisArg', function() {
            var thisArg = { thisArg: true };
            buf.forEachInView(function() {
                expect(this.thisArg).to.be.true;
            }, thisArg);
        });
    });
});