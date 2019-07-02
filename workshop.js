var nio = require('zzz.skein');


const __helpers = {
	"isComment": function(s) { return s !== undefined && s.startsWith('###'); }

	, "parseValue": function(s) {

		if ( s === undefined ) return undefined;

		try
		{
			let _vv = s;

			if ( Array.isArray(s) )
			{
				_vv = [];
				s.forEach(itm => {
					_vv.push(__helpers.parseValue(itm));
				});
			}

			else if ( isNaN(s) )
			{
				let tokens = s.split(':');
				if ( tokens.length == 2 )
				{
					// if there are two elements, 1st element is a type. 2nd element is a value
					let _type = tokens[0];
					_vv  = tokens[1];

					switch(_type)
					{
						case 'b': _vv = parseInt(_vv, 2); break;
						case 'o': _vv = parseInt(_vv, 8); break;
						case 'd': _vv = parseInt(_vv, 10); break;
						case 'h': _vv = parseInt(_vv, 16); break;
						case 'f': _vv = parseFloat(_vv); break;

						case 's':
						default:
							// no-op
					}
				}
			}

			return _vv;
		}
		catch(e)
		{
			throw "invalid const definition";
		}
	}
}

/**
 * ref : data
 *
 * __refid
 * __refnum
 * __processMap : A map for processes.
 */

const __datafunc_countBytes = function(ref, cman, tool, skein)
{
	let dd = this;
	let args = arguments;
	let oldValue = cman.refMem.getRefValueByNum(ref.__refnum, 0, 0);
	if ( isNaN(oldValue) ) oldValue = 0;

	let newValue = oldValue + skein.remaining;
	cman.refMem.setRefValueByNum(ref.__refnum, newValue, 0, 0);
}

const __datafunc_map = {
	"countBytes":__datafunc_countBytes
}


/**
 * This class has primary information of data which is defined in "data" tag
 */
class DataDivision
{
	static setup(spec)
	{
		let dd = new DataDivision();

		for ( let refid in spec )
		{
			if ( __helpers.isComment(refid) ) continue;
			let refspec = spec[refid];
			let ref = { __refid:refid };

			if ( refspec.fn !== undefined )
			{
				ref.__fn = __datafunc_map[refspec.fn].bind(dd, ref);
			}

			if ( refspec.const !== undefined )
			{
				ref.__const = __helpers.parseValue(refspec.const);
			}

			dd._refTable.addRef(refid, ref);
		}

		return dd;
	}

	constructor()
	{
		this._refTable = new RefTable();
	}

	get refTable() { return this._refTable; }

	/**
	 * for checking const too
	 *
	 * @param refMem
	 * @param refid
	 * @param idx
	 * @param cycle
	 */
	getRefValue(refMem, refid, idx, cycle)
	{
		let ref = this._refTable.getRef(refid);
		if ( ref === undefined ) return undefined;

		let refnum = ref.__refnum;
		let memCell = this._refMem.cell(refnum);
		if ( memCell === undefined ) memCell = ref.__const;

		this._refMem.getRefValueByNum(refnum, idx, cycle);
	}

	spawnRefMem()
	{
		let refMem = new RefMem();
		this._refTable.injectConst2RefMem(refMem);

		return refMem;
	}
}

/**
 * "Ref" is a alias of data who has name.
 * If we worked with a name, our performance is lower than using index.
 */
class RefTable
{
	constructor()
	{
		this._seq = [];
		this._map = {};
	}

	get size() { return this._seq.length; }

	addRef(refid, ref)
	{
		if ( refid === undefined ) return undefined;
		if ( refid in this._map ) return this._map[refid];

		let s = this._seq.length;
		ref.__refid = refid;
		ref.__refnum = s;

		this._seq[s] = ref;
		this._map[refid] = ref;

		return this;
	}

	getRef(refid)
	{
		return this._map[refid];
	}

	getRefByNum(seqnum)
	{
		if ( seqnum < this._seq.length )
		{
			return this._seq[seqnum];
		}

		return undefined;
	}

	getRefnum(refid)
	{
		return refid in this._map ? this._map[refid].__refnum : -1;
	}


	findFunctionRefs()
	{
		let ids = [];
		for ( let refid in this._map )
		{
			let ref = this._map[refid];
			if ( ref.__fn !== undefined ) ids.push(refid);
		}

		return ids;
	}

	getFunction(refid)
	{
		let ref = this._map[refid];
		return ref !== undefined ? ref.__fn : undefined;
	}

