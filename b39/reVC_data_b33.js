
  var Module = typeof Module != 'undefined' ? Module : {};

  Module['expectedDataFileDownloads'] ??= 0;
  Module['expectedDataFileDownloads']++;
  (() => {
    // Do not attempt to redownload the virtual filesystem data when in a pthread or a Wasm Worker context.
    var isPthread = typeof ENVIRONMENT_IS_PTHREAD != 'undefined' && ENVIRONMENT_IS_PTHREAD;
    var isWasmWorker = typeof ENVIRONMENT_IS_WASM_WORKER != 'undefined' && ENVIRONMENT_IS_WASM_WORKER;
    if (isPthread || isWasmWorker) return;
    var isNode = typeof process === 'object' && typeof process.versions === 'object' && typeof process.versions.node === 'string';
    function loadPackage(metadata) {

      var PACKAGE_PATH = '';
      if (typeof window === 'object') {
        PACKAGE_PATH = window['encodeURIComponent'](window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/')) + '/');
      } else if (typeof process === 'undefined' && typeof location !== 'undefined') {
        // web worker
        PACKAGE_PATH = encodeURIComponent(location.pathname.substring(0, location.pathname.lastIndexOf('/')) + '/');
      }
      var PACKAGE_NAME = '/home/z/my-project/b2-web/reVC.data.b33';
      var REMOTE_PACKAGE_BASE = 'reVC.data.b33';
      var REMOTE_PACKAGE_NAME = Module['locateFile'] ? Module['locateFile'](REMOTE_PACKAGE_BASE, '') : REMOTE_PACKAGE_BASE;
var REMOTE_PACKAGE_SIZE = metadata['remote_package_size'];

      function fetchRemotePackage(packageName, packageSize, callback, errback) {
        if (isNode) {
          require('fs').readFile(packageName, (err, contents) => {
            if (err) {
              errback(err);
            } else {
              callback(contents.buffer);
            }
          });
          return;
        }
        // B3.10-STATIC: data package = 2 static chunks on the Pages host
        // (no Range proxy). Fetch both, report progress, concat, callback.
        Module['dataFileDownloads'] = Module['dataFileDownloads'] || {};
        (function () {
          var CHUNKS = [
            { u: '../p/b33/0.bin', s: 87697276 },
            { u: '../p/b33/1.bin', s: 87697275 }
          ];
          var states = CHUNKS.map(function () { return { loaded: 0 }; });
          var report = function () {
            var loaded = 0, total = 0;
            for (var i = 0; i < CHUNKS.length; i++) { loaded += states[i].loaded; total += CHUNKS[i].s; }
            Module['dataFileDownloads'][REMOTE_PACKAGE_NAME] = { loaded: loaded, total: total };
            Module['setStatus'] && Module['setStatus']('Downloading data... (' + loaded + '/' + total + ')');
          };
          Promise.all(CHUNKS.map(function (c, i) {
            return fetch(c.u).then(function (response) {
              if (!response.ok) throw new Error(c.u + ': ' + response.status);
              if (!response.body && response.arrayBuffer) {
                return response.arrayBuffer().then(function (b) {
                  states[i].loaded = b.byteLength; report();
                  return new Uint8Array(b);
                });
              }
              var reader = response.body.getReader();
              var parts = [];
              var step = function (r) {
                if (r.done) {
                  var totalLen = 0; parts.forEach(function (pp) { totalLen += pp.length; });
                  var out = new Uint8Array(totalLen), off = 0;
                  parts.forEach(function (pp) { out.set(pp, off); off += pp.length; });
                  states[i].loaded = totalLen; report();
                  return out;
                }
                parts.push(r.value);
                states[i].loaded += r.value.length; report();
                return reader.read().then(step);
              };
              return reader.read().then(step);
            });
          })).then(function (outs) {
            var total = 0; outs.forEach(function (o) { total += o.length; });
            if (total !== packageSize) throw new Error('data chunks total ' + total + ' != expected ' + packageSize);
            var out = new Uint8Array(total), off = 0;
            outs.forEach(function (o) { out.set(o, off); off += o.length; });
            callback(out.buffer);
          }).catch(function (e) { errback(e); });
        })();
        return;

      };

      function handleError(error) {
        console.error('package error:', error);
      };

      var fetchedCallback = null;
      var fetched = Module['getPreloadedPackage'] ? Module['getPreloadedPackage'](REMOTE_PACKAGE_NAME, REMOTE_PACKAGE_SIZE) : null;

      if (!fetched) fetchRemotePackage(REMOTE_PACKAGE_NAME, REMOTE_PACKAGE_SIZE, (data) => {
        if (fetchedCallback) {
          fetchedCallback(data);
          fetchedCallback = null;
        } else {
          fetched = data;
        }
      }, handleError);

    function runWithFS(Module) {

      function assert(check, msg) {
        if (!check) throw msg + new Error().stack;
      }
Module['FS_createPath']("/", "anim", true, true);
Module['FS_createPath']("/", "audio", true, true);
Module['FS_createPath']("/", "data", true, true);
Module['FS_createPath']("/data", "maps", true, true);
Module['FS_createPath']("/data/maps", "airport", true, true);
Module['FS_createPath']("/data/maps", "airportn", true, true);
Module['FS_createPath']("/data/maps", "bank", true, true);
Module['FS_createPath']("/data/maps", "bar", true, true);
Module['FS_createPath']("/data/maps", "bridge", true, true);
Module['FS_createPath']("/data/maps", "cisland", true, true);
Module['FS_createPath']("/data/maps", "club", true, true);
Module['FS_createPath']("/data/maps", "concerth", true, true);
Module['FS_createPath']("/data/maps", "docks", true, true);
Module['FS_createPath']("/data/maps", "downtown", true, true);
Module['FS_createPath']("/data/maps", "downtows", true, true);
Module['FS_createPath']("/data/maps", "golf", true, true);
Module['FS_createPath']("/data/maps", "haiti", true, true);
Module['FS_createPath']("/data/maps", "haitin", true, true);
Module['FS_createPath']("/data/maps", "hotel", true, true);
Module['FS_createPath']("/data/maps", "islandsf", true, true);
Module['FS_createPath']("/data/maps", "lawyers", true, true);
Module['FS_createPath']("/data/maps", "littleha", true, true);
Module['FS_createPath']("/data/maps", "mall", true, true);
Module['FS_createPath']("/data/maps", "mansion", true, true);
Module['FS_createPath']("/data/maps", "nbeach", true, true);
Module['FS_createPath']("/data/maps", "nbeachbt", true, true);
Module['FS_createPath']("/data/maps", "nbeachw", true, true);
Module['FS_createPath']("/data/maps", "oceandn", true, true);
Module['FS_createPath']("/data/maps", "oceandrv", true, true);
Module['FS_createPath']("/data/maps", "stadint", true, true);
Module['FS_createPath']("/data/maps", "starisl", true, true);
Module['FS_createPath']("/data/maps", "stripclb", true, true);
Module['FS_createPath']("/data/maps", "washintn", true, true);
Module['FS_createPath']("/data/maps", "washints", true, true);
Module['FS_createPath']("/data/maps", "yacht", true, true);
Module['FS_createPath']("/data", "paths", true, true);
Module['FS_createPath']("/", "models", true, true);
Module['FS_createPath']("/models", "coll", true, true);
Module['FS_createPath']("/models", "generic", true, true);
Module['FS_createPath']("/", "text", true, true);
Module['FS_createPath']("/", "txd", true, true);

      /** @constructor */
      function DataRequest(start, end, audio) {
        this.start = start;
        this.end = end;
        this.audio = audio;
      }
      DataRequest.prototype = {
        requests: {},
        open: function(mode, name) {
          this.name = name;
          this.requests[name] = this;
          Module['addRunDependency'](`fp ${this.name}`);
        },
        send: function() {},
        onload: function() {
          var byteArray = this.byteArray.subarray(this.start, this.end);
          this.finish(byteArray);
        },
        finish: function(byteArray) {
          var that = this;
          // canOwn this data in the filesystem, it is a slide into the heap that will never change
          Module['FS_createDataFile'](this.name, null, byteArray, true, true, true);
          Module['removeRunDependency'](`fp ${that.name}`);
          this.requests[this.name] = null;
        }
      };

      var files = metadata['files'];
      for (var i = 0; i < files.length; ++i) {
        new DataRequest(files[i]['start'], files[i]['end'], files[i]['audio'] || 0).open('GET', files[i]['filename']);
      }

      function processPackageData(arrayBuffer) {
        assert(arrayBuffer, 'Loading data file failed.');
        assert(arrayBuffer.constructor.name === ArrayBuffer.name, 'bad input to processPackageData');
        var byteArray = new Uint8Array(arrayBuffer);
        var curr;
        // Reuse the bytearray from the XHR as the source for file reads.
          DataRequest.prototype.byteArray = byteArray;
          var files = metadata['files'];
          for (var i = 0; i < files.length; ++i) {
            DataRequest.prototype.requests[files[i].filename].onload();
          }
          // B3: every file is copied into MEMFS now; drop the package-wide
          // view so the ArrayBuffer can be garbage-collected.
          DataRequest.prototype.byteArray = null;          Module['removeRunDependency']('datafile_/home/z/my-project/b2-web/reVC.data.b33');

      };
      Module['addRunDependency']('datafile_/home/z/my-project/b2-web/reVC.data.b33');

      Module['preloadResults'] ??= {};

      Module['preloadResults'][PACKAGE_NAME] = {fromCache: false};
      if (fetched) {
        processPackageData(fetched);
        fetched = null;
      } else {
        fetchedCallback = processPackageData;
      }

    }
    if (Module['calledRun']) {
      runWithFS(Module);
    } else {
      (Module['preRun'] ??= []).push(runWithFS); // FS is not initialized yet, wait for it
    }

    }
    loadPackage({"files": [{"filename": "/anim/cuts.dir", "start": 0, "end": 4736}, {"filename": "/anim/cuts.img", "start": 4736, "end": 115088000}, {"filename": "/anim/ped.ifp", "start": 115088000, "end": 117289152}, {"filename": "/audio/flash.adf", "start": 117289152, "end": 142736198}, {"filename": "/audio/sfx.sdt", "start": 142736198, "end": 142935018}, {"filename": "/audio/sound.cache", "start": 142935018, "end": 142939914}, {"filename": "/data/animviewer.dat", "start": 142939914, "end": 142941008}, {"filename": "/data/carcols.dat", "start": 142941008, "end": 142948955}, {"filename": "/data/cullzone.dat", "start": 142948955, "end": 143104263}, {"filename": "/data/cullzoneempty.dat", "start": 143104263, "end": 143265387}, {"filename": "/data/debug.sc", "start": 143265387, "end": 143270765}, {"filename": "/data/default.dat", "start": 143270765, "end": 143271268}, {"filename": "/data/default.ide", "start": 143271268, "end": 143292115}, {"filename": "/data/fistfite.dat", "start": 143292115, "end": 143294048}, {"filename": "/data/freeroam_miami.scm", "start": 143294048, "end": 143332245}, {"filename": "/data/gta_vc.dat", "start": 143332245, "end": 143334770}, {"filename": "/data/handling.cfg", "start": 143334770, "end": 143360598}, {"filename": "/data/info.zon", "start": 143360598, "end": 143371081}, {"filename": "/data/main.sc", "start": 143371081, "end": 143376596}, {"filename": "/data/main.scm", "start": 143376596, "end": 144645729}, {"filename": "/data/map.zon", "start": 144645729, "end": 144647883}, {"filename": "/data/maps/airport/airport.col", "start": 144647883, "end": 144972095}, {"filename": "/data/maps/airport/airport.ide", "start": 144972095, "end": 144988358}, {"filename": "/data/maps/airport/airport.ipl", "start": 144988358, "end": 145026103}, {"filename": "/data/maps/airportn/airportn.col", "start": 145026103, "end": 145237083}, {"filename": "/data/maps/airportn/airportn.ide", "start": 145237083, "end": 145241739}, {"filename": "/data/maps/airportn/airportn.ipl", "start": 145241739, "end": 145262710}, {"filename": "/data/maps/bank/bank.col", "start": 145262710, "end": 145279926}, {"filename": "/data/maps/bank/bank.ide", "start": 145279926, "end": 145287612}, {"filename": "/data/maps/bank/bank.ipl", "start": 145287612, "end": 145292591}, {"filename": "/data/maps/bar/bar.ide", "start": 145292591, "end": 145292627}, {"filename": "/data/maps/bridge/bridge.col", "start": 145292627, "end": 145392183}, {"filename": "/data/maps/bridge/bridge.ide", "start": 145392183, "end": 145394207}, {"filename": "/data/maps/bridge/bridge.ipl", "start": 145394207, "end": 145399038}, {"filename": "/data/maps/cisland/cisland.col", "start": 145399038, "end": 145620330}, {"filename": "/data/maps/cisland/cisland.ide", "start": 145620330, "end": 145629337}, {"filename": "/data/maps/cisland/cisland.ipl", "start": 145629337, "end": 145654967}, {"filename": "/data/maps/club/club.col", "start": 145654967, "end": 145678979}, {"filename": "/data/maps/club/club.ide", "start": 145678979, "end": 145688303}, {"filename": "/data/maps/club/club.ipl", "start": 145688303, "end": 145695257}, {"filename": "/data/maps/concerth/concerth.col", "start": 145695257, "end": 145705837}, {"filename": "/data/maps/concerth/concerth.ide", "start": 145705837, "end": 145714005}, {"filename": "/data/maps/concerth/concerth.ipl", "start": 145714005, "end": 145715817}, {"filename": "/data/maps/cull.ipl", "start": 145715817, "end": 145772294}, {"filename": "/data/maps/docks/docks.col", "start": 145772294, "end": 146068738}, {"filename": "/data/maps/docks/docks.ide", "start": 146068738, "end": 146077869}, {"filename": "/data/maps/docks/docks.ipl", "start": 146077869, "end": 146108122}, {"filename": "/data/maps/downtown/downtown.col", "start": 146108122, "end": 146612910}, {"filename": "/data/maps/downtown/downtown.ide", "start": 146612910, "end": 146635611}, {"filename": "/data/maps/downtown/downtown.ipl", "start": 146635611, "end": 146690370}, {"filename": "/data/maps/downtows/downtows.col", "start": 146690370, "end": 146946634}, {"filename": "/data/maps/downtows/downtows.ide", "start": 146946634, "end": 146953475}, {"filename": "/data/maps/downtows/downtows.ipl", "start": 146953475, "end": 146979889}, {"filename": "/data/maps/generic.ide", "start": 146979889, "end": 147001618}, {"filename": "/data/maps/golf/golf.col", "start": 147001618, "end": 147362438}, {"filename": "/data/maps/golf/golf.ide", "start": 147362438, "end": 147368035}, {"filename": "/data/maps/golf/golf.ipl", "start": 147368035, "end": 147385404}, {"filename": "/data/maps/haiti/haiti.col", "start": 147385404, "end": 147737936}, {"filename": "/data/maps/haiti/haiti.ide", "start": 147737936, "end": 147743757}, {"filename": "/data/maps/haiti/haiti.ipl", "start": 147743757, "end": 147782577}, {"filename": "/data/maps/haitin/haitin.col", "start": 147782577, "end": 148083921}, {"filename": "/data/maps/haitin/haitin.ide", "start": 148083921, "end": 148089724}, {"filename": "/data/maps/haitin/haitin.ipl", "start": 148089724, "end": 148116139}, {"filename": "/data/maps/hotel/hotel.col", "start": 148116139, "end": 148127319}, {"filename": "/data/maps/hotel/hotel.ide", "start": 148127319, "end": 148132000}, {"filename": "/data/maps/hotel/hotel.ipl", "start": 148132000, "end": 148140933}, {"filename": "/data/maps/islandsf/islandsf.col", "start": 148140933, "end": 148149489}, {"filename": "/data/maps/islandsf/islandsf.ide", "start": 148149489, "end": 148153392}, {"filename": "/data/maps/islandsf/islandsf.ipl", "start": 148153392, "end": 148163650}, {"filename": "/data/maps/lawyers/lawyers.col", "start": 148163650, "end": 148179442}, {"filename": "/data/maps/lawyers/lawyers.ide", "start": 148179442, "end": 148180514}, {"filename": "/data/maps/lawyers/lawyers.ipl", "start": 148180514, "end": 148181929}, {"filename": "/data/maps/littleha/littleha.col", "start": 148181929, "end": 148549489}, {"filename": "/data/maps/littleha/littleha.ide", "start": 148549489, "end": 148564757}, {"filename": "/data/maps/littleha/littleha.ipl", "start": 148564757, "end": 148632989}, {"filename": "/data/maps/mall/mall.col", "start": 148632989, "end": 148835481}, {"filename": "/data/maps/mall/mall.ide", "start": 148835481, "end": 148845328}, {"filename": "/data/maps/mall/mall.ipl", "start": 148845328, "end": 148869105}, {"filename": "/data/maps/mansion/mansion.col", "start": 148869105, "end": 149021981}, {"filename": "/data/maps/mansion/mansion.ide", "start": 149021981, "end": 149031498}, {"filename": "/data/maps/mansion/mansion.ipl", "start": 149031498, "end": 149046557}, {"filename": "/data/maps/map0.dat", "start": 149046557, "end": 149047215}, {"filename": "/data/maps/map1.dat", "start": 149047215, "end": 149047873}, {"filename": "/data/maps/map2.dat", "start": 149047873, "end": 149048531}, {"filename": "/data/maps/map3.dat", "start": 149048531, "end": 149049189}, {"filename": "/data/maps/map4.dat", "start": 149049189, "end": 149049847}, {"filename": "/data/maps/map5.dat", "start": 149049847, "end": 149050505}, {"filename": "/data/maps/map6.dat", "start": 149050505, "end": 149051163}, {"filename": "/data/maps/map7.dat", "start": 149051163, "end": 149051821}, {"filename": "/data/maps/nbeach/nbeach.col", "start": 149051821, "end": 149408521}, {"filename": "/data/maps/nbeach/nbeach.ide", "start": 149408521, "end": 149414042}, {"filename": "/data/maps/nbeach/nbeach.ipl", "start": 149414042, "end": 149456898}, {"filename": "/data/maps/nbeachbt/nbeachbt.col", "start": 149456898, "end": 149952286}, {"filename": "/data/maps/nbeachbt/nbeachbt.ide", "start": 149952286, "end": 149962448}, {"filename": "/data/maps/nbeachbt/nbeachbt.ipl", "start": 149962448, "end": 150036616}, {"filename": "/data/maps/nbeachw/nbeachw.col", "start": 150036616, "end": 150298196}, {"filename": "/data/maps/nbeachw/nbeachw.ide", "start": 150298196, "end": 150307457}, {"filename": "/data/maps/nbeachw/nbeachw.ipl", "start": 150307457, "end": 150348402}, {"filename": "/data/maps/oceandn/oceandn.col", "start": 150348402, "end": 150639094}, {"filename": "/data/maps/oceandn/oceandn.ide", "start": 150639094, "end": 150659412}, {"filename": "/data/maps/oceandn/oceandn.ipl", "start": 150659412, "end": 150736361}, {"filename": "/data/maps/oceandrv/oceandrv.col", "start": 150736361, "end": 150913469}, {"filename": "/data/maps/oceandrv/oceandrv.ide", "start": 150913469, "end": 150926679}, {"filename": "/data/maps/oceandrv/oceandrv.ipl", "start": 150926679, "end": 150976868}, {"filename": "/data/maps/paths.ipl", "start": 150976868, "end": 152122974}, {"filename": "/data/maps/stadint/stadint.col", "start": 152122974, "end": 152556310}, {"filename": "/data/maps/stadint/stadint.ide", "start": 152556310, "end": 152566630}, {"filename": "/data/maps/stadint/stadint.ipl", "start": 152566630, "end": 152573903}, {"filename": "/data/maps/starisl/starisl.col", "start": 152573903, "end": 152820423}, {"filename": "/data/maps/starisl/starisl.ide", "start": 152820423, "end": 152824421}, {"filename": "/data/maps/starisl/starisl.ipl", "start": 152824421, "end": 152863442}, {"filename": "/data/maps/stripclb/stripclb.col", "start": 152863442, "end": 152892434}, {"filename": "/data/maps/stripclb/stripclb.ide", "start": 152892434, "end": 152897583}, {"filename": "/data/maps/stripclb/stripclb.ipl", "start": 152897583, "end": 152898751}, {"filename": "/data/maps/washintn/washintn.col", "start": 152898751, "end": 153173863}, {"filename": "/data/maps/washintn/washintn.ide", "start": 153173863, "end": 153191360}, {"filename": "/data/maps/washintn/washintn.ipl", "start": 153191360, "end": 153274315}, {"filename": "/data/maps/washints/washints.col", "start": 153274315, "end": 153583519}, {"filename": "/data/maps/washints/washints.ide", "start": 153583519, "end": 153604818}, {"filename": "/data/maps/washints/washints.ipl", "start": 153604818, "end": 153672249}, {"filename": "/data/maps/yacht/yacht.col", "start": 153672249, "end": 153697185}, {"filename": "/data/maps/yacht/yacht.ide", "start": 153697185, "end": 153699563}, {"filename": "/data/maps/yacht/yacht.ipl", "start": 153699563, "end": 153699639}, {"filename": "/data/navig.zon", "start": 153699639, "end": 153700398}, {"filename": "/data/object.dat", "start": 153700398, "end": 153726675}, {"filename": "/data/occlu.ipl", "start": 153726675, "end": 153748402}, {"filename": "/data/particle.cfg", "start": 153748402, "end": 153765740}, {"filename": "/data/paths/flight.dat", "start": 153765740, "end": 153773780}, {"filename": "/data/paths/flight2.dat", "start": 153773780, "end": 153777235}, {"filename": "/data/paths/flight3.dat", "start": 153777235, "end": 153789039}, {"filename": "/data/paths/spath0.dat", "start": 153789039, "end": 153790845}, {"filename": "/data/ped.dat", "start": 153790845, "end": 153792860}, {"filename": "/data/pedgrp.dat", "start": 153792860, "end": 153801295}, {"filename": "/data/pedstats.dat", "start": 153801295, "end": 153804517}, {"filename": "/data/surface.dat", "start": 153804517, "end": 153805079}, {"filename": "/data/timecyc.dat", "start": 153805079, "end": 153851219}, {"filename": "/data/train.dat", "start": 153851219, "end": 153853670}, {"filename": "/data/train2.dat", "start": 153853670, "end": 153857864}, {"filename": "/data/water.dat", "start": 153857864, "end": 153859093}, {"filename": "/data/waterpro.dat", "start": 153859093, "end": 153880537}, {"filename": "/data/weapon.dat", "start": 153880537, "end": 153887355}, {"filename": "/gamecontrollerdb.txt", "start": 153887355, "end": 154139506}, {"filename": "/models/coll/generic.col", "start": 154139506, "end": 154224278}, {"filename": "/models/coll/peds.col", "start": 154224278, "end": 154245755}, {"filename": "/models/coll/vehicles.col", "start": 154245755, "end": 154351351}, {"filename": "/models/coll/weapons.col", "start": 154351351, "end": 154351799}, {"filename": "/models/fonts.txd", "start": 154351799, "end": 154876383}, {"filename": "/models/fonts_r.txd", "start": 154876383, "end": 155400967}, {"filename": "/models/fronten1.txd", "start": 155400967, "end": 155599023}, {"filename": "/models/fronten2.txd", "start": 155599023, "end": 156347607}, {"filename": "/models/frontend_ds2.txd", "start": 156347607, "end": 156677583}, {"filename": "/models/frontend_ds3.txd", "start": 156677583, "end": 157202551}, {"filename": "/models/frontend_ds4.txd", "start": 157202551, "end": 157727519}, {"filename": "/models/frontend_nsw.txd", "start": 157727519, "end": 160087623}, {"filename": "/models/frontend_x360.txd", "start": 160087623, "end": 160612591}, {"filename": "/models/frontend_xone.txd", "start": 160612591, "end": 161137559}, {"filename": "/models/generic.txd", "start": 161137559, "end": 162305935}, {"filename": "/models/generic/air_vlo.dff", "start": 162305935, "end": 162312851}, {"filename": "/models/generic/arrow.dff", "start": 162312851, "end": 162317700}, {"filename": "/models/generic/player.bmp", "start": 162317700, "end": 162384312}, {"filename": "/models/generic/wheels.dff", "start": 162384312, "end": 162480379}, {"filename": "/models/generic/wheels.txd", "start": 162480379, "end": 162504355}, {"filename": "/models/generic/zonecylb.dff", "start": 162504355, "end": 162506615}, {"filename": "/models/gta3.dir", "start": 162506615, "end": 162699991}, {"filename": "/models/hud.txd", "start": 162699991, "end": 162807167}, {"filename": "/models/intro.txd", "start": 162807167, "end": 162891903}, {"filename": "/models/misc.txd", "start": 162891903, "end": 162915879}, {"filename": "/models/nswbtns.txd", "start": 162915879, "end": 163444303}, {"filename": "/models/particle.txd", "start": 163444303, "end": 166112375}, {"filename": "/models/ps3btns.txd", "start": 166112375, "end": 166640799}, {"filename": "/models/x360btns.txd", "start": 166640799, "end": 167169223}, {"filename": "/revc.ini", "start": 167169223, "end": 167171863}, {"filename": "/text/american.gxt", "start": 167171863, "end": 167595997}, {"filename": "/text/french.gxt", "start": 167595997, "end": 168066129}, {"filename": "/text/german.gxt", "start": 168066129, "end": 168528159}, {"filename": "/text/italian.gxt", "start": 168528159, "end": 168987245}, {"filename": "/text/russian.gxt", "start": 168987245, "end": 169407849}, {"filename": "/text/spanish.gxt", "start": 169407849, "end": 169863263}, {"filename": "/txd/intro1.txd", "start": 169863263, "end": 170126599}, {"filename": "/txd/intro2.txd", "start": 170126599, "end": 170389935}, {"filename": "/txd/intro3.txd", "start": 170389935, "end": 170653271}, {"filename": "/txd/intro4.txd", "start": 170653271, "end": 170916607}, {"filename": "/txd/loadsc0.txd", "start": 170916607, "end": 171179943}, {"filename": "/txd/loadsc1.txd", "start": 171179943, "end": 171443279}, {"filename": "/txd/loadsc10.txd", "start": 171443279, "end": 171706615}, {"filename": "/txd/loadsc11.txd", "start": 171706615, "end": 171969951}, {"filename": "/txd/loadsc12.txd", "start": 171969951, "end": 172233287}, {"filename": "/txd/loadsc13.txd", "start": 172233287, "end": 172496623}, {"filename": "/txd/loadsc2.txd", "start": 172496623, "end": 172759959}, {"filename": "/txd/loadsc3.txd", "start": 172759959, "end": 173023295}, {"filename": "/txd/loadsc4.txd", "start": 173023295, "end": 173286631}, {"filename": "/txd/loadsc5.txd", "start": 173286631, "end": 173549967}, {"filename": "/txd/loadsc6.txd", "start": 173549967, "end": 173813303}, {"filename": "/txd/loadsc7.txd", "start": 173813303, "end": 174076639}, {"filename": "/txd/loadsc8.txd", "start": 174076639, "end": 174339975}, {"filename": "/txd/loadsc9.txd", "start": 174339975, "end": 174603311}, {"filename": "/txd/news.txd", "start": 174603311, "end": 174866647}, {"filename": "/txd/outro.txd", "start": 174866647, "end": 175129983}, {"filename": "/txd/splash1.txd", "start": 175129983, "end": 175262247}, {"filename": "/txd/splash2.txd", "start": 175262247, "end": 175394511}, {"filename": "/txd/splash3.txd", "start": 175394511, "end": 175394551}], "remote_package_size": 175394551});

  })();
