var bundle = require('../src/bundled');
var chai   = require('chai');
var expect = chai.expect;
var pkg    = require('../package.json');

chai.expect();
chai.should();

describe(["LiteList"], function() {
    describe("bundled", function() {
        var LiteList = require('LiteList');

        it("should exist", function() {
            expect(LiteList).to.exist;
        });

        it("should have RivetsLiteList", function() {
            expect(LiteList.RivetsLiteList).to.exist;
        });

        it("should have Scroll", function() {
            expect(LiteList.Scroll).to.exist;
        });

        it("should have rivets", function() {
            expect(require('rivets')).to.exist;
        });

        it("should have tween.js", function() {
            expect(require('tween.js')).to.exist;
            expect(require('TWEEN')).to.exist;
        });

        it("should have the same version as package.json", function() {
            expect(LiteList.VERSION).to.equal(pkg.version);
        });
    });

    describe("constructor", function() {
        it("")
    });
});