	injectConst2RefMem(refmem)
	{
		let ids = [];
		for ( let refid in this._map )
		{
			let ref = this._map[refid];
			if ( ref.__const !== undefined )
			{
				refmem.initCell(ref.__refnum, ref.__const, true);
			}
		}
	}
}

/**
 *
 */
class RefMem
{
	constructor()
	{
		this._memCell = [];
	}

	setRefValueByNum(refnum, value, idx, cycle)
	{
		let refmem = this.cell(refnum, true);
		refmem.setValue(value, idx, cycle);
	}

	// TODO default value
	getRefValueByNum(refnum, idx, cycle)
	{
		let refmem = this._memCell[refnum];
		return refmem === undefined ? undefined : refmem.getValue(idx, cycle);
	}

	initCell(refnum, value, isReadonly)
	{
		let memCell = this._memCell[refnum];
		if ( memCell === undefined && value !== undefined )
		{
			memCell = this._memCell[refnum] = new RefMemCell(value, isReadonly);
		}
		else
		{
			memCell.init(value, isReadonly);
		}

		return memCell;
	}

	cell(refnum, initVal, isReadonly)
	{
		let memCell = this._memCell[refnum];
		if ( memCell === undefined ) memCell = this.initCell(refnum, initVal, isReadonly);

		return memCell;
	}
}

class RefMemCell
{
	constructor(value, isReadonly)
	{
		this._isReadonly = false;
		this.init(value, isReadonly);

		this._base = 0;
		this._autoIndex = 0;
		this._autoCycle = 0;
	}

	get size()          { return this._values === undefined ? 0 : this._values.length; }
	get isReadonly()    { return this._isReadonly; }
	get values()        { return this._values; }

	init(value, isReadonly)
	{
		if ( value === undefined ) this._values = [];
		else
		{
			this._isReadonly = isReadonly !== undefined && isReadonly;
			if ( Array.isArray(value) ) this._values = value.slice(0);
			else
				this._values = [value];
		}
	}

	getValue(idx, cycle)
	{
		let ii = this._memIdx(idx, cycle);
		return this._values[ii];
	}

	setValue(value, idx, cycle)
	{
		if ( this._isReadonly ) throw "This memcell is net writable";

		let ii = this._memIdx(idx, cycle);
		this._values[ii] = value;
		return this;
	}

	upCycle(cycle)
	{
		this._jumpCycle(++this._autoCycle);
	}

	rewind()
	{
		this._base = 0;
		this._autoIndex = 0;
		this._autoCycle = 0;
	}

	_memIdx(idx, cycle)
	{
		if ( cycle !== undefined && cycle !== this._autoCycle ) this._jumpCycle(cycle);
		if ( idx !== undefined && idx >= this._autoIndex ) this._autoIndex = idx + 1;

		return this._base + (idx === undefined ? this._autoIndex++ : idx);
	}

	_jumpCycle(cycle)
	{
		this._autoCycle = cycle;
		this._base = this._base + this._autoIndex;
	}
}

/**
 * The values of some items of the protocol such as 'byte length' are determined after the subsequent bytes are set.
 * This class determines whether the end of the following item has been reached.
 */
class CallDependencyWindow
{
	constructor()
	{
		this._lastEnd = {};
	}

	/**
	 *
	 * @param toolLinks
	 * @param hasEnd, To check whether there are ends in sub toolLinks.
	 * @param callee
	 * @param fn
	 */
	traverse(toolLinks, hasEnd, callee, fnRefid)
	{
		if ( toolLinks === undefined ) return;
		if ( !Array.isArray(toolLinks) ) throw "tools must be array";

		let that = this;

		for ( let i = 0; i < toolLinks.length; i++ )
		{
			let link = toolLinks[i];
			let t = link.tool;

			// check my calls ...
			if ( Array.isArray(t.calls) )
			{
				t.calls.some(function(c) {
					if ( c.callee === callee && c.refid === fnRefid )
					{
						that._traceEnd(callee, fnRefid, link);
						if ( hasEnd !== undefined ) hasEnd[callee + ':' + fnRefid] = true;
						return false;
					}
				});
			}

			// check sub tools ...
			let mycheck = {};
			that.traverse(link.subLinks, mycheck, callee, fnRefid);

			if ( link.isBranch )
			{
				if ( link.hasEnd === undefined ) link.hasEnd = {};
				link.hasEnd = Object.assign(link.hasEnd, mycheck);
			}

			if ( hasEnd !== undefined )
			{
				for ( let k of Object.keys(mycheck) )
				{
					hasEnd[k] = true;
				}
			}
		}
	}

