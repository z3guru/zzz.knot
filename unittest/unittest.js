var fs = require('fs');
var path = require('path');
var nio = require('zzz.skein');
var assert = require('assert');

var rewire = require("rewire");
var workshop = rewire('../workshop');

describe("TestRefMemCell", function() {

	it("testFillGet", function() {
		let RefMemCellType = workshop.__get__("RefMemCell");
		let cell = new RefMemCellType();

		// test varray
		let tt = [ 1, 5, 7, 9 ];
		cell.init(tt);

		//
		assert.equal(cell.getValue(), 1);
		assert.equal(cell.getValue(), 5);
		assert.equal(cell.getValue(), 7);
		assert.equal(cell.getValue(), 9);
	});

	it("testFillGet2", function() {
		let RefMemCellType = workshop.__get__("RefMemCell");
		let cell = new RefMemCellType();

		// test varray
		let tt = [ 1, 5, 7, 9 ];
		cell.init(tt);

		//
		assert.equal(cell.getValue(1), 5);
		assert.equal(cell.getValue(), 7);
		assert.equal(cell.getValue(1), 5);
		assert.equal(cell.getValue(), 9);
	});

	it("testSetGet2", function() {
		let RefMemCellType = workshop.__get__("RefMemCell");
		let cell = new RefMemCellType();

		// set
		cell.setValue(3, 2);

		//
		cell.rewind();
		assert.equal(cell.getValue(), undefined);
		assert.equal(cell.getValue(), undefined);
		assert.equal(cell.getValue(), 3);
	});

	it("testCycle", function() {
		let RefMemCellType = workshop.__get__("RefMemCell");
		let cell = new RefMemCellType();

		// test varray
		let tt = [ 1, 5, 7, 9 ];
		cell.init(tt);

		//
		assert.equal(cell.getValue(0), 1);
		cell.upCycle();
		assert.equal(cell.getValue(0), 5);
		assert.equal(cell.getValue(), 7);
		cell.upCycle();
		assert.equal(cell.getValue(0), 9);
	});

	it("testCycle2", function() {
		let RefMemCellType = workshop.__get__("RefMemCell");
		let cell = new RefMemCellType();

		// test varray
		let tt = [ 1, 5, 7, 9 ];
		cell.init(tt);

		//
		assert.equal(cell.getValue(0), 1);
		assert.equal(cell.getValue(0, 1), 5);
		assert.equal(cell.getValue(), 7);
		assert.equal(cell.getValue(0, 2), 9);
	});

});

describe("TestRefMem", function() {

	it("testFillGet", function() {
		let RefMemType = workshop.__get__("RefMem");
		let sref = new RefMemType();

		// test varray
		let refnum = 1;
		let cell = sref.cell(refnum, true);
		let tt = [ 1, 5, 7, 9 ];
		cell.init(tt);

		//
		assert.equal(sref.getRefValueByNum(refnum), 1);
		assert.equal(sref.getRefValueByNum(refnum), 5);
		assert.equal(sref.getRefValueByNum(refnum), 7);
		assert.equal(sref.getRefValueByNum(refnum), 9);
	});

	it("testFillGet2", function() {
		let RefMemType = workshop.__get__("RefMem");
		let sref = new RefMemType();

		// test varray
		let refnum = 1;
		let cell = sref.cell(refnum, true);
		let tt = [ 1, 5, 7, 9 ];
		cell.init(tt);

		//
		assert.equal(sref.getRefValueByNum(refnum, 1), 5);
		assert.equal(sref.getRefValueByNum(refnum), 7);
		assert.equal(sref.getRefValueByNum(refnum, 1), 5);
		assert.equal(sref.getRefValueByNum(refnum), 9);
	});

	it("testCycle", function() {
		let RefMemType = workshop.__get__("RefMem");
		let sref = new RefMemType();

		// test varray
		let refnum = 1;
		let cell = sref.cell(refnum, true);
		let tt = [ 1, 5, 7, 9 ];
		cell.init(tt);

		//
		assert.equal(sref.getRefValueByNum(refnum, 0), 1);
		assert.equal(sref.getRefValueByNum(refnum, 0, 1), 5);
		assert.equal(sref.getRefValueByNum(refnum), 7);
		assert.equal(sref.getRefValueByNum(refnum, 0, 2), 9);
	});
});


