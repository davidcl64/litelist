// Here to generate browserified code bundle
require('../src/bundled');

var chai   = require('chai');
var sinon  = require('sinon');
var expect = chai.expect;
var pkg    = require('../package.json');

chai.expect();
chai.should();

var LiteList = require('LiteList');
var mock     = require('./lib/mock');

describe(["LiteList"], function() {
    var dataSource = {
        bind: function(/*id, el*/) {},

        sync: function(id, el/*, itemIdx, item*/) {
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

    var requiredOpts = {
        itemHeight:     100,
        scrollView:     ".scrollView"
    };

    var viewWidth = 1000, viewHeight = 1000;

    var scrollView, itemsContainer;
    var sandbox, qsStub, gcsStub;

    beforeEach(function() {
        scrollView      = mock.getFakeView(viewWidth, viewHeight);
        itemsContainer  = scrollView.children[0];

        if(itemTemplate.childNodes.length === 0) {
            itemTemplate.appendChild(document.createElement("div"));
        }

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

    describe("bundled", function() {
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
        it("Should create a LiteList object with all options specified", function() {
            var liteList = new LiteList(fullOpts);

            expect(liteList.itemsInView).to.be.instanceof(Array);
            expect(liteList.itemsInView.length).to.equal(0);
            expect(liteList.items).to.be.instanceof(Array);
            expect(liteList.items.length).to.equal(0);
            expect(liteList.itemWidth).to.equal(fullOpts.itemWidth);
            expect(liteList.itemHeight).to.equal(fullOpts.itemHeight);
            expect(liteList.margin).to.deep.equal(fullOpts.margin);
            expect(liteList.view).to.deep.equal(scrollView);
            expect(liteList.itemsContainer).to.deep.equal(itemsContainer);
            expect(liteList.dataSource).to.deep.equal(dataSource);
            expect(liteList.itemTemplate).to.deep.equal(itemTemplate);
            expect(liteList.scrollTop).to.equal(0);

            // View Metrics
            expect(liteList.clientHeight).to.equal(viewHeight);
            expect(liteList.clientWidth ).to.equal(viewWidth);
            expect(liteList.rowsPerPage ).to.equal(Math.ceil (viewHeight/fullOpts.itemHeight));
            expect(liteList.itemsPerRow ).to.equal(Math.floor(viewWidth /fullOpts.itemWidth ));
            expect(liteList.itemsPerPage).to.equal(liteList.rowsPerPage * liteList.itemsPerRow);
            expect(liteList.maxBuffer   ).to.equal(liteList.itemsPerPage * 3);
        });

        it("Should use expected defaults when only required opts are specified", function() {
            var liteList = new LiteList(requiredOpts);

            expect(liteList.itemsInView).to.be.instanceof(Array);
            expect(liteList.itemsInView.length).to.equal(0);
            expect(liteList.items).to.be.instanceof(Array);
            expect(liteList.items.length).to.equal(0);
            expect(liteList.itemWidth).to.equal(0);
            expect(liteList.itemHeight).to.equal(requiredOpts.itemHeight);
            expect(liteList.margin).to.deep.equal({x: 0, y: 0});
            expect(liteList.view).to.deep.equal(scrollView);
            expect(liteList.itemsContainer).to.deep.equal(itemsContainer);
            expect(liteList.dataSource).to.equal(false);
            expect(liteList.itemTemplate).to.equal(false);
            expect(liteList.scrollTop).to.equal(0);

            // View Metrics
            expect(liteList.clientHeight).to.equal(viewHeight);
            expect(liteList.clientWidth ).to.equal(viewWidth);
            expect(liteList.rowsPerPage ).to.equal(Math.ceil(viewHeight/fullOpts.itemHeight));
            expect(liteList.itemsPerRow ).to.equal(1);
            expect(liteList.itemsPerPage).to.equal(liteList.rowsPerPage * liteList.itemsPerRow);
            expect(liteList.maxBuffer   ).to.equal(liteList.itemsPerPage * 3);
        });
    });

    describe("_createInViewObj()", function() {
        it("should create an in view object and add it to the dom with all options specified", function() {
            var liteList  = new LiteList(fullOpts);
            var item      = {text: 'hello'};
            var inViewObj;

            liteList.items[0] = item;
            inViewObj = liteList._createInViewObj({text: 'hello'}, 0);
            expect(itemsContainer.children.length).to.equal(1);
        });

        it("should create an in view object and not add it to the dom with required options specified", function() {
            var liteList  = new LiteList(requiredOpts);
            var item      = {text: 'hello'};
            var inViewObj;

            liteList.items[0] = item;
            inViewObj = liteList._createInViewObj({text: 'hello'}, 0);
            expect(itemsContainer.children.length).to.equal(0);
        });
    });
});