	_traceEnd(callee, fnRefid, toolLink)
	{
		let key = callee + ':' + fnRefid;
		let prev = this._lastEnd[key];
		this._lastEnd[key] = toolLink;

		toolLink.setEndOfCDW(callee, fnRefid);
		if ( prev !== undefined ) prev.clearEndOfCDW(callee, fnRefid);
	}
}

/**
 * context
 */
class CraftsMan
{
	constructor(ws, seq, texture)
	{
		this._workshop = ws;
		this._seq = seq;
		this._texture = texture;

		//
		this._toolLinkStack = this._buildToolLinkStack(this._texture.flow);

		// TODO by settings. & refatoring
		// { toolLink:..., skein:..., deps:...};
		this._lazyStack = [];

		//
		this._refMem = ws.dataDivision.spawnRefMem();
	}

	knit(skein)
	{
		let toolLink = this._toolLinkStack.pop();

		// check whether there are dependencies of tool
		if ( toolLink.dependencies !== undefined )
		{
			this._addLazyStack(toolLink);
			return;
		}

		// if there is a lazy, then use his skein as buf
		let buf = this._lazyStack.length == 0 ? skein : this._lazyStack.slice(-1)[0].skein;
		toolLink.knit(this, buf);

		// check dependencies has been resolved.
		this._lazyStack.forEach(function(e) {
			let lazyDeps = e.deps;
			for ( let k = lazyDeps.length - 1; k >= 0; k-- )
			{
				if ( toolLink.isEndOfCDW('data', lazyDeps[k]) )
				{
					e.deps.splice(k, 1);
				}
			}

		});

		// manipulate lazy whose dependencies all have been resolved.
		let last = this._lazyStack.slice(-1)[0];
		if ( last !== undefined && Array.isArray(last.deps) )
		{
			if ( last.deps.length == 0 )
			{
				this._lazyStack.pop();
				buf = this._lazyStack.length == 0 ? skein : this._lazyStack.slice(-1)[0].skein;
				last.toolLink.knit(this, buf);

				last.skein.flip();
				buf.putSkein(last.skein);
			}
		}

		// check whether kniting is complete
		if ( this._toolLinkStack.length == 0 )
		{
			if ( this._lazyStack.length == 0 ) return true;
			else
				throw "Some dependencies are not resolved";
		}

		return false;
	}

	unknit(skein)
	{
		let toolLink = this._toolLinkStack.pop();
		if ( !toolLink.unknit(this, skein) ) this._toolLinkStack.push(toolLink);

		return this._toolLinkStack.length == 0;
	}

	setRefValue(refid, value, idx, cycle)
	{
		let refnum = this._workshop.dataDivision.refTable.getRefnum(refid);
		this._refMem.setRefValueByNum(refnum, value, idx, cycle);
	}

	// TODO default value
	getRefValue(refid, idx, cycle)
	{
		let refnum = this._workshop.dataDivision.refTable.getRefnum(refid);
		return this._refMem.getRefValueByNum(refnum, idx, cycle);
	}

	getRefSize(refid)
	{
		let refnum = this._workshop.dataDivision.refTable.getRefnum(refid);
		let cell = this._refMem.cell(refnum);
		return cell === undefined ? 0 :  cell.size;
	}


	// TODO default value
	initRef(refid, value, isReadonly)
	{
		let refnum = this._workshop.dataDivision.refTable.getRefnum(refid);
		if ( refnum == -1 )
		{
			let ref = {};
			this._workshop.dataDivision.refTable.addRef(refid, ref);
			refnum = ref.__refnum;
		}

		return this._refMem.initCell(refnum, value, isReadonly);
	}

	get texture() { return this._texture; }
	get toolLinkStack() { return this._toolLinkStack; }
	get chunkBuf() { return this._chunkBuf; }
	get refMem()   { return this._refMem; }


	_buildToolLinkStack(flow)
	{
		let toolLinkStack = [];
		this._texture.flow.reverse().forEach((t)=>toolLinkStack.push(t));

		return toolLinkStack;
	}

	_addLazyStack(toolLink)
	{
		let lazy = { toolLink:toolLink, skein:nio.Skein.allocate(10 * 1024), deps:toolLink.dependencies.slice(0)};
		this._lazyStack.push(lazy);

		return lazy;
	}
}


/**
 * A context of specifications
 */
