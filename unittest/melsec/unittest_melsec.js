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

	it("testRandomRead", function() {

		// test varray
		let cman = context.ws.assign("RR");
		let skein = nio.Skein.allocate(1024);

		//
		cman.initRef("FIXVAL", [0x5000]);
		cman.initRef("ROUTE", [0x00, 0xFF, 0x03FF, 0x00]);
		cman.initRef("CMD", [0x0403]);
		cman.initRef("MONTIMER", [0x0010]);
		cman.initRef("POINTS", [3, 2]);
		cman.initRef("DEVICE", [0x9C, 10, 0x9C, 11, 0x9C, 12, 0xA8, 255, 0xA8, 257]);

		while ( !cman.knit(skein) );

		skein.flip();
		console.log('===============================');
		console.log(skein.toHexString());
	});
});