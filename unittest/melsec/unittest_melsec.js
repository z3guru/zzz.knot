var fs = require('fs');
var path = require('path');
var assert = require('assert');

var rewire = require("rewire");

var nio = require('zzz.skein');
var workshop = rewire('../../workshop');

describe("TestCommand", function() {

	let context = {};

	before(function() {

		context.spec = JSON.parse(fs.readFileSync(path.resolve(__dirname, './melsec_spec.json'), 'utf8'));
		context.ws = workshop.setupWorkshop(context.spec);
	});

	it("testBatchRead CMD_0401", function() {

		// test varray
		let cman = context.ws.assign("BR");
		let skein = nio.Skein.allocate(1024);

		//
		//cman.initRef("FIXVAL", [0x5000]);
		cman.initRef("ROUTE", [0x00, 0xFF, 0x03FF, 0x00]);
		cman.initRef("MONTIMER", [0x0010]);
		cman.initRef("CMD", [0x0401]);
		cman.initRef("SUBCMD", [0x0001]);
		cman.initRef("POINTS", [8]);
		cman.initRef("DEVICE", [0x90, 0x64]);

		while ( !cman.knit(skein) );

		skein.flip();
		console.log('===============================');
		console.log(skein.toHexString());
	});

	it("testBatchRead CMD_1401", function() {

		// test varray
		let cman = context.ws.assign("BW");
		let skein = nio.Skein.allocate(1024);

		//
		//cman.initRef("FIXVAL", [0x5000]);
		cman.initRef("ROUTE", [0x00, 0xFF, 0x03FF, 0x00]);
		cman.initRef("MONTIMER", [0x0010]);
		cman.initRef("CMD", [0x1401]);
		cman.initRef("SUBCMD", [0x0000]);
		cman.initRef("POINTS", [3]);
		cman.initRef("DEVICE", [0xA8, 100]);
		cman.initRef("DATA", [0x1995, 0x1202, 0x1130]);

		while ( !cman.knit(skein) );

		skein.flip();
		console.log('===============================');
		console.log(skein.toHexString());
	});

	it("testRandomRead CMD_0403", function() {

		// test varray
		let cman = context.ws.assign("RR");
		let skein = nio.Skein.allocate(1024);

		//
		cman.initRef("FIXVAL", [0x5000]);
		cman.initRef("ROUTE", [0x00, 0xFF, 0x03FF, 0x00]);
		cman.initRef("CMD", [0x0403]);
		cman.initRef("MONTIMER", [0x0000]);
		cman.initRef("POINTS", [4, 3]);
		cman.initRef("DEVICE", [0xA8, 0, 0xC2, 0, 0x90, 100, 0xA8, 0x5DC, 0x9D, 0x160, 0x90, 0x457]);

		while ( !cman.knit(skein) );

		skein.flip();
		console.log('===============================');
		console.log(skein.toHexString());
	});


	it("testRandomWrite CMD_1402", function() {

		// test varray
		let cman = context.ws.assign("RR");
		let skein = nio.Skein.allocate(1024);

		//
		cman.initRef("FIXVAL", [0x5000]);
		cman.initRef("ROUTE", [0x00, 0xFF, 0x03FF, 0x00]);
		cman.initRef("CMD", [0x0403]);
		cman.initRef("MONTIMER", [0x0000]);
		cman.initRef("POINTS", [4, 3]);
		cman.initRef("DEVICE", [0xA8, 0, 0xC2, 0, 0x90, 100, 0xA8, 0x5DC, 0x9D, 0x160, 0x90, 0x457]);

		while ( !cman.knit(skein) );

		skein.flip();
		console.log('===============================');
		console.log(skein.toHexString());
	});

});