class Workshop
{
	static setup(spec)
	{
		var ws = new Workshop();

		// setup environment...
		ws._env = spec.environment;
		// setup data division
		ws._dd = DataDivision.setup(spec.data);
		// setup tools
		ws._setupTools(spec.tools);
		Object.values(ws.toolMap).forEach((t) => t.lazySetup(ws));
		// setup textures
		ws._setupTextures(spec.textures);

		return ws;
	}

	constructor()
	{
		this._seq = 0;
	}

	get env()           { return this._env; }
	get dataDivision()  { return this._dd; }
	get toolMap()       { return this._toolMap; }
	get textureMap()    { return this._textureMap; }

	/**
	 * assign {@link CraftsMan}
	 * @param ttid
	 */
	assign(ttid)
	{
		return new CraftsMan(this, this._seq++, this._textureMap[ttid]);
	}


	_setupTools(spec)
	{
		this._toolMap = {};
		for ( let tid in spec )
		{
			if ( __helpers.isComment(tid) ) continue;
			this._toolMap[tid] = Tool.setup(spec[tid]);
		}
	}

	/**
	 * {@link Workshop#_setupTools} must be called before calling this
	 *
	 * @param spec
	 * @private
	 */
	_setupTextures(spec)
	{
		this._textureMap = {};
		for ( let ttid in spec )
		{
			if ( __helpers.isComment(ttid) ) continue;
			this._textureMap[ttid] = Texture.setup(this, ttid, spec[ttid]);
		}

		// traverse Textures's flow for functional data
		this._traverseCDW();
	}

	/**
	 * TODO rename 'function'
	 * @private
	 */
	_traverseCDW()
	{
		let fnRefs = this._dd.refTable.findFunctionRefs();

		Object.values(this._textureMap).forEach(function(tt) {
			tt.traverseCDW("data", fnRefs);
		});
	}

}

/**
 * byte stream <===> data
 */
class Tool
{
	static setup(spec)
	{
		let t = new Tool();

		// call..
		if ( Array.isArray(spec.calls) )
		{
			t._calls = [];
			spec.calls.forEach(function(c) {
				let tokens = c.split(':');
				t._calls.push({callee:tokens[0], refid:tokens[1]});
			});
		}

		// sub tools ...
		if ( Array.isArray(spec.subtools) )
		{
			t._subtools = [];
			spec.subtools.forEach(function(ss) {
				t._subtools.push(Tool.setup(ss));
			});
		}

		// knots ...
		if ( Array.isArray(spec.knots) )
		{
			t._references = new Set();
			t._knots = [];
			for ( var i = 0; i < spec.knots.length; i++ )
			{
				let newKnot = Knot.setup(spec.knots[i]);
				t._knots.push(newKnot);

				newKnot.references.forEach(refid => t._references.add(refid));
			}
		}

		// chunk module ...
		if ( spec.chunk !== undefined )
		{
			t._chunkModule = ChunkModuleKit.setup(spec.chunk);
		}

		// if knots and no chunk ==
		if ( t._chunkModule === undefined && t._knots !== undefined && t._knots.length > 0 )
		{
			let sz = 0;
			t._knots.forEach(function(t) { sz += t.minimum; });
			t._chunkModule = ChunkModuleKit.setup({method:"bytes", size:sz});
		}

		// extends ...
		// only set lazy extends...
		if ( spec.extends ) t._lazyExtends = spec.extends;

		return t;
	}

	get calls()       { return this._calls === undefined ? this._superProperty('_calls') : this._calls; }
	get knots()       { return this._knots === undefined ? this._superProperty('_knots') : this._knots; }
	get subtools()    { return this._subtools === undefined ? this._superProperty('_subtools') : this._subtools; }
	get chunkModule() { return this._chunkModule === undefined ? this._superProperty('_chunkModule') : this._chunkModule; }
	get references()  { return this._references === undefined ? this._superProperty('_references') : this._references;  }

	lazySetup(workshop)
	{
		if ( this._lazyExtends !== undefined )
		{
			if ( !workshop.toolMap.hasOwnProperty(this._lazyExtends) )
				throw "Not found a super tool of this, extends=" + this._lazyExtends;

			this._super = workshop.toolMap[this._lazyExtends];
		}

		// subtool...
		if ( Array.isArray(this._subtools) ) this._subtools.forEach((t) => t.lazySetup(workshop));

		// call functions...
		if ( this._calls !== undefined )
		{
			let refTable = workshop.dataDivision.refTable;
			this._calls.forEach(c => {
				c.fn = refTable.getFunction(c.refid);
			});
		}

	}

