var LiteList = require('../src/litelist');

var chai   = require('chai');
var expect = chai.expect;

chai.expect();
chai.should();

describe(["LiteList"], function(api) {
    describe("LiteList", function() {
        it("should exist", function(done) {
            expect(LiteList).to.exist;
            done();
        });
    });
});