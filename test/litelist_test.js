var chai   = require('chai');
var sinon  = require('sinon');
var expect = chai.expect;
var pkg    = require('../package.json');
var utils  = require('./lib/utils');

chai.expect();
chai.should();

// Use the bundled version of the library
var LiteList   = require('../src/bundled');
var ViewBuffer = require('../src/viewbuffer');
var mock       = require('./lib/mock');

describe(["LiteList"], function() {
    var dataSource = {
        bind: function(/*id, el*/) {},

        sync: function(id, el, itemIdx, item) {
            el.innerText = item.text + "_" + id + "_" + itemIdx;
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

        it("should have the same version as package.json", function() {
            expect(LiteList.VERSION).to.equal(pkg.version);
        });
    });

    describe("constructor", function() {
        it("Should create a LiteList object with all options specified", function() {
            var liteList = new LiteList(fullOpts);

            expect(liteList.viewBuffer).to.be.instanceof(ViewBuffer);
            expect(liteList.viewBuffer.view).to.be.empty;
            expect(liteList.viewBuffer.data).to.be.empty;
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
            expect(liteList.height      ).to.equal(0);
        });

        it("Should use expected defaults when only required opts are specified", function() {
            var liteList = new LiteList(requiredOpts);

            expect(liteList.viewBuffer).to.be.instanceof(ViewBuffer);
            expect(liteList.viewBuffer.view).to.be.empty;
            expect(liteList.viewBuffer.data).to.be.empty;
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
            expect(liteList.height      ).to.equal(0);
        });
    });

//    describe("_createInViewObj()", function() {
//        it("should create an in view object and add it to the dom with all options specified", function() {
//            var liteList  = new LiteList(fullOpts);
//            var item      = {text: 'hello'};
//            var inViewObj;
//
//            liteList.items[0] = item;
//            inViewObj = liteList._createInViewObj({text: 'hello'}, 0);
//            expect(itemsContainer.children.length).to.equal(1);
//        });
//
//        it("should create an in view object and not add it to the dom with required options specified", function() {
//            var liteList  = new LiteList(requiredOpts);
//            var item      = {text: 'hello'};
//            var inViewObj;
//
//            liteList.items[0] = item;
//            inViewObj = liteList._createInViewObj({text: 'hello'}, 0);
//            expect(itemsContainer.children.length).to.equal(0);
//        });
//    });

    describe("push()", function() {
        it("should be able to push a single item", function() {
            var liteList = new LiteList(fullOpts);

            liteList.push({text: "hello"});
            expect(liteList.viewBuffer.view.length).to.equal(1);
            expect(liteList.viewBuffer.data.length).to.equal(1);
            expect(itemsContainer.style.height).to.equal(fullOpts.itemHeight + "px");
        });

        it("should be able to push a multiple items", function() {
            var liteList = new LiteList(fullOpts);

            liteList.push.apply(liteList, [0,1,2,3,4].map(function(val) { return {text: "hello " + val}; }));
            expect(liteList.viewBuffer.view.length).to.equal(5);
            expect(liteList.viewBuffer.data.length).to.equal(5);
            expect(itemsContainer.style.height).to.equal(fullOpts.itemHeight + "px");
        });

        it("should grow itemsContainer.height as new rows are added", function() {
            var liteList = new LiteList(fullOpts);
            var vals     = new Array(100);

            liteList.push.apply(liteList, utils.array.fill.call(vals, function(val) { return {text: "hello " + val}; }));
            expect(liteList.viewBuffer.view.length).to.equal(100);
            expect(liteList.viewBuffer.data.length).to.equal(100);
            expect(itemsContainer.style.height).to.equal((fullOpts.itemHeight * 100/10) + "px");
        });

        it("should not exceed maxbuffer", function() {
            var liteList = new LiteList(fullOpts);
            var vals     = new Array(500);

            liteList.push.apply(liteList, utils.array.fill.call(vals, function(val) { return {text: "hello " + val}; }));
            expect(liteList.viewBuffer.view.length).to.equal(300);
            expect(liteList.viewBuffer.data.length).to.equal(500);
            expect(itemsContainer.style.height).to.equal((fullOpts.itemHeight * 500/10) + "px");
        });

        // Currently this isn't addressed in the code as the actual numbers of items added to the DOM are small
        // for my use cases.
        //
        // Investigation will need to determine how much performance gain can be seen various form factors
        // and other use cases before determining if the added complexity to the code is worthwhile.
        it("future performance: should probably limit updates to the DOM when multiple items are added at once");
    });

    describe("clear()", function() {
        it("should clear all items from the list", function() {
            var liteList = new LiteList(fullOpts);
            var vals     = new Array(100);

            liteList.push.apply(liteList, utils.array.fill.call(vals, function(val) { return {text: "hello " + val}; }));
            liteList.clear();
            expect(liteList.viewBuffer.view.length).to.equal(0);
            expect(liteList.viewBuffer.data.length).to.equal(0);
            expect(itemsContainer.style.height).to.equal("0px");
        });
    });
});