	knit(cman, skein)
	{
		if ( this.log ) console.log(this.log);

		// if use chunk?, then subtools must unknit of chunked subskein.
		let chunkModule = this.chunkModule;
		if ( chunkModule !== undefined ) chunkModule.made(cman, skein);

		return this._knit(cman, skein);
	}

	/**
	 * chunking, ToolLink has done it
	 *
	 * @param cman
	 * @param skein
	 * @returns {boolean}
	 */
	unknit(cman, skein)
	{
		if ( this.log ) console.log(this.log);
		return this._unknit(cman, skein);
	}

	_superProperty(name)
	{
		return this._super === undefined ? undefined : this._super[name];
	}

	_knit(cman, skein)
	{
		let knots = this.knots;
		if ( knots )
		{
			knots.forEach(function(k) {
				k.knit(cman, skein);
			});
		}

		return true;
	}

	_unknit(cman, skein)
	{
		let knots = this.knots;
		if ( knots )
		{
			knots.forEach(function(k) {
				k.unknit(cman, skein);
			});
		}

		return true;
	}
}

/**
 * {@link Tool} wrapper in {@link Texture}
 */
class ToolLink
{
	constructor(tool)
	{
		this._tool = tool;
		this._endOfCDW = undefined;   // for dependency window
		//this._hasEnd = undefined;

		//
		this._subLinks = this._makeSubLinks(tool.subtools);
	}

	get tool()          { return this._tool; }
	get isBranch()      { return false; } // TODO implements
	get subLinks()      { return this._subLinks; }
	get dependencies()  { return this._dependencies; }

	/*
	get hasEnd()    { return this._hasEnd; }
	set hasEnd(v)   { this._hasEnd = v; }
	*/
	knit(cman, skein)
	{
		// mark current of skein...
		let posS = skein.position;
		let result = this._tool.knit(cman, skein);

		//
		if ( result )
		{
			// call functions.
			if ( this._tool.calls !== undefined )
			{
				// TODO classify callee
				let caller = this._tool;
				let bytes = skein.duplicate(); // set part that was made by tool
				bytes.position = posS;
				bytes.limit = skein.position;

				this._tool.calls.forEach(c => {
					let fn = c.fn;
					fn(cman, caller, bytes);
				})
			}

			// if there are sub toolLinks, psuh those into stack
			if ( this._subLinks !== undefined )
			{
				for ( let k = this._subLinks.length - 1; k >=0; k-- )
				{
					cman.toolLinkStack.push(this._subLinks[k]);
				}
			}
		}

		return result;
	}

	unknit(cman, skein)
	{
		if ( this._tool.log ) console.log(this._tool.log);

		let result = false;

		// if use chunk?, then subtools must unknit of chunked subskein.
		let chunkModule = this._tool.chunkModule;
		if ( chunkModule )
		{
			let chunked = chunkModule.chunk(cman, skein);
			if ( chunked !== undefined ) result = this._tool.unknit(cman, chunked);

			//
			if ( !result ) throw "Chunk is invalid !!";
		}
		else
			result = this._tool.unknit(cman, skein);

		//
		if ( result && this._subLinks !== undefined )
		{
			for ( let k = this._subLinks.length - 1; k >=0; k-- )
			{
				cman.toolLinkStack.push(this._subLinks[k]);
			}
		}

		return result;
	}

	setEndOfCDW(callee, fnRefid)
	{
		if ( this._endOfCDW === undefined ) this._endOfCDW = {};
		this._endOfCDW[callee + ':' + fnRefid] = true;
	}

	clearEndOfCDW(callee, fnRefid)
	{
		if ( this._endOfCDW !== undefined ) delete this._endOfCDW[callee + ':' + fnRefid];
	}

	isEndOfCDW(callee, fnRefid)
	{
		return this._endOfCDW !== undefined && this._endOfCDW[callee + ':' + fnRefid] === true;
	}

	/**
	 * @{link Tool}
	 * TODO redesign
	 */
	checkDependencies(callee, fnArray)
	{
		if ( callee !== 'data' ) return;

		let refSet = this._tool.references;
		if ( refSet !== undefined )
		{
			let deps = [];

			refSet.forEach(refid => {
				if ( fnArray.includes(refid) ) deps.push(refid);
			});

			this._dependencies = deps.length == 0 ? undefined : deps;
		}

		// check sub ...
		if ( this._subLinks !== undefined )
		{
			this._subLinks.forEach(sub => sub.checkDependencies(callee, fnArray));
		}
	}


