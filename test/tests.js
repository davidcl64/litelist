var bundle = require('../src/bundled');
var chai   = require('chai');
var sinon  = require('sinon');
var expect = chai.expect;
var pkg    = require('../package.json');

chai.expect();
chai.should();

describe(["LiteList"], function() {
    describe("bundled", function() {
        var LiteList = require('LiteList');

        it("LiteList should exist", function() {
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
        var LiteList   = require('LiteList');
        var mock       = require('./lib/mock');
        var dataSource = {
            bind: function(/*id, el*/) {},

            sync: function(id, el, itemIdx, item) {
                el.innerText = "innerText[" + id + "]";
            },

            unbind: function(/*id, el*/) {}


        };

        var itemTemplate    = document.createDocumentFragment();

        var fullOpts = {
            itemWidth:      100,
            itemHeight:     100,
            margin:         { x: 0, y: 0 },
            scrollView:     ".scrollView",
            itemsContainer: ".itemsContainer",
            dataSource:     dataSource,
            itemTemplate:   itemTemplate
        };

        var scrollView, itemsContainer;
        var sandbox, qsStub, gcsStub;

        beforeEach(function() {
            scrollView      = mock.getFakeView(1000, 1000);
            itemsContainer  = scrollView.children[0];

            itemTemplate.appendChild(document.createElement("div"));

            // Create a new sandbox
            sandbox = sinon.sandbox.create();

            qsStub  = sandbox.stub(document, 'querySelector');
            gcsStub = sandbox.stub(window,   'getComputedStyle');

            qsStub.withArgs('.scrollView'    ).returns(scrollView);
            qsStub.withArgs('.itemsContainer').returns(itemsContainer);

            gcsStub.withArgs(scrollView).returns({ height: scrollView.clientHeight });
        });

        // Restore stuff to the way we were...
        afterEach(function () {
            sandbox.restore();
        });

        it("Should create a LiteListObject with all opt specified", function() {
            var liteList = new LiteList(fullOpts);
            console.log(liteList);
        });
    });
});