describe("TestCallDependencyWindow", function() {

	it("testTraverse", function() {

		let spec = JSON.parse(fs.readFileSync(path.resolve(__dirname, './test_depwindow.json'), 'utf8'));
		let ws = workshop.setupWorkshop(spec);

		let ToolLinkType = workshop.__get__("ToolLink");
		let CallDependencyWindowType = workshop.__get__("CallDependencyWindow");
		let cdw = new CallDependencyWindowType();

		let links = [ new ToolLinkType(ws.toolMap['DEP_1']) ];
		let hasEnd = {};
		cdw.traverse(links, hasEnd, 'data', 'DATALEN');

		assert.equal(Object.entries(hasEnd).length, 1);
		assert.equal(hasEnd['data:DATALEN'], true);
		assert.equal(links[0].isEndOfCDW('data', 'DATALEN'), true);
		assert.equal(links[0].isEndOfCDW('data', 'DATALEN2'), false);
	});

	it("testTraverse2", function() {

		let spec = JSON.parse(fs.readFileSync(path.resolve(__dirname, './test_depwindow.json'), 'utf8'));
		let ws = workshop.setupWorkshop(spec);

		let ToolLinkType = workshop.__get__("ToolLink");
		let CallDependencyWindowType = workshop.__get__("CallDependencyWindow");
		let cdw = new CallDependencyWindowType();

		let links = [ new ToolLinkType(ws.toolMap['DEP_1']), new ToolLinkType(ws.toolMap['DEP_2']), new ToolLinkType(ws.toolMap['DEP_3']) ];
		cdw.traverse(links, undefined, 'data', 'DATALEN');

		assert.equal(links[0].isEndOfCDW('data', 'DATALEN'), false);
		assert.equal(links[1].isEndOfCDW('data', 'DATALEN'), false);
		assert.equal(links[2].isEndOfCDW('data', 'DATALEN'), true);
	});

	it("testTraverse3", function() {

		let spec = JSON.parse(fs.readFileSync(path.resolve(__dirname, './test_depwindow.json'), 'utf8'));
		let ws = workshop.setupWorkshop(spec);

		let ToolLinkType = workshop.__get__("ToolLink");
		let CallDependencyWindowType = workshop.__get__("CallDependencyWindow");
		let cdw = new CallDependencyWindowType();

		let links = [ new ToolLinkType(ws.toolMap['DEP_6']) ];
		let hasEnd = {};
		cdw.traverse(links, hasEnd, 'data', 'DATALEN');

		assert.equal(hasEnd['data:DATALEN'], true);
		assert.equal(links[0].isEndOfCDW('data', 'DATALEN'), false);
		assert.equal(links[0].subLinks[0].isEndOfCDW('data', 'DATALEN'), true);
	});

	it("testTraverse4", function() {

		let spec = JSON.parse(fs.readFileSync(path.resolve(__dirname, './test_depwindow.json'), 'utf8'));
		let ws = workshop.setupWorkshop(spec);

		let ToolLinkType = workshop.__get__("ToolLink");
		let CallDependencyWindowType = workshop.__get__("CallDependencyWindow");
		let cdw = new CallDependencyWindowType();

		let links = [ new ToolLinkType(ws.toolMap['DEP_8']) ];
		let hasEnd = {};
		cdw.traverse(links, hasEnd, 'data', 'DATALEN');

		assert.equal(hasEnd['data:DATALEN'], true);
		assert.equal(links[0].isEndOfCDW('data', 'DATALEN'), false);
		assert.equal(links[0].subLinks[1].isEndOfCDW('data', 'DATALEN'), false);
		assert.equal(links[0].subLinks[1].subLinks[0].isEndOfCDW('data', 'DATALEN'), true);
	});

});


describe("TestWorkshop", function() {

	it("testTraverseCDW", function() {

		let spec = JSON.parse(fs.readFileSync(path.resolve(__dirname, './test_depwindow.json'), 'utf8'));
		let ws = workshop.setupWorkshop(spec);

		let links = ws.textureMap['TT1'].flow;
		assert.equal(links[0].isEndOfCDW('data', 'DATALEN'), false);
		assert.equal(links[0].subLinks[1].isEndOfCDW('data', 'DATALEN'), false);
		assert.equal(links[0].subLinks[1].subLinks[0].isEndOfCDW('data', 'DATALEN'), true);
	});

	it("testAssign", function() {

		let spec = JSON.parse(fs.readFileSync(path.resolve(__dirname, './test_depwindow.json'), 'utf8'));
		let ws = workshop.setupWorkshop(spec);

		let links = ws.textureMap['TT1'].flow;
		let cman = ws.assign('TT1');

		assert.equal(cman.toolLinkStack.length, links.length);
		assert.equal(cman.toolLinkStack[0].tool.id, links.reverse()[0].tool.id);
	});

	it("testDataDivision", function() {
		let spec = JSON.parse(fs.readFileSync(path.resolve(__dirname, './test_depwindow.json'), 'utf8'));
		let ws = workshop.setupWorkshop(spec);

		let ref = ws.dataDivision.refTable.getRef("VAR1");
		assert.equal(ref.__const, 135);

		let refmem = ws.dataDivision.spawnRefMem();
		let cell = refmem.cell(ref.__refnum);
		assert.equal(cell.size, 1);
		assert.equal(cell.isReadonly, true);
	});

});

describe("TestTool", function() {

	it("testReferences", function() {
		let spec = JSON.parse(fs.readFileSync(path.resolve(__dirname, './test_depwindow.json'), 'utf8'));
		let ws = workshop.setupWorkshop(spec);

		let tool = ws.toolMap['KNOT'];
		let refs = tool.references;

		assert.equal(refs.size, 2);
		assert.equal(refs.has('DATALEN'), true);
		assert.equal(refs.has('HEAD'), true);
		assert.equal(refs.has('HEAD1'), false);
	});

});

describe("TestToolLink", function() {

	it("testDependencies", function() {
		let spec = JSON.parse(fs.readFileSync(path.resolve(__dirname, './test_depwindow.json'), 'utf8'));
		let ws = workshop.setupWorkshop(spec);
		let tt = ws.textureMap['TT3'];

		let deps = tt.flow[0].dependencies;
		assert.equal(deps.length, 1);
		assert.equal(deps[0], 'DATALEN');

		deps = tt.flow[1].dependencies;
		assert.equal(deps.length, 1);
		assert.equal(deps[0], 'DATALEN');

	});

	it("testCall", function() {
		let spec = JSON.parse(fs.readFileSync(path.resolve(__dirname, './test_depwindow.json'), 'utf8'));
		let ws = workshop.setupWorkshop(spec);

		let tool = ws.toolMap['DEP_1'];
		let bytes = nio.Skein.allocate(4);
		let cman = ws.assign('TT1');

		tool.calls.forEach(c => {
			let fn = c.fn;
			fn(cman, tool, bytes);
			fn(cman, tool, bytes); // 2nd test...
		});

		assert.equal(cman.getRefValue('DATALEN', 0, 0), 8);
	});


});