	_makeSubLinks(subtools)
	{
		if ( subtools === undefined || subtools.length == 0 ) return;

		let sublinks = [];
		subtools.forEach(t => sublinks.push(new ToolLink(t)));

		return sublinks;
	}
}

class Texture
{
	constructor(id)
	{
		this._id = id;
		this._cdwMap = {};
	}

	static setup(workshop, ttid, spec)
	{
		let tt = new Texture(ttid);

		// flow...
		if ( spec.flow )
		{
			tt._flow = [];
			spec.flow.forEach(function(tid) {
				let t = workshop.toolMap[tid];
				if ( t === undefined ) throw "unknown tool, tid=" + tid;

				tt._flow.push(new ToolLink(t));
			})
		}

		return tt;
	}

	/**
	 * lazy called by @{link Workshop}
	 */
	traverseCDW(callee, fnArray)
	{
		let that = this;
		let cdw = new CallDependencyWindow();

		// traverse call dependecies...
		fnArray.forEach(function(fn) {
			let hasEnd = {};
			cdw.traverse(that._flow, hasEnd, callee, fn);

			// TODO check hasEnd
		});

		//
		this._flow.forEach(toolLink => {
			toolLink.checkDependencies(callee, fnArray);
		});
	}

	get cdwMap() { return this._cdwMap; }
	get flow()   { return this._flow; }
}

const __knot_libs = {

	setupSyntaxKnot: function(syntax, refid)
	{
		if ( syntax === undefined ) throw new Error("A knot's syntax is undefined");

		if ( syntax.startsWith("bit") )
		{
			let defstr = syntax.substring(syntax.indexOf('.') + 1);
			return BitKnot.setup(defstr, refid);
		}
		else if ( syntax.startsWith("bin") )
		{
			let defstr = syntax.substring(syntax.indexOf('.') + 1);
			return BinaryKnot.setup(defstr, refid);
		}
	}
	,

	setupConst: function(spec)
	{
		return __helpers.parseValue(spec);
	}
}

class Knot
{
	constructor(defs, options)
	{
		this._defs = defs;
		this._options = options;

		let refs = new Set();
		if ( this._defs !== undefined )
		{
			this._defs.forEach(d => { if ( d.refid !== undefined ) refs.add(d.refid); })
		}

		this._references = refs;
	}

	static setup(spec)
	{
		try
		{
			let knot = undefined;

			if ( typeof spec === "string" )
			{
			}
			else if ( spec.syntax !== undefined )
			{
				knot = __knot_libs.setupSyntaxKnot(spec.syntax, spec.refid);
				knot._localRefid = spec.refid;
				knot._references.add(spec.refid);
			}

			knot._spec = spec || {};
			knot._spec.iter = spec.iter === undefined ? 1 : spec.iter;
			//knot._localRef = spec.refid ? cman.refTable.addRef(spec.refid, {}) : undefined;

			// const =============
			knot._const = __knot_libs.setupConst(spec.const);

			// cycle =============
			knot._loop = isNaN(spec.loop) ? ('*' === spec.loop ? 0 : 1) : parseInt(spec.loop);

			return knot;
		}
		catch(e)
		{
			console.error(e.message, e);
		}
	}

	get minimum() { return this._minimum; }
	get references() { return this._references; }

	knit(cman, skein)
	{
		let cycle = 0;
		let loop = this._loop;

		if ( loop === 0 )
		{
			loop = cman.getRefSize(this._localRefid) / this._defs.length;
			if ( loop < 1 ) loop = 1;
		}

		for ( var i = 0; i < loop; i++ )
		{
			this._knit(cman, skein, cycle++);
		}
	}

	unknit(cman, skein)
	{
		let cycle = 0;

		while(skein.hasRemaining)
		{
			this._unknit(cman, skein, cycle++);
		}
	}

	_compileNeedSize(sz)
	{
		if ( isNaN(sz) )
		{

		}
		else
			return function() { return sz; }
	}

	_getValue(cman, defrefid, defidx, cycle)
	{
		try
		{
			let refid = defrefid || this._localRefid;
			return refid ? cman.getRefValue(refid, defidx, cycle) : this._const[defidx];
		}
		catch(e)
		{
		}

		return 0;
	}

	_setValue(value, cman, defref, defidx, cycle)
	{
		try
		{
			let ref = defref || this._localRefid;
			cman.setRefValue(ref, value, defidx, cycle);
		}
		catch(e)
		{
		}

		return 0;
	}

}

__bit_abfunc = function(a, b, v)
{
	return a * v + b;
}

__bit_masks = [ 0, 0b1, 0b11, 0b111, 0b1111, 0b11111, 0b111111, 0b1111111, 0b11111111 ];

class BitKnot extends Knot
{
	static setup(syntax, refid)
	{
		let tokens = null;
		let re = /\s*([bB])\s*(\d+)\s*\[\s*([\w\.]+)?\s*:\s*(\d+)\s*\]\s*/g;
		let defs = [];
		let offset = 0;

		while( (tokens = re.exec(syntax)) !== null )
		{
			let def = {};
			def.bB = tokens[1] == 'b';
			def.sz = parseInt(tokens[2]);
			def.refid = tokens[3].trim().length == 0 ? refid : tokens[3];
			def.idx = isNaN(tokens[4]) ? -1 : parseInt(tokens[4]);
			def.mask = __bit_masks[def.sz];
			def.func = __bit_abfunc.bind(def, def.bB ? 1 : -1, def.bB ? 0 : def.mask);
			def.offset = offset;

			defs.push(def);
			offset += def.sz;
		}

		let knot = new BitKnot(defs);
		knot._minimum = 1;

		return knot;
	}

	_knit(cman, skein, cycle)
	{
		let bb = 0;

		for ( let i = 0; i < this._defs.length; i++ )
		{
			let vv = this._getValue(cman, this._defs[i].refid, this._defs[i].idx, cycle);

			vv = this._defs[i].func(vv & this._defs[i].mask);
			bb |= vv << (8 - this._defs[i].offset - this._defs[i].sz);
		}

		skein.put(bb);
	}

	_unknit(cman, skein, cycle)
	{
		let bb = skein.get();

		for ( let i = 0; i < this._defs.length; i++ )
		{
			let vv = bb >> (8 - this._defs[i].offset - this._defs[i].sz);
			vv = vv & this._defs[i].mask;

			let refid = this._defs[i].refid;
			cman.setRefValue(refid, vv, this._defs[i].idx, cycle)
		}
	}
}

class BinaryKnot extends Knot
{
	static setup(syntax)
	{
		let tokens = null;
		let re = /\s*([bB])\s*(\d+)(?:\s*\[\s*([\w\.]+)?\s*:\s*(\d+)\s*\])?\s*/g;
		let defs = [];

		let idxGlobalOffset = 0;
		let idxRefOffset = {};
		let minimum = 0;

		while( (tokens = re.exec(syntax)) !== null )
		{
			let def = {};

			def.bB = tokens[1] == 'b';
			def.sz = parseInt(tokens[2]);
			def.refid = tokens[3];
			def.idx = isNaN(tokens[4]) ? -1 : parseInt(tokens[4]);

			defs.push(def);
			minimum += def.sz;
		}

		let knot = new BinaryKnot(defs, {idxGlobalOffset:idxGlobalOffset, idxRefOffset:idxRefOffset});
		knot._minimum = minimum;

		return knot;
	}

	_knit(cman, skein, cycle)
	{
		for ( let i = 0; i < this._defs.length; i++ )
		{
			let vv = this._getValue(cman, this._defs[i].refid, this._defs[i].idx, cycle);

			skein.order = this._defs[i].bB ? nio.Skein.LITTLE_ENDIAN : nio.Skein.BIG_ENDIAN;
			skein.putUInt(vv, this._defs[i].sz);
		}
	}

	_unknit(cman, skein, cycle)
	{
		for ( let i = 0; i < this._defs.length; i++ )
		{
			skein.order = this._defs[i].bB ? nio.Skein.LITTLE_ENDIAN : nio.Skein.BIG_ENDIAN;
			let vv = skein.getUInt(this._defs[i].sz);
			this._setValue(vv, cman, this._defs[i].refid, this._defs[i].idx, cycle)
		}
	}

}

class ChunkModuleKit
{
	static setup(def)
	{
		if ( def.method === undefined ) throw "chunk method is not defined";

		var m = undefined;
		switch(def.method)
		{
			case ChunkModule.METHOD.BYTES: m = new ChunkModuleBytes(def); break;
			case ChunkModule.METHOD.MARK : m = new ChunkModuleMark(def); break;
			default:
				throw "unsupported chunk method=" + def.method;
		}

		return m;
	}
}

const ChunkMethod = { BYTES:'bytes', MARK:'mark' };
class ChunkModule
{
	constructor(def)
	{
	}

	static get METHOD() { return ChunkMethod; }

	/**
	 * get chunk and put a chunk to cman
	 *
	 * @param skein
	 * @param chunkBuf temporary buffer, if this is undefined and chunking is not completed, next chunking will be started at first byte.
	 * @return if there is a chunk then a skein's cut otherwise undefined
	 */
	chunk(cman, skein) { }

	made(cman, skein) { }
}

class ChunkModuleBytes extends ChunkModule
{
	constructor(def)
	{
		super(def);
		this._remain = 0;
		this._needSize = this._compileNeedSize(def.size);
	}

	chunk(cman, skein)
	{
		let sz = this._needSize();
		return skein.remaining < sz ? undefined : skein.cut(sz);
	}

	made(cman, skein)
	{
		var sz = this._needSize();
		if ( sz == undefined ) return true;

		return skein.remaining >= sz;
	}

	/**
	 *
	 * @param sz a definition of a size
	 * @private
	 */
	_compileNeedSize(sz)
	{
		if ( isNaN(sz) )
		{
			// TODO implement
		}
		else
			return function() { return sz; }
	}
}

class ChunkModuleMark extends ChunkModule
{
	constructor(def)
	{
		super(def);
		this._markInclude = def.markInclude === undefined ? 3 : def.markInclude;
		this._startMark = def.start;
		this._endMark = def.end;

		this._reset();
	}

	chunk(cman, skein)
	{
		try
		{
			let dupBuf = skein.duplicate();
			// TODO need to modify the below exception's message
			if ( dupBuf.remaining() < this._lastOffset ) throw "Offset overflow";
			dupBuf.skip(this._lastOffset);

			while(dupBuf.hasRemaining())
			{
				let bb = skein.get();
				this._lastOffset++;

				switch(this._state)
				{
					// check first
					case 0:
						this._pos_0 = dupBuf.position - 1;       // a position of a begin of start mark
						_checkStart(bb);
						break;

					// continue to check start marks
					case 1:
						_checkStart(bb);
						break;

					// data
					case 2:
						this._pos_1 = dupBuf.position - 1;       // a position of data
					// continue to check end mark

					// check end
					case 3:
						this._pos_2 = dupBuf.position - 1;       // a position of a begin of end mark
						_checkEnd(bb);
						break;

					// continue to check end marks
					case 4:
						this._pos_3 = dupBuf.position - 1;
						_checkEnd(bb);
						if ( this._state != 5 ) break;

					// all is OK
					case 5:
						this._reset();

						// check whether there is data
						if ( this._markInclude != 0 || this._pos_1 != this._pos_2 )
						{
							let posS = (this._markInclude & 2) == 0 ? this._pos_1 : this._pos_0;
							let posE = (this._markInclude & 1) == 0 ? this._pos_2 : this._pos_3;
							let part = skein.duplicate();
							part.position = posS;
							part.limit = posE + 1;

							dupBuf.limit(dupBuf.position);
							dupBuf.position(skein.position);
							return dupBuf;
						}
				}
			}
		}
		catch(e)
		{
			this._reset();
		}

		return undefined;
	}

	_reset()
	{
		this._checkStart = this._startMark === undefined ? 0 : this._startMark.length;
		this._checkEnd = this._endMark === undefined ? 0 : this._endMark.length;
		this._lastOffset = 0;

		// if there is no start's mark then skip checking start.
		this._state = this._checkStart == 0 ? 2 : 0;
	}

	_checkStart(bb)
	{
		let idx = this._startMark.length - this._checkStart;

		if ( bb == this._startMark[idx] )
		{
			this._checkStart = this._checkStart - 1;
			this._state = this._checkStart === 0 ? 2 : 1;
		}
		else
		{
			this._reset();
		}
	}

	_checkEnd(bb)
	{
		let idx = this._endMark.length - this._checkEnd;

		if ( bb == this._endMark[idx] )
		{
			this._checkEnd = this._checkEnd - 1;
			this._state = this._checkEnd === 0 ? 5 : 4;
		}
		else
		{
			// reset indicators for checking end
			this._checkEnd = this._endMark === undefined ? 0 : this._endMark.length;
			this._state = 3;
		}
	}
}


module.exports = {
	  version: "0.1"
	, setupWorkshop: function(spec)
	{
		return Workshop.setup(spec);
	}
}