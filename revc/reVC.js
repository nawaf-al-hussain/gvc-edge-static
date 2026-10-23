// Support for growable heap + pthreads, where the buffer may change, so JS views
// must be updated.
function GROWABLE_HEAP_I8() {
  if (wasmMemory.buffer != HEAP8.buffer) {
    updateMemoryViews();
  }
  return HEAP8;
}

function GROWABLE_HEAP_U8() {
  if (wasmMemory.buffer != HEAP8.buffer) {
    updateMemoryViews();
  }
  return HEAPU8;
}

function GROWABLE_HEAP_I16() {
  if (wasmMemory.buffer != HEAP8.buffer) {
    updateMemoryViews();
  }
  return HEAP16;
}

function GROWABLE_HEAP_U16() {
  if (wasmMemory.buffer != HEAP8.buffer) {
    updateMemoryViews();
  }
  return HEAPU16;
}

function GROWABLE_HEAP_I32() {
  if (wasmMemory.buffer != HEAP8.buffer) {
    updateMemoryViews();
  }
  return HEAP32;
}

function GROWABLE_HEAP_U32() {
  if (wasmMemory.buffer != HEAP8.buffer) {
    updateMemoryViews();
  }
  return HEAPU32;
}

function GROWABLE_HEAP_F32() {
  if (wasmMemory.buffer != HEAP8.buffer) {
    updateMemoryViews();
  }
  return HEAPF32;
}

function GROWABLE_HEAP_F64() {
  if (wasmMemory.buffer != HEAP8.buffer) {
    updateMemoryViews();
  }
  return HEAPF64;
}

// include: shell.js
// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(moduleArg) => Promise<Module>
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module = typeof Module != "undefined" ? Module : {};

// Determine the runtime environment we are in. You can customize this by
// setting the ENVIRONMENT setting at compile time (see settings.js).
// Attempt to auto-detect the environment
var ENVIRONMENT_IS_WEB = typeof window == "object";

var ENVIRONMENT_IS_WORKER = typeof WorkerGlobalScope != "undefined";

// N.b. Electron.js environment is simultaneously a NODE-environment, but
// also a web environment.
var ENVIRONMENT_IS_NODE = typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string" && process.type != "renderer";

var ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

// Three configurations we can be running in:
// 1) We could be the application main() thread running in the main JS UI thread. (ENVIRONMENT_IS_WORKER == false and ENVIRONMENT_IS_PTHREAD == false)
// 2) We could be the application main() thread proxied to worker. (with Emscripten -sPROXY_TO_WORKER) (ENVIRONMENT_IS_WORKER == true, ENVIRONMENT_IS_PTHREAD == false)
// 3) We could be an application pthread running in a worker. (ENVIRONMENT_IS_WORKER == true and ENVIRONMENT_IS_PTHREAD == true)
// The way we signal to a worker that it is hosting a pthread is to construct
// it with a specific name.
var ENVIRONMENT_IS_PTHREAD = ENVIRONMENT_IS_WORKER && self.name?.startsWith("em-pthread");

if (ENVIRONMENT_IS_NODE) {
  // `require()` is no-op in an ESM module, use `createRequire()` to construct
  // the require()` function.  This is only necessary for multi-environment
  // builds, `-sENVIRONMENT=node` emits a static import declaration instead.
  // TODO: Swap all `require()`'s with `import()`'s?
  var worker_threads = require("worker_threads");
  global.Worker = worker_threads.Worker;
  ENVIRONMENT_IS_WORKER = !worker_threads.isMainThread;
  // Under node we set `workerData` to `em-pthread` to signal that the worker
  // is hosting a pthread.
  ENVIRONMENT_IS_PTHREAD = ENVIRONMENT_IS_WORKER && worker_threads["workerData"] == "em-pthread";
}

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)
// include: /home/z/my-project/wt-b35/b3/scripts/b34_pre.js
// B3.3 delivery receiver (--pre-js): runs at glue top-level in EVERY
// environment, including each pooled pthread worker. Uses
// addEventListener('message') which COEXISTS with Emscripten's
// self.onmessage handler (assigned later by the glue), so the page can
// deliver Blobs into workers with plain postMessage:
//   worker.postMessage({ b33: { <idx>: <Blob>, ... } })
// The page fetches each image ONCE; structured-cloning a Blob shares the
// browser-side backing store (no ArrayBuffer copy, no per-worker refetch).
// Blob mode: install and ready. OPFS mode (B33_OPFS=1 baked in): also
// write the blob into origin-private filesystem and open a
// FileSystemSyncAccessHandle for synchronous reads (one open handle per
// file browser-wide - the engine's single cd-stream thread matches this).
"use strict";

(function() {
  if (typeof ENVIRONMENT_IS_WORKER === "undefined" || !ENVIRONMENT_IS_WORKER) return;
  if (ENVIRONMENT_IS_NODE) return;
  globalThis.B33 = {
    blobs: {},
    opfs: {},
    sizes: {},
    ready: {},
    failed: {},
    reader: null,
    tmp: null
  };
  /* B3.4: SELF-SERVE OPFS. The cd-stream worker is claimed by
   * pthread_create within milliseconds of the pool spawning
   * (CdStreamInit runs in CGame::InitialiseOnceBeforeRW), and the C
   * entry wait then starves the worker's event loop (B3.3 §3), so
   * page-delivered messages can NEVER reach it - it always fell back
   * to the sync-XHR blob (+327 MB RAM-resident in the browser
   * process; measured load-path OOM in this sandbox). If the
   * persistent profile already holds the part files, open the handles
   * right here, while this worker is still idle and its event loop is
   * alive. Page delivery remains as the (now idempotent) fallback. */ (async function() {
    try {
      var TOTAL = 327487488, NPARTS = 4, partsz = TOTAL / NPARTS;
      /* 81871872 exact */ var root = await navigator.storage.getDirectory();
      var parts = [];
      for (var i = 0; i < NPARTS; i++) {
        var fh = await root.getFileHandle("b33-gta3-" + i + ".img", {
          create: false
        });
        var st = await fh.getFile();
        var want = (i === NPARTS - 1) ? (TOTAL - partsz * (NPARTS - 1)) : partsz;
        if (st.size !== want) throw new Error("part " + i + " size " + st.size);
        parts.push(await fh.createSyncAccessHandle());
      }
      B33.opfs[0] = parts;
      B33.partsz = partsz;
      B33.sizes[0] = TOTAL;
      B33.ready[0] = 1;
      delete B33.failed[0];
      beacon({
        ch: "b33ready",
        idx: 0,
        wid: self.name || "?",
        size: TOTAL,
        parts: NPARTS,
        mode: "opfs-selfserve"
      });
    } catch (e) {
      /* fresh profile (no parts / no quota): leave ready unset - the C
       * entry wait falls through to the sync-XHR blob self-heal */ beacon({
        ch: "b33selfserve",
        wid: self.name || "?",
        skipped: String(e).slice(0, 80)
      });
    }
  })();
  function beacon(o) {
    // XHR to the harness server (ground truth) AND postMessage to the page
    // (fast in-page gating; the Emscripten main-thread handler silently
    // ignores messages without a cmd field).
    try {
      var x = new XMLHttpRequest;
      x.open("POST", "/log", true);
      x.send(JSON.stringify(o));
    } catch (e) {}
    try {
      self.postMessage(o);
    } catch (e) {}
  }
  /* B3.10-PAGES: file-mode attach for handle-race losers. Sync access
   * handles are exclusive browser-wide, so a loser can never open them -
   * but plain File objects cost no RAM and serve synchronous reads. */
  (async function() {
    try {
      for (var tF = 0; tF < 40; tF++) {
        await new Promise(function(rF) { setTimeout(rF, 250); });
        if (globalThis.B33 && B33.opfs && B33.opfs[0] && B33.ready[0] === 1) return;
        if (globalThis.B33 && B33.files && B33.files[0]) return;
      }
      var rootF = await navigator.storage.getDirectory();
      var namesF = ["b33-gta3-0.img", "b33-gta3-1.img", "b33-gta3-2.img", "b33-gta3-3.img"];
      var filesF = [];
      for (var iF = 0; iF < namesF.length; iF++) {
        var fhF = await rootF.getFileHandle(namesF[iF], { create: false });
        filesF.push(await fhF.getFile());
      }
      globalThis.B33 = globalThis.B33 || { blobs: {}, sizes: {}, ready: {}, failed: {}, urls: {} };
      B33.files = B33.files || {};
      B33.files[0] = filesF;
      if (!B33.partsz) B33.partsz = 81871872;
      if (!B33.sizes[0]) B33.sizes[0] = 327487488;
      B33.ready[0] = 1;
      delete B33.failed[0];
      beacon({ ch: "b33ready", idx: 0, wid: self.name || "?", size: 327487488, parts: 4, mode: "opfs-file" });
    } catch (eF2) {
      beacon({ ch: "b33selfserve", wid: self.name || "?", skipped: ("file-mode: " + String(eF2)).slice(0, 80) });
    }
  })();
  self.addEventListener("message", function(e) {
    var d = e.data;
    if (!d || (!d.b33 && !d.b33opfsParts)) return;
    // Emscripten cmds flow through onmessage
    if (d.b33opfsParts) {
      // OPFS delivery variant: the PAGE streamed the image into OPFS as
      // PART FILES (fetch + Range -> body.pipeTo per part: no Blob, no
      // JS-heap copy - the blob path aborts in persistent contexts and the
      // ephemeral quota is too small - both measured). Chromium allows
      // exactly ONE open sync access handle PER FILE, so the image is
      // split: every worker opens one handle per part and can then serve
      // any offset (b33_img_read routes by part). Handles open while this
      // worker is still idle (before the pthread body attaches).
      /* B3.4: IDEMPOTENT delivery - the page re-sends b33opfsParts every
       * 250 ms until each worker beacons ready. Re-opening handles this
       * worker already holds throws NoModificationAllowedError, which the
       * old code recorded as a PERMANENT failure (B33.failed) even though
       * the first open succeeded - poisoning b33_img_ready() and forcing
       * the whole pool toward the RAM-resident blob fallback (measured:
       * 9 handle conflicts in one B3.4 run, load-path OOM). Skip if the
       * handles are already open. */ if (B33.opfs[0] && B33.opfs[0].length) {
        beacon({
          ch: "b33ready",
          idx: 0,
          wid: self.name || "?",
          size: B33.sizes[0],
          mode: "opfs-already"
        });
        return;
      }
      (async function() {
        try {
          /* serialize handle acquisition across workers: Chromium allows
           * one open sync handle per FILE, so simultaneous opens race;
           * stagger by worker index and retry once on conflict */ var widn = 0;
          var m = /em-pthread-(\d+)/.exec(self.name || "");
          if (m) widn = m[1] | 0;
          await new Promise(function(r) {
            setTimeout(r, widn * 120);
          });
          var root = await navigator.storage.getDirectory();
          var names = d.b33opfsParts;
          var parts = [];
          for (var i = 0; i < names.length; i++) {
            var fh = await root.getFileHandle(names[i], {
              create: false
            });
            parts.push(await fh.createSyncAccessHandle());
          }
          B33.opfs[0] = parts;
          B33.partsz = d.b33partsz | 0;
          B33.sizes[0] = d.b33total | 0;
          B33.ready[0] = 1;
          delete B33.failed[0];
          /* B3.4: a success clears any stale conflict marker */ beacon({
            ch: "b33ready",
            idx: 0,
            wid: self.name || "?",
            size: B33.sizes[0],
            parts: names.length,
            mode: "opfs"
          });
        } catch (err) {
          /* one retry after a conflict: the winning worker holds all four
           * handles only transiently during its own open sequence */ await new Promise(function(r) {
            setTimeout(r, 400);
          });
          try {
            var root2 = await navigator.storage.getDirectory();
            var names2 = d.b33opfsParts;
            var parts2 = [];
            for (var j = 0; j < names2.length; j++) {
              var fh2 = await root2.getFileHandle(names2[j], {
                create: false
              });
              parts2.push(await fh2.createSyncAccessHandle());
            }
            B33.opfs[0] = parts2;
            B33.partsz = d.b33partsz | 0;
            B33.sizes[0] = d.b33total | 0;
            B33.ready[0] = 1;
            delete B33.failed[0];
            /* B3.4: a success clears any stale conflict marker */ beacon({
              ch: "b33ready",
              idx: 0,
              wid: self.name || "?",
              size: B33.sizes[0],
              parts: names2.length,
              mode: "opfs-retry"
            });
          } catch (err2) {
            B33.failed[0] = String(err2);
            beacon({
              ch: "b33ready",
              idx: 0,
              wid: self.name || "?",
              failed: String(err2)
            });
          }
        }
      })();
      return;
    }
    var imgs = d.b33;
    Object.keys(imgs).forEach(function(k) {
      var idx = k | 0;
      var blob = imgs[k];
      B33.blobs[idx] = blob;
      B33.sizes[idx] = blob.size;
      B33.urls = B33.urls || {};
      if (d.b33url && !B33.urls[idx]) B33.urls[idx] = d.b33url;
      beacon({
        ch: "b33install",
        idx,
        wid: self.name || "?",
        size: blob.size
      });
      if (d.b33mode === "opfs") {
        (async function() {
          try {
            var root = await navigator.storage.getDirectory();
            var fh = await root.getFileHandle("b33-img" + idx + ".img", {
              create: true
            });
            var st = await fh.getFile();
            if (st.size !== blob.size) {
              var w = await fh.createWritable();
              await blob.stream().pipeTo(w);
              st = await fh.getFile();
              beacon({
                ch: "b33opfs",
                wrote: fh.name,
                size: st.size
              });
            } else {
              beacon({
                ch: "b33opfs",
                reused: fh.name,
                size: st.size
              });
            }
            B33.opfs[idx] = await fh.createSyncAccessHandle();
            B33.sizes[idx] = (await fh.getFile()).size;
            B33.ready[idx] = 1;
            beacon({
              ch: "b33ready",
              idx,
              wid: self.name || "?",
              size: B33.sizes[idx],
              mode: "opfs"
            });
          } catch (err) {
            B33.failed[idx] = String(err);
            beacon({
              ch: "b33ready",
              idx,
              failed: String(err)
            });
          }
        })();
      } else {
        B33.ready[idx] = 1;
        beacon({
          ch: "b33ready",
          idx,
          wid: self.name || "?",
          size: blob.size,
          mode: "blob"
        });
      }
    });
  });
  // Optional WORKERFS helpers (only meaningful when -lworkerfs.js is
  // linked, P1W). Defined unconditionally here because the pre-js runs
  // before the library assignments; WORKERFS is resolved lazily at call
  // time. Object literals live here - they cannot appear inside EM_ASM.
  B33.p1wMount = function(blob) {
    if (typeof WORKERFS === "undefined") return -1;
    try {
      FS.mkdir("/mnt");
      FS.mount(WORKERFS, {
        blobs: [ {
          name: "gta3.img",
          data: blob
        } ]
      }, "/mnt");
      return 1;
    } catch (e) {
      B33.p1wMountErr = String(e);
      console.log("[p1w] mount threw: " + e);
      return 0;
    }
  };
  B33.p1wReadFnv = function(off, len) {
    // WORKERFS stream read with explicit position (FS.readFile would read
    // the whole file - it takes no offset/length options in this build).
    var st = FS.open("/mnt/gta3.img", "r");
    var buf = new Uint8Array(len);
    FS.read(st, buf, 0, len, off);
    FS.close(st);
    var h = 2166136261;
    for (var i = 0; i < buf.length; i++) {
      h = Math.imul(h ^ buf[i], 16777619) >>> 0;
    }
    console.log("[p1w] workerfs stream read off=" + off + " len=" + len + " fnv=" + (h >>> 0).toString(16));
    return h >>> 0;
  };
})();

// end include: /home/z/my-project/wt-b35/b3/scripts/b34_pre.js
// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = Object.assign({}, Module);

var arguments_ = [];

var thisProgram = "./this.program";

var quit_ = (status, toThrow) => {
  throw toThrow;
};

// In MODULARIZE mode _scriptName needs to be captured already at the very top of the page immediately when the page is parsed, so it is generated there
// before the page load. In non-MODULARIZE modes generate it here.
var _scriptName = (typeof document != "undefined") ? document.currentScript?.src : undefined;

if (ENVIRONMENT_IS_NODE) {
  _scriptName = __filename;
} else if (ENVIRONMENT_IS_WORKER) {
  _scriptName = self.location.href;
}

// `/` should be present at the end if `scriptDirectory` is not empty
var scriptDirectory = "";

function locateFile(path) {
  if (Module["locateFile"]) {
    return Module["locateFile"](path, scriptDirectory);
  }
  return scriptDirectory + path;
}

// Hooks that are implemented differently in different runtime environments.
var readAsync, readBinary;

if (ENVIRONMENT_IS_NODE) {
  if (typeof process == "undefined" || !process.release || process.release.name !== "node") throw new Error("not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)");
  var nodeVersion = process.versions.node;
  var numericVersion = nodeVersion.split(".").slice(0, 3);
  numericVersion = (numericVersion[0] * 1e4) + (numericVersion[1] * 100) + (numericVersion[2].split("-")[0] * 1);
  if (numericVersion < 16e4) {
    throw new Error("This emscripten-generated code requires node v16.0.0 (detected v" + nodeVersion + ")");
  }
  // These modules will usually be used on Node.js. Load them eagerly to avoid
  // the complexity of lazy-loading.
  var fs = require("fs");
  var nodePath = require("path");
  scriptDirectory = __dirname + "/";
  // include: node_shell_read.js
  readBinary = filename => {
    // We need to re-wrap `file://` strings to URLs.
    filename = isFileURI(filename) ? new URL(filename) : filename;
    var ret = fs.readFileSync(filename);
    assert(Buffer.isBuffer(ret));
    return ret;
  };
  readAsync = async (filename, binary = true) => {
    // See the comment in the `readBinary` function.
    filename = isFileURI(filename) ? new URL(filename) : filename;
    var ret = fs.readFileSync(filename, binary ? undefined : "utf8");
    assert(binary ? Buffer.isBuffer(ret) : typeof ret == "string");
    return ret;
  };
  // end include: node_shell_read.js
  if (!Module["thisProgram"] && process.argv.length > 1) {
    thisProgram = process.argv[1].replace(/\\/g, "/");
  }
  arguments_ = process.argv.slice(2);
  if (typeof module != "undefined") {
    module["exports"] = Module;
  }
  quit_ = (status, toThrow) => {
    process.exitCode = status;
    throw toThrow;
  };
} else if (ENVIRONMENT_IS_SHELL) {
  if ((typeof process == "object" && typeof require === "function") || typeof window == "object" || typeof WorkerGlobalScope != "undefined") throw new Error("not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)");
} else // Note that this includes Node.js workers when relevant (pthreads is enabled).
// Node.js workers are detected as a combination of ENVIRONMENT_IS_WORKER and
// ENVIRONMENT_IS_NODE.
if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  if (ENVIRONMENT_IS_WORKER) {
    // Check worker, not web, since window could be polyfilled
    scriptDirectory = self.location.href;
  } else if (typeof document != "undefined" && document.currentScript) {
    // web
    scriptDirectory = document.currentScript.src;
  }
  // blob urls look like blob:http://site.com/etc/etc and we cannot infer anything from them.
  // otherwise, slice off the final part of the url to find the script directory.
  // if scriptDirectory does not contain a slash, lastIndexOf will return -1,
  // and scriptDirectory will correctly be replaced with an empty string.
  // If scriptDirectory contains a query (starting with ?) or a fragment (starting with #),
  // they are removed because they could contain a slash.
  if (scriptDirectory.startsWith("blob:")) {
    scriptDirectory = "";
  } else {
    scriptDirectory = scriptDirectory.substr(0, scriptDirectory.replace(/[?#].*/, "").lastIndexOf("/") + 1);
  }
  if (!(typeof window == "object" || typeof WorkerGlobalScope != "undefined")) throw new Error("not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)");
  // Differentiate the Web Worker from the Node Worker case, as reading must
  // be done differently.
  if (!ENVIRONMENT_IS_NODE) {
    // include: web_or_worker_shell_read.js
    if (ENVIRONMENT_IS_WORKER) {
      readBinary = url => {
        var xhr = new XMLHttpRequest;
        xhr.open("GET", url, false);
        xhr.responseType = "arraybuffer";
        xhr.send(null);
        return new Uint8Array(/** @type{!ArrayBuffer} */ (xhr.response));
      };
    }
    readAsync = async url => {
      // Fetch has some additional restrictions over XHR, like it can't be used on a file:// url.
      // See https://github.com/github/fetch/pull/92#issuecomment-140665932
      // Cordova or Electron apps are typically loaded from a file:// url.
      // So use XHR on webview if URL is a file URL.
      if (isFileURI(url)) {
        return new Promise((resolve, reject) => {
          var xhr = new XMLHttpRequest;
          xhr.open("GET", url, true);
          xhr.responseType = "arraybuffer";
          xhr.onload = () => {
            if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) {
              // file URLs can return 0
              resolve(xhr.response);
              return;
            }
            reject(xhr.status);
          };
          xhr.onerror = reject;
          xhr.send(null);
        });
      }
      var response = await fetch(url, {
        credentials: "same-origin"
      });
      if (response.ok) {
        return response.arrayBuffer();
      }
      throw new Error(response.status + " : " + response.url);
    };
  }
} else // end include: web_or_worker_shell_read.js
{
  throw new Error("environment detection error");
}

// Set up the out() and err() hooks, which are how we can print to stdout or
// stderr, respectively.
// Normally just binding console.log/console.error here works fine, but
// under node (with workers) we see missing/out-of-order messages so route
// directly to stdout and stderr.
// See https://github.com/emscripten-core/emscripten/issues/14804
var defaultPrint = console.log.bind(console);

var defaultPrintErr = console.error.bind(console);

if (ENVIRONMENT_IS_NODE) {
  defaultPrint = (...args) => fs.writeSync(1, args.join(" ") + "\n");
  defaultPrintErr = (...args) => fs.writeSync(2, args.join(" ") + "\n");
}

var out = Module["print"] || defaultPrint;

var err = Module["printErr"] || defaultPrintErr;

// Merge back in the overrides
Object.assign(Module, moduleOverrides);

// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used.
moduleOverrides = null;

checkIncomingModuleAPI();

// Emit code to handle expected values on the Module object. This applies Module.x
// to the proper local x. This has two benefits: first, we only emit it if it is
// expected to arrive, and second, by using a local everywhere else that can be
// minified.
if (Module["arguments"]) arguments_ = Module["arguments"];

legacyModuleProp("arguments", "arguments_");

if (Module["thisProgram"]) thisProgram = Module["thisProgram"];

legacyModuleProp("thisProgram", "thisProgram");

// perform assertions in shell.js after we set up out() and err(), as otherwise if an assertion fails it cannot print the message
// Assertions on removed incoming Module JS APIs.
assert(typeof Module["memoryInitializerPrefixURL"] == "undefined", "Module.memoryInitializerPrefixURL option was removed, use Module.locateFile instead");

assert(typeof Module["pthreadMainPrefixURL"] == "undefined", "Module.pthreadMainPrefixURL option was removed, use Module.locateFile instead");

assert(typeof Module["cdInitializerPrefixURL"] == "undefined", "Module.cdInitializerPrefixURL option was removed, use Module.locateFile instead");

assert(typeof Module["filePackagePrefixURL"] == "undefined", "Module.filePackagePrefixURL option was removed, use Module.locateFile instead");

assert(typeof Module["read"] == "undefined", "Module.read option was removed");

assert(typeof Module["readAsync"] == "undefined", "Module.readAsync option was removed (modify readAsync in JS)");

assert(typeof Module["readBinary"] == "undefined", "Module.readBinary option was removed (modify readBinary in JS)");

assert(typeof Module["setWindowTitle"] == "undefined", "Module.setWindowTitle option was removed (modify emscripten_set_window_title in JS)");

assert(typeof Module["TOTAL_MEMORY"] == "undefined", "Module.TOTAL_MEMORY has been renamed Module.INITIAL_MEMORY");

legacyModuleProp("asm", "wasmExports");

legacyModuleProp("readAsync", "readAsync");

legacyModuleProp("readBinary", "readBinary");

legacyModuleProp("setWindowTitle", "setWindowTitle");

var WORKERFS = "WORKERFS is no longer included by default; build with -lworkerfs.js";

assert(ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER || ENVIRONMENT_IS_NODE, "Pthreads do not work in this environment yet (need Web Workers, or an alternative to them)");

assert(!ENVIRONMENT_IS_SHELL, "shell environment detected but not enabled at build time.  Add `shell` to `-sENVIRONMENT` to enable.");

// end include: shell.js
// include: preamble.js
// === Preamble library stuff ===
// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html
var wasmBinary = Module["wasmBinary"];

legacyModuleProp("wasmBinary", "wasmBinary");

if (typeof WebAssembly != "object") {
  err("no native wasm support detected");
}

// include: base64Utils.js
// Converts a string of base64 into a byte array (Uint8Array).
function intArrayFromBase64(s) {
  if (typeof ENVIRONMENT_IS_NODE != "undefined" && ENVIRONMENT_IS_NODE) {
    var buf = Buffer.from(s, "base64");
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.length);
  }
  var decoded = atob(s);
  var bytes = new Uint8Array(decoded.length);
  for (var i = 0; i < decoded.length; ++i) {
    bytes[i] = decoded.charCodeAt(i);
  }
  return bytes;
}

// end include: base64Utils.js
// Wasm globals
var wasmMemory;

// For sending to workers.
var wasmModule;

//========================================
// Runtime essentials
//========================================
// whether we are quitting the application. no code should run after this.
// set in exit() and abort()
var ABORT = false;

// set by exit() and abort().  Passed to 'onExit' handler.
// NOTE: This is also used as the process return code code in shell environments
// but only when noExitRuntime is false.
var EXITSTATUS;

// In STRICT mode, we only define assert() when ASSERTIONS is set.  i.e. we
// don't define it at all in release modes.  This matches the behaviour of
// MINIMAL_RUNTIME.
// TODO(sbc): Make this the default even without STRICT enabled.
/** @type {function(*, string=)} */ function assert(condition, text) {
  if (!condition) {
    abort("Assertion failed" + (text ? ": " + text : ""));
  }
}

// We used to include malloc/free by default in the past. Show a helpful error in
// builds with assertions.
// Memory management
var /** @type {!Int8Array} */ HEAP8, /** @type {!Uint8Array} */ HEAPU8, /** @type {!Int16Array} */ HEAP16, /** @type {!Uint16Array} */ HEAPU16, /** @type {!Int32Array} */ HEAP32, /** @type {!Uint32Array} */ HEAPU32, /** @type {!Float32Array} */ HEAPF32, /** @type {!Float64Array} */ HEAPF64;

// include: runtime_shared.js
function updateMemoryViews() {
  var b = wasmMemory.buffer;
  Module["HEAP8"] = HEAP8 = new Int8Array(b);
  Module["HEAP16"] = HEAP16 = new Int16Array(b);
  Module["HEAPU8"] = HEAPU8 = new Uint8Array(b);
  Module["HEAPU16"] = HEAPU16 = new Uint16Array(b);
  Module["HEAP32"] = HEAP32 = new Int32Array(b);
  Module["HEAPU32"] = HEAPU32 = new Uint32Array(b);
  Module["HEAPF32"] = HEAPF32 = new Float32Array(b);
  Module["HEAPF64"] = HEAPF64 = new Float64Array(b);
}

// end include: runtime_shared.js
// include: runtime_pthread.js
// Pthread Web Worker handling code.
// This code runs only on pthread web workers and handles pthread setup
// and communication with the main thread via postMessage.
// Unique ID of the current pthread worker (zero on non-pthread-workers
// including the main thread).
var workerID = 0;

if (ENVIRONMENT_IS_PTHREAD) {
  var wasmModuleReceived;
  // Node.js support
  if (ENVIRONMENT_IS_NODE) {
    // Create as web-worker-like an environment as we can.
    var parentPort = worker_threads["parentPort"];
    parentPort.on("message", msg => onmessage({
      data: msg
    }));
    Object.assign(globalThis, {
      self: global,
      postMessage: msg => parentPort.postMessage(msg)
    });
  }
  // Thread-local guard variable for one-time init of the JS state
  var initializedJS = false;
  function threadPrintErr(...args) {
    var text = args.join(" ");
    // See https://github.com/emscripten-core/emscripten/issues/14804
    if (ENVIRONMENT_IS_NODE) {
      fs.writeSync(2, text + "\n");
      return;
    }
    console.error(text);
  }
  if (!Module["printErr"]) err = threadPrintErr;
  dbg = threadPrintErr;
  function threadAlert(...args) {
    var text = args.join(" ");
    postMessage({
      cmd: "alert",
      text,
      threadId: _pthread_self()
    });
  }
  self.alert = threadAlert;
  // Turn unhandled rejected promises into errors so that the main thread will be
  // notified about them.
  self.onunhandledrejection = e => {
    throw e.reason || e;
  };
  function handleMessage(e) {
    try {
      var msgData = e["data"];
      //dbg('msgData: ' + Object.keys(msgData));
      var cmd = msgData.cmd;
      if (cmd === "load") {
        // Preload command that is called once per worker to parse and load the Emscripten code.
        workerID = msgData.workerID;
        // Until we initialize the runtime, queue up any further incoming messages.
        let messageQueue = [];
        self.onmessage = e => messageQueue.push(e);
        // And add a callback for when the runtime is initialized.
        self.startWorker = instance => {
          // Notify the main thread that this thread has loaded.
          postMessage({
            cmd: "loaded"
          });
          // Process any messages that were queued before the thread was ready.
          for (let msg of messageQueue) {
            handleMessage(msg);
          }
          // Restore the real message handler.
          self.onmessage = handleMessage;
        };
        // Use `const` here to ensure that the variable is scoped only to
        // that iteration, allowing safe reference from a closure.
        for (const handler of msgData.handlers) {
          // The the main module has a handler for a certain even, but no
          // handler exists on the pthread worker, then proxy that handler
          // back to the main thread.
          if (!Module[handler] || Module[handler].proxy) {
            Module[handler] = (...args) => {
              postMessage({
                cmd: "callHandler",
                handler,
                args
              });
            };
            // Rebind the out / err handlers if needed
            if (handler == "print") out = Module[handler];
            if (handler == "printErr") err = Module[handler];
          }
        }
        wasmMemory = msgData.wasmMemory;
        updateMemoryViews();
        wasmModuleReceived(msgData.wasmModule);
      } else if (cmd === "run") {
        assert(msgData.pthread_ptr);
        // Call inside JS module to set up the stack frame for this pthread in JS module scope.
        // This needs to be the first thing that we do, as we cannot call to any C/C++ functions
        // until the thread stack is initialized.
        establishStackSpace(msgData.pthread_ptr);
        // Pass the thread address to wasm to store it for fast access.
        __emscripten_thread_init(msgData.pthread_ptr, /*is_main=*/ 0, /*is_runtime=*/ 0, /*can_block=*/ 1, 0, 0);
        PThread.receiveObjectTransfer(msgData);
        PThread.threadInitTLS();
        // Await mailbox notifications with `Atomics.waitAsync` so we can start
        // using the fast `Atomics.notify` notification path.
        __emscripten_thread_mailbox_await(msgData.pthread_ptr);
        if (!initializedJS) {
          initializedJS = true;
        }
        try {
          invokeEntryPoint(msgData.start_routine, msgData.arg);
        } catch (ex) {
          if (ex != "unwind") {
            // The pthread "crashed".  Do not call `_emscripten_thread_exit` (which
            // would make this thread joinable).  Instead, re-throw the exception
            // and let the top level handler propagate it back to the main thread.
            throw ex;
          }
        }
      } else if (msgData.target === "setimmediate") {} else // no-op
      if (cmd === "checkMailbox") {
        if (initializedJS) {
          checkMailbox();
        }
      } else if (cmd) {
        // The received message looks like something that should be handled by this message
        // handler, (since there is a cmd field present), but is not one of the
        // recognized commands:
        err(`worker: received unknown command ${cmd}`);
        err(msgData);
      }
    } catch (ex) {
      err(`worker: onmessage() captured an uncaught exception: ${ex}`);
      if (ex?.stack) err(ex.stack);
      __emscripten_thread_crashed();
      throw ex;
    }
  }
  self.onmessage = handleMessage;
}

// ENVIRONMENT_IS_PTHREAD
// end include: runtime_pthread.js
assert(!Module["STACK_SIZE"], "STACK_SIZE can no longer be set at runtime.  Use -sSTACK_SIZE at link time");

assert(typeof Int32Array != "undefined" && typeof Float64Array !== "undefined" && Int32Array.prototype.subarray != undefined && Int32Array.prototype.set != undefined, "JS engine does not provide full typed array support");

// In non-standalone/normal mode, we create the memory here.
// include: runtime_init_memory.js
// Create the wasm memory. (Note: this only applies if IMPORTED_MEMORY is defined)
// check for full engine support (use string 'subarray' to avoid closure compiler confusion)
if (!ENVIRONMENT_IS_PTHREAD) {
  if (Module["wasmMemory"]) {
    wasmMemory = Module["wasmMemory"];
  } else {
    var INITIAL_MEMORY = Module["INITIAL_MEMORY"] || 67108864;
    legacyModuleProp("INITIAL_MEMORY", "INITIAL_MEMORY");
    assert(INITIAL_MEMORY >= 65536, "INITIAL_MEMORY should be larger than STACK_SIZE, was " + INITIAL_MEMORY + "! (STACK_SIZE=" + 65536 + ")");
    /** @suppress {checkTypes} */ wasmMemory = new WebAssembly.Memory({
      "initial": INITIAL_MEMORY / 65536,
      // In theory we should not need to emit the maximum if we want "unlimited"
      // or 4GB of memory, but VMs error on that atm, see
      // https://github.com/emscripten-core/emscripten/issues/14130
      // And in the pthreads case we definitely need to emit a maximum. So
      // always emit one.
      "maximum": 32768,
      "shared": true
    });
  }
  updateMemoryViews();
}

// end include: runtime_init_memory.js
// include: runtime_stack_check.js
// Initializes the stack cookie. Called at the startup of main and at the startup of each thread in pthreads mode.
function writeStackCookie() {
  var max = _emscripten_stack_get_end();
  assert((max & 3) == 0);
  // If the stack ends at address zero we write our cookies 4 bytes into the
  // stack.  This prevents interference with SAFE_HEAP and ASAN which also
  // monitor writes to address zero.
  if (max == 0) {
    max += 4;
  }
  // The stack grow downwards towards _emscripten_stack_get_end.
  // We write cookies to the final two words in the stack and detect if they are
  // ever overwritten.
  GROWABLE_HEAP_U32()[((max) >> 2)] = 34821223;
  checkInt32(34821223);
  GROWABLE_HEAP_U32()[(((max) + (4)) >> 2)] = 2310721022;
  checkInt32(2310721022);
  // Also test the global address 0 for integrity.
  GROWABLE_HEAP_U32()[((0) >> 2)] = 1668509029;
  checkInt32(1668509029);
}

function checkStackCookie() {
  if (ABORT) return;
  var max = _emscripten_stack_get_end();
  // See writeStackCookie().
  if (max == 0) {
    max += 4;
  }
  var cookie1 = GROWABLE_HEAP_U32()[((max) >> 2)];
  var cookie2 = GROWABLE_HEAP_U32()[(((max) + (4)) >> 2)];
  if (cookie1 != 34821223 || cookie2 != 2310721022) {
    abort(`Stack overflow! Stack cookie has been overwritten at ${ptrToString(max)}, expected hex dwords 0x89BACDFE and 0x2135467, but received ${ptrToString(cookie2)} ${ptrToString(cookie1)}`);
  }
  // Also test the global address 0 for integrity.
  if (GROWABLE_HEAP_U32()[((0) >> 2)] != 1668509029) /* 'emsc' */ {
    abort("Runtime error: The application has corrupted its heap memory area (address zero)!");
  }
}

// end include: runtime_stack_check.js
var __ATPRERUN__ = [];

// functions called before the runtime is initialized
var __ATINIT__ = [];

// functions called during startup
var __ATMAIN__ = [];

// functions called during shutdown
var __ATPOSTRUN__ = [];

// functions called after the main() is called
var runtimeInitialized = false;

function preRun() {
  assert(!ENVIRONMENT_IS_PTHREAD);
  // PThreads reuse the runtime from the main thread.
  if (Module["preRun"]) {
    if (typeof Module["preRun"] == "function") Module["preRun"] = [ Module["preRun"] ];
    while (Module["preRun"].length) {
      addOnPreRun(Module["preRun"].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}

function initRuntime() {
  assert(!runtimeInitialized);
  runtimeInitialized = true;
  if (ENVIRONMENT_IS_PTHREAD) return startWorker(Module);
  checkStackCookie();
  setStackLimits();
  if (!Module["noFSInit"] && !FS.initialized) FS.init();
  FS.ignorePermissions = false;
  TTY.init();
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  checkStackCookie();
  if (ENVIRONMENT_IS_PTHREAD) return;
  // PThreads reuse the runtime from the main thread.
  callRuntimeCallbacks(__ATMAIN__);
}

function postRun() {
  checkStackCookie();
  if (ENVIRONMENT_IS_PTHREAD) return;
  // PThreads reuse the runtime from the main thread.
  if (Module["postRun"]) {
    if (typeof Module["postRun"] == "function") Module["postRun"] = [ Module["postRun"] ];
    while (Module["postRun"].length) {
      addOnPostRun(Module["postRun"].shift());
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}

// include: runtime_math.js
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/imul
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/fround
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/clz32
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/trunc
assert(Math.imul, "This browser does not support Math.imul(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill");

assert(Math.fround, "This browser does not support Math.fround(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill");

assert(Math.clz32, "This browser does not support Math.clz32(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill");

assert(Math.trunc, "This browser does not support Math.trunc(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill");

// end include: runtime_math.js
// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// Module.preRun (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;

var dependenciesFulfilled = null;

// overridden to take different actions when all run dependencies are fulfilled
var runDependencyTracking = {};

var runDependencyWatcher = null;

function getUniqueRunDependency(id) {
  var orig = id;
  while (1) {
    if (!runDependencyTracking[id]) return id;
    id = orig + Math.random();
  }
}

function addRunDependency(id) {
  runDependencies++;
  Module["monitorRunDependencies"]?.(runDependencies);
  if (id) {
    assert(!runDependencyTracking[id]);
    runDependencyTracking[id] = 1;
    if (runDependencyWatcher === null && typeof setInterval != "undefined") {
      // Check for missing dependencies every few seconds
      runDependencyWatcher = setInterval(() => {
        if (ABORT) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
          return;
        }
        var shown = false;
        for (var dep in runDependencyTracking) {
          if (!shown) {
            shown = true;
            err("still waiting on run dependencies:");
          }
          err(`dependency: ${dep}`);
        }
        if (shown) {
          err("(end of list)");
        }
      }, 1e4);
    }
  } else {
    err("warning: run dependency added without ID");
  }
}

function removeRunDependency(id) {
  runDependencies--;
  Module["monitorRunDependencies"]?.(runDependencies);
  if (id) {
    assert(runDependencyTracking[id]);
    delete runDependencyTracking[id];
  } else {
    err("warning: run dependency removed without ID");
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback();
    }
  }
}

/** @param {string|number=} what */ function abort(what) {
  Module["onAbort"]?.(what);
  what = "Aborted(" + what + ")";
  // TODO(sbc): Should we remove printing and leave it up to whoever
  // catches the exception?
  err(what);
  ABORT = true;
  // Use a wasm runtime error, because a JS error might be seen as a foreign
  // exception, which means we'd run destructors on it. We need the error to
  // simply make the program stop.
  // FIXME This approach does not work in Wasm EH because it currently does not assume
  // all RuntimeErrors are from traps; it decides whether a RuntimeError is from
  // a trap or not based on a hidden field within the object. So at the moment
  // we don't have a way of throwing a wasm trap from JS. TODO Make a JS API that
  // allows this in the wasm spec.
  // Suppress closure compiler warning here. Closure compiler's builtin extern
  // definition for WebAssembly.RuntimeError claims it takes no arguments even
  // though it can.
  // TODO(https://github.com/google/closure-compiler/pull/3913): Remove if/when upstream closure gets fixed.
  /** @suppress {checkTypes} */ var e = new WebAssembly.RuntimeError(what);
  // Throw the error whether or not MODULARIZE is set because abort is used
  // in code paths apart from instantiation where an exception is expected
  // to be thrown when abort is called.
  throw e;
}

// include: memoryprofiler.js
// end include: memoryprofiler.js
// include: URIUtils.js
// Prefix of data URIs emitted by SINGLE_FILE and related options.
var dataURIPrefix = "data:application/octet-stream;base64,";

/**
 * Indicates whether filename is a base64 data URI.
 * @noinline
 */ var isDataURI = filename => filename.startsWith(dataURIPrefix);

/**
 * Indicates whether filename is delivered via file protocol (as opposed to http/https)
 * @noinline
 */ var isFileURI = filename => filename.startsWith("file://");

// end include: URIUtils.js
function createExportWrapper(name, nargs) {
  return (...args) => {
    assert(runtimeInitialized, `native function \`${name}\` called before runtime initialization`);
    var f = wasmExports[name];
    assert(f, `exported native function \`${name}\` not found`);
    // Only assert for too many arguments. Too few can be valid since the missing arguments will be zero filled.
    assert(args.length <= nargs, `native function \`${name}\` called with ${args.length} args but expects ${nargs}`);
    return f(...args);
  };
}

// include: runtime_exceptions.js
// end include: runtime_exceptions.js
function findWasmBinary() {
  var f = "reVC.wasm";
  if (!isDataURI(f)) {
    return locateFile(f);
  }
  return f;
}

var wasmBinaryFile;

function getBinarySync(file) {
  if (file == wasmBinaryFile && wasmBinary) {
    return new Uint8Array(wasmBinary);
  }
  if (readBinary) {
    return readBinary(file);
  }
  throw "both async and sync fetching of the wasm failed";
}

async function getWasmBinary(binaryFile) {
  // If we don't have the binary yet, load it asynchronously using readAsync.
  if (!wasmBinary) {
    // Fetch the binary using readAsync
    try {
      var response = await readAsync(binaryFile);
      return new Uint8Array(response);
    } catch {}
  }
  // Otherwise, getBinarySync should be able to get it synchronously
  return getBinarySync(binaryFile);
}

async function instantiateArrayBuffer(binaryFile, imports) {
  try {
    var binary = await getWasmBinary(binaryFile);
    var instance = await WebAssembly.instantiate(binary, imports);
    return instance;
  } catch (reason) {
    err(`failed to asynchronously prepare wasm: ${reason}`);
    // Warn on some common problems.
    if (isFileURI(wasmBinaryFile)) {
      err(`warning: Loading from a file URI (${wasmBinaryFile}) is not supported in most browsers. See https://emscripten.org/docs/getting_started/FAQ.html#how-do-i-run-a-local-webserver-for-testing-why-does-my-program-stall-in-downloading-or-preparing`);
    }
    abort(reason);
  }
}

async function instantiateAsync(binary, binaryFile, imports) {
  if (!binary && typeof WebAssembly.instantiateStreaming == "function" && !isDataURI(binaryFile) && // Don't use streaming for file:// delivered objects in a webview, fetch them synchronously.
  !isFileURI(binaryFile) && // Avoid instantiateStreaming() on Node.js environment for now, as while
  // Node.js v18.1.0 implements it, it does not have a full fetch()
  // implementation yet.
  // Reference:
  //   https://github.com/emscripten-core/emscripten/pull/16917
  !ENVIRONMENT_IS_NODE && typeof fetch == "function") {
    try {
      var response = fetch(binaryFile, {
        credentials: "same-origin"
      });
      var instantiationResult = await WebAssembly.instantiateStreaming(response, imports);
      return instantiationResult;
    } catch (reason) {
      // We expect the most common failure cause to be a bad MIME type for the binary,
      // in which case falling back to ArrayBuffer instantiation should work.
      err(`wasm streaming compile failed: ${reason}`);
      err("falling back to ArrayBuffer instantiation");
    }
  }
  return instantiateArrayBuffer(binaryFile, imports);
}

function getWasmImports() {
  assignWasmImports();
  // prepare imports
  return {
    "env": wasmImports,
    "wasi_snapshot_preview1": wasmImports
  };
}

// Create the wasm instance.
// Receives the wasm imports, returns the exports.
async function createWasm() {
  // Load the wasm module and create an instance of using native support in the JS engine.
  // handle a generated wasm instance, receiving its exports and
  // performing other necessary setup
  /** @param {WebAssembly.Module=} module*/ function receiveInstance(instance, module) {
    wasmExports = instance.exports;
    registerTLSInit(wasmExports["_emscripten_tls_init"]);
    wasmTable = wasmExports["__indirect_function_table"];
    assert(wasmTable, "table not found in wasm exports");
    addOnInit(wasmExports["__wasm_call_ctors"]);
    // We now have the Wasm module loaded up, keep a reference to the compiled module so we can post it to the workers.
    wasmModule = module;
    removeRunDependency("wasm-instantiate");
    return wasmExports;
  }
  // wait for the pthread pool (if any)
  addRunDependency("wasm-instantiate");
  // Prefer streaming instantiation if available.
  // Async compilation can be confusing when an error on the page overwrites Module
  // (for example, if the order of elements is wrong, and the one defining Module is
  // later), so we save Module and check it later.
  var trueModule = Module;
  function receiveInstantiationResult(result) {
    // 'result' is a ResultObject object which has both the module and instance.
    // receiveInstance() will swap in the exports (to Module.asm) so they can be called
    assert(Module === trueModule, "the Module object should not be replaced during async compilation - perhaps the order of HTML elements is wrong?");
    trueModule = null;
    receiveInstance(result["instance"], result["module"]);
  }
  var info = getWasmImports();
  // User shell pages can write their own Module.instantiateWasm = function(imports, successCallback) callback
  // to manually instantiate the Wasm module themselves. This allows pages to
  // run the instantiation parallel to any other async startup actions they are
  // performing.
  // Also pthreads and wasm workers initialize the wasm instance through this
  // path.
  if (Module["instantiateWasm"]) {
    try {
      return Module["instantiateWasm"](info, receiveInstance);
    } catch (e) {
      err(`Module.instantiateWasm callback failed with error: ${e}`);
      return false;
    }
  }
  if (ENVIRONMENT_IS_PTHREAD) {
    return new Promise(resolve => {
      wasmModuleReceived = module => {
        // Instantiate from the module posted from the main thread.
        // We can just use sync instantiation in the worker.
        var instance = new WebAssembly.Instance(module, getWasmImports());
        receiveInstance(instance, module);
        resolve();
      };
    });
  }
  wasmBinaryFile ??= findWasmBinary();
  var result = await instantiateAsync(wasmBinary, wasmBinaryFile, info);
  receiveInstantiationResult(result);
  return result;
}

// Globals used by JS i64 conversions (see makeSetValue)
var tempDouble;

var tempI64;

// include: runtime_debug.js
// Endianness check
(() => {
  var h16 = new Int16Array(1);
  var h8 = new Int8Array(h16.buffer);
  h16[0] = 25459;
  if (h8[0] !== 115 || h8[1] !== 99) throw "Runtime error: expected the system to be little-endian! (Run with -sSUPPORT_BIG_ENDIAN to bypass)";
})();

if (Module["ENVIRONMENT"]) {
  throw new Error("Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -sENVIRONMENT=web or -sENVIRONMENT=node)");
}

function legacyModuleProp(prop, newName, incoming = true) {
  if (!Object.getOwnPropertyDescriptor(Module, prop)) {
    Object.defineProperty(Module, prop, {
      configurable: true,
      get() {
        let extra = incoming ? " (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)" : "";
        abort(`\`Module.${prop}\` has been replaced by \`${newName}\`` + extra);
      }
    });
  }
}

function ignoredModuleProp(prop) {
  if (Object.getOwnPropertyDescriptor(Module, prop)) {
    abort(`\`Module.${prop}\` was supplied but \`${prop}\` not included in INCOMING_MODULE_JS_API`);
  }
}

// forcing the filesystem exports a few things by default
function isExportedByForceFilesystem(name) {
  return name === "FS_createPath" || name === "FS_createDataFile" || name === "FS_createPreloadedFile" || name === "FS_unlink" || name === "addRunDependency" || // The old FS has some functionality that WasmFS lacks.
  name === "FS_createLazyFile" || name === "FS_createDevice" || name === "removeRunDependency";
}

/**
 * Intercept access to a global symbol.  This enables us to give informative
 * warnings/errors when folks attempt to use symbols they did not include in
 * their build, or no symbols that no longer exist.
 */ function hookGlobalSymbolAccess(sym, func) {
  if (typeof globalThis != "undefined" && !Object.getOwnPropertyDescriptor(globalThis, sym)) {
    Object.defineProperty(globalThis, sym, {
      configurable: true,
      get() {
        func();
        return undefined;
      }
    });
  }
}

function missingGlobal(sym, msg) {
  hookGlobalSymbolAccess(sym, () => {
    warnOnce(`\`${sym}\` is not longer defined by emscripten. ${msg}`);
  });
}

missingGlobal("buffer", "Please use HEAP8.buffer or wasmMemory.buffer");

missingGlobal("asm", "Please use wasmExports instead");

function missingLibrarySymbol(sym) {
  hookGlobalSymbolAccess(sym, () => {
    // Can't `abort()` here because it would break code that does runtime
    // checks.  e.g. `if (typeof SDL === 'undefined')`.
    var msg = `\`${sym}\` is a library symbol and not included by default; add it to your library.js __deps or to DEFAULT_LIBRARY_FUNCS_TO_INCLUDE on the command line`;
    // DEFAULT_LIBRARY_FUNCS_TO_INCLUDE requires the name as it appears in
    // library.js, which means $name for a JS name with no prefix, or name
    // for a JS name like _name.
    var librarySymbol = sym;
    if (!librarySymbol.startsWith("_")) {
      librarySymbol = "$" + sym;
    }
    msg += ` (e.g. -sDEFAULT_LIBRARY_FUNCS_TO_INCLUDE='${librarySymbol}')`;
    if (isExportedByForceFilesystem(sym)) {
      msg += ". Alternatively, forcing filesystem support (-sFORCE_FILESYSTEM) can export this for you";
    }
    warnOnce(msg);
  });
  // Any symbol that is not included from the JS library is also (by definition)
  // not exported on the Module object.
  unexportedRuntimeSymbol(sym);
}

function unexportedRuntimeSymbol(sym) {
  if (ENVIRONMENT_IS_PTHREAD) {
    return;
  }
  if (!Object.getOwnPropertyDescriptor(Module, sym)) {
    Object.defineProperty(Module, sym, {
      configurable: true,
      get() {
        var msg = `'${sym}' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the Emscripten FAQ)`;
        if (isExportedByForceFilesystem(sym)) {
          msg += ". Alternatively, forcing filesystem support (-sFORCE_FILESYSTEM) can export this for you";
        }
        abort(msg);
      }
    });
  }
}

var MAX_UINT8 = (2 ** 8) - 1;

var MAX_UINT16 = (2 ** 16) - 1;

var MAX_UINT32 = (2 ** 32) - 1;

var MAX_UINT53 = (2 ** 53) - 1;

var MAX_UINT64 = (2 ** 64) - 1;

var MIN_INT8 = -(2 ** (8 - 1));

var MIN_INT16 = -(2 ** (16 - 1));

var MIN_INT32 = -(2 ** (32 - 1));

var MIN_INT53 = -(2 ** (53 - 1));

var MIN_INT64 = -(2 ** (64 - 1));

function checkInt(value, bits, min, max) {
  assert(Number.isInteger(Number(value)), `attempt to write non-integer (${value}) into integer heap`);
  assert(value <= max, `value (${value}) too large to write as ${bits}-bit value`);
  assert(value >= min, `value (${value}) too small to write as ${bits}-bit value`);
}

var checkInt8 = value => checkInt(value, 8, MIN_INT8, MAX_UINT8);

var checkInt16 = value => checkInt(value, 16, MIN_INT16, MAX_UINT16);

var checkInt32 = value => checkInt(value, 32, MIN_INT32, MAX_UINT32);

var checkInt64 = value => checkInt(value, 64, MIN_INT64, MAX_UINT64);

// Used by XXXXX_DEBUG settings to output debug messages.
function dbg(...args) {
  // Avoid using the console for debugging in multi-threaded node applications
  // See https://github.com/emscripten-core/emscripten/issues/14804
  if (ENVIRONMENT_IS_NODE && fs) {
    fs.writeSync(2, args.join(" ") + "\n");
  } else // TODO(sbc): Make this configurable somehow.  Its not always convenient for
  // logging to show up as warnings.
  console.warn(...args);
}

// end include: runtime_debug.js
// === Body ===
var ASM_CONSTS = {
  444493: $0 => {
    if (!$0) {
      AL.alcErr = 40964;
      return 1;
    }
  },
  444541: $0 => {
    if (!AL.currentCtx) {
      err("alGetProcAddress() called without a valid context");
      return 1;
    }
    if (!$0) {
      AL.currentCtx.err = 40963;
      return 1;
    }
  }
};

function b33_img_ready(idx) {
  if (globalThis.B33 && B33.failed && B33.failed[idx] !== undefined) return -1;
  return (globalThis.B33 && B33.ready && B33.ready[idx] === 1) ? 1 : 0;
}

function b33_img_fetch_sync(idx) {
  if (!globalThis.B33) globalThis.B33 = {
    blobs: {},
    sizes: {},
    ready: {},
    failed: {},
    reader: null,
    urls: {}
  };
  if (B33.blobs[idx] !== undefined) return 1;
  /* B3.10-PAGES: static hosting serves no single-file gta3.img; a worker
   * that lost the OPFS handle race must self-heal from the 4 static parts.
   * sync XHR works in pthread workers; self.location is this script's URL,
   * so ../p/g3/ resolves against the deployed page tree. */
  try {
    var PB3 = new URL("../p/g3/", self.location.href).href;
    var TOT3 = 327487488, PZ3 = 81871872, ch3 = [], got3 = 0;
    for (var q3 = 0; q3 < 4; q3++) {
      var xq3 = new XMLHttpRequest;
      xq3.open("GET", PB3 + q3 + ".bin", false);
      xq3.responseType = "arraybuffer";
      xq3.send();
      if ((xq3.status | 0) !== 200 || !xq3.response) throw new Error("part " + q3 + " status " + xq3.status);
      if (xq3.response.byteLength !== (q3 < 3 ? PZ3 : TOT3 - PZ3 * 3)) throw new Error("part " + q3 + " size " + xq3.response.byteLength);
      ch3.push(xq3.response);
      got3 += xq3.response.byteLength;
    }
    if (got3 !== TOT3) throw new Error("total " + got3);
    var bl3 = new Blob(ch3);
    B33.blobs[idx] = bl3;
    B33.sizes[idx] = bl3.size;
    B33.ready[idx] = 1;
    console.log("[b33] sync-XHR self-heal (pages 4-part): " + bl3.size + " B");
    return 1;
  } catch (eP3) {
    console.log("[b33] pages 4-part self-heal failed: " + eP3);
  }
  var url = (B33.urls && B33.urls[idx]) || "gta3.img";
  try {
    var x = new XMLHttpRequest;
    x.open("GET", url, false);
    x.responseType = "blob";
    x.send();
    if ((x.status | 0) === 200 && x.response && x.response.size) {
      B33.blobs[idx] = x.response;
      B33.sizes[idx] = x.response.size;
      B33.ready[idx] = 1;
      console.log("[b33] sync-XHR self-heal: " + url + " " + x.response.size + " B (blob)");
      return 1;
    }
  } catch (e) {
    console.log("[b33] sync-XHR blob failed: " + e);
  }
  try {
    var x2 = new XMLHttpRequest;
    x2.open("GET", url, false);
    x2.responseType = "arraybuffer";
    x2.send();
    if ((x2.status | 0) === 200 && x2.response && x2.response.byteLength) {
      var b = new Blob([ x2.response ]);
      B33.blobs[idx] = b;
      B33.sizes[idx] = b.size;
      B33.ready[idx] = 1;
      console.log("[b33] sync-XHR self-heal: " + url + " " + b.size + " B (arraybuffer->Blob)");
      return 1;
    }
  } catch (e2) {
    console.log("[b33] sync-XHR arraybuffer failed: " + e2);
  }
  return 0;
}

function b33_img_size(idx) {
  return (globalThis.B33 && B33.sizes && B33.sizes[idx] !== undefined) ? (B33.sizes[idx] | 0) : 0;
}

function b33_img_register(idx, path) {
  globalThis.B33 = globalThis.B33 || {
    blobs: {},
    sizes: {},
    ready: {},
    failed: {},
    reader: null,
    paths: {}
  };
  B33.paths[idx] = UTF8ToString(path);
}

function b33_img_read(idx, off, buf, len) {
  if (!globalThis.B33) return -1;
  var parts = B33.opfs ? B33.opfs[idx] : null;
  if (parts && parts.length) {
    var partsz = B33.partsz | 0;
    if (!partsz) return -1;
    var tmp = B33.tmp && B33.tmp.byteLength >= len ? B33.tmp : (B33.tmp = new ArrayBuffer(len < 524288 ? 524288 : len));
    var tmpU8 = new Uint8Array(tmp);
    var totalSize = B33.sizes ? (B33.sizes[idx] | 0) : 0;
    var done = 0;
    try {
      while (len > 0) {
        var pi = (off / partsz) | 0;
        var po = off - pi * partsz;
        if (pi < 0 || pi >= parts.length || po < 0) return -1;
        var h = parts[pi];
        var want = Math.min(len, partsz - po);
        var gotTotal = 0;
        while (gotTotal < want) {
          var got = h.read(tmpU8.subarray(gotTotal, want), {
            at: po + gotTotal
          });
          if (got < 0) return -1;
          if (got === 0) {
            if (off + done + gotTotal >= totalSize) break;
            return -1;
          }
          gotTotal += got;
        }
        if (gotTotal > 0) new Uint8Array(GROWABLE_HEAP_U8().buffer, buf + done, gotTotal).set(tmpU8.subarray(0, gotTotal));
        done += gotTotal;
        off += gotTotal;
        len -= gotTotal;
        if (gotTotal < want) break;
      }
      return done;
    } catch (e0) {
      console.log("[b33] opfs read error idx=" + idx + " off=" + off + ": " + e0);
      return -1;
    }
  }
  /* B3.10-PAGES: file-mode reads (handle-race losers). Disk-backed File
   * objects are shareable across workers; FileReaderSync on file.slice is
   * synchronous in workers. Zero RAM unlike the full-image blob. */
  var fparts = (!parts && B33.files && B33.files[idx]) ? B33.files[idx] : null;
  if (fparts) {
    var partszF = B33.partsz | 0;
    if (!partszF) return -1;
    var doneF = 0;
    try {
      var frs = B33.frs || (B33.frs = new FileReaderSync());
      while (len > 0) {
        var piF = (off / partszF) | 0;
        var poF = off - piF * partszF;
        if (piF < 0 || piF >= fparts.length || poF < 0) return -1;
        var wantF = Math.min(len, partszF - poF);
        var abF = frs.readAsArrayBuffer(fparts[piF].slice(poF, poF + wantF));
        var gotF = abF ? (abF.byteLength | 0) : 0;
        if (gotF <= 0) {
          if (off + doneF >= (B33.sizes ? (B33.sizes[idx] | 0) : 0)) break;
          return -1;
        }
        new Uint8Array(GROWABLE_HEAP_U8().buffer, buf + doneF, gotF).set(new Uint8Array(abF));
        doneF += gotF;
        off += gotF;
        len -= gotF;
      }
      return doneF;
    } catch (eF) {
      console.log("[b33] file read error idx=" + idx + " off=" + off + ": " + eF);
      return -1;
    }
  }
  var b = B33.blobs ? B33.blobs[idx] : null;
  if (!b) return -1;
  if (off >= b.size) return 0;
  try {
    B33.reader = B33.reader || new FileReaderSync;
    var ab = B33.reader.readAsArrayBuffer(b.slice(off, off + len));
    var n = ab.byteLength | 0;
    if (n > 0) new Uint8Array(GROWABLE_HEAP_U8().buffer, buf, n).set(new Uint8Array(ab));
    return n;
  } catch (e) {
    console.log("[b33] bridge read error idx=" + idx + " off=" + off + ": " + e);
    return -1;
  }
}

// end include: preamble.js
class ExitStatus {
  name="ExitStatus";
  constructor(status) {
    this.message = `Program terminated with exit(${status})`;
    this.status = status;
  }
}

var terminateWorker = worker => {
  worker.terminate();
  // terminate() can be asynchronous, so in theory the worker can continue
  // to run for some amount of time after termination.  However from our POV
  // the worker now dead and we don't want to hear from it again, so we stub
  // out its message handler here.  This avoids having to check in each of
  // the onmessage handlers if the message was coming from valid worker.
  worker.onmessage = e => {
    var cmd = e["data"].cmd;
    err(`received "${cmd}" command from terminated worker: ${worker.workerID}`);
  };
};

var cleanupThread = pthread_ptr => {
  assert(!ENVIRONMENT_IS_PTHREAD, "Internal Error! cleanupThread() can only ever be called from main application thread!");
  assert(pthread_ptr, "Internal Error! Null pthread_ptr in cleanupThread!");
  var worker = PThread.pthreads[pthread_ptr];
  assert(worker);
  PThread.returnWorkerToPool(worker);
};

var spawnThread = threadParams => {
  assert(!ENVIRONMENT_IS_PTHREAD, "Internal Error! spawnThread() can only ever be called from main application thread!");
  assert(threadParams.pthread_ptr, "Internal error, no pthread ptr!");
  var worker = PThread.getNewWorker();
  if (!worker) {
    // No available workers in the PThread pool.
    return 6;
  }
  assert(!worker.pthread_ptr, "Internal error!");
  PThread.runningWorkers.push(worker);
  // Add to pthreads map
  PThread.pthreads[threadParams.pthread_ptr] = worker;
  worker.pthread_ptr = threadParams.pthread_ptr;
  var msg = {
    cmd: "run",
    start_routine: threadParams.startRoutine,
    arg: threadParams.arg,
    pthread_ptr: threadParams.pthread_ptr
  };
  if (ENVIRONMENT_IS_NODE) {
    // Mark worker as weakly referenced once we start executing a pthread,
    // so that its existence does not prevent Node.js from exiting.  This
    // has no effect if the worker is already weakly referenced (e.g. if
    // this worker was previously idle/unused).
    worker.unref();
  }
  // Ask the worker to start executing its pthread entry point function.
  worker.postMessage(msg, threadParams.transferList);
  return 0;
};

var runtimeKeepaliveCounter = 0;

var keepRuntimeAlive = () => noExitRuntime || runtimeKeepaliveCounter > 0;

var stackSave = () => _emscripten_stack_get_current();

var stackRestore = val => __emscripten_stack_restore(val);

var stackAlloc = sz => __emscripten_stack_alloc(sz);

var convertI32PairToI53Checked = (lo, hi) => {
  assert(lo == (lo >>> 0) || lo == (lo | 0));
  // lo should either be a i32 or a u32
  assert(hi === (hi | 0));
  // hi should be a i32
  return ((hi + 2097152) >>> 0 < 4194305 - !!lo) ? (lo >>> 0) + hi * 4294967296 : NaN;
};

/** @type{function(number, (number|boolean), ...number)} */ var proxyToMainThread = (funcIndex, emAsmAddr, sync, ...callArgs) => {
  // EM_ASM proxying is done by passing a pointer to the address of the EM_ASM
  // content as `emAsmAddr`.  JS library proxying is done by passing an index
  // into `proxiedJSCallArgs` as `funcIndex`. If `emAsmAddr` is non-zero then
  // `funcIndex` will be ignored.
  // Additional arguments are passed after the first three are the actual
  // function arguments.
  // The serialization buffer contains the number of call params, and then
  // all the args here.
  // We also pass 'sync' to C separately, since C needs to look at it.
  // Allocate a buffer, which will be copied by the C code.
  // First passed parameter specifies the number of arguments to the function.
  // When BigInt support is enabled, we must handle types in a more complex
  // way, detecting at runtime if a value is a BigInt or not (as we have no
  // type info here). To do that, add a "prefix" before each value that
  // indicates if it is a BigInt, which effectively doubles the number of
  // values we serialize for proxying. TODO: pack this?
  var serializedNumCallArgs = callArgs.length;
  var sp = stackSave();
  var args = stackAlloc(serializedNumCallArgs * 8);
  var b = ((args) >> 3);
  for (var i = 0; i < callArgs.length; i++) {
    var arg = callArgs[i];
    GROWABLE_HEAP_F64()[b + i] = arg;
  }
  var rtn = __emscripten_run_on_main_thread_js(funcIndex, emAsmAddr, serializedNumCallArgs, args, sync);
  stackRestore(sp);
  return rtn;
};

function _proc_exit(code) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(0, 0, 1, code);
  EXITSTATUS = code;
  if (!keepRuntimeAlive()) {
    PThread.terminateAllThreads();
    Module["onExit"]?.(code);
    ABORT = true;
  }
  quit_(code, new ExitStatus(code));
}

var handleException = e => {
  // Certain exception types we do not treat as errors since they are used for
  // internal control flow.
  // 1. ExitStatus, which is thrown by exit()
  // 2. "unwind", which is thrown by emscripten_unwind_to_js_event_loop() and others
  //    that wish to return to JS event loop.
  if (e instanceof ExitStatus || e == "unwind") {
    return EXITSTATUS;
  }
  checkStackCookie();
  if (e instanceof WebAssembly.RuntimeError) {
    if (_emscripten_stack_get_current() <= 0) {
      err("Stack overflow detected.  You can try increasing -sSTACK_SIZE (currently set to 65536)");
    }
  }
  quit_(1, e);
};

function exitOnMainThread(returnCode) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(1, 0, 0, returnCode);
  _exit(returnCode);
}

/** @suppress {duplicate } */ /** @param {boolean|number=} implicit */ var exitJS = (status, implicit) => {
  EXITSTATUS = status;
  checkUnflushedContent();
  if (ENVIRONMENT_IS_PTHREAD) {
    // implicit exit can never happen on a pthread
    assert(!implicit);
    // When running in a pthread we propagate the exit back to the main thread
    // where it can decide if the whole process should be shut down or not.
    // The pthread may have decided not to exit its own runtime, for example
    // because it runs a main loop, but that doesn't affect the main thread.
    exitOnMainThread(status);
    throw "unwind";
  }
  // if exit() was called explicitly, warn the user if the runtime isn't actually being shut down
  if (keepRuntimeAlive() && !implicit) {
    var msg = `program exited (with status: ${status}), but keepRuntimeAlive() is set (counter=${runtimeKeepaliveCounter}) due to an async operation, so halting execution but not exiting the runtime or preventing further async execution (you can use emscripten_force_exit, if you want to force a true shutdown)`;
    err(msg);
  }
  _proc_exit(status);
};

var _exit = exitJS;

var ptrToString = ptr => {
  assert(typeof ptr === "number");
  // With CAN_ADDRESS_2GB or MEMORY64, pointers are already unsigned.
  ptr >>>= 0;
  return "0x" + ptr.toString(16).padStart(8, "0");
};

var PThread = {
  unusedWorkers: [],
  runningWorkers: [],
  tlsInitFunctions: [],
  pthreads: {},
  nextWorkerID: 1,
  debugInit() {
    function pthreadLogPrefix() {
      var t = 0;
      if (runtimeInitialized && typeof _pthread_self != "undefined") {
        t = _pthread_self();
      }
      return `w:${workerID},t:${ptrToString(t)}: `;
    }
    // Prefix all err()/dbg() messages with the calling thread ID.
    var origDbg = dbg;
    dbg = (...args) => origDbg(pthreadLogPrefix() + args.join(" "));
  },
  init() {
    PThread.debugInit();
    if ((!(ENVIRONMENT_IS_PTHREAD))) {
      PThread.initMainThread();
    }
  },
  initMainThread() {
    var pthreadPoolSize = 4;
    // Start loading up the Worker pool, if requested.
    while (pthreadPoolSize--) {
      PThread.allocateUnusedWorker();
    }
    // MINIMAL_RUNTIME takes care of calling loadWasmModuleToAllWorkers
    // in postamble_minimal.js
    addOnPreRun(() => {
      addRunDependency("loading-workers");
      PThread.loadWasmModuleToAllWorkers(() => removeRunDependency("loading-workers"));
    });
  },
  terminateAllThreads: () => {
    assert(!ENVIRONMENT_IS_PTHREAD, "Internal Error! terminateAllThreads() can only ever be called from main application thread!");
    // Attempt to kill all workers.  Sadly (at least on the web) there is no
    // way to terminate a worker synchronously, or to be notified when a
    // worker in actually terminated.  This means there is some risk that
    // pthreads will continue to be executing after `worker.terminate` has
    // returned.  For this reason, we don't call `returnWorkerToPool` here or
    // free the underlying pthread data structures.
    for (var worker of PThread.runningWorkers) {
      terminateWorker(worker);
    }
    for (var worker of PThread.unusedWorkers) {
      terminateWorker(worker);
    }
    PThread.unusedWorkers = [];
    PThread.runningWorkers = [];
    PThread.pthreads = {};
  },
  returnWorkerToPool: worker => {
    // We don't want to run main thread queued calls here, since we are doing
    // some operations that leave the worker queue in an invalid state until
    // we are completely done (it would be bad if free() ends up calling a
    // queued pthread_create which looks at the global data structures we are
    // modifying). To achieve that, defer the free() til the very end, when
    // we are all done.
    var pthread_ptr = worker.pthread_ptr;
    delete PThread.pthreads[pthread_ptr];
    // Note: worker is intentionally not terminated so the pool can
    // dynamically grow.
    PThread.unusedWorkers.push(worker);
    PThread.runningWorkers.splice(PThread.runningWorkers.indexOf(worker), 1);
    // Not a running Worker anymore
    // Detach the worker from the pthread object, and return it to the
    // worker pool as an unused worker.
    worker.pthread_ptr = 0;
    // Finally, free the underlying (and now-unused) pthread structure in
    // linear memory.
    __emscripten_thread_free_data(pthread_ptr);
  },
  receiveObjectTransfer(data) {},
  threadInitTLS() {
    // Call thread init functions (these are the _emscripten_tls_init for each
    // module loaded.
    PThread.tlsInitFunctions.forEach(f => f());
  },
  loadWasmModuleToWorker: worker => new Promise(onFinishedLoading => {
    worker.onmessage = e => {
      var d = e["data"];
      var cmd = d.cmd;
      // If this message is intended to a recipient that is not the main
      // thread, forward it to the target thread.
      if (d.targetThread && d.targetThread != _pthread_self()) {
        var targetWorker = PThread.pthreads[d.targetThread];
        if (targetWorker) {
          targetWorker.postMessage(d, d.transferList);
        } else {
          err(`Internal error! Worker sent a message "${cmd}" to target pthread ${d.targetThread}, but that thread no longer exists!`);
        }
        return;
      }
      if (cmd === "checkMailbox") {
        checkMailbox();
      } else if (cmd === "spawnThread") {
        spawnThread(d);
      } else if (cmd === "cleanupThread") {
        cleanupThread(d.thread);
      } else if (cmd === "loaded") {
        worker.loaded = true;
        // Check that this worker doesn't have an associated pthread.
        if (ENVIRONMENT_IS_NODE && !worker.pthread_ptr) {
          // Once worker is loaded & idle, mark it as weakly referenced,
          // so that mere existence of a Worker in the pool does not prevent
          // Node.js from exiting the app.
          worker.unref();
        }
        onFinishedLoading(worker);
      } else if (cmd === "alert") {
        alert(`Thread ${d.threadId}: ${d.text}`);
      } else if (d.target === "setimmediate") {
        // Worker wants to postMessage() to itself to implement setImmediate()
        // emulation.
        worker.postMessage(d);
      } else if (cmd === "callHandler") {
        Module[d.handler](...d.args);
      } else if (cmd) {
        // The received message looks like something that should be handled by this message
        // handler, (since there is a e.data.cmd field present), but is not one of the
        // recognized commands:
        err(`worker sent an unknown command ${cmd}`);
      }
    };
    worker.onerror = e => {
      var message = "worker sent an error!";
      if (worker.pthread_ptr) {
        message = `Pthread ${ptrToString(worker.pthread_ptr)} sent an error!`;
      }
      err(`${message} ${e.filename}:${e.lineno}: ${e.message}`);
      throw e;
    };
    if (ENVIRONMENT_IS_NODE) {
      worker.on("message", data => worker.onmessage({
        data
      }));
      worker.on("error", e => worker.onerror(e));
    }
    assert(wasmMemory instanceof WebAssembly.Memory, "WebAssembly memory should have been loaded by now!");
    assert(wasmModule instanceof WebAssembly.Module, "WebAssembly Module should have been loaded by now!");
    // When running on a pthread, none of the incoming parameters on the module
    // object are present. Proxy known handlers back to the main thread if specified.
    var handlers = [];
    var knownHandlers = [ "onExit", "onAbort", "print", "printErr" ];
    for (var handler of knownHandlers) {
      if (Module.propertyIsEnumerable(handler)) {
        handlers.push(handler);
      }
    }
    worker.workerID = PThread.nextWorkerID++;
    // Ask the new worker to load up the Emscripten-compiled page. This is a heavy operation.
    worker.postMessage({
      cmd: "load",
      handlers,
      wasmMemory,
      wasmModule,
      "workerID": worker.workerID
    });
  }),
  loadWasmModuleToAllWorkers(onMaybeReady) {
    // Instantiation is synchronous in pthreads.
    if (ENVIRONMENT_IS_PTHREAD) {
      return onMaybeReady();
    }
    let pthreadPoolReady = Promise.all(PThread.unusedWorkers.map(PThread.loadWasmModuleToWorker));
    pthreadPoolReady.then(onMaybeReady);
  },
  allocateUnusedWorker() {
    var worker;
    var workerOptions = {
      // This is the way that we signal to the node worker that it is hosting
      // a pthread.
      "workerData": "em-pthread",
      // This is the way that we signal to the Web Worker that it is hosting
      // a pthread.
      "name": "em-pthread-" + PThread.nextWorkerID
    };
    var pthreadMainJs = _scriptName;
    // We can't use makeModuleReceiveWithVar here since we want to also
    // call URL.createObjectURL on the mainScriptUrlOrBlob.
    if (Module["mainScriptUrlOrBlob"]) {
      pthreadMainJs = Module["mainScriptUrlOrBlob"];
      if (typeof pthreadMainJs != "string") {
        pthreadMainJs = URL.createObjectURL(pthreadMainJs);
      }
    }
    worker = new Worker(pthreadMainJs, workerOptions);
    PThread.unusedWorkers.push(worker);
  },
  getNewWorker() {
    if (PThread.unusedWorkers.length == 0) {
      // PTHREAD_POOL_SIZE_STRICT should show a warning and, if set to level `2`, return from the function.
      // However, if we're in Node.js, then we can create new workers on the fly and PTHREAD_POOL_SIZE_STRICT
      // should be ignored altogether.
      if (!ENVIRONMENT_IS_NODE) {
        err("Tried to spawn a new thread, but the thread pool is exhausted.\n" + "This might result in a deadlock unless some threads eventually exit or the code explicitly breaks out to the event loop.\n" + "If you want to increase the pool size, use setting `-sPTHREAD_POOL_SIZE=...`." + "\nIf you want to throw an explicit error instead of the risk of deadlocking in those cases, use setting `-sPTHREAD_POOL_SIZE_STRICT=2`.");
      }
      PThread.allocateUnusedWorker();
      PThread.loadWasmModuleToWorker(PThread.unusedWorkers[0]);
    }
    return PThread.unusedWorkers.pop();
  }
};

var callRuntimeCallbacks = callbacks => {
  while (callbacks.length > 0) {
    // Pass the module as the first argument.
    callbacks.shift()(Module);
  }
};

var establishStackSpace = pthread_ptr => {
  // If memory growth is enabled, the memory views may have gotten out of date,
  // so resync them before accessing the pthread ptr below.
  updateMemoryViews();
  var stackHigh = GROWABLE_HEAP_U32()[(((pthread_ptr) + (52)) >> 2)];
  var stackSize = GROWABLE_HEAP_U32()[(((pthread_ptr) + (56)) >> 2)];
  var stackLow = stackHigh - stackSize;
  assert(stackHigh != 0);
  assert(stackLow != 0);
  assert(stackHigh > stackLow, "stackHigh must be higher then stackLow");
  // Set stack limits used by `emscripten/stack.h` function.  These limits are
  // cached in wasm-side globals to make checks as fast as possible.
  _emscripten_stack_set_limits(stackHigh, stackLow);
  setStackLimits();
  // Call inside wasm module to set up the stack frame for this pthread in wasm module scope
  stackRestore(stackHigh);
  // Write the stack cookie last, after we have set up the proper bounds and
  // current position of the stack.
  writeStackCookie();
};

var wasmTableMirror = [];

/** @type {WebAssembly.Table} */ var wasmTable;

var getWasmTableEntry = funcPtr => {
  var func = wasmTableMirror[funcPtr];
  if (!func) {
    if (funcPtr >= wasmTableMirror.length) wasmTableMirror.length = funcPtr + 1;
    /** @suppress {checkTypes} */ wasmTableMirror[funcPtr] = func = wasmTable.get(funcPtr);
  }
  /** @suppress {checkTypes} */ assert(wasmTable.get(funcPtr) == func, "JavaScript-side Wasm function table mirror is out of date!");
  return func;
};

var invokeEntryPoint = (ptr, arg) => {
  // An old thread on this worker may have been canceled without returning the
  // `runtimeKeepaliveCounter` to zero. Reset it now so the new thread won't
  // be affected.
  runtimeKeepaliveCounter = 0;
  // Same for noExitRuntime.  The default for pthreads should always be false
  // otherwise pthreads would never complete and attempts to pthread_join to
  // them would block forever.
  // pthreads can still choose to set `noExitRuntime` explicitly, or
  // call emscripten_unwind_to_js_event_loop to extend their lifetime beyond
  // their main function.  See comment in src/runtime_pthread.js for more.
  noExitRuntime = 0;
  // pthread entry points are always of signature 'void *ThreadMain(void *arg)'
  // Native codebases sometimes spawn threads with other thread entry point
  // signatures, such as void ThreadMain(void *arg), void *ThreadMain(), or
  // void ThreadMain().  That is not acceptable per C/C++ specification, but
  // x86 compiler ABI extensions enable that to work. If you find the
  // following line to crash, either change the signature to "proper" void
  // *ThreadMain(void *arg) form, or try linking with the Emscripten linker
  // flag -sEMULATE_FUNCTION_POINTER_CASTS to add in emulation for this x86
  // ABI extension.
  var result = getWasmTableEntry(ptr)(arg);
  checkStackCookie();
  function finish(result) {
    if (keepRuntimeAlive()) {
      EXITSTATUS = result;
    } else {
      __emscripten_thread_exit(result);
    }
  }
  finish(result);
};

var noExitRuntime = Module["noExitRuntime"] || true;

var registerTLSInit = tlsInitFunc => PThread.tlsInitFunctions.push(tlsInitFunc);

var setStackLimits = () => {
  var stackLow = _emscripten_stack_get_base();
  var stackHigh = _emscripten_stack_get_end();
  ___set_stack_limits(stackLow, stackHigh);
};

var warnOnce = text => {
  warnOnce.shown ||= {};
  if (!warnOnce.shown[text]) {
    warnOnce.shown[text] = 1;
    if (ENVIRONMENT_IS_NODE) text = "warning: " + text;
    err(text);
  }
};

var UTF8Decoder = typeof TextDecoder != "undefined" ? new TextDecoder : undefined;

/**
     * Given a pointer 'idx' to a null-terminated UTF8-encoded string in the given
     * array that contains uint8 values, returns a copy of that string as a
     * Javascript String object.
     * heapOrArray is either a regular array, or a JavaScript typed array view.
     * @param {number=} idx
     * @param {number=} maxBytesToRead
     * @return {string}
     */ var UTF8ArrayToString = (heapOrArray, idx = 0, maxBytesToRead = NaN) => {
  var endIdx = idx + maxBytesToRead;
  var endPtr = idx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on
  // null terminator by itself.  Also, use the length info to avoid running tiny
  // strings through TextDecoder, since .subarray() allocates garbage.
  // (As a tiny code save trick, compare endPtr against endIdx using a negation,
  // so that undefined/NaN means Infinity)
  while (heapOrArray[endPtr] && !(endPtr >= endIdx)) ++endPtr;
  if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
    return UTF8Decoder.decode(heapOrArray.buffer instanceof ArrayBuffer ? heapOrArray.subarray(idx, endPtr) : heapOrArray.slice(idx, endPtr));
  }
  var str = "";
  // If building with TextDecoder, we have already computed the string length
  // above, so test loop end condition against that
  while (idx < endPtr) {
    // For UTF8 byte structure, see:
    // http://en.wikipedia.org/wiki/UTF-8#Description
    // https://www.ietf.org/rfc/rfc2279.txt
    // https://tools.ietf.org/html/rfc3629
    var u0 = heapOrArray[idx++];
    if (!(u0 & 128)) {
      str += String.fromCharCode(u0);
      continue;
    }
    var u1 = heapOrArray[idx++] & 63;
    if ((u0 & 224) == 192) {
      str += String.fromCharCode(((u0 & 31) << 6) | u1);
      continue;
    }
    var u2 = heapOrArray[idx++] & 63;
    if ((u0 & 240) == 224) {
      u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
    } else {
      if ((u0 & 248) != 240) warnOnce("Invalid UTF-8 leading byte " + ptrToString(u0) + " encountered when deserializing a UTF-8 string in wasm memory to a JS string!");
      u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (heapOrArray[idx++] & 63);
    }
    if (u0 < 65536) {
      str += String.fromCharCode(u0);
    } else {
      var ch = u0 - 65536;
      str += String.fromCharCode(55296 | (ch >> 10), 56320 | (ch & 1023));
    }
  }
  return str;
};

/**
     * Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the
     * emscripten HEAP, returns a copy of that string as a Javascript String object.
     *
     * @param {number} ptr
     * @param {number=} maxBytesToRead - An optional length that specifies the
     *   maximum number of bytes to read. You can omit this parameter to scan the
     *   string until the first 0 byte. If maxBytesToRead is passed, and the string
     *   at [ptr, ptr+maxBytesToReadr[ contains a null byte in the middle, then the
     *   string will cut short at that byte index (i.e. maxBytesToRead will not
     *   produce a string of exact length [ptr, ptr+maxBytesToRead[) N.B. mixing
     *   frequent uses of UTF8ToString() with and without maxBytesToRead may throw
     *   JS JIT optimizations off, so it is worth to consider consistently using one
     * @return {string}
     */ var UTF8ToString = (ptr, maxBytesToRead) => {
  assert(typeof ptr == "number", `UTF8ToString expects a number (got ${typeof ptr})`);
  return ptr ? UTF8ArrayToString(GROWABLE_HEAP_U8(), ptr, maxBytesToRead) : "";
};

var ___assert_fail = (condition, filename, line, func) => abort(`Assertion failed: ${UTF8ToString(condition)}, at: ` + [ filename ? UTF8ToString(filename) : "unknown filename", line, func ? UTF8ToString(func) : "unknown function" ]);

class ExceptionInfo {
  // excPtr - Thrown object pointer to wrap. Metadata pointer is calculated from it.
  constructor(excPtr) {
    this.excPtr = excPtr;
    this.ptr = excPtr - 24;
  }
  set_type(type) {
    GROWABLE_HEAP_U32()[(((this.ptr) + (4)) >> 2)] = type;
  }
  get_type() {
    return GROWABLE_HEAP_U32()[(((this.ptr) + (4)) >> 2)];
  }
  set_destructor(destructor) {
    GROWABLE_HEAP_U32()[(((this.ptr) + (8)) >> 2)] = destructor;
  }
  get_destructor() {
    return GROWABLE_HEAP_U32()[(((this.ptr) + (8)) >> 2)];
  }
  set_caught(caught) {
    caught = caught ? 1 : 0;
    GROWABLE_HEAP_I8()[(this.ptr) + (12)] = caught;
    checkInt8(caught);
  }
  get_caught() {
    return GROWABLE_HEAP_I8()[(this.ptr) + (12)] != 0;
  }
  set_rethrown(rethrown) {
    rethrown = rethrown ? 1 : 0;
    GROWABLE_HEAP_I8()[(this.ptr) + (13)] = rethrown;
    checkInt8(rethrown);
  }
  get_rethrown() {
    return GROWABLE_HEAP_I8()[(this.ptr) + (13)] != 0;
  }
  // Initialize native structure fields. Should be called once after allocated.
  init(type, destructor) {
    this.set_adjusted_ptr(0);
    this.set_type(type);
    this.set_destructor(destructor);
  }
  set_adjusted_ptr(adjustedPtr) {
    GROWABLE_HEAP_U32()[(((this.ptr) + (16)) >> 2)] = adjustedPtr;
  }
  get_adjusted_ptr() {
    return GROWABLE_HEAP_U32()[(((this.ptr) + (16)) >> 2)];
  }
}

var exceptionLast = 0;

var uncaughtExceptionCount = 0;

var ___cxa_throw = (ptr, type, destructor) => {
  var info = new ExceptionInfo(ptr);
  // Initialize ExceptionInfo content after it was allocated in __cxa_allocate_exception.
  info.init(type, destructor);
  exceptionLast = ptr;
  uncaughtExceptionCount++;
  assert(false, "Exception thrown, but exception catching is not enabled. Compile with -sNO_DISABLE_EXCEPTION_CATCHING or -sEXCEPTION_CATCHING_ALLOWED=[..] to catch.");
};

var ___handle_stack_overflow = requested => {
  var base = _emscripten_stack_get_base();
  var end = _emscripten_stack_get_end();
  abort(`stack overflow (Attempt to set SP to ${ptrToString(requested)}` + `, with stack limits [${ptrToString(end)} - ${ptrToString(base)}` + "]). If you require more stack space build with -sSTACK_SIZE=<bytes>");
};

function pthreadCreateProxied(pthread_ptr, attr, startRoutine, arg) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(2, 0, 1, pthread_ptr, attr, startRoutine, arg);
  return ___pthread_create_js(pthread_ptr, attr, startRoutine, arg);
}

var _emscripten_has_threading_support = () => typeof SharedArrayBuffer != "undefined";

var ___pthread_create_js = (pthread_ptr, attr, startRoutine, arg) => {
  if (!_emscripten_has_threading_support()) {
    dbg("pthread_create: environment does not support SharedArrayBuffer, pthreads are not available");
    return 6;
  }
  // List of JS objects that will transfer ownership to the Worker hosting the thread
  var transferList = [];
  var error = 0;
  // Synchronously proxy the thread creation to main thread if possible. If we
  // need to transfer ownership of objects, then proxy asynchronously via
  // postMessage.
  if (ENVIRONMENT_IS_PTHREAD && (transferList.length === 0 || error)) {
    return pthreadCreateProxied(pthread_ptr, attr, startRoutine, arg);
  }
  // If on the main thread, and accessing Canvas/OffscreenCanvas failed, abort
  // with the detected error.
  if (error) return error;
  var threadParams = {
    startRoutine,
    pthread_ptr,
    arg,
    transferList
  };
  if (ENVIRONMENT_IS_PTHREAD) {
    // The prepopulated pool of web workers that can host pthreads is stored
    // in the main JS thread. Therefore if a pthread is attempting to spawn a
    // new thread, the thread creation must be deferred to the main JS thread.
    threadParams.cmd = "spawnThread";
    postMessage(threadParams, transferList);
    // When we defer thread creation this way, we have no way to detect thread
    // creation synchronously today, so we have to assume success and return 0.
    return 0;
  }
  // We are the main thread, so we have the pthread warmup pool in this
  // thread and can fire off JS thread creation directly ourselves.
  return spawnThread(threadParams);
};

var PATH = {
  isAbs: path => path.charAt(0) === "/",
  splitPath: filename => {
    var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
    return splitPathRe.exec(filename).slice(1);
  },
  normalizeArray: (parts, allowAboveRoot) => {
    // if the path tries to go above the root, `up` ends up > 0
    var up = 0;
    for (var i = parts.length - 1; i >= 0; i--) {
      var last = parts[i];
      if (last === ".") {
        parts.splice(i, 1);
      } else if (last === "..") {
        parts.splice(i, 1);
        up++;
      } else if (up) {
        parts.splice(i, 1);
        up--;
      }
    }
    // if the path is allowed to go above the root, restore leading ..s
    if (allowAboveRoot) {
      for (;up; up--) {
        parts.unshift("..");
      }
    }
    return parts;
  },
  normalize: path => {
    var isAbsolute = PATH.isAbs(path), trailingSlash = path.substr(-1) === "/";
    // Normalize the path
    path = PATH.normalizeArray(path.split("/").filter(p => !!p), !isAbsolute).join("/");
    if (!path && !isAbsolute) {
      path = ".";
    }
    if (path && trailingSlash) {
      path += "/";
    }
    return (isAbsolute ? "/" : "") + path;
  },
  dirname: path => {
    var result = PATH.splitPath(path), root = result[0], dir = result[1];
    if (!root && !dir) {
      // No dirname whatsoever
      return ".";
    }
    if (dir) {
      // It has a dirname, strip trailing slash
      dir = dir.substr(0, dir.length - 1);
    }
    return root + dir;
  },
  basename: path => {
    // EMSCRIPTEN return '/'' for '/', not an empty string
    if (path === "/") return "/";
    path = PATH.normalize(path);
    path = path.replace(/\/$/, "");
    var lastSlash = path.lastIndexOf("/");
    if (lastSlash === -1) return path;
    return path.substr(lastSlash + 1);
  },
  join: (...paths) => PATH.normalize(paths.join("/")),
  join2: (l, r) => PATH.normalize(l + "/" + r)
};

var initRandomFill = () => {
  if (typeof crypto == "object" && typeof crypto["getRandomValues"] == "function") {
    // for modern web browsers
    // like with most Web APIs, we can't use Web Crypto API directly on shared memory,
    // so we need to create an intermediate buffer and copy it to the destination
    return view => (view.set(crypto.getRandomValues(new Uint8Array(view.byteLength))), 
    // Return the original view to match modern native implementations.
    view);
  } else if (ENVIRONMENT_IS_NODE) {
    // for nodejs with or without crypto support included
    try {
      var crypto_module = require("crypto");
      var randomFillSync = crypto_module["randomFillSync"];
      if (randomFillSync) {
        // nodejs with LTS crypto support
        return view => crypto_module["randomFillSync"](view);
      }
      // very old nodejs with the original crypto API
      var randomBytes = crypto_module["randomBytes"];
      return view => (view.set(randomBytes(view.byteLength)), // Return the original view to match modern native implementations.
      view);
    } catch (e) {}
  }
  // we couldn't find a proper implementation, as Math.random() is not suitable for /dev/random, see emscripten-core/emscripten/pull/7096
  abort("no cryptographic support found for randomDevice. consider polyfilling it if you want to use something insecure like Math.random(), e.g. put this in a --pre-js: var crypto = { getRandomValues: (array) => { for (var i = 0; i < array.length; i++) array[i] = (Math.random()*256)|0 } };");
};

var randomFill = view => (randomFill = initRandomFill())(view);

var PATH_FS = {
  resolve: (...args) => {
    var resolvedPath = "", resolvedAbsolute = false;
    for (var i = args.length - 1; i >= -1 && !resolvedAbsolute; i--) {
      var path = (i >= 0) ? args[i] : FS.cwd();
      // Skip empty and invalid entries
      if (typeof path != "string") {
        throw new TypeError("Arguments to path.resolve must be strings");
      } else if (!path) {
        return "";
      }
      // an invalid portion invalidates the whole thing
      resolvedPath = path + "/" + resolvedPath;
      resolvedAbsolute = PATH.isAbs(path);
    }
    // At this point the path should be resolved to a full absolute path, but
    // handle relative paths to be safe (might happen when process.cwd() fails)
    resolvedPath = PATH.normalizeArray(resolvedPath.split("/").filter(p => !!p), !resolvedAbsolute).join("/");
    return ((resolvedAbsolute ? "/" : "") + resolvedPath) || ".";
  },
  relative: (from, to) => {
    from = PATH_FS.resolve(from).substr(1);
    to = PATH_FS.resolve(to).substr(1);
    function trim(arr) {
      var start = 0;
      for (;start < arr.length; start++) {
        if (arr[start] !== "") break;
      }
      var end = arr.length - 1;
      for (;end >= 0; end--) {
        if (arr[end] !== "") break;
      }
      if (start > end) return [];
      return arr.slice(start, end - start + 1);
    }
    var fromParts = trim(from.split("/"));
    var toParts = trim(to.split("/"));
    var length = Math.min(fromParts.length, toParts.length);
    var samePartsLength = length;
    for (var i = 0; i < length; i++) {
      if (fromParts[i] !== toParts[i]) {
        samePartsLength = i;
        break;
      }
    }
    var outputParts = [];
    for (var i = samePartsLength; i < fromParts.length; i++) {
      outputParts.push("..");
    }
    outputParts = outputParts.concat(toParts.slice(samePartsLength));
    return outputParts.join("/");
  }
};

var FS_stdin_getChar_buffer = [];

var lengthBytesUTF8 = str => {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code
    // unit, not a Unicode code point of the character! So decode
    // UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var c = str.charCodeAt(i);
    // possibly a lead surrogate
    if (c <= 127) {
      len++;
    } else if (c <= 2047) {
      len += 2;
    } else if (c >= 55296 && c <= 57343) {
      len += 4;
      ++i;
    } else {
      len += 3;
    }
  }
  return len;
};

var stringToUTF8Array = (str, heap, outIdx, maxBytesToWrite) => {
  assert(typeof str === "string", `stringToUTF8Array expects a string (got ${typeof str})`);
  // Parameter maxBytesToWrite is not optional. Negative values, 0, null,
  // undefined and false each don't write out any bytes.
  if (!(maxBytesToWrite > 0)) return 0;
  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1;
  // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code
    // unit, not a Unicode code point of the character! So decode
    // UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description
    // and https://www.ietf.org/rfc/rfc2279.txt
    // and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i);
    // possibly a lead surrogate
    if (u >= 55296 && u <= 57343) {
      var u1 = str.charCodeAt(++i);
      u = 65536 + ((u & 1023) << 10) | (u1 & 1023);
    }
    if (u <= 127) {
      if (outIdx >= endIdx) break;
      heap[outIdx++] = u;
    } else if (u <= 2047) {
      if (outIdx + 1 >= endIdx) break;
      heap[outIdx++] = 192 | (u >> 6);
      heap[outIdx++] = 128 | (u & 63);
    } else if (u <= 65535) {
      if (outIdx + 2 >= endIdx) break;
      heap[outIdx++] = 224 | (u >> 12);
      heap[outIdx++] = 128 | ((u >> 6) & 63);
      heap[outIdx++] = 128 | (u & 63);
    } else {
      if (outIdx + 3 >= endIdx) break;
      if (u > 1114111) warnOnce("Invalid Unicode code point " + ptrToString(u) + " encountered when serializing a JS string to a UTF-8 string in wasm memory! (Valid unicode code points should be in range 0-0x10FFFF).");
      heap[outIdx++] = 240 | (u >> 18);
      heap[outIdx++] = 128 | ((u >> 12) & 63);
      heap[outIdx++] = 128 | ((u >> 6) & 63);
      heap[outIdx++] = 128 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  heap[outIdx] = 0;
  return outIdx - startIdx;
};

/** @type {function(string, boolean=, number=)} */ function intArrayFromString(stringy, dontAddNull, length) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}

var FS_stdin_getChar = () => {
  if (!FS_stdin_getChar_buffer.length) {
    var result = null;
    if (ENVIRONMENT_IS_NODE) {
      // we will read data by chunks of BUFSIZE
      var BUFSIZE = 256;
      var buf = Buffer.alloc(BUFSIZE);
      var bytesRead = 0;
      // For some reason we must suppress a closure warning here, even though
      // fd definitely exists on process.stdin, and is even the proper way to
      // get the fd of stdin,
      // https://github.com/nodejs/help/issues/2136#issuecomment-523649904
      // This started to happen after moving this logic out of library_tty.js,
      // so it is related to the surrounding code in some unclear manner.
      /** @suppress {missingProperties} */ var fd = process.stdin.fd;
      try {
        bytesRead = fs.readSync(fd, buf, 0, BUFSIZE);
      } catch (e) {
        // Cross-platform differences: on Windows, reading EOF throws an
        // exception, but on other OSes, reading EOF returns 0. Uniformize
        // behavior by treating the EOF exception to return 0.
        if (e.toString().includes("EOF")) bytesRead = 0; else throw e;
      }
      if (bytesRead > 0) {
        result = buf.slice(0, bytesRead).toString("utf-8");
      }
    } else if (typeof window != "undefined" && typeof window.prompt == "function") {
      // Browser.
      result = window.prompt("Input: ");
      // returns null on cancel
      if (result !== null) {
        result += "\n";
      }
    } else {}
    if (!result) {
      return null;
    }
    FS_stdin_getChar_buffer = intArrayFromString(result, true);
  }
  return FS_stdin_getChar_buffer.shift();
};

var TTY = {
  ttys: [],
  init() {},
  // https://github.com/emscripten-core/emscripten/pull/1555
  // if (ENVIRONMENT_IS_NODE) {
  //   // currently, FS.init does not distinguish if process.stdin is a file or TTY
  //   // device, it always assumes it's a TTY device. because of this, we're forcing
  //   // process.stdin to UTF8 encoding to at least make stdin reading compatible
  //   // with text files until FS.init can be refactored.
  //   process.stdin.setEncoding('utf8');
  // }
  shutdown() {},
  // https://github.com/emscripten-core/emscripten/pull/1555
  // if (ENVIRONMENT_IS_NODE) {
  //   // inolen: any idea as to why node -e 'process.stdin.read()' wouldn't exit immediately (with process.stdin being a tty)?
  //   // isaacs: because now it's reading from the stream, you've expressed interest in it, so that read() kicks off a _read() which creates a ReadReq operation
  //   // inolen: I thought read() in that case was a synchronous operation that just grabbed some amount of buffered data if it exists?
  //   // isaacs: it is. but it also triggers a _read() call, which calls readStart() on the handle
  //   // isaacs: do process.stdin.pause() and i'd think it'd probably close the pending call
  //   process.stdin.pause();
  // }
  register(dev, ops) {
    TTY.ttys[dev] = {
      input: [],
      output: [],
      ops
    };
    FS.registerDevice(dev, TTY.stream_ops);
  },
  stream_ops: {
    open(stream) {
      var tty = TTY.ttys[stream.node.rdev];
      if (!tty) {
        throw new FS.ErrnoError(43);
      }
      stream.tty = tty;
      stream.seekable = false;
    },
    close(stream) {
      // flush any pending line data
      stream.tty.ops.fsync(stream.tty);
    },
    fsync(stream) {
      stream.tty.ops.fsync(stream.tty);
    },
    read(stream, buffer, offset, length, pos) {
      /* ignored */ if (!stream.tty || !stream.tty.ops.get_char) {
        throw new FS.ErrnoError(60);
      }
      var bytesRead = 0;
      for (var i = 0; i < length; i++) {
        var result;
        try {
          result = stream.tty.ops.get_char(stream.tty);
        } catch (e) {
          throw new FS.ErrnoError(29);
        }
        if (result === undefined && bytesRead === 0) {
          throw new FS.ErrnoError(6);
        }
        if (result === null || result === undefined) break;
        bytesRead++;
        buffer[offset + i] = result;
      }
      if (bytesRead) {
        stream.node.atime = Date.now();
      }
      return bytesRead;
    },
    write(stream, buffer, offset, length, pos) {
      if (!stream.tty || !stream.tty.ops.put_char) {
        throw new FS.ErrnoError(60);
      }
      try {
        for (var i = 0; i < length; i++) {
          stream.tty.ops.put_char(stream.tty, buffer[offset + i]);
        }
      } catch (e) {
        throw new FS.ErrnoError(29);
      }
      if (length) {
        stream.node.mtime = stream.node.ctime = Date.now();
      }
      return i;
    }
  },
  default_tty_ops: {
    get_char(tty) {
      return FS_stdin_getChar();
    },
    put_char(tty, val) {
      if (val === null || val === 10) {
        out(UTF8ArrayToString(tty.output));
        tty.output = [];
      } else {
        if (val != 0) tty.output.push(val);
      }
    },
    // val == 0 would cut text output off in the middle.
    fsync(tty) {
      if (tty.output && tty.output.length > 0) {
        out(UTF8ArrayToString(tty.output));
        tty.output = [];
      }
    },
    ioctl_tcgets(tty) {
      // typical setting
      return {
        c_iflag: 25856,
        c_oflag: 5,
        c_cflag: 191,
        c_lflag: 35387,
        c_cc: [ 3, 28, 127, 21, 4, 0, 1, 0, 17, 19, 26, 0, 18, 15, 23, 22, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
      };
    },
    ioctl_tcsets(tty, optional_actions, data) {
      // currently just ignore
      return 0;
    },
    ioctl_tiocgwinsz(tty) {
      return [ 24, 80 ];
    }
  },
  default_tty1_ops: {
    put_char(tty, val) {
      if (val === null || val === 10) {
        err(UTF8ArrayToString(tty.output));
        tty.output = [];
      } else {
        if (val != 0) tty.output.push(val);
      }
    },
    fsync(tty) {
      if (tty.output && tty.output.length > 0) {
        err(UTF8ArrayToString(tty.output));
        tty.output = [];
      }
    }
  }
};

var alignMemory = (size, alignment) => {
  assert(alignment, "alignment argument is required");
  return Math.ceil(size / alignment) * alignment;
};

var mmapAlloc = size => {
  abort("internal error: mmapAlloc called but `emscripten_builtin_memalign` native symbol not exported");
};

var MEMFS = {
  ops_table: null,
  mount(mount) {
    return MEMFS.createNode(null, "/", 16895, 0);
  },
  createNode(parent, name, mode, dev) {
    if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
      // no supported
      throw new FS.ErrnoError(63);
    }
    MEMFS.ops_table ||= {
      dir: {
        node: {
          getattr: MEMFS.node_ops.getattr,
          setattr: MEMFS.node_ops.setattr,
          lookup: MEMFS.node_ops.lookup,
          mknod: MEMFS.node_ops.mknod,
          rename: MEMFS.node_ops.rename,
          unlink: MEMFS.node_ops.unlink,
          rmdir: MEMFS.node_ops.rmdir,
          readdir: MEMFS.node_ops.readdir,
          symlink: MEMFS.node_ops.symlink
        },
        stream: {
          llseek: MEMFS.stream_ops.llseek
        }
      },
      file: {
        node: {
          getattr: MEMFS.node_ops.getattr,
          setattr: MEMFS.node_ops.setattr
        },
        stream: {
          llseek: MEMFS.stream_ops.llseek,
          read: MEMFS.stream_ops.read,
          write: MEMFS.stream_ops.write,
          allocate: MEMFS.stream_ops.allocate,
          mmap: MEMFS.stream_ops.mmap,
          msync: MEMFS.stream_ops.msync
        }
      },
      link: {
        node: {
          getattr: MEMFS.node_ops.getattr,
          setattr: MEMFS.node_ops.setattr,
          readlink: MEMFS.node_ops.readlink
        },
        stream: {}
      },
      chrdev: {
        node: {
          getattr: MEMFS.node_ops.getattr,
          setattr: MEMFS.node_ops.setattr
        },
        stream: FS.chrdev_stream_ops
      }
    };
    var node = FS.createNode(parent, name, mode, dev);
    if (FS.isDir(node.mode)) {
      node.node_ops = MEMFS.ops_table.dir.node;
      node.stream_ops = MEMFS.ops_table.dir.stream;
      node.contents = {};
    } else if (FS.isFile(node.mode)) {
      node.node_ops = MEMFS.ops_table.file.node;
      node.stream_ops = MEMFS.ops_table.file.stream;
      node.usedBytes = 0;
      // The actual number of bytes used in the typed array, as opposed to contents.length which gives the whole capacity.
      // When the byte data of the file is populated, this will point to either a typed array, or a normal JS array. Typed arrays are preferred
      // for performance, and used by default. However, typed arrays are not resizable like normal JS arrays are, so there is a small disk size
      // penalty involved for appending file writes that continuously grow a file similar to std::vector capacity vs used -scheme.
      node.contents = null;
    } else if (FS.isLink(node.mode)) {
      node.node_ops = MEMFS.ops_table.link.node;
      node.stream_ops = MEMFS.ops_table.link.stream;
    } else if (FS.isChrdev(node.mode)) {
      node.node_ops = MEMFS.ops_table.chrdev.node;
      node.stream_ops = MEMFS.ops_table.chrdev.stream;
    }
    node.atime = node.mtime = node.ctime = Date.now();
    // add the new node to the parent
    if (parent) {
      parent.contents[name] = node;
      parent.atime = parent.mtime = parent.ctime = node.atime;
    }
    return node;
  },
  getFileDataAsTypedArray(node) {
    if (!node.contents) return new Uint8Array(0);
    if (node.contents.subarray) return node.contents.subarray(0, node.usedBytes);
    // Make sure to not return excess unused bytes.
    return new Uint8Array(node.contents);
  },
  expandFileStorage(node, newCapacity) {
    var prevCapacity = node.contents ? node.contents.length : 0;
    if (prevCapacity >= newCapacity) return;
    // No need to expand, the storage was already large enough.
    // Don't expand strictly to the given requested limit if it's only a very small increase, but instead geometrically grow capacity.
    // For small filesizes (<1MB), perform size*2 geometric increase, but for large sizes, do a much more conservative size*1.125 increase to
    // avoid overshooting the allocation cap by a very large margin.
    var CAPACITY_DOUBLING_MAX = 1024 * 1024;
    newCapacity = Math.max(newCapacity, (prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2 : 1.125)) >>> 0);
    if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256);
    // At minimum allocate 256b for each file when expanding.
    var oldContents = node.contents;
    node.contents = new Uint8Array(newCapacity);
    // Allocate new storage.
    if (node.usedBytes > 0) node.contents.set(oldContents.subarray(0, node.usedBytes), 0);
  },
  // Copy old data over to the new storage.
  resizeFileStorage(node, newSize) {
    if (node.usedBytes == newSize) return;
    if (newSize == 0) {
      node.contents = null;
      // Fully decommit when requesting a resize to zero.
      node.usedBytes = 0;
    } else {
      var oldContents = node.contents;
      node.contents = new Uint8Array(newSize);
      // Allocate new storage.
      if (oldContents) {
        node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes)));
      }
      // Copy old data over to the new storage.
      node.usedBytes = newSize;
    }
  },
  node_ops: {
    getattr(node) {
      var attr = {};
      // device numbers reuse inode numbers.
      attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
      attr.ino = node.id;
      attr.mode = node.mode;
      attr.nlink = 1;
      attr.uid = 0;
      attr.gid = 0;
      attr.rdev = node.rdev;
      if (FS.isDir(node.mode)) {
        attr.size = 4096;
      } else if (FS.isFile(node.mode)) {
        attr.size = node.usedBytes;
      } else if (FS.isLink(node.mode)) {
        attr.size = node.link.length;
      } else {
        attr.size = 0;
      }
      attr.atime = new Date(node.atime);
      attr.mtime = new Date(node.mtime);
      attr.ctime = new Date(node.ctime);
      // NOTE: In our implementation, st_blocks = Math.ceil(st_size/st_blksize),
      //       but this is not required by the standard.
      attr.blksize = 4096;
      attr.blocks = Math.ceil(attr.size / attr.blksize);
      return attr;
    },
    setattr(node, attr) {
      for (const key of [ "mode", "atime", "mtime", "ctime" ]) {
        if (attr[key]) {
          node[key] = attr[key];
        }
      }
      if (attr.size !== undefined) {
        MEMFS.resizeFileStorage(node, attr.size);
      }
    },
    lookup(parent, name) {
      throw new FS.ErrnoError(44);
    },
    mknod(parent, name, mode, dev) {
      return MEMFS.createNode(parent, name, mode, dev);
    },
    rename(old_node, new_dir, new_name) {
      var new_node;
      try {
        new_node = FS.lookupNode(new_dir, new_name);
      } catch (e) {}
      if (new_node) {
        if (FS.isDir(old_node.mode)) {
          // if we're overwriting a directory at new_name, make sure it's empty.
          for (var i in new_node.contents) {
            throw new FS.ErrnoError(55);
          }
        }
        FS.hashRemoveNode(new_node);
      }
      // do the internal rewiring
      delete old_node.parent.contents[old_node.name];
      new_dir.contents[new_name] = old_node;
      old_node.name = new_name;
      new_dir.ctime = new_dir.mtime = old_node.parent.ctime = old_node.parent.mtime = Date.now();
    },
    unlink(parent, name) {
      delete parent.contents[name];
      parent.ctime = parent.mtime = Date.now();
    },
    rmdir(parent, name) {
      var node = FS.lookupNode(parent, name);
      for (var i in node.contents) {
        throw new FS.ErrnoError(55);
      }
      delete parent.contents[name];
      parent.ctime = parent.mtime = Date.now();
    },
    readdir(node) {
      return [ ".", "..", ...Object.keys(node.contents) ];
    },
    symlink(parent, newname, oldpath) {
      var node = MEMFS.createNode(parent, newname, 511 | 40960, 0);
      node.link = oldpath;
      return node;
    },
    readlink(node) {
      if (!FS.isLink(node.mode)) {
        throw new FS.ErrnoError(28);
      }
      return node.link;
    }
  },
  stream_ops: {
    read(stream, buffer, offset, length, position) {
      var contents = stream.node.contents;
      if (position >= stream.node.usedBytes) return 0;
      var size = Math.min(stream.node.usedBytes - position, length);
      assert(size >= 0);
      if (size > 8 && contents.subarray) {
        // non-trivial, and typed array
        buffer.set(contents.subarray(position, position + size), offset);
      } else {
        for (var i = 0; i < size; i++) buffer[offset + i] = contents[position + i];
      }
      return size;
    },
    write(stream, buffer, offset, length, position, canOwn) {
      // The data buffer should be a typed array view
      assert(!(buffer instanceof ArrayBuffer));
      // If the buffer is located in main memory (HEAP), and if
      // memory can grow, we can't hold on to references of the
      // memory buffer, as they may get invalidated. That means we
      // need to do copy its contents.
      if (buffer.buffer === GROWABLE_HEAP_I8().buffer) {
        canOwn = false;
      }
      if (!length) return 0;
      var node = stream.node;
      node.mtime = node.ctime = Date.now();
      if (buffer.subarray && (!node.contents || node.contents.subarray)) {
        // This write is from a typed array to a typed array?
        if (canOwn) {
          assert(position === 0, "canOwn must imply no weird position inside the file");
          node.contents = buffer.subarray(offset, offset + length);
          node.usedBytes = length;
          return length;
        } else if (node.usedBytes === 0 && position === 0) {
          // If this is a simple first write to an empty file, do a fast set since we don't need to care about old data.
          node.contents = buffer.slice(offset, offset + length);
          node.usedBytes = length;
          return length;
        } else if (position + length <= node.usedBytes) {
          // Writing to an already allocated and used subrange of the file?
          node.contents.set(buffer.subarray(offset, offset + length), position);
          return length;
        }
      }
      // Appending to an existing file and we need to reallocate, or source data did not come as a typed array.
      MEMFS.expandFileStorage(node, position + length);
      if (node.contents.subarray && buffer.subarray) {
        // Use typed array write which is available.
        node.contents.set(buffer.subarray(offset, offset + length), position);
      } else {
        for (var i = 0; i < length; i++) {
          node.contents[position + i] = buffer[offset + i];
        }
      }
      node.usedBytes = Math.max(node.usedBytes, position + length);
      return length;
    },
    llseek(stream, offset, whence) {
      var position = offset;
      if (whence === 1) {
        position += stream.position;
      } else if (whence === 2) {
        if (FS.isFile(stream.node.mode)) {
          position += stream.node.usedBytes;
        }
      }
      if (position < 0) {
        throw new FS.ErrnoError(28);
      }
      return position;
    },
    allocate(stream, offset, length) {
      MEMFS.expandFileStorage(stream.node, offset + length);
      stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length);
    },
    mmap(stream, length, position, prot, flags) {
      if (!FS.isFile(stream.node.mode)) {
        throw new FS.ErrnoError(43);
      }
      var ptr;
      var allocated;
      var contents = stream.node.contents;
      // Only make a new copy when MAP_PRIVATE is specified.
      if (!(flags & 2) && contents && contents.buffer === GROWABLE_HEAP_I8().buffer) {
        // We can't emulate MAP_SHARED when the file is not backed by the
        // buffer we're mapping to (e.g. the HEAP buffer).
        allocated = false;
        ptr = contents.byteOffset;
      } else {
        allocated = true;
        ptr = mmapAlloc(length);
        if (!ptr) {
          throw new FS.ErrnoError(48);
        }
        if (contents) {
          // Try to avoid unnecessary slices.
          if (position > 0 || position + length < contents.length) {
            if (contents.subarray) {
              contents = contents.subarray(position, position + length);
            } else {
              contents = Array.prototype.slice.call(contents, position, position + length);
            }
          }
          GROWABLE_HEAP_I8().set(contents, ptr);
        }
      }
      return {
        ptr,
        allocated
      };
    },
    msync(stream, buffer, offset, length, mmapFlags) {
      MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);
      // should we check if bytesWritten and length are the same?
      return 0;
    }
  }
};

var asyncLoad = async url => {
  var arrayBuffer = await readAsync(url);
  assert(arrayBuffer, `Loading data file "${url}" failed (no arrayBuffer).`);
  return new Uint8Array(arrayBuffer);
};

var FS_createDataFile = (parent, name, fileData, canRead, canWrite, canOwn) => {
  FS.createDataFile(parent, name, fileData, canRead, canWrite, canOwn);
};

var preloadPlugins = Module["preloadPlugins"] || [];

var FS_handledByPreloadPlugin = (byteArray, fullname, finish, onerror) => {
  // Ensure plugins are ready.
  if (typeof Browser != "undefined") Browser.init();
  var handled = false;
  preloadPlugins.forEach(plugin => {
    if (handled) return;
    if (plugin["canHandle"](fullname)) {
      plugin["handle"](byteArray, fullname, finish, onerror);
      handled = true;
    }
  });
  return handled;
};

var FS_createPreloadedFile = (parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) => {
  // TODO we should allow people to just pass in a complete filename instead
  // of parent and name being that we just join them anyways
  var fullname = name ? PATH_FS.resolve(PATH.join2(parent, name)) : parent;
  var dep = getUniqueRunDependency(`cp ${fullname}`);
  // might have several active requests for the same fullname
  function processData(byteArray) {
    function finish(byteArray) {
      preFinish?.();
      if (!dontCreateFile) {
        FS_createDataFile(parent, name, byteArray, canRead, canWrite, canOwn);
      }
      onload?.();
      removeRunDependency(dep);
    }
    if (FS_handledByPreloadPlugin(byteArray, fullname, finish, () => {
      onerror?.();
      removeRunDependency(dep);
    })) {
      return;
    }
    finish(byteArray);
  }
  addRunDependency(dep);
  if (typeof url == "string") {
    asyncLoad(url).then(processData, onerror);
  } else {
    processData(url);
  }
};

var FS_modeStringToFlags = str => {
  var flagModes = {
    "r": 0,
    "r+": 2,
    "w": 512 | 64 | 1,
    "w+": 512 | 64 | 2,
    "a": 1024 | 64 | 1,
    "a+": 1024 | 64 | 2
  };
  var flags = flagModes[str];
  if (typeof flags == "undefined") {
    throw new Error(`Unknown file open mode: ${str}`);
  }
  return flags;
};

var FS_getMode = (canRead, canWrite) => {
  var mode = 0;
  if (canRead) mode |= 292 | 73;
  if (canWrite) mode |= 146;
  return mode;
};

var strError = errno => UTF8ToString(_strerror(errno));

var ERRNO_CODES = {
  "EPERM": 63,
  "ENOENT": 44,
  "ESRCH": 71,
  "EINTR": 27,
  "EIO": 29,
  "ENXIO": 60,
  "E2BIG": 1,
  "ENOEXEC": 45,
  "EBADF": 8,
  "ECHILD": 12,
  "EAGAIN": 6,
  "EWOULDBLOCK": 6,
  "ENOMEM": 48,
  "EACCES": 2,
  "EFAULT": 21,
  "ENOTBLK": 105,
  "EBUSY": 10,
  "EEXIST": 20,
  "EXDEV": 75,
  "ENODEV": 43,
  "ENOTDIR": 54,
  "EISDIR": 31,
  "EINVAL": 28,
  "ENFILE": 41,
  "EMFILE": 33,
  "ENOTTY": 59,
  "ETXTBSY": 74,
  "EFBIG": 22,
  "ENOSPC": 51,
  "ESPIPE": 70,
  "EROFS": 69,
  "EMLINK": 34,
  "EPIPE": 64,
  "EDOM": 18,
  "ERANGE": 68,
  "ENOMSG": 49,
  "EIDRM": 24,
  "ECHRNG": 106,
  "EL2NSYNC": 156,
  "EL3HLT": 107,
  "EL3RST": 108,
  "ELNRNG": 109,
  "EUNATCH": 110,
  "ENOCSI": 111,
  "EL2HLT": 112,
  "EDEADLK": 16,
  "ENOLCK": 46,
  "EBADE": 113,
  "EBADR": 114,
  "EXFULL": 115,
  "ENOANO": 104,
  "EBADRQC": 103,
  "EBADSLT": 102,
  "EDEADLOCK": 16,
  "EBFONT": 101,
  "ENOSTR": 100,
  "ENODATA": 116,
  "ETIME": 117,
  "ENOSR": 118,
  "ENONET": 119,
  "ENOPKG": 120,
  "EREMOTE": 121,
  "ENOLINK": 47,
  "EADV": 122,
  "ESRMNT": 123,
  "ECOMM": 124,
  "EPROTO": 65,
  "EMULTIHOP": 36,
  "EDOTDOT": 125,
  "EBADMSG": 9,
  "ENOTUNIQ": 126,
  "EBADFD": 127,
  "EREMCHG": 128,
  "ELIBACC": 129,
  "ELIBBAD": 130,
  "ELIBSCN": 131,
  "ELIBMAX": 132,
  "ELIBEXEC": 133,
  "ENOSYS": 52,
  "ENOTEMPTY": 55,
  "ENAMETOOLONG": 37,
  "ELOOP": 32,
  "EOPNOTSUPP": 138,
  "EPFNOSUPPORT": 139,
  "ECONNRESET": 15,
  "ENOBUFS": 42,
  "EAFNOSUPPORT": 5,
  "EPROTOTYPE": 67,
  "ENOTSOCK": 57,
  "ENOPROTOOPT": 50,
  "ESHUTDOWN": 140,
  "ECONNREFUSED": 14,
  "EADDRINUSE": 3,
  "ECONNABORTED": 13,
  "ENETUNREACH": 40,
  "ENETDOWN": 38,
  "ETIMEDOUT": 73,
  "EHOSTDOWN": 142,
  "EHOSTUNREACH": 23,
  "EINPROGRESS": 26,
  "EALREADY": 7,
  "EDESTADDRREQ": 17,
  "EMSGSIZE": 35,
  "EPROTONOSUPPORT": 66,
  "ESOCKTNOSUPPORT": 137,
  "EADDRNOTAVAIL": 4,
  "ENETRESET": 39,
  "EISCONN": 30,
  "ENOTCONN": 53,
  "ETOOMANYREFS": 141,
  "EUSERS": 136,
  "EDQUOT": 19,
  "ESTALE": 72,
  "ENOTSUP": 138,
  "ENOMEDIUM": 148,
  "EILSEQ": 25,
  "EOVERFLOW": 61,
  "ECANCELED": 11,
  "ENOTRECOVERABLE": 56,
  "EOWNERDEAD": 62,
  "ESTRPIPE": 135
};

var FS = {
  root: null,
  mounts: [],
  devices: {},
  streams: [],
  nextInode: 1,
  nameTable: null,
  currentPath: "/",
  initialized: false,
  ignorePermissions: true,
  ErrnoError: class extends Error {
    name="ErrnoError";
    // We set the `name` property to be able to identify `FS.ErrnoError`
    // - the `name` is a standard ECMA-262 property of error objects. Kind of good to have it anyway.
    // - when using PROXYFS, an error can come from an underlying FS
    // as different FS objects have their own FS.ErrnoError each,
    // the test `err instanceof FS.ErrnoError` won't detect an error coming from another filesystem, causing bugs.
    // we'll use the reliable test `err.name == "ErrnoError"` instead
    constructor(errno) {
      super(runtimeInitialized ? strError(errno) : "");
      this.errno = errno;
      for (var key in ERRNO_CODES) {
        if (ERRNO_CODES[key] === errno) {
          this.code = key;
          break;
        }
      }
    }
  },
  filesystems: null,
  syncFSRequests: 0,
  readFiles: {},
  FSStream: class {
    shared={};
    get object() {
      return this.node;
    }
    set object(val) {
      this.node = val;
    }
    get isRead() {
      return (this.flags & 2097155) !== 1;
    }
    get isWrite() {
      return (this.flags & 2097155) !== 0;
    }
    get isAppend() {
      return (this.flags & 1024);
    }
    get flags() {
      return this.shared.flags;
    }
    set flags(val) {
      this.shared.flags = val;
    }
    get position() {
      return this.shared.position;
    }
    set position(val) {
      this.shared.position = val;
    }
  },
  FSNode: class {
    node_ops={};
    stream_ops={};
    readMode=292 | 73;
    writeMode=146;
    mounted=null;
    constructor(parent, name, mode, rdev) {
      if (!parent) {
        parent = this;
      }
      // root node sets parent to itself
      this.parent = parent;
      this.mount = parent.mount;
      this.id = FS.nextInode++;
      this.name = name;
      this.mode = mode;
      this.rdev = rdev;
      this.atime = this.mtime = this.ctime = Date.now();
    }
    get read() {
      return (this.mode & this.readMode) === this.readMode;
    }
    set read(val) {
      val ? this.mode |= this.readMode : this.mode &= ~this.readMode;
    }
    get write() {
      return (this.mode & this.writeMode) === this.writeMode;
    }
    set write(val) {
      val ? this.mode |= this.writeMode : this.mode &= ~this.writeMode;
    }
    get isFolder() {
      return FS.isDir(this.mode);
    }
    get isDevice() {
      return FS.isChrdev(this.mode);
    }
  },
  lookupPath(path, opts = {}) {
    if (!path) return {
      path: "",
      node: null
    };
    opts.follow_mount ??= true;
    if (!PATH.isAbs(path)) {
      path = FS.cwd() + "/" + path;
    }
    // limit max consecutive symlinks to 40 (SYMLOOP_MAX).
    linkloop: for (var nlinks = 0; nlinks < 40; nlinks++) {
      // split the absolute path
      var parts = path.split("/").filter(p => !!p && (p !== "."));
      // start at the root
      var current = FS.root;
      var current_path = "/";
      for (var i = 0; i < parts.length; i++) {
        var islast = (i === parts.length - 1);
        if (islast && opts.parent) {
          // stop resolving
          break;
        }
        if (parts[i] === "..") {
          current_path = PATH.dirname(current_path);
          current = current.parent;
          continue;
        }
        current_path = PATH.join2(current_path, parts[i]);
        try {
          current = FS.lookupNode(current, parts[i]);
        } catch (e) {
          // if noent_okay is true, suppress a ENOENT in the last component
          // and return an object with an undefined node. This is needed for
          // resolving symlinks in the path when creating a file.
          if ((e?.errno === 44) && islast && opts.noent_okay) {
            return {
              path: current_path
            };
          }
          throw e;
        }
        // jump to the mount's root node if this is a mountpoint
        if (FS.isMountpoint(current) && (!islast || opts.follow_mount)) {
          current = current.mounted.root;
        }
        // by default, lookupPath will not follow a symlink if it is the final path component.
        // setting opts.follow = true will override this behavior.
        if (FS.isLink(current.mode) && (!islast || opts.follow)) {
          if (!current.node_ops.readlink) {
            throw new FS.ErrnoError(52);
          }
          var link = current.node_ops.readlink(current);
          if (!PATH.isAbs(link)) {
            link = PATH.dirname(current_path) + "/" + link;
          }
          path = link + "/" + parts.slice(i + 1).join("/");
          continue linkloop;
        }
      }
      return {
        path: current_path,
        node: current
      };
    }
    throw new FS.ErrnoError(32);
  },
  getPath(node) {
    var path;
    while (true) {
      if (FS.isRoot(node)) {
        var mount = node.mount.mountpoint;
        if (!path) return mount;
        return mount[mount.length - 1] !== "/" ? `${mount}/${path}` : mount + path;
      }
      path = path ? `${node.name}/${path}` : node.name;
      node = node.parent;
    }
  },
  hashName(parentid, name) {
    var hash = 0;
    for (var i = 0; i < name.length; i++) {
      hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
    }
    return ((parentid + hash) >>> 0) % FS.nameTable.length;
  },
  hashAddNode(node) {
    var hash = FS.hashName(node.parent.id, node.name);
    node.name_next = FS.nameTable[hash];
    FS.nameTable[hash] = node;
  },
  hashRemoveNode(node) {
    var hash = FS.hashName(node.parent.id, node.name);
    if (FS.nameTable[hash] === node) {
      FS.nameTable[hash] = node.name_next;
    } else {
      var current = FS.nameTable[hash];
      while (current) {
        if (current.name_next === node) {
          current.name_next = node.name_next;
          break;
        }
        current = current.name_next;
      }
    }
  },
  lookupNode(parent, name) {
    var errCode = FS.mayLookup(parent);
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    var hash = FS.hashName(parent.id, name);
    for (var node = FS.nameTable[hash]; node; node = node.name_next) {
      var nodeName = node.name;
      if (node.parent.id === parent.id && nodeName === name) {
        return node;
      }
    }
    // if we failed to find it in the cache, call into the VFS
    return FS.lookup(parent, name);
  },
  createNode(parent, name, mode, rdev) {
    assert(typeof parent == "object");
    var node = new FS.FSNode(parent, name, mode, rdev);
    FS.hashAddNode(node);
    return node;
  },
  destroyNode(node) {
    FS.hashRemoveNode(node);
  },
  isRoot(node) {
    return node === node.parent;
  },
  isMountpoint(node) {
    return !!node.mounted;
  },
  isFile(mode) {
    return (mode & 61440) === 32768;
  },
  isDir(mode) {
    return (mode & 61440) === 16384;
  },
  isLink(mode) {
    return (mode & 61440) === 40960;
  },
  isChrdev(mode) {
    return (mode & 61440) === 8192;
  },
  isBlkdev(mode) {
    return (mode & 61440) === 24576;
  },
  isFIFO(mode) {
    return (mode & 61440) === 4096;
  },
  isSocket(mode) {
    return (mode & 49152) === 49152;
  },
  flagsToPermissionString(flag) {
    var perms = [ "r", "w", "rw" ][flag & 3];
    if ((flag & 512)) {
      perms += "w";
    }
    return perms;
  },
  nodePermissions(node, perms) {
    if (FS.ignorePermissions) {
      return 0;
    }
    // return 0 if any user, group or owner bits are set.
    if (perms.includes("r") && !(node.mode & 292)) {
      return 2;
    } else if (perms.includes("w") && !(node.mode & 146)) {
      return 2;
    } else if (perms.includes("x") && !(node.mode & 73)) {
      return 2;
    }
    return 0;
  },
  mayLookup(dir) {
    if (!FS.isDir(dir.mode)) return 54;
    var errCode = FS.nodePermissions(dir, "x");
    if (errCode) return errCode;
    if (!dir.node_ops.lookup) return 2;
    return 0;
  },
  mayCreate(dir, name) {
    if (!FS.isDir(dir.mode)) {
      return 54;
    }
    try {
      var node = FS.lookupNode(dir, name);
      return 20;
    } catch (e) {}
    return FS.nodePermissions(dir, "wx");
  },
  mayDelete(dir, name, isdir) {
    var node;
    try {
      node = FS.lookupNode(dir, name);
    } catch (e) {
      return e.errno;
    }
    var errCode = FS.nodePermissions(dir, "wx");
    if (errCode) {
      return errCode;
    }
    if (isdir) {
      if (!FS.isDir(node.mode)) {
        return 54;
      }
      if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
        return 10;
      }
    } else {
      if (FS.isDir(node.mode)) {
        return 31;
      }
    }
    return 0;
  },
  mayOpen(node, flags) {
    if (!node) {
      return 44;
    }
    if (FS.isLink(node.mode)) {
      return 32;
    } else if (FS.isDir(node.mode)) {
      if (FS.flagsToPermissionString(flags) !== "r" || // opening for write
      (flags & 512)) {
        // TODO: check for O_SEARCH? (== search for dir only)
        return 31;
      }
    }
    return FS.nodePermissions(node, FS.flagsToPermissionString(flags));
  },
  MAX_OPEN_FDS: 4096,
  nextfd() {
    for (var fd = 0; fd <= FS.MAX_OPEN_FDS; fd++) {
      if (!FS.streams[fd]) {
        return fd;
      }
    }
    throw new FS.ErrnoError(33);
  },
  getStreamChecked(fd) {
    var stream = FS.getStream(fd);
    if (!stream) {
      throw new FS.ErrnoError(8);
    }
    return stream;
  },
  getStream: fd => FS.streams[fd],
  createStream(stream, fd = -1) {
    assert(fd >= -1);
    // clone it, so we can return an instance of FSStream
    stream = Object.assign(new FS.FSStream, stream);
    if (fd == -1) {
      fd = FS.nextfd();
    }
    stream.fd = fd;
    FS.streams[fd] = stream;
    return stream;
  },
  closeStream(fd) {
    FS.streams[fd] = null;
  },
  dupStream(origStream, fd = -1) {
    var stream = FS.createStream(origStream, fd);
    stream.stream_ops?.dup?.(stream);
    return stream;
  },
  chrdev_stream_ops: {
    open(stream) {
      var device = FS.getDevice(stream.node.rdev);
      // override node's stream ops with the device's
      stream.stream_ops = device.stream_ops;
      // forward the open call
      stream.stream_ops.open?.(stream);
    },
    llseek() {
      throw new FS.ErrnoError(70);
    }
  },
  major: dev => ((dev) >> 8),
  minor: dev => ((dev) & 255),
  makedev: (ma, mi) => ((ma) << 8 | (mi)),
  registerDevice(dev, ops) {
    FS.devices[dev] = {
      stream_ops: ops
    };
  },
  getDevice: dev => FS.devices[dev],
  getMounts(mount) {
    var mounts = [];
    var check = [ mount ];
    while (check.length) {
      var m = check.pop();
      mounts.push(m);
      check.push(...m.mounts);
    }
    return mounts;
  },
  syncfs(populate, callback) {
    if (typeof populate == "function") {
      callback = populate;
      populate = false;
    }
    FS.syncFSRequests++;
    if (FS.syncFSRequests > 1) {
      err(`warning: ${FS.syncFSRequests} FS.syncfs operations in flight at once, probably just doing extra work`);
    }
    var mounts = FS.getMounts(FS.root.mount);
    var completed = 0;
    function doCallback(errCode) {
      assert(FS.syncFSRequests > 0);
      FS.syncFSRequests--;
      return callback(errCode);
    }
    function done(errCode) {
      if (errCode) {
        if (!done.errored) {
          done.errored = true;
          return doCallback(errCode);
        }
        return;
      }
      if (++completed >= mounts.length) {
        doCallback(null);
      }
    }
    // sync all mounts
    mounts.forEach(mount => {
      if (!mount.type.syncfs) {
        return done(null);
      }
      mount.type.syncfs(mount, populate, done);
    });
  },
  mount(type, opts, mountpoint) {
    if (typeof type == "string") {
      // The filesystem was not included, and instead we have an error
      // message stored in the variable.
      throw type;
    }
    var root = mountpoint === "/";
    var pseudo = !mountpoint;
    var node;
    if (root && FS.root) {
      throw new FS.ErrnoError(10);
    } else if (!root && !pseudo) {
      var lookup = FS.lookupPath(mountpoint, {
        follow_mount: false
      });
      mountpoint = lookup.path;
      // use the absolute path
      node = lookup.node;
      if (FS.isMountpoint(node)) {
        throw new FS.ErrnoError(10);
      }
      if (!FS.isDir(node.mode)) {
        throw new FS.ErrnoError(54);
      }
    }
    var mount = {
      type,
      opts,
      mountpoint,
      mounts: []
    };
    // create a root node for the fs
    var mountRoot = type.mount(mount);
    mountRoot.mount = mount;
    mount.root = mountRoot;
    if (root) {
      FS.root = mountRoot;
    } else if (node) {
      // set as a mountpoint
      node.mounted = mount;
      // add the new mount to the current mount's children
      if (node.mount) {
        node.mount.mounts.push(mount);
      }
    }
    return mountRoot;
  },
  unmount(mountpoint) {
    var lookup = FS.lookupPath(mountpoint, {
      follow_mount: false
    });
    if (!FS.isMountpoint(lookup.node)) {
      throw new FS.ErrnoError(28);
    }
    // destroy the nodes for this mount, and all its child mounts
    var node = lookup.node;
    var mount = node.mounted;
    var mounts = FS.getMounts(mount);
    Object.keys(FS.nameTable).forEach(hash => {
      var current = FS.nameTable[hash];
      while (current) {
        var next = current.name_next;
        if (mounts.includes(current.mount)) {
          FS.destroyNode(current);
        }
        current = next;
      }
    });
    // no longer a mountpoint
    node.mounted = null;
    // remove this mount from the child mounts
    var idx = node.mount.mounts.indexOf(mount);
    assert(idx !== -1);
    node.mount.mounts.splice(idx, 1);
  },
  lookup(parent, name) {
    return parent.node_ops.lookup(parent, name);
  },
  mknod(path, mode, dev) {
    var lookup = FS.lookupPath(path, {
      parent: true
    });
    var parent = lookup.node;
    var name = PATH.basename(path);
    if (!name || name === "." || name === "..") {
      throw new FS.ErrnoError(28);
    }
    var errCode = FS.mayCreate(parent, name);
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    if (!parent.node_ops.mknod) {
      throw new FS.ErrnoError(63);
    }
    return parent.node_ops.mknod(parent, name, mode, dev);
  },
  statfs(path) {
    // NOTE: None of the defaults here are true. We're just returning safe and
    //       sane values.
    var rtn = {
      bsize: 4096,
      frsize: 4096,
      blocks: 1e6,
      bfree: 5e5,
      bavail: 5e5,
      files: FS.nextInode,
      ffree: FS.nextInode - 1,
      fsid: 42,
      flags: 2,
      namelen: 255
    };
    var parent = FS.lookupPath(path, {
      follow: true
    }).node;
    if (parent?.node_ops.statfs) {
      Object.assign(rtn, parent.node_ops.statfs(parent.mount.opts.root));
    }
    return rtn;
  },
  create(path, mode = 438) {
    mode &= 4095;
    mode |= 32768;
    return FS.mknod(path, mode, 0);
  },
  mkdir(path, mode = 511) {
    mode &= 511 | 512;
    mode |= 16384;
    return FS.mknod(path, mode, 0);
  },
  mkdirTree(path, mode) {
    var dirs = path.split("/");
    var d = "";
    for (var i = 0; i < dirs.length; ++i) {
      if (!dirs[i]) continue;
      d += "/" + dirs[i];
      try {
        FS.mkdir(d, mode);
      } catch (e) {
        if (e.errno != 20) throw e;
      }
    }
  },
  mkdev(path, mode, dev) {
    if (typeof dev == "undefined") {
      dev = mode;
      mode = 438;
    }
    mode |= 8192;
    return FS.mknod(path, mode, dev);
  },
  symlink(oldpath, newpath) {
    if (!PATH_FS.resolve(oldpath)) {
      throw new FS.ErrnoError(44);
    }
    var lookup = FS.lookupPath(newpath, {
      parent: true
    });
    var parent = lookup.node;
    if (!parent) {
      throw new FS.ErrnoError(44);
    }
    var newname = PATH.basename(newpath);
    var errCode = FS.mayCreate(parent, newname);
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    if (!parent.node_ops.symlink) {
      throw new FS.ErrnoError(63);
    }
    return parent.node_ops.symlink(parent, newname, oldpath);
  },
  rename(old_path, new_path) {
    var old_dirname = PATH.dirname(old_path);
    var new_dirname = PATH.dirname(new_path);
    var old_name = PATH.basename(old_path);
    var new_name = PATH.basename(new_path);
    // parents must exist
    var lookup, old_dir, new_dir;
    // let the errors from non existent directories percolate up
    lookup = FS.lookupPath(old_path, {
      parent: true
    });
    old_dir = lookup.node;
    lookup = FS.lookupPath(new_path, {
      parent: true
    });
    new_dir = lookup.node;
    if (!old_dir || !new_dir) throw new FS.ErrnoError(44);
    // need to be part of the same mount
    if (old_dir.mount !== new_dir.mount) {
      throw new FS.ErrnoError(75);
    }
    // source must exist
    var old_node = FS.lookupNode(old_dir, old_name);
    // old path should not be an ancestor of the new path
    var relative = PATH_FS.relative(old_path, new_dirname);
    if (relative.charAt(0) !== ".") {
      throw new FS.ErrnoError(28);
    }
    // new path should not be an ancestor of the old path
    relative = PATH_FS.relative(new_path, old_dirname);
    if (relative.charAt(0) !== ".") {
      throw new FS.ErrnoError(55);
    }
    // see if the new path already exists
    var new_node;
    try {
      new_node = FS.lookupNode(new_dir, new_name);
    } catch (e) {}
    // early out if nothing needs to change
    if (old_node === new_node) {
      return;
    }
    // we'll need to delete the old entry
    var isdir = FS.isDir(old_node.mode);
    var errCode = FS.mayDelete(old_dir, old_name, isdir);
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    // need delete permissions if we'll be overwriting.
    // need create permissions if new doesn't already exist.
    errCode = new_node ? FS.mayDelete(new_dir, new_name, isdir) : FS.mayCreate(new_dir, new_name);
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    if (!old_dir.node_ops.rename) {
      throw new FS.ErrnoError(63);
    }
    if (FS.isMountpoint(old_node) || (new_node && FS.isMountpoint(new_node))) {
      throw new FS.ErrnoError(10);
    }
    // if we are going to change the parent, check write permissions
    if (new_dir !== old_dir) {
      errCode = FS.nodePermissions(old_dir, "w");
      if (errCode) {
        throw new FS.ErrnoError(errCode);
      }
    }
    // remove the node from the lookup hash
    FS.hashRemoveNode(old_node);
    // do the underlying fs rename
    try {
      old_dir.node_ops.rename(old_node, new_dir, new_name);
      // update old node (we do this here to avoid each backend
      // needing to)
      old_node.parent = new_dir;
    } catch (e) {
      throw e;
    } finally {
      // add the node back to the hash (in case node_ops.rename
      // changed its name)
      FS.hashAddNode(old_node);
    }
  },
  rmdir(path) {
    var lookup = FS.lookupPath(path, {
      parent: true
    });
    var parent = lookup.node;
    var name = PATH.basename(path);
    var node = FS.lookupNode(parent, name);
    var errCode = FS.mayDelete(parent, name, true);
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    if (!parent.node_ops.rmdir) {
      throw new FS.ErrnoError(63);
    }
    if (FS.isMountpoint(node)) {
      throw new FS.ErrnoError(10);
    }
    parent.node_ops.rmdir(parent, name);
    FS.destroyNode(node);
  },
  readdir(path) {
    var lookup = FS.lookupPath(path, {
      follow: true
    });
    var node = lookup.node;
    if (!node.node_ops.readdir) {
      throw new FS.ErrnoError(54);
    }
    return node.node_ops.readdir(node);
  },
  unlink(path) {
    var lookup = FS.lookupPath(path, {
      parent: true
    });
    var parent = lookup.node;
    if (!parent) {
      throw new FS.ErrnoError(44);
    }
    var name = PATH.basename(path);
    var node = FS.lookupNode(parent, name);
    var errCode = FS.mayDelete(parent, name, false);
    if (errCode) {
      // According to POSIX, we should map EISDIR to EPERM, but
      // we instead do what Linux does (and we must, as we use
      // the musl linux libc).
      throw new FS.ErrnoError(errCode);
    }
    if (!parent.node_ops.unlink) {
      throw new FS.ErrnoError(63);
    }
    if (FS.isMountpoint(node)) {
      throw new FS.ErrnoError(10);
    }
    parent.node_ops.unlink(parent, name);
    FS.destroyNode(node);
  },
  readlink(path) {
    var lookup = FS.lookupPath(path);
    var link = lookup.node;
    if (!link) {
      throw new FS.ErrnoError(44);
    }
    if (!link.node_ops.readlink) {
      throw new FS.ErrnoError(28);
    }
    return link.node_ops.readlink(link);
  },
  stat(path, dontFollow) {
    var lookup = FS.lookupPath(path, {
      follow: !dontFollow
    });
    var node = lookup.node;
    if (!node) {
      throw new FS.ErrnoError(44);
    }
    if (!node.node_ops.getattr) {
      throw new FS.ErrnoError(63);
    }
    return node.node_ops.getattr(node);
  },
  lstat(path) {
    return FS.stat(path, true);
  },
  chmod(path, mode, dontFollow) {
    var node;
    if (typeof path == "string") {
      var lookup = FS.lookupPath(path, {
        follow: !dontFollow
      });
      node = lookup.node;
    } else {
      node = path;
    }
    if (!node.node_ops.setattr) {
      throw new FS.ErrnoError(63);
    }
    node.node_ops.setattr(node, {
      mode: (mode & 4095) | (node.mode & ~4095),
      ctime: Date.now()
    });
  },
  lchmod(path, mode) {
    FS.chmod(path, mode, true);
  },
  fchmod(fd, mode) {
    var stream = FS.getStreamChecked(fd);
    FS.chmod(stream.node, mode);
  },
  chown(path, uid, gid, dontFollow) {
    var node;
    if (typeof path == "string") {
      var lookup = FS.lookupPath(path, {
        follow: !dontFollow
      });
      node = lookup.node;
    } else {
      node = path;
    }
    if (!node.node_ops.setattr) {
      throw new FS.ErrnoError(63);
    }
    node.node_ops.setattr(node, {
      timestamp: Date.now()
    });
  },
  // we ignore the uid / gid for now
  lchown(path, uid, gid) {
    FS.chown(path, uid, gid, true);
  },
  fchown(fd, uid, gid) {
    var stream = FS.getStreamChecked(fd);
    FS.chown(stream.node, uid, gid);
  },
  truncate(path, len) {
    if (len < 0) {
      throw new FS.ErrnoError(28);
    }
    var node;
    if (typeof path == "string") {
      var lookup = FS.lookupPath(path, {
        follow: true
      });
      node = lookup.node;
    } else {
      node = path;
    }
    if (!node.node_ops.setattr) {
      throw new FS.ErrnoError(63);
    }
    if (FS.isDir(node.mode)) {
      throw new FS.ErrnoError(31);
    }
    if (!FS.isFile(node.mode)) {
      throw new FS.ErrnoError(28);
    }
    var errCode = FS.nodePermissions(node, "w");
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    node.node_ops.setattr(node, {
      size: len,
      timestamp: Date.now()
    });
  },
  ftruncate(fd, len) {
    var stream = FS.getStreamChecked(fd);
    if ((stream.flags & 2097155) === 0) {
      throw new FS.ErrnoError(28);
    }
    FS.truncate(stream.node, len);
  },
  utime(path, atime, mtime) {
    var lookup = FS.lookupPath(path, {
      follow: true
    });
    var node = lookup.node;
    node.node_ops.setattr(node, {
      atime,
      mtime
    });
  },
  open(path, flags, mode = 438) {
    if (path === "") {
      throw new FS.ErrnoError(44);
    }
    flags = typeof flags == "string" ? FS_modeStringToFlags(flags) : flags;
    if ((flags & 64)) {
      mode = (mode & 4095) | 32768;
    } else {
      mode = 0;
    }
    var node;
    if (typeof path == "object") {
      node = path;
    } else {
      // noent_okay makes it so that if the final component of the path
      // doesn't exist, lookupPath returns `node: undefined`. `path` will be
      // updated to point to the target of all symlinks.
      var lookup = FS.lookupPath(path, {
        follow: !(flags & 131072),
        noent_okay: true
      });
      node = lookup.node;
      path = lookup.path;
    }
    // perhaps we need to create the node
    var created = false;
    if ((flags & 64)) {
      if (node) {
        // if O_CREAT and O_EXCL are set, error out if the node already exists
        if ((flags & 128)) {
          throw new FS.ErrnoError(20);
        }
      } else {
        // node doesn't exist, try to create it
        node = FS.mknod(path, mode, 0);
        created = true;
      }
    }
    if (!node) {
      throw new FS.ErrnoError(44);
    }
    // can't truncate a device
    if (FS.isChrdev(node.mode)) {
      flags &= ~512;
    }
    // if asked only for a directory, then this must be one
    if ((flags & 65536) && !FS.isDir(node.mode)) {
      throw new FS.ErrnoError(54);
    }
    // check permissions, if this is not a file we just created now (it is ok to
    // create and write to a file with read-only permissions; it is read-only
    // for later use)
    if (!created) {
      var errCode = FS.mayOpen(node, flags);
      if (errCode) {
        throw new FS.ErrnoError(errCode);
      }
    }
    // do truncation if necessary
    if ((flags & 512) && !created) {
      FS.truncate(node, 0);
    }
    // we've already handled these, don't pass down to the underlying vfs
    flags &= ~(128 | 512 | 131072);
    // register the stream with the filesystem
    var stream = FS.createStream({
      node,
      path: FS.getPath(node),
      // we want the absolute path to the node
      flags,
      seekable: true,
      position: 0,
      stream_ops: node.stream_ops,
      // used by the file family libc calls (fopen, fwrite, ferror, etc.)
      ungotten: [],
      error: false
    });
    // call the new stream's open function
    if (stream.stream_ops.open) {
      stream.stream_ops.open(stream);
    }
    if (Module["logReadFiles"] && !(flags & 1)) {
      if (!(path in FS.readFiles)) {
        FS.readFiles[path] = 1;
      }
    }
    return stream;
  },
  close(stream) {
    if (FS.isClosed(stream)) {
      throw new FS.ErrnoError(8);
    }
    if (stream.getdents) stream.getdents = null;
    // free readdir state
    try {
      if (stream.stream_ops.close) {
        stream.stream_ops.close(stream);
      }
    } catch (e) {
      throw e;
    } finally {
      FS.closeStream(stream.fd);
    }
    stream.fd = null;
  },
  isClosed(stream) {
    return stream.fd === null;
  },
  llseek(stream, offset, whence) {
    if (FS.isClosed(stream)) {
      throw new FS.ErrnoError(8);
    }
    if (!stream.seekable || !stream.stream_ops.llseek) {
      throw new FS.ErrnoError(70);
    }
    if (whence != 0 && whence != 1 && whence != 2) {
      throw new FS.ErrnoError(28);
    }
    stream.position = stream.stream_ops.llseek(stream, offset, whence);
    stream.ungotten = [];
    return stream.position;
  },
  read(stream, buffer, offset, length, position) {
    assert(offset >= 0);
    if (length < 0 || position < 0) {
      throw new FS.ErrnoError(28);
    }
    if (FS.isClosed(stream)) {
      throw new FS.ErrnoError(8);
    }
    if ((stream.flags & 2097155) === 1) {
      throw new FS.ErrnoError(8);
    }
    if (FS.isDir(stream.node.mode)) {
      throw new FS.ErrnoError(31);
    }
    if (!stream.stream_ops.read) {
      throw new FS.ErrnoError(28);
    }
    var seeking = typeof position != "undefined";
    if (!seeking) {
      position = stream.position;
    } else if (!stream.seekable) {
      throw new FS.ErrnoError(70);
    }
    var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);
    if (!seeking) stream.position += bytesRead;
    return bytesRead;
  },
  write(stream, buffer, offset, length, position, canOwn) {
    assert(offset >= 0);
    if (length < 0 || position < 0) {
      throw new FS.ErrnoError(28);
    }
    if (FS.isClosed(stream)) {
      throw new FS.ErrnoError(8);
    }
    if ((stream.flags & 2097155) === 0) {
      throw new FS.ErrnoError(8);
    }
    if (FS.isDir(stream.node.mode)) {
      throw new FS.ErrnoError(31);
    }
    if (!stream.stream_ops.write) {
      throw new FS.ErrnoError(28);
    }
    if (stream.seekable && stream.flags & 1024) {
      // seek to the end before writing in append mode
      FS.llseek(stream, 0, 2);
    }
    var seeking = typeof position != "undefined";
    if (!seeking) {
      position = stream.position;
    } else if (!stream.seekable) {
      throw new FS.ErrnoError(70);
    }
    var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);
    if (!seeking) stream.position += bytesWritten;
    return bytesWritten;
  },
  allocate(stream, offset, length) {
    if (FS.isClosed(stream)) {
      throw new FS.ErrnoError(8);
    }
    if (offset < 0 || length <= 0) {
      throw new FS.ErrnoError(28);
    }
    if ((stream.flags & 2097155) === 0) {
      throw new FS.ErrnoError(8);
    }
    if (!FS.isFile(stream.node.mode) && !FS.isDir(stream.node.mode)) {
      throw new FS.ErrnoError(43);
    }
    if (!stream.stream_ops.allocate) {
      throw new FS.ErrnoError(138);
    }
    stream.stream_ops.allocate(stream, offset, length);
  },
  mmap(stream, length, position, prot, flags) {
    // User requests writing to file (prot & PROT_WRITE != 0).
    // Checking if we have permissions to write to the file unless
    // MAP_PRIVATE flag is set. According to POSIX spec it is possible
    // to write to file opened in read-only mode with MAP_PRIVATE flag,
    // as all modifications will be visible only in the memory of
    // the current process.
    if ((prot & 2) !== 0 && (flags & 2) === 0 && (stream.flags & 2097155) !== 2) {
      throw new FS.ErrnoError(2);
    }
    if ((stream.flags & 2097155) === 1) {
      throw new FS.ErrnoError(2);
    }
    if (!stream.stream_ops.mmap) {
      throw new FS.ErrnoError(43);
    }
    if (!length) {
      throw new FS.ErrnoError(28);
    }
    return stream.stream_ops.mmap(stream, length, position, prot, flags);
  },
  msync(stream, buffer, offset, length, mmapFlags) {
    assert(offset >= 0);
    if (!stream.stream_ops.msync) {
      return 0;
    }
    return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags);
  },
  ioctl(stream, cmd, arg) {
    if (!stream.stream_ops.ioctl) {
      throw new FS.ErrnoError(59);
    }
    return stream.stream_ops.ioctl(stream, cmd, arg);
  },
  readFile(path, opts = {}) {
    opts.flags = opts.flags || 0;
    opts.encoding = opts.encoding || "binary";
    if (opts.encoding !== "utf8" && opts.encoding !== "binary") {
      throw new Error(`Invalid encoding type "${opts.encoding}"`);
    }
    var ret;
    var stream = FS.open(path, opts.flags);
    var stat = FS.stat(path);
    var length = stat.size;
    var buf = new Uint8Array(length);
    FS.read(stream, buf, 0, length, 0);
    if (opts.encoding === "utf8") {
      ret = UTF8ArrayToString(buf);
    } else if (opts.encoding === "binary") {
      ret = buf;
    }
    FS.close(stream);
    return ret;
  },
  writeFile(path, data, opts = {}) {
    opts.flags = opts.flags || 577;
    var stream = FS.open(path, opts.flags, opts.mode);
    if (typeof data == "string") {
      var buf = new Uint8Array(lengthBytesUTF8(data) + 1);
      var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
      FS.write(stream, buf, 0, actualNumBytes, undefined, opts.canOwn);
    } else if (ArrayBuffer.isView(data)) {
      FS.write(stream, data, 0, data.byteLength, undefined, opts.canOwn);
    } else {
      throw new Error("Unsupported data type");
    }
    FS.close(stream);
  },
  cwd: () => FS.currentPath,
  chdir(path) {
    var lookup = FS.lookupPath(path, {
      follow: true
    });
    if (lookup.node === null) {
      throw new FS.ErrnoError(44);
    }
    if (!FS.isDir(lookup.node.mode)) {
      throw new FS.ErrnoError(54);
    }
    var errCode = FS.nodePermissions(lookup.node, "x");
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    FS.currentPath = lookup.path;
  },
  createDefaultDirectories() {
    FS.mkdir("/tmp");
    FS.mkdir("/home");
    FS.mkdir("/home/web_user");
  },
  createDefaultDevices() {
    // create /dev
    FS.mkdir("/dev");
    // setup /dev/null
    FS.registerDevice(FS.makedev(1, 3), {
      read: () => 0,
      write: (stream, buffer, offset, length, pos) => length,
      llseek: () => 0
    });
    FS.mkdev("/dev/null", FS.makedev(1, 3));
    // setup /dev/tty and /dev/tty1
    // stderr needs to print output using err() rather than out()
    // so we register a second tty just for it.
    TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
    TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
    FS.mkdev("/dev/tty", FS.makedev(5, 0));
    FS.mkdev("/dev/tty1", FS.makedev(6, 0));
    // setup /dev/[u]random
    // use a buffer to avoid overhead of individual crypto calls per byte
    var randomBuffer = new Uint8Array(1024), randomLeft = 0;
    var randomByte = () => {
      if (randomLeft === 0) {
        randomLeft = randomFill(randomBuffer).byteLength;
      }
      return randomBuffer[--randomLeft];
    };
    FS.createDevice("/dev", "random", randomByte);
    FS.createDevice("/dev", "urandom", randomByte);
    // we're not going to emulate the actual shm device,
    // just create the tmp dirs that reside in it commonly
    FS.mkdir("/dev/shm");
    FS.mkdir("/dev/shm/tmp");
  },
  createSpecialDirectories() {
    // create /proc/self/fd which allows /proc/self/fd/6 => readlink gives the
    // name of the stream for fd 6 (see test_unistd_ttyname)
    FS.mkdir("/proc");
    var proc_self = FS.mkdir("/proc/self");
    FS.mkdir("/proc/self/fd");
    FS.mount({
      mount() {
        var node = FS.createNode(proc_self, "fd", 16895, 73);
        node.stream_ops = {
          llseek: MEMFS.stream_ops.llseek
        };
        node.node_ops = {
          lookup(parent, name) {
            var fd = +name;
            var stream = FS.getStreamChecked(fd);
            var ret = {
              parent: null,
              mount: {
                mountpoint: "fake"
              },
              node_ops: {
                readlink: () => stream.path
              },
              id: fd + 1
            };
            ret.parent = ret;
            // make it look like a simple root node
            return ret;
          },
          readdir() {
            return Array.from(FS.streams.entries()).filter(([k, v]) => v).map(([k, v]) => k.toString());
          }
        };
        return node;
      }
    }, {}, "/proc/self/fd");
  },
  createStandardStreams(input, output, error) {
    // TODO deprecate the old functionality of a single
    // input / output callback and that utilizes FS.createDevice
    // and instead require a unique set of stream ops
    // by default, we symlink the standard streams to the
    // default tty devices. however, if the standard streams
    // have been overwritten we create a unique device for
    // them instead.
    if (input) {
      FS.createDevice("/dev", "stdin", input);
    } else {
      FS.symlink("/dev/tty", "/dev/stdin");
    }
    if (output) {
      FS.createDevice("/dev", "stdout", null, output);
    } else {
      FS.symlink("/dev/tty", "/dev/stdout");
    }
    if (error) {
      FS.createDevice("/dev", "stderr", null, error);
    } else {
      FS.symlink("/dev/tty1", "/dev/stderr");
    }
    // open default streams for the stdin, stdout and stderr devices
    var stdin = FS.open("/dev/stdin", 0);
    var stdout = FS.open("/dev/stdout", 1);
    var stderr = FS.open("/dev/stderr", 1);
    assert(stdin.fd === 0, `invalid handle for stdin (${stdin.fd})`);
    assert(stdout.fd === 1, `invalid handle for stdout (${stdout.fd})`);
    assert(stderr.fd === 2, `invalid handle for stderr (${stderr.fd})`);
  },
  staticInit() {
    FS.nameTable = new Array(4096);
    FS.mount(MEMFS, {}, "/");
    FS.createDefaultDirectories();
    FS.createDefaultDevices();
    FS.createSpecialDirectories();
    FS.filesystems = {
      "MEMFS": MEMFS
    };
  },
  init(input, output, error) {
    assert(!FS.initialized, "FS.init was previously called. If you want to initialize later with custom parameters, remove any earlier calls (note that one is automatically added to the generated code)");
    FS.initialized = true;
    // Allow Module.stdin etc. to provide defaults, if none explicitly passed to us here
    input ??= Module["stdin"];
    output ??= Module["stdout"];
    error ??= Module["stderr"];
    FS.createStandardStreams(input, output, error);
  },
  quit() {
    FS.initialized = false;
    // force-flush all streams, so we get musl std streams printed out
    _fflush(0);
    // close all of our streams
    for (var i = 0; i < FS.streams.length; i++) {
      var stream = FS.streams[i];
      if (!stream) {
        continue;
      }
      FS.close(stream);
    }
  },
  findObject(path, dontResolveLastLink) {
    var ret = FS.analyzePath(path, dontResolveLastLink);
    if (!ret.exists) {
      return null;
    }
    return ret.object;
  },
  analyzePath(path, dontResolveLastLink) {
    // operate from within the context of the symlink's target
    try {
      var lookup = FS.lookupPath(path, {
        follow: !dontResolveLastLink
      });
      path = lookup.path;
    } catch (e) {}
    var ret = {
      isRoot: false,
      exists: false,
      error: 0,
      name: null,
      path: null,
      object: null,
      parentExists: false,
      parentPath: null,
      parentObject: null
    };
    try {
      var lookup = FS.lookupPath(path, {
        parent: true
      });
      ret.parentExists = true;
      ret.parentPath = lookup.path;
      ret.parentObject = lookup.node;
      ret.name = PATH.basename(path);
      lookup = FS.lookupPath(path, {
        follow: !dontResolveLastLink
      });
      ret.exists = true;
      ret.path = lookup.path;
      ret.object = lookup.node;
      ret.name = lookup.node.name;
      ret.isRoot = lookup.path === "/";
    } catch (e) {
      ret.error = e.errno;
    }
    return ret;
  },
  createPath(parent, path, canRead, canWrite) {
    parent = typeof parent == "string" ? parent : FS.getPath(parent);
    var parts = path.split("/").reverse();
    while (parts.length) {
      var part = parts.pop();
      if (!part) continue;
      var current = PATH.join2(parent, part);
      try {
        FS.mkdir(current);
      } catch (e) {}
      // ignore EEXIST
      parent = current;
    }
    return current;
  },
  createFile(parent, name, properties, canRead, canWrite) {
    var path = PATH.join2(typeof parent == "string" ? parent : FS.getPath(parent), name);
    var mode = FS_getMode(canRead, canWrite);
    return FS.create(path, mode);
  },
  createDataFile(parent, name, data, canRead, canWrite, canOwn) {
    var path = name;
    if (parent) {
      parent = typeof parent == "string" ? parent : FS.getPath(parent);
      path = name ? PATH.join2(parent, name) : parent;
    }
    var mode = FS_getMode(canRead, canWrite);
    var node = FS.create(path, mode);
    if (data) {
      if (typeof data == "string") {
        var arr = new Array(data.length);
        for (var i = 0, len = data.length; i < len; ++i) arr[i] = data.charCodeAt(i);
        data = arr;
      }
      // make sure we can write to the file
      FS.chmod(node, mode | 146);
      var stream = FS.open(node, 577);
      FS.write(stream, data, 0, data.length, 0, canOwn);
      FS.close(stream);
      FS.chmod(node, mode);
    }
  },
  createDevice(parent, name, input, output) {
    var path = PATH.join2(typeof parent == "string" ? parent : FS.getPath(parent), name);
    var mode = FS_getMode(!!input, !!output);
    FS.createDevice.major ??= 64;
    var dev = FS.makedev(FS.createDevice.major++, 0);
    // Create a fake device that a set of stream ops to emulate
    // the old behavior.
    FS.registerDevice(dev, {
      open(stream) {
        stream.seekable = false;
      },
      close(stream) {
        // flush any pending line data
        if (output?.buffer?.length) {
          output(10);
        }
      },
      read(stream, buffer, offset, length, pos) {
        /* ignored */ var bytesRead = 0;
        for (var i = 0; i < length; i++) {
          var result;
          try {
            result = input();
          } catch (e) {
            throw new FS.ErrnoError(29);
          }
          if (result === undefined && bytesRead === 0) {
            throw new FS.ErrnoError(6);
          }
          if (result === null || result === undefined) break;
          bytesRead++;
          buffer[offset + i] = result;
        }
        if (bytesRead) {
          stream.node.atime = Date.now();
        }
        return bytesRead;
      },
      write(stream, buffer, offset, length, pos) {
        for (var i = 0; i < length; i++) {
          try {
            output(buffer[offset + i]);
          } catch (e) {
            throw new FS.ErrnoError(29);
          }
        }
        if (length) {
          stream.node.mtime = stream.node.ctime = Date.now();
        }
        return i;
      }
    });
    return FS.mkdev(path, mode, dev);
  },
  forceLoadFile(obj) {
    if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true;
    if (typeof XMLHttpRequest != "undefined") {
      throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
    } else {
      // Command-line.
      try {
        obj.contents = readBinary(obj.url);
        obj.usedBytes = obj.contents.length;
      } catch (e) {
        throw new FS.ErrnoError(29);
      }
    }
  },
  createLazyFile(parent, name, url, canRead, canWrite) {
    // Lazy chunked Uint8Array (implements get and length from Uint8Array).
    // Actual getting is abstracted away for eventual reuse.
    class LazyUint8Array {
      lengthKnown=false;
      chunks=[];
      // Loaded chunks. Index is the chunk number
      get(idx) {
        if (idx > this.length - 1 || idx < 0) {
          return undefined;
        }
        var chunkOffset = idx % this.chunkSize;
        var chunkNum = (idx / this.chunkSize) | 0;
        return this.getter(chunkNum)[chunkOffset];
      }
      setDataGetter(getter) {
        this.getter = getter;
      }
      cacheLength() {
        // Find length
        var xhr = new XMLHttpRequest;
        xhr.open("HEAD", url, false);
        xhr.send(null);
        if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
        var datalength = Number(xhr.getResponseHeader("Content-length"));
        var header;
        var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
        var usesGzip = (header = xhr.getResponseHeader("Content-Encoding")) && header === "gzip";
        var chunkSize = 1024 * 1024;
        // Chunk size in bytes
        if (!hasByteServing) chunkSize = datalength;
        // Function to get a range from the remote URL.
        var doXHR = (from, to) => {
          if (from > to) throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!");
          if (to > datalength - 1) throw new Error("only " + datalength + " bytes available! programmer error!");
          // TODO: Use mozResponseArrayBuffer, responseStream, etc. if available.
          var xhr = new XMLHttpRequest;
          xhr.open("GET", url, false);
          if (datalength !== chunkSize) xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
          // Some hints to the browser that we want binary data.
          xhr.responseType = "arraybuffer";
          if (xhr.overrideMimeType) {
            xhr.overrideMimeType("text/plain; charset=x-user-defined");
          }
          xhr.send(null);
          if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
          if (xhr.response !== undefined) {
            return new Uint8Array(/** @type{Array<number>} */ (xhr.response || []));
          }
          return intArrayFromString(xhr.responseText || "", true);
        };
        var lazyArray = this;
        lazyArray.setDataGetter(chunkNum => {
          var start = chunkNum * chunkSize;
          var end = (chunkNum + 1) * chunkSize - 1;
          // including this byte
          end = Math.min(end, datalength - 1);
          // if datalength-1 is selected, this is the last block
          if (typeof lazyArray.chunks[chunkNum] == "undefined") {
            lazyArray.chunks[chunkNum] = doXHR(start, end);
          }
          if (typeof lazyArray.chunks[chunkNum] == "undefined") throw new Error("doXHR failed!");
          return lazyArray.chunks[chunkNum];
        });
        if (usesGzip || !datalength) {
          // if the server uses gzip or doesn't supply the length, we have to download the whole file to get the (uncompressed) length
          chunkSize = datalength = 1;
          // this will force getter(0)/doXHR do download the whole file
          datalength = this.getter(0).length;
          chunkSize = datalength;
          out("LazyFiles on gzip forces download of the whole file when length is accessed");
        }
        this._length = datalength;
        this._chunkSize = chunkSize;
        this.lengthKnown = true;
      }
      get length() {
        if (!this.lengthKnown) {
          this.cacheLength();
        }
        return this._length;
      }
      get chunkSize() {
        if (!this.lengthKnown) {
          this.cacheLength();
        }
        return this._chunkSize;
      }
    }
    if (typeof XMLHttpRequest != "undefined") {
      if (!ENVIRONMENT_IS_WORKER) throw "Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc";
      var lazyArray = new LazyUint8Array;
      var properties = {
        isDevice: false,
        contents: lazyArray
      };
    } else {
      var properties = {
        isDevice: false,
        url
      };
    }
    var node = FS.createFile(parent, name, properties, canRead, canWrite);
    // This is a total hack, but I want to get this lazy file code out of the
    // core of MEMFS. If we want to keep this lazy file concept I feel it should
    // be its own thin LAZYFS proxying calls to MEMFS.
    if (properties.contents) {
      node.contents = properties.contents;
    } else if (properties.url) {
      node.contents = null;
      node.url = properties.url;
    }
    // Add a function that defers querying the file size until it is asked the first time.
    Object.defineProperties(node, {
      usedBytes: {
        get: function() {
          return this.contents.length;
        }
      }
    });
    // override each stream op with one that tries to force load the lazy file first
    var stream_ops = {};
    var keys = Object.keys(node.stream_ops);
    keys.forEach(key => {
      var fn = node.stream_ops[key];
      stream_ops[key] = (...args) => {
        FS.forceLoadFile(node);
        return fn(...args);
      };
    });
    function writeChunks(stream, buffer, offset, length, position) {
      var contents = stream.node.contents;
      if (position >= contents.length) return 0;
      var size = Math.min(contents.length - position, length);
      assert(size >= 0);
      if (contents.slice) {
        // normal array
        for (var i = 0; i < size; i++) {
          buffer[offset + i] = contents[position + i];
        }
      } else {
        for (var i = 0; i < size; i++) {
          // LazyUint8Array from sync binary XHR
          buffer[offset + i] = contents.get(position + i);
        }
      }
      return size;
    }
    // use a custom read function
    stream_ops.read = (stream, buffer, offset, length, position) => {
      FS.forceLoadFile(node);
      return writeChunks(stream, buffer, offset, length, position);
    };
    // use a custom mmap function
    stream_ops.mmap = (stream, length, position, prot, flags) => {
      FS.forceLoadFile(node);
      var ptr = mmapAlloc(length);
      if (!ptr) {
        throw new FS.ErrnoError(48);
      }
      writeChunks(stream, GROWABLE_HEAP_I8(), ptr, length, position);
      return {
        ptr,
        allocated: true
      };
    };
    node.stream_ops = stream_ops;
    return node;
  },
  absolutePath() {
    abort("FS.absolutePath has been removed; use PATH_FS.resolve instead");
  },
  createFolder() {
    abort("FS.createFolder has been removed; use FS.mkdir instead");
  },
  createLink() {
    abort("FS.createLink has been removed; use FS.symlink instead");
  },
  joinPath() {
    abort("FS.joinPath has been removed; use PATH.join instead");
  },
  mmapAlloc() {
    abort("FS.mmapAlloc has been replaced by the top level function mmapAlloc");
  },
  standardizePath() {
    abort("FS.standardizePath has been removed; use PATH.normalize instead");
  }
};

var SYSCALLS = {
  DEFAULT_POLLMASK: 5,
  calculateAt(dirfd, path, allowEmpty) {
    if (PATH.isAbs(path)) {
      return path;
    }
    // relative path
    var dir;
    if (dirfd === -100) {
      dir = FS.cwd();
    } else {
      var dirstream = SYSCALLS.getStreamFromFD(dirfd);
      dir = dirstream.path;
    }
    if (path.length == 0) {
      if (!allowEmpty) {
        throw new FS.ErrnoError(44);
      }
      return dir;
    }
    return dir + "/" + path;
  },
  doStat(func, path, buf) {
    var stat = func(path);
    GROWABLE_HEAP_I32()[((buf) >> 2)] = stat.dev;
    checkInt32(stat.dev);
    GROWABLE_HEAP_I32()[(((buf) + (4)) >> 2)] = stat.mode;
    checkInt32(stat.mode);
    GROWABLE_HEAP_U32()[(((buf) + (8)) >> 2)] = stat.nlink;
    checkInt32(stat.nlink);
    GROWABLE_HEAP_I32()[(((buf) + (12)) >> 2)] = stat.uid;
    checkInt32(stat.uid);
    GROWABLE_HEAP_I32()[(((buf) + (16)) >> 2)] = stat.gid;
    checkInt32(stat.gid);
    GROWABLE_HEAP_I32()[(((buf) + (20)) >> 2)] = stat.rdev;
    checkInt32(stat.rdev);
    (tempI64 = [ stat.size >>> 0, (tempDouble = stat.size, (+(Math.abs(tempDouble))) >= 1 ? (tempDouble > 0 ? (+(Math.floor((tempDouble) / 4294967296))) >>> 0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble))) >>> 0)) / 4294967296))))) >>> 0) : 0) ], 
    GROWABLE_HEAP_I32()[(((buf) + (24)) >> 2)] = tempI64[0], GROWABLE_HEAP_I32()[(((buf) + (28)) >> 2)] = tempI64[1]);
    checkInt64(stat.size);
    GROWABLE_HEAP_I32()[(((buf) + (32)) >> 2)] = 4096;
    checkInt32(4096);
    GROWABLE_HEAP_I32()[(((buf) + (36)) >> 2)] = stat.blocks;
    checkInt32(stat.blocks);
    var atime = stat.atime.getTime();
    var mtime = stat.mtime.getTime();
    var ctime = stat.ctime.getTime();
    (tempI64 = [ Math.floor(atime / 1e3) >>> 0, (tempDouble = Math.floor(atime / 1e3), 
    (+(Math.abs(tempDouble))) >= 1 ? (tempDouble > 0 ? (+(Math.floor((tempDouble) / 4294967296))) >>> 0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble))) >>> 0)) / 4294967296))))) >>> 0) : 0) ], 
    GROWABLE_HEAP_I32()[(((buf) + (40)) >> 2)] = tempI64[0], GROWABLE_HEAP_I32()[(((buf) + (44)) >> 2)] = tempI64[1]);
    checkInt64(Math.floor(atime / 1e3));
    GROWABLE_HEAP_U32()[(((buf) + (48)) >> 2)] = (atime % 1e3) * 1e3 * 1e3;
    checkInt32((atime % 1e3) * 1e3 * 1e3);
    (tempI64 = [ Math.floor(mtime / 1e3) >>> 0, (tempDouble = Math.floor(mtime / 1e3), 
    (+(Math.abs(tempDouble))) >= 1 ? (tempDouble > 0 ? (+(Math.floor((tempDouble) / 4294967296))) >>> 0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble))) >>> 0)) / 4294967296))))) >>> 0) : 0) ], 
    GROWABLE_HEAP_I32()[(((buf) + (56)) >> 2)] = tempI64[0], GROWABLE_HEAP_I32()[(((buf) + (60)) >> 2)] = tempI64[1]);
    checkInt64(Math.floor(mtime / 1e3));
    GROWABLE_HEAP_U32()[(((buf) + (64)) >> 2)] = (mtime % 1e3) * 1e3 * 1e3;
    checkInt32((mtime % 1e3) * 1e3 * 1e3);
    (tempI64 = [ Math.floor(ctime / 1e3) >>> 0, (tempDouble = Math.floor(ctime / 1e3), 
    (+(Math.abs(tempDouble))) >= 1 ? (tempDouble > 0 ? (+(Math.floor((tempDouble) / 4294967296))) >>> 0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble))) >>> 0)) / 4294967296))))) >>> 0) : 0) ], 
    GROWABLE_HEAP_I32()[(((buf) + (72)) >> 2)] = tempI64[0], GROWABLE_HEAP_I32()[(((buf) + (76)) >> 2)] = tempI64[1]);
    checkInt64(Math.floor(ctime / 1e3));
    GROWABLE_HEAP_U32()[(((buf) + (80)) >> 2)] = (ctime % 1e3) * 1e3 * 1e3;
    checkInt32((ctime % 1e3) * 1e3 * 1e3);
    (tempI64 = [ stat.ino >>> 0, (tempDouble = stat.ino, (+(Math.abs(tempDouble))) >= 1 ? (tempDouble > 0 ? (+(Math.floor((tempDouble) / 4294967296))) >>> 0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble))) >>> 0)) / 4294967296))))) >>> 0) : 0) ], 
    GROWABLE_HEAP_I32()[(((buf) + (88)) >> 2)] = tempI64[0], GROWABLE_HEAP_I32()[(((buf) + (92)) >> 2)] = tempI64[1]);
    checkInt64(stat.ino);
    return 0;
  },
  doMsync(addr, stream, len, flags, offset) {
    if (!FS.isFile(stream.node.mode)) {
      throw new FS.ErrnoError(43);
    }
    if (flags & 2) {
      // MAP_PRIVATE calls need not to be synced back to underlying fs
      return 0;
    }
    var buffer = GROWABLE_HEAP_U8().slice(addr, addr + len);
    FS.msync(stream, buffer, offset, len, flags);
  },
  getStreamFromFD(fd) {
    var stream = FS.getStreamChecked(fd);
    return stream;
  },
  varargs: undefined,
  getStr(ptr) {
    var ret = UTF8ToString(ptr);
    return ret;
  }
};

var ___syscall__newselect = function(nfds, readfds, writefds, exceptfds, timeout) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(3, 0, 1, nfds, readfds, writefds, exceptfds, timeout);
  try {
    // readfds are supported,
    // writefds checks socket open status
    // exceptfds are supported, although on web, such exceptional conditions never arise in web sockets
    //                          and so the exceptfds list will always return empty.
    // timeout is supported, although on SOCKFS and PIPEFS these are ignored and always treated as 0 - fully async
    assert(nfds <= 64, "nfds must be less than or equal to 64");
    // fd sets have 64 bits // TODO: this could be 1024 based on current musl headers
    var total = 0;
    var srcReadLow = (readfds ? GROWABLE_HEAP_I32()[((readfds) >> 2)] : 0), srcReadHigh = (readfds ? GROWABLE_HEAP_I32()[(((readfds) + (4)) >> 2)] : 0);
    var srcWriteLow = (writefds ? GROWABLE_HEAP_I32()[((writefds) >> 2)] : 0), srcWriteHigh = (writefds ? GROWABLE_HEAP_I32()[(((writefds) + (4)) >> 2)] : 0);
    var srcExceptLow = (exceptfds ? GROWABLE_HEAP_I32()[((exceptfds) >> 2)] : 0), srcExceptHigh = (exceptfds ? GROWABLE_HEAP_I32()[(((exceptfds) + (4)) >> 2)] : 0);
    var dstReadLow = 0, dstReadHigh = 0;
    var dstWriteLow = 0, dstWriteHigh = 0;
    var dstExceptLow = 0, dstExceptHigh = 0;
    var allLow = (readfds ? GROWABLE_HEAP_I32()[((readfds) >> 2)] : 0) | (writefds ? GROWABLE_HEAP_I32()[((writefds) >> 2)] : 0) | (exceptfds ? GROWABLE_HEAP_I32()[((exceptfds) >> 2)] : 0);
    var allHigh = (readfds ? GROWABLE_HEAP_I32()[(((readfds) + (4)) >> 2)] : 0) | (writefds ? GROWABLE_HEAP_I32()[(((writefds) + (4)) >> 2)] : 0) | (exceptfds ? GROWABLE_HEAP_I32()[(((exceptfds) + (4)) >> 2)] : 0);
    var check = (fd, low, high, val) => fd < 32 ? (low & val) : (high & val);
    for (var fd = 0; fd < nfds; fd++) {
      var mask = 1 << (fd % 32);
      if (!(check(fd, allLow, allHigh, mask))) {
        continue;
      }
      // index isn't in the set
      var stream = SYSCALLS.getStreamFromFD(fd);
      var flags = SYSCALLS.DEFAULT_POLLMASK;
      if (stream.stream_ops.poll) {
        var timeoutInMillis = -1;
        if (timeout) {
          // select(2) is declared to accept "struct timeval { time_t tv_sec; suseconds_t tv_usec; }".
          // However, musl passes the two values to the syscall as an array of long values.
          // Note that sizeof(time_t) != sizeof(long) in wasm32. The former is 8, while the latter is 4.
          // This means using "C_STRUCTS.timeval.tv_usec" leads to a wrong offset.
          // So, instead, we use POINTER_SIZE.
          var tv_sec = (readfds ? GROWABLE_HEAP_I32()[((timeout) >> 2)] : 0), tv_usec = (readfds ? GROWABLE_HEAP_I32()[(((timeout) + (4)) >> 2)] : 0);
          timeoutInMillis = (tv_sec + tv_usec / 1e6) * 1e3;
        }
        flags = stream.stream_ops.poll(stream, timeoutInMillis);
      }
      if ((flags & 1) && check(fd, srcReadLow, srcReadHigh, mask)) {
        fd < 32 ? (dstReadLow = dstReadLow | mask) : (dstReadHigh = dstReadHigh | mask);
        total++;
      }
      if ((flags & 4) && check(fd, srcWriteLow, srcWriteHigh, mask)) {
        fd < 32 ? (dstWriteLow = dstWriteLow | mask) : (dstWriteHigh = dstWriteHigh | mask);
        total++;
      }
      if ((flags & 2) && check(fd, srcExceptLow, srcExceptHigh, mask)) {
        fd < 32 ? (dstExceptLow = dstExceptLow | mask) : (dstExceptHigh = dstExceptHigh | mask);
        total++;
      }
    }
    if (readfds) {
      GROWABLE_HEAP_I32()[((readfds) >> 2)] = dstReadLow;
      checkInt32(dstReadLow);
      GROWABLE_HEAP_I32()[(((readfds) + (4)) >> 2)] = dstReadHigh;
      checkInt32(dstReadHigh);
    }
    if (writefds) {
      GROWABLE_HEAP_I32()[((writefds) >> 2)] = dstWriteLow;
      checkInt32(dstWriteLow);
      GROWABLE_HEAP_I32()[(((writefds) + (4)) >> 2)] = dstWriteHigh;
      checkInt32(dstWriteHigh);
    }
    if (exceptfds) {
      GROWABLE_HEAP_I32()[((exceptfds) >> 2)] = dstExceptLow;
      checkInt32(dstExceptLow);
      GROWABLE_HEAP_I32()[(((exceptfds) + (4)) >> 2)] = dstExceptHigh;
      checkInt32(dstExceptHigh);
    }
    return total;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
};

function ___syscall_chdir(path) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(4, 0, 1, path);
  try {
    path = SYSCALLS.getStr(path);
    FS.chdir(path);
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

function ___syscall_faccessat(dirfd, path, amode, flags) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(5, 0, 1, dirfd, path, amode, flags);
  try {
    path = SYSCALLS.getStr(path);
    assert(flags === 0 || flags == 512);
    path = SYSCALLS.calculateAt(dirfd, path);
    if (amode & ~7) {
      // need a valid mode
      return -28;
    }
    var lookup = FS.lookupPath(path, {
      follow: true
    });
    var node = lookup.node;
    if (!node) {
      return -44;
    }
    var perms = "";
    if (amode & 4) perms += "r";
    if (amode & 2) perms += "w";
    if (amode & 1) perms += "x";
    if (perms && /* otherwise, they've just passed F_OK */ FS.nodePermissions(node, perms)) {
      return -2;
    }
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

/** @suppress {duplicate } */ var syscallGetVarargI = () => {
  assert(SYSCALLS.varargs != undefined);
  // the `+` prepended here is necessary to convince the JSCompiler that varargs is indeed a number.
  var ret = GROWABLE_HEAP_I32()[((+SYSCALLS.varargs) >> 2)];
  SYSCALLS.varargs += 4;
  return ret;
};

var syscallGetVarargP = syscallGetVarargI;

function ___syscall_fcntl64(fd, cmd, varargs) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(6, 0, 1, fd, cmd, varargs);
  SYSCALLS.varargs = varargs;
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    switch (cmd) {
     case 0:
      {
        var arg = syscallGetVarargI();
        if (arg < 0) {
          return -28;
        }
        while (FS.streams[arg]) {
          arg++;
        }
        var newStream;
        newStream = FS.dupStream(stream, arg);
        return newStream.fd;
      }

     case 1:
     case 2:
      return 0;

     // FD_CLOEXEC makes no sense for a single process.
      case 3:
      return stream.flags;

     case 4:
      {
        var arg = syscallGetVarargI();
        stream.flags |= arg;
        return 0;
      }

     case 12:
      {
        var arg = syscallGetVarargP();
        var offset = 0;
        // We're always unlocked.
        GROWABLE_HEAP_I16()[(((arg) + (offset)) >> 1)] = 2;
        checkInt16(2);
        return 0;
      }

     case 13:
     case 14:
      return 0;
    }
    // Pretend that the locking is successful.
    return -28;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

function ___syscall_fstat64(fd, buf) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(7, 0, 1, fd, buf);
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    return SYSCALLS.doStat(FS.stat, stream.path, buf);
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

var stringToUTF8 = (str, outPtr, maxBytesToWrite) => {
  assert(typeof maxBytesToWrite == "number", "stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!");
  return stringToUTF8Array(str, GROWABLE_HEAP_U8(), outPtr, maxBytesToWrite);
};

function ___syscall_getcwd(buf, size) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(8, 0, 1, buf, size);
  try {
    if (size === 0) return -28;
    var cwd = FS.cwd();
    var cwdLengthInBytes = lengthBytesUTF8(cwd) + 1;
    if (size < cwdLengthInBytes) return -68;
    stringToUTF8(cwd, buf, size);
    return cwdLengthInBytes;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

function ___syscall_getdents64(fd, dirp, count) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(9, 0, 1, fd, dirp, count);
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    stream.getdents ||= FS.readdir(stream.path);
    var struct_size = 280;
    var pos = 0;
    var off = FS.llseek(stream, 0, 1);
    var startIdx = Math.floor(off / struct_size);
    var endIdx = Math.min(stream.getdents.length, startIdx + Math.floor(count / struct_size));
    for (var idx = startIdx; idx < endIdx; idx++) {
      var id;
      var type;
      var name = stream.getdents[idx];
      if (name === ".") {
        id = stream.node.id;
        type = 4;
      } else // DT_DIR
      if (name === "..") {
        var lookup = FS.lookupPath(stream.path, {
          parent: true
        });
        id = lookup.node.id;
        type = 4;
      } else // DT_DIR
      {
        var child;
        try {
          child = FS.lookupNode(stream.node, name);
        } catch (e) {
          // If the entry is not a directory, file, or symlink, nodefs
          // lookupNode will raise EINVAL. Skip these and continue.
          if (e?.errno === 28) {
            continue;
          }
          throw e;
        }
        id = child.id;
        type = FS.isChrdev(child.mode) ? 2 : // DT_CHR, character device.
        FS.isDir(child.mode) ? 4 : // DT_DIR, directory.
        FS.isLink(child.mode) ? 10 : // DT_LNK, symbolic link.
        8;
      }
      // DT_REG, regular file.
      assert(id);
      (tempI64 = [ id >>> 0, (tempDouble = id, (+(Math.abs(tempDouble))) >= 1 ? (tempDouble > 0 ? (+(Math.floor((tempDouble) / 4294967296))) >>> 0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble))) >>> 0)) / 4294967296))))) >>> 0) : 0) ], 
      GROWABLE_HEAP_I32()[((dirp + pos) >> 2)] = tempI64[0], GROWABLE_HEAP_I32()[(((dirp + pos) + (4)) >> 2)] = tempI64[1]);
      checkInt64(id);
      (tempI64 = [ (idx + 1) * struct_size >>> 0, (tempDouble = (idx + 1) * struct_size, 
      (+(Math.abs(tempDouble))) >= 1 ? (tempDouble > 0 ? (+(Math.floor((tempDouble) / 4294967296))) >>> 0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble))) >>> 0)) / 4294967296))))) >>> 0) : 0) ], 
      GROWABLE_HEAP_I32()[(((dirp + pos) + (8)) >> 2)] = tempI64[0], GROWABLE_HEAP_I32()[(((dirp + pos) + (12)) >> 2)] = tempI64[1]);
      checkInt64((idx + 1) * struct_size);
      GROWABLE_HEAP_I16()[(((dirp + pos) + (16)) >> 1)] = 280;
      checkInt16(280);
      GROWABLE_HEAP_I8()[(dirp + pos) + (18)] = type;
      checkInt8(type);
      stringToUTF8(name, dirp + pos + 19, 256);
      pos += struct_size;
    }
    FS.llseek(stream, idx * struct_size, 0);
    return pos;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

function ___syscall_ioctl(fd, op, varargs) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(10, 0, 1, fd, op, varargs);
  SYSCALLS.varargs = varargs;
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    switch (op) {
     case 21509:
      {
        if (!stream.tty) return -59;
        return 0;
      }

     case 21505:
      {
        if (!stream.tty) return -59;
        if (stream.tty.ops.ioctl_tcgets) {
          var termios = stream.tty.ops.ioctl_tcgets(stream);
          var argp = syscallGetVarargP();
          GROWABLE_HEAP_I32()[((argp) >> 2)] = termios.c_iflag || 0;
          checkInt32(termios.c_iflag || 0);
          GROWABLE_HEAP_I32()[(((argp) + (4)) >> 2)] = termios.c_oflag || 0;
          checkInt32(termios.c_oflag || 0);
          GROWABLE_HEAP_I32()[(((argp) + (8)) >> 2)] = termios.c_cflag || 0;
          checkInt32(termios.c_cflag || 0);
          GROWABLE_HEAP_I32()[(((argp) + (12)) >> 2)] = termios.c_lflag || 0;
          checkInt32(termios.c_lflag || 0);
          for (var i = 0; i < 32; i++) {
            GROWABLE_HEAP_I8()[(argp + i) + (17)] = termios.c_cc[i] || 0;
            checkInt8(termios.c_cc[i] || 0);
          }
          return 0;
        }
        return 0;
      }

     case 21510:
     case 21511:
     case 21512:
      {
        if (!stream.tty) return -59;
        return 0;
      }

     // no-op, not actually adjusting terminal settings
      case 21506:
     case 21507:
     case 21508:
      {
        if (!stream.tty) return -59;
        if (stream.tty.ops.ioctl_tcsets) {
          var argp = syscallGetVarargP();
          var c_iflag = GROWABLE_HEAP_I32()[((argp) >> 2)];
          var c_oflag = GROWABLE_HEAP_I32()[(((argp) + (4)) >> 2)];
          var c_cflag = GROWABLE_HEAP_I32()[(((argp) + (8)) >> 2)];
          var c_lflag = GROWABLE_HEAP_I32()[(((argp) + (12)) >> 2)];
          var c_cc = [];
          for (var i = 0; i < 32; i++) {
            c_cc.push(GROWABLE_HEAP_I8()[(argp + i) + (17)]);
          }
          return stream.tty.ops.ioctl_tcsets(stream.tty, op, {
            c_iflag,
            c_oflag,
            c_cflag,
            c_lflag,
            c_cc
          });
        }
        return 0;
      }

     // no-op, not actually adjusting terminal settings
      case 21519:
      {
        if (!stream.tty) return -59;
        var argp = syscallGetVarargP();
        GROWABLE_HEAP_I32()[((argp) >> 2)] = 0;
        checkInt32(0);
        return 0;
      }

     case 21520:
      {
        if (!stream.tty) return -59;
        return -28;
      }

     // not supported
      case 21531:
      {
        var argp = syscallGetVarargP();
        return FS.ioctl(stream, op, argp);
      }

     case 21523:
      {
        // TODO: in theory we should write to the winsize struct that gets
        // passed in, but for now musl doesn't read anything on it
        if (!stream.tty) return -59;
        if (stream.tty.ops.ioctl_tiocgwinsz) {
          var winsize = stream.tty.ops.ioctl_tiocgwinsz(stream.tty);
          var argp = syscallGetVarargP();
          GROWABLE_HEAP_I16()[((argp) >> 1)] = winsize[0];
          checkInt16(winsize[0]);
          GROWABLE_HEAP_I16()[(((argp) + (2)) >> 1)] = winsize[1];
          checkInt16(winsize[1]);
        }
        return 0;
      }

     case 21524:
      {
        // TODO: technically, this ioctl call should change the window size.
        // but, since emscripten doesn't have any concept of a terminal window
        // yet, we'll just silently throw it away as we do TIOCGWINSZ
        if (!stream.tty) return -59;
        return 0;
      }

     case 21515:
      {
        if (!stream.tty) return -59;
        return 0;
      }

     default:
      return -28;
    }
  } // not supported
  catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

function ___syscall_lstat64(path, buf) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(11, 0, 1, path, buf);
  try {
    path = SYSCALLS.getStr(path);
    return SYSCALLS.doStat(FS.lstat, path, buf);
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

function ___syscall_mkdirat(dirfd, path, mode) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(12, 0, 1, dirfd, path, mode);
  try {
    path = SYSCALLS.getStr(path);
    path = SYSCALLS.calculateAt(dirfd, path);
    FS.mkdir(path, mode, 0);
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

function ___syscall_newfstatat(dirfd, path, buf, flags) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(13, 0, 1, dirfd, path, buf, flags);
  try {
    path = SYSCALLS.getStr(path);
    var nofollow = flags & 256;
    var allowEmpty = flags & 4096;
    flags = flags & (~6400);
    assert(!flags, `unknown flags in __syscall_newfstatat: ${flags}`);
    path = SYSCALLS.calculateAt(dirfd, path, allowEmpty);
    return SYSCALLS.doStat(nofollow ? FS.lstat : FS.stat, path, buf);
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

function ___syscall_openat(dirfd, path, flags, varargs) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(14, 0, 1, dirfd, path, flags, varargs);
  SYSCALLS.varargs = varargs;
  try {
    path = SYSCALLS.getStr(path);
    path = SYSCALLS.calculateAt(dirfd, path);
    var mode = varargs ? syscallGetVarargI() : 0;
    return FS.open(path, flags, mode).fd;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

function ___syscall_readlinkat(dirfd, path, buf, bufsize) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(15, 0, 1, dirfd, path, buf, bufsize);
  try {
    path = SYSCALLS.getStr(path);
    path = SYSCALLS.calculateAt(dirfd, path);
    if (bufsize <= 0) return -28;
    var ret = FS.readlink(path);
    var len = Math.min(bufsize, lengthBytesUTF8(ret));
    var endChar = GROWABLE_HEAP_I8()[buf + len];
    stringToUTF8(ret, buf, bufsize + 1);
    // readlink is one of the rare functions that write out a C string, but does never append a null to the output buffer(!)
    // stringToUTF8() always appends a null byte, so restore the character under the null byte after the write.
    GROWABLE_HEAP_I8()[buf + len] = endChar;
    return len;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

function ___syscall_renameat(olddirfd, oldpath, newdirfd, newpath) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(16, 0, 1, olddirfd, oldpath, newdirfd, newpath);
  try {
    oldpath = SYSCALLS.getStr(oldpath);
    newpath = SYSCALLS.getStr(newpath);
    oldpath = SYSCALLS.calculateAt(olddirfd, oldpath);
    newpath = SYSCALLS.calculateAt(newdirfd, newpath);
    FS.rename(oldpath, newpath);
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

function ___syscall_stat64(path, buf) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(17, 0, 1, path, buf);
  try {
    path = SYSCALLS.getStr(path);
    return SYSCALLS.doStat(FS.stat, path, buf);
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

function ___syscall_unlinkat(dirfd, path, flags) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(18, 0, 1, dirfd, path, flags);
  try {
    path = SYSCALLS.getStr(path);
    path = SYSCALLS.calculateAt(dirfd, path);
    if (flags === 0) {
      FS.unlink(path);
    } else if (flags === 512) {
      FS.rmdir(path);
    } else {
      abort("Invalid flags passed to unlinkat");
    }
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

var __abort_js = () => abort("native code called abort()");

var __emscripten_init_main_thread_js = tb => {
  // Pass the thread address to the native code where they stored in wasm
  // globals which act as a form of TLS. Global constructors trying
  // to access this value will read the wrong value, but that is UB anyway.
  __emscripten_thread_init(tb, /*is_main=*/ !ENVIRONMENT_IS_WORKER, /*is_runtime=*/ 1, /*can_block=*/ !ENVIRONMENT_IS_WEB, /*default_stacksize=*/ 65536, /*start_profiling=*/ false);
  PThread.threadInitTLS();
};

var maybeExit = () => {
  if (!keepRuntimeAlive()) {
    try {
      if (ENVIRONMENT_IS_PTHREAD) __emscripten_thread_exit(EXITSTATUS); else _exit(EXITSTATUS);
    } catch (e) {
      handleException(e);
    }
  }
};

var callUserCallback = func => {
  if (ABORT) {
    err("user callback triggered after runtime exited or application aborted.  Ignoring.");
    return;
  }
  try {
    func();
    maybeExit();
  } catch (e) {
    handleException(e);
  }
};

var __emscripten_thread_mailbox_await = pthread_ptr => {
  if (typeof Atomics.waitAsync === "function") {
    // Wait on the pthread's initial self-pointer field because it is easy and
    // safe to access from sending threads that need to notify the waiting
    // thread.
    // TODO: How to make this work with wasm64?
    var wait = Atomics.waitAsync(GROWABLE_HEAP_I32(), ((pthread_ptr) >> 2), pthread_ptr);
    assert(wait.async);
    wait.value.then(checkMailbox);
    var waitingAsync = pthread_ptr + 128;
    Atomics.store(GROWABLE_HEAP_I32(), ((waitingAsync) >> 2), 1);
  }
};

// If `Atomics.waitAsync` is not implemented, then we will always fall back
// to postMessage and there is no need to do anything here.
var checkMailbox = () => {
  // Only check the mailbox if we have a live pthread runtime. We implement
  // pthread_self to return 0 if there is no live runtime.
  var pthread_ptr = _pthread_self();
  if (pthread_ptr) {
    // If we are using Atomics.waitAsync as our notification mechanism, wait
    // for a notification before processing the mailbox to avoid missing any
    // work that could otherwise arrive after we've finished processing the
    // mailbox and before we're ready for the next notification.
    __emscripten_thread_mailbox_await(pthread_ptr);
    callUserCallback(__emscripten_check_mailbox);
  }
};

var __emscripten_notify_mailbox_postmessage = (targetThread, currThreadId) => {
  if (targetThread == currThreadId) {
    setTimeout(checkMailbox);
  } else if (ENVIRONMENT_IS_PTHREAD) {
    postMessage({
      targetThread,
      cmd: "checkMailbox"
    });
  } else {
    var worker = PThread.pthreads[targetThread];
    if (!worker) {
      err(`Cannot send message to thread with ID ${targetThread}, unknown thread ID!`);
      return;
    }
    worker.postMessage({
      cmd: "checkMailbox"
    });
  }
};

var proxiedJSCallArgs = [];

var __emscripten_receive_on_main_thread_js = (funcIndex, emAsmAddr, callingThread, numCallArgs, args) => {
  // Sometimes we need to backproxy events to the calling thread (e.g.
  // HTML5 DOM events handlers such as
  // emscripten_set_mousemove_callback()), so keep track in a globally
  // accessible variable about the thread that initiated the proxying.
  proxiedJSCallArgs.length = numCallArgs;
  var b = ((args) >> 3);
  for (var i = 0; i < numCallArgs; i++) {
    proxiedJSCallArgs[i] = GROWABLE_HEAP_F64()[b + i];
  }
  // Proxied JS library funcs use funcIndex and EM_ASM functions use emAsmAddr
  var func = emAsmAddr ? ASM_CONSTS[emAsmAddr] : proxiedFunctionTable[funcIndex];
  assert(!(funcIndex && emAsmAddr));
  assert(func.length == numCallArgs, "Call args mismatch in _emscripten_receive_on_main_thread_js");
  PThread.currentProxiedOperationCallerThread = callingThread;
  var rtn = func(...proxiedJSCallArgs);
  PThread.currentProxiedOperationCallerThread = 0;
  // Proxied functions can return any type except bigint.  All other types
  // cooerce to f64/double (the return type of this function in C) but not
  // bigint.
  assert(typeof rtn != "bigint");
  return rtn;
};

var __emscripten_thread_cleanup = thread => {
  // Called when a thread needs to be cleaned up so it can be reused.
  // A thread is considered reusable when it either returns from its
  // entry point, calls pthread_exit, or acts upon a cancellation.
  // Detached threads are responsible for calling this themselves,
  // otherwise pthread_join is responsible for calling this.
  if (!ENVIRONMENT_IS_PTHREAD) cleanupThread(thread); else postMessage({
    cmd: "cleanupThread",
    thread
  });
};

var __emscripten_thread_set_strongref = thread => {
  // Called when a thread needs to be strongly referenced.
  // Currently only used for:
  // - keeping the "main" thread alive in PROXY_TO_PTHREAD mode;
  // - crashed threads that needs to propagate the uncaught exception
  //   back to the main thread.
  if (ENVIRONMENT_IS_NODE) {
    PThread.pthreads[thread].ref();
  }
};

function __gmtime_js(time_low, time_high, tmPtr) {
  var time = convertI32PairToI53Checked(time_low, time_high);
  var date = new Date(time * 1e3);
  GROWABLE_HEAP_I32()[((tmPtr) >> 2)] = date.getUTCSeconds();
  checkInt32(date.getUTCSeconds());
  GROWABLE_HEAP_I32()[(((tmPtr) + (4)) >> 2)] = date.getUTCMinutes();
  checkInt32(date.getUTCMinutes());
  GROWABLE_HEAP_I32()[(((tmPtr) + (8)) >> 2)] = date.getUTCHours();
  checkInt32(date.getUTCHours());
  GROWABLE_HEAP_I32()[(((tmPtr) + (12)) >> 2)] = date.getUTCDate();
  checkInt32(date.getUTCDate());
  GROWABLE_HEAP_I32()[(((tmPtr) + (16)) >> 2)] = date.getUTCMonth();
  checkInt32(date.getUTCMonth());
  GROWABLE_HEAP_I32()[(((tmPtr) + (20)) >> 2)] = date.getUTCFullYear() - 1900;
  checkInt32(date.getUTCFullYear() - 1900);
  GROWABLE_HEAP_I32()[(((tmPtr) + (24)) >> 2)] = date.getUTCDay();
  checkInt32(date.getUTCDay());
  var start = Date.UTC(date.getUTCFullYear(), 0, 1, 0, 0, 0, 0);
  var yday = ((date.getTime() - start) / (1e3 * 60 * 60 * 24)) | 0;
  GROWABLE_HEAP_I32()[(((tmPtr) + (28)) >> 2)] = yday;
  checkInt32(yday);
}

var isLeapYear = year => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

var MONTH_DAYS_LEAP_CUMULATIVE = [ 0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335 ];

var MONTH_DAYS_REGULAR_CUMULATIVE = [ 0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334 ];

var ydayFromDate = date => {
  var leap = isLeapYear(date.getFullYear());
  var monthDaysCumulative = (leap ? MONTH_DAYS_LEAP_CUMULATIVE : MONTH_DAYS_REGULAR_CUMULATIVE);
  var yday = monthDaysCumulative[date.getMonth()] + date.getDate() - 1;
  // -1 since it's days since Jan 1
  return yday;
};

function __localtime_js(time_low, time_high, tmPtr) {
  var time = convertI32PairToI53Checked(time_low, time_high);
  var date = new Date(time * 1e3);
  GROWABLE_HEAP_I32()[((tmPtr) >> 2)] = date.getSeconds();
  checkInt32(date.getSeconds());
  GROWABLE_HEAP_I32()[(((tmPtr) + (4)) >> 2)] = date.getMinutes();
  checkInt32(date.getMinutes());
  GROWABLE_HEAP_I32()[(((tmPtr) + (8)) >> 2)] = date.getHours();
  checkInt32(date.getHours());
  GROWABLE_HEAP_I32()[(((tmPtr) + (12)) >> 2)] = date.getDate();
  checkInt32(date.getDate());
  GROWABLE_HEAP_I32()[(((tmPtr) + (16)) >> 2)] = date.getMonth();
  checkInt32(date.getMonth());
  GROWABLE_HEAP_I32()[(((tmPtr) + (20)) >> 2)] = date.getFullYear() - 1900;
  checkInt32(date.getFullYear() - 1900);
  GROWABLE_HEAP_I32()[(((tmPtr) + (24)) >> 2)] = date.getDay();
  checkInt32(date.getDay());
  var yday = ydayFromDate(date) | 0;
  GROWABLE_HEAP_I32()[(((tmPtr) + (28)) >> 2)] = yday;
  checkInt32(yday);
  GROWABLE_HEAP_I32()[(((tmPtr) + (36)) >> 2)] = -(date.getTimezoneOffset() * 60);
  checkInt32(-(date.getTimezoneOffset() * 60));
  // Attention: DST is in December in South, and some regions don't have DST at all.
  var start = new Date(date.getFullYear(), 0, 1);
  var summerOffset = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
  var winterOffset = start.getTimezoneOffset();
  var dst = (summerOffset != winterOffset && date.getTimezoneOffset() == Math.min(winterOffset, summerOffset)) | 0;
  GROWABLE_HEAP_I32()[(((tmPtr) + (32)) >> 2)] = dst;
  checkInt32(dst);
}

var __tzset_js = (timezone, daylight, std_name, dst_name) => {
  // TODO: Use (malleable) environment variables instead of system settings.
  var currentYear = (new Date).getFullYear();
  var winter = new Date(currentYear, 0, 1);
  var summer = new Date(currentYear, 6, 1);
  var winterOffset = winter.getTimezoneOffset();
  var summerOffset = summer.getTimezoneOffset();
  // Local standard timezone offset. Local standard time is not adjusted for
  // daylight savings.  This code uses the fact that getTimezoneOffset returns
  // a greater value during Standard Time versus Daylight Saving Time (DST).
  // Thus it determines the expected output during Standard Time, and it
  // compares whether the output of the given date the same (Standard) or less
  // (DST).
  var stdTimezoneOffset = Math.max(winterOffset, summerOffset);
  // timezone is specified as seconds west of UTC ("The external variable
  // `timezone` shall be set to the difference, in seconds, between
  // Coordinated Universal Time (UTC) and local standard time."), the same
  // as returned by stdTimezoneOffset.
  // See http://pubs.opengroup.org/onlinepubs/009695399/functions/tzset.html
  GROWABLE_HEAP_U32()[((timezone) >> 2)] = stdTimezoneOffset * 60;
  checkInt32(stdTimezoneOffset * 60);
  GROWABLE_HEAP_I32()[((daylight) >> 2)] = Number(winterOffset != summerOffset);
  checkInt32(Number(winterOffset != summerOffset));
  var extractZone = timezoneOffset => {
    // Why inverse sign?
    // Read here https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/getTimezoneOffset
    var sign = timezoneOffset >= 0 ? "-" : "+";
    var absOffset = Math.abs(timezoneOffset);
    var hours = String(Math.floor(absOffset / 60)).padStart(2, "0");
    var minutes = String(absOffset % 60).padStart(2, "0");
    return `UTC${sign}${hours}${minutes}`;
  };
  var winterName = extractZone(winterOffset);
  var summerName = extractZone(summerOffset);
  assert(winterName);
  assert(summerName);
  assert(lengthBytesUTF8(winterName) <= 16, `timezone name truncated to fit in TZNAME_MAX (${winterName})`);
  assert(lengthBytesUTF8(summerName) <= 16, `timezone name truncated to fit in TZNAME_MAX (${summerName})`);
  if (summerOffset < winterOffset) {
    // Northern hemisphere
    stringToUTF8(winterName, std_name, 17);
    stringToUTF8(summerName, dst_name, 17);
  } else {
    stringToUTF8(winterName, dst_name, 17);
    stringToUTF8(summerName, std_name, 17);
  }
};

var runtimeKeepalivePush = () => {
  runtimeKeepaliveCounter += 1;
};

var _emscripten_set_main_loop_timing = (mode, value) => {
  MainLoop.timingMode = mode;
  MainLoop.timingValue = value;
  if (!MainLoop.func) {
    err("emscripten_set_main_loop_timing: Cannot set timing mode for main loop since a main loop does not exist! Call emscripten_set_main_loop first to set one up.");
    return 1;
  }
  // Return non-zero on failure, can't set timing mode when there is no main loop.
  if (!MainLoop.running) {
    runtimeKeepalivePush();
    MainLoop.running = true;
  }
  if (mode == 0) {
    MainLoop.scheduler = function MainLoop_scheduler_setTimeout() {
      var timeUntilNextTick = Math.max(0, MainLoop.tickStartTime + value - _emscripten_get_now()) | 0;
      setTimeout(MainLoop.runner, timeUntilNextTick);
    };
    // doing this each time means that on exception, we stop
    MainLoop.method = "timeout";
  } else if (mode == 1) {
    MainLoop.scheduler = function MainLoop_scheduler_rAF() {
      MainLoop.requestAnimationFrame(MainLoop.runner);
    };
    MainLoop.method = "rAF";
  } else if (mode == 2) {
    if (typeof MainLoop.setImmediate == "undefined") {
      if (typeof setImmediate == "undefined") {
        // Emulate setImmediate. (note: not a complete polyfill, we don't emulate clearImmediate() to keep code size to minimum, since not needed)
        var setImmediates = [];
        var emscriptenMainLoopMessageId = "setimmediate";
        /** @param {Event} event */ var MainLoop_setImmediate_messageHandler = event => {
          // When called in current thread or Worker, the main loop ID is structured slightly different to accommodate for --proxy-to-worker runtime listening to Worker events,
          // so check for both cases.
          if (event.data === emscriptenMainLoopMessageId || event.data.target === emscriptenMainLoopMessageId) {
            event.stopPropagation();
            setImmediates.shift()();
          }
        };
        addEventListener("message", MainLoop_setImmediate_messageHandler, true);
        MainLoop.setImmediate = /** @type{function(function(): ?, ...?): number} */ (func => {
          setImmediates.push(func);
          if (ENVIRONMENT_IS_WORKER) {
            Module["setImmediates"] ??= [];
            Module["setImmediates"].push(func);
            postMessage({
              target: emscriptenMainLoopMessageId
            });
          } else // In --proxy-to-worker, route the message via proxyClient.js
          postMessage(emscriptenMainLoopMessageId, "*");
        });
      } else {
        MainLoop.setImmediate = setImmediate;
      }
    }
    MainLoop.scheduler = function MainLoop_scheduler_setImmediate() {
      MainLoop.setImmediate(MainLoop.runner);
    };
    MainLoop.method = "immediate";
  }
  return 0;
};

var _emscripten_get_now = () => performance.timeOrigin + performance.now();

var runtimeKeepalivePop = () => {
  assert(runtimeKeepaliveCounter > 0);
  runtimeKeepaliveCounter -= 1;
};

/**
     * @param {number=} arg
     * @param {boolean=} noSetTiming
     */ var setMainLoop = (iterFunc, fps, simulateInfiniteLoop, arg, noSetTiming) => {
  assert(!MainLoop.func, "emscripten_set_main_loop: there can only be one main loop function at once: call emscripten_cancel_main_loop to cancel the previous one before setting a new one with different parameters.");
  MainLoop.func = iterFunc;
  MainLoop.arg = arg;
  var thisMainLoopId = MainLoop.currentlyRunningMainloop;
  function checkIsRunning() {
    if (thisMainLoopId < MainLoop.currentlyRunningMainloop) {
      runtimeKeepalivePop();
      maybeExit();
      return false;
    }
    return true;
  }
  // We create the loop runner here but it is not actually running until
  // _emscripten_set_main_loop_timing is called (which might happen a
  // later time).  This member signifies that the current runner has not
  // yet been started so that we can call runtimeKeepalivePush when it
  // gets it timing set for the first time.
  MainLoop.running = false;
  MainLoop.runner = function MainLoop_runner() {
    if (ABORT) return;
    if (MainLoop.queue.length > 0) {
      var start = Date.now();
      var blocker = MainLoop.queue.shift();
      blocker.func(blocker.arg);
      if (MainLoop.remainingBlockers) {
        var remaining = MainLoop.remainingBlockers;
        var next = remaining % 1 == 0 ? remaining - 1 : Math.floor(remaining);
        if (blocker.counted) {
          MainLoop.remainingBlockers = next;
        } else {
          // not counted, but move the progress along a tiny bit
          next = next + .5;
          // do not steal all the next one's progress
          MainLoop.remainingBlockers = (8 * remaining + next) / 9;
        }
      }
      MainLoop.updateStatus();
      // catches pause/resume main loop from blocker execution
      if (!checkIsRunning()) return;
      setTimeout(MainLoop.runner, 0);
      return;
    }
    // catch pauses from non-main loop sources
    if (!checkIsRunning()) return;
    // Implement very basic swap interval control
    MainLoop.currentFrameNumber = MainLoop.currentFrameNumber + 1 | 0;
    if (MainLoop.timingMode == 1 && MainLoop.timingValue > 1 && MainLoop.currentFrameNumber % MainLoop.timingValue != 0) {
      // Not the scheduled time to render this frame - skip.
      MainLoop.scheduler();
      return;
    } else if (MainLoop.timingMode == 0) {
      MainLoop.tickStartTime = _emscripten_get_now();
    }
    if (MainLoop.method === "timeout" && Module["ctx"]) {
      warnOnce("Looks like you are rendering without using requestAnimationFrame for the main loop. You should use 0 for the frame rate in emscripten_set_main_loop in order to use requestAnimationFrame, as that can greatly improve your frame rates!");
      MainLoop.method = "";
    }
    // just warn once per call to set main loop
    MainLoop.runIter(iterFunc);
    // catch pauses from the main loop itself
    if (!checkIsRunning()) return;
    MainLoop.scheduler();
  };
  if (!noSetTiming) {
    if (fps && fps > 0) {
      _emscripten_set_main_loop_timing(0, 1e3 / fps);
    } else {
      // Do rAF by rendering each frame (no decimating)
      _emscripten_set_main_loop_timing(1, 1);
    }
    MainLoop.scheduler();
  }
  if (simulateInfiniteLoop) {
    throw "unwind";
  }
};

var MainLoop = {
  running: false,
  scheduler: null,
  method: "",
  currentlyRunningMainloop: 0,
  func: null,
  arg: 0,
  timingMode: 0,
  timingValue: 0,
  currentFrameNumber: 0,
  queue: [],
  preMainLoop: [],
  postMainLoop: [],
  pause() {
    MainLoop.scheduler = null;
    // Incrementing this signals the previous main loop that it's now become old, and it must return.
    MainLoop.currentlyRunningMainloop++;
  },
  resume() {
    MainLoop.currentlyRunningMainloop++;
    var timingMode = MainLoop.timingMode;
    var timingValue = MainLoop.timingValue;
    var func = MainLoop.func;
    MainLoop.func = null;
    // do not set timing and call scheduler, we will do it on the next lines
    setMainLoop(func, 0, false, MainLoop.arg, true);
    _emscripten_set_main_loop_timing(timingMode, timingValue);
    MainLoop.scheduler();
  },
  updateStatus() {
    if (Module["setStatus"]) {
      var message = Module["statusMessage"] || "Please wait...";
      var remaining = MainLoop.remainingBlockers ?? 0;
      var expected = MainLoop.expectedBlockers ?? 0;
      if (remaining) {
        if (remaining < expected) {
          Module["setStatus"](`{message} ({expected - remaining}/{expected})`);
        } else {
          Module["setStatus"](message);
        }
      } else {
        Module["setStatus"]("");
      }
    }
  },
  init() {
    Module["preMainLoop"] && MainLoop.preMainLoop.push(Module["preMainLoop"]);
    Module["postMainLoop"] && MainLoop.postMainLoop.push(Module["postMainLoop"]);
  },
  runIter(func) {
    if (ABORT) return;
    for (var pre of MainLoop.preMainLoop) {
      if (pre() === false) {
        return;
      }
    }
    // |return false| skips a frame
    callUserCallback(func);
    for (var post of MainLoop.postMainLoop) {
      post();
    }
    checkStackCookie();
  },
  nextRAF: 0,
  fakeRequestAnimationFrame(func) {
    // try to keep 60fps between calls to here
    var now = Date.now();
    if (MainLoop.nextRAF === 0) {
      MainLoop.nextRAF = now + 1e3 / 60;
    } else {
      while (now + 2 >= MainLoop.nextRAF) {
        // fudge a little, to avoid timer jitter causing us to do lots of delay:0
        MainLoop.nextRAF += 1e3 / 60;
      }
    }
    var delay = Math.max(MainLoop.nextRAF - now, 0);
    setTimeout(func, delay);
  },
  requestAnimationFrame(func) {
    if (typeof requestAnimationFrame == "function") {
      requestAnimationFrame(func);
      return;
    }
    var RAF = MainLoop.fakeRequestAnimationFrame;
    RAF(func);
  }
};

var AL = {
  QUEUE_INTERVAL: 25,
  QUEUE_LOOKAHEAD: .1,
  DEVICE_NAME: "Emscripten OpenAL",
  CAPTURE_DEVICE_NAME: "Emscripten OpenAL capture",
  ALC_EXTENSIONS: {
    ALC_SOFT_pause_device: true,
    ALC_SOFT_HRTF: true
  },
  AL_EXTENSIONS: {
    AL_EXT_float32: true,
    AL_SOFT_loop_points: true,
    AL_SOFT_source_length: true,
    AL_EXT_source_distance_model: true,
    AL_SOFT_source_spatialize: true
  },
  _alcErr: 0,
  alcErr: 0,
  deviceRefCounts: {},
  alcStringCache: {},
  paused: false,
  stringCache: {},
  contexts: {},
  currentCtx: null,
  buffers: {
    0: {
      id: 0,
      refCount: 0,
      audioBuf: null,
      frequency: 0,
      bytesPerSample: 2,
      channels: 1,
      length: 0
    }
  },
  paramArray: [],
  _nextId: 1,
  newId: () => AL.freeIds.length > 0 ? AL.freeIds.pop() : AL._nextId++,
  freeIds: [],
  scheduleContextAudio: ctx => {
    // If we are animating using the requestAnimationFrame method, then the main loop does not run when in the background.
    // To give a perfect glitch-free audio stop when switching from foreground to background, we need to avoid updating
    // audio altogether when in the background, so detect that case and kill audio buffer streaming if so.
    if (MainLoop.timingMode === 1 && document["visibilityState"] != "visible") {
      return;
    }
    for (var i in ctx.sources) {
      AL.scheduleSourceAudio(ctx.sources[i]);
    }
  },
  scheduleSourceAudio: (src, lookahead) => {
    // See comment on scheduleContextAudio above.
    if (MainLoop.timingMode === 1 && document["visibilityState"] != "visible") {
      return;
    }
    if (src.state !== 4114) {
      return;
    }
    var currentTime = AL.updateSourceTime(src);
    var startTime = src.bufStartTime;
    var startOffset = src.bufOffset;
    var bufCursor = src.bufsProcessed;
    // Advance past any audio that is already scheduled
    for (var i = 0; i < src.audioQueue.length; i++) {
      var audioSrc = src.audioQueue[i];
      startTime = audioSrc._startTime + audioSrc._duration;
      startOffset = 0;
      bufCursor += audioSrc._skipCount + 1;
    }
    if (!lookahead) {
      lookahead = AL.QUEUE_LOOKAHEAD;
    }
    var lookaheadTime = currentTime + lookahead;
    var skipCount = 0;
    while (startTime < lookaheadTime) {
      if (bufCursor >= src.bufQueue.length) {
        if (src.looping) {
          bufCursor %= src.bufQueue.length;
        } else {
          break;
        }
      }
      var buf = src.bufQueue[bufCursor % src.bufQueue.length];
      // If the buffer contains no data, skip it
      if (buf.length === 0) {
        skipCount++;
        // If we've gone through the whole queue and everything is 0 length, just give up
        if (skipCount === src.bufQueue.length) {
          break;
        }
      } else {
        var audioSrc = src.context.audioCtx.createBufferSource();
        audioSrc.buffer = buf.audioBuf;
        audioSrc.playbackRate.value = src.playbackRate;
        if (buf.audioBuf._loopStart || buf.audioBuf._loopEnd) {
          audioSrc.loopStart = buf.audioBuf._loopStart;
          audioSrc.loopEnd = buf.audioBuf._loopEnd;
        }
        var duration = 0;
        // If the source is a looping static buffer, use native looping for gapless playback
        if (src.type === 4136 && src.looping) {
          duration = Number.POSITIVE_INFINITY;
          audioSrc.loop = true;
          if (buf.audioBuf._loopStart) {
            audioSrc.loopStart = buf.audioBuf._loopStart;
          }
          if (buf.audioBuf._loopEnd) {
            audioSrc.loopEnd = buf.audioBuf._loopEnd;
          }
        } else {
          duration = (buf.audioBuf.duration - startOffset) / src.playbackRate;
        }
        audioSrc._startOffset = startOffset;
        audioSrc._duration = duration;
        audioSrc._skipCount = skipCount;
        skipCount = 0;
        audioSrc.connect(src.gain);
        if (typeof audioSrc.start != "undefined") {
          // Sample the current time as late as possible to mitigate drift
          startTime = Math.max(startTime, src.context.audioCtx.currentTime);
          audioSrc.start(startTime, startOffset);
        } else if (typeof audioSrc.noteOn != "undefined") {
          startTime = Math.max(startTime, src.context.audioCtx.currentTime);
          audioSrc.noteOn(startTime);
        }
        audioSrc._startTime = startTime;
        src.audioQueue.push(audioSrc);
        startTime += duration;
      }
      startOffset = 0;
      bufCursor++;
    }
  },
  updateSourceTime: src => {
    var currentTime = src.context.audioCtx.currentTime;
    if (src.state !== 4114) {
      return currentTime;
    }
    // if the start time is unset, determine it based on the current offset.
    // This will be the case when a source is resumed after being paused, and
    // allows us to pretend that the source actually started playing some time
    // in the past such that it would just now have reached the stored offset.
    if (!isFinite(src.bufStartTime)) {
      src.bufStartTime = currentTime - src.bufOffset / src.playbackRate;
      src.bufOffset = 0;
    }
    var nextStartTime = 0;
    while (src.audioQueue.length) {
      var audioSrc = src.audioQueue[0];
      src.bufsProcessed += audioSrc._skipCount;
      nextStartTime = audioSrc._startTime + audioSrc._duration;
      // n.b. audioSrc._duration already factors in playbackRate, so no divide by src.playbackRate on it.
      if (currentTime < nextStartTime) {
        break;
      }
      src.audioQueue.shift();
      src.bufStartTime = nextStartTime;
      src.bufOffset = 0;
      src.bufsProcessed++;
    }
    if (src.bufsProcessed >= src.bufQueue.length && !src.looping) {
      // The source has played its entire queue and is non-looping, so just mark it as stopped.
      AL.setSourceState(src, 4116);
    } else if (src.type === 4136 && src.looping) {
      // If the source is a looping static buffer, determine the buffer offset based on the loop points
      var buf = src.bufQueue[0];
      if (buf.length === 0) {
        src.bufOffset = 0;
      } else {
        var delta = (currentTime - src.bufStartTime) * src.playbackRate;
        var loopStart = buf.audioBuf._loopStart || 0;
        var loopEnd = buf.audioBuf._loopEnd || buf.audioBuf.duration;
        if (loopEnd <= loopStart) {
          loopEnd = buf.audioBuf.duration;
        }
        if (delta < loopEnd) {
          src.bufOffset = delta;
        } else {
          src.bufOffset = loopStart + (delta - loopStart) % (loopEnd - loopStart);
        }
      }
    } else if (src.audioQueue[0]) {
      // The source is still actively playing, so we just need to calculate where we are in the current buffer
      // so it can be remembered if the source gets paused.
      src.bufOffset = (currentTime - src.audioQueue[0]._startTime) * src.playbackRate;
    } else {
      // The source hasn't finished yet, but there is no scheduled audio left for it. This can be because
      // the source has just been started/resumed, or due to an underrun caused by a long blocking operation.
      // We need to determine what state we would be in by this point in time so that when we next schedule
      // audio playback, it will be just as if no underrun occurred.
      if (src.type !== 4136 && src.looping) {
        // if the source is a looping buffer queue, let's first calculate the queue duration, so we can
        // quickly fast forward past any full loops of the queue and only worry about the remainder.
        var srcDuration = AL.sourceDuration(src) / src.playbackRate;
        if (srcDuration > 0) {
          src.bufStartTime += Math.floor((currentTime - src.bufStartTime) / srcDuration) * srcDuration;
        }
      }
      // Since we've already skipped any full-queue loops if there were any, we just need to find
      // out where in the queue the remaining time puts us, which won't require stepping through the
      // entire queue more than once.
      for (var i = 0; i < src.bufQueue.length; i++) {
        if (src.bufsProcessed >= src.bufQueue.length) {
          if (src.looping) {
            src.bufsProcessed %= src.bufQueue.length;
          } else {
            AL.setSourceState(src, 4116);
            break;
          }
        }
        var buf = src.bufQueue[src.bufsProcessed];
        if (buf.length > 0) {
          nextStartTime = src.bufStartTime + buf.audioBuf.duration / src.playbackRate;
          if (currentTime < nextStartTime) {
            src.bufOffset = (currentTime - src.bufStartTime) * src.playbackRate;
            break;
          }
          src.bufStartTime = nextStartTime;
        }
        src.bufOffset = 0;
        src.bufsProcessed++;
      }
    }
    return currentTime;
  },
  cancelPendingSourceAudio: src => {
    AL.updateSourceTime(src);
    for (var i = 1; i < src.audioQueue.length; i++) {
      var audioSrc = src.audioQueue[i];
      audioSrc.stop();
    }
    if (src.audioQueue.length > 1) {
      src.audioQueue.length = 1;
    }
  },
  stopSourceAudio: src => {
    for (var i = 0; i < src.audioQueue.length; i++) {
      src.audioQueue[i].stop();
    }
    src.audioQueue.length = 0;
  },
  setSourceState: (src, state) => {
    if (state === 4114) {
      if (src.state === 4114 || src.state == 4116) {
        src.bufsProcessed = 0;
        src.bufOffset = 0;
      } else {}
      AL.stopSourceAudio(src);
      src.state = 4114;
      src.bufStartTime = Number.NEGATIVE_INFINITY;
      AL.scheduleSourceAudio(src);
    } else if (state === 4115) {
      if (src.state === 4114) {
        // Store off the current offset to restore with on resume.
        AL.updateSourceTime(src);
        AL.stopSourceAudio(src);
        src.state = 4115;
      }
    } else if (state === 4116) {
      if (src.state !== 4113) {
        src.state = 4116;
        src.bufsProcessed = src.bufQueue.length;
        src.bufStartTime = Number.NEGATIVE_INFINITY;
        src.bufOffset = 0;
        AL.stopSourceAudio(src);
      }
    } else if (state === 4113) {
      if (src.state !== 4113) {
        src.state = 4113;
        src.bufsProcessed = 0;
        src.bufStartTime = Number.NEGATIVE_INFINITY;
        src.bufOffset = 0;
        AL.stopSourceAudio(src);
      }
    }
  },
  initSourcePanner: src => {
    if (src.type === 4144) /* AL_UNDETERMINED */ {
      return;
    }
    // Find the first non-zero buffer in the queue to determine the proper format
    var templateBuf = AL.buffers[0];
    for (var i = 0; i < src.bufQueue.length; i++) {
      if (src.bufQueue[i].id !== 0) {
        templateBuf = src.bufQueue[i];
        break;
      }
    }
    // Create a panner if AL_SOURCE_SPATIALIZE_SOFT is set to true, or alternatively if it's set to auto and the source is mono
    if (src.spatialize === 1 || (src.spatialize === 2 && /* AL_AUTO_SOFT */ templateBuf.channels === 1)) {
      if (src.panner) {
        return;
      }
      src.panner = src.context.audioCtx.createPanner();
      AL.updateSourceGlobal(src);
      AL.updateSourceSpace(src);
      src.panner.connect(src.context.gain);
      src.gain.disconnect();
      src.gain.connect(src.panner);
    } else {
      if (!src.panner) {
        return;
      }
      src.panner.disconnect();
      src.gain.disconnect();
      src.gain.connect(src.context.gain);
      src.panner = null;
    }
  },
  updateContextGlobal: ctx => {
    for (var i in ctx.sources) {
      AL.updateSourceGlobal(ctx.sources[i]);
    }
  },
  updateSourceGlobal: src => {
    var panner = src.panner;
    if (!panner) {
      return;
    }
    panner.refDistance = src.refDistance;
    panner.maxDistance = src.maxDistance;
    panner.rolloffFactor = src.rolloffFactor;
    panner.panningModel = src.context.hrtf ? "HRTF" : "equalpower";
    // Use the source's distance model if AL_SOURCE_DISTANCE_MODEL is enabled
    var distanceModel = src.context.sourceDistanceModel ? src.distanceModel : src.context.distanceModel;
    switch (distanceModel) {
     case 0:
      panner.distanceModel = "inverse";
      panner.refDistance = 340282e33;
      /* FLT_MAX */ break;

     case 53249:
     /* AL_INVERSE_DISTANCE */ case 53250:
      /* AL_INVERSE_DISTANCE_CLAMPED */ panner.distanceModel = "inverse";
      break;

     case 53251:
     /* AL_LINEAR_DISTANCE */ case 53252:
      /* AL_LINEAR_DISTANCE_CLAMPED */ panner.distanceModel = "linear";
      break;

     case 53253:
     /* AL_EXPONENT_DISTANCE */ case 53254:
      /* AL_EXPONENT_DISTANCE_CLAMPED */ panner.distanceModel = "exponential";
      break;
    }
  },
  updateListenerSpace: ctx => {
    var listener = ctx.audioCtx.listener;
    if (listener.positionX) {
      listener.positionX.value = ctx.listener.position[0];
      listener.positionY.value = ctx.listener.position[1];
      listener.positionZ.value = ctx.listener.position[2];
    } else {
      listener.setPosition(ctx.listener.position[0], ctx.listener.position[1], ctx.listener.position[2]);
    }
    if (listener.forwardX) {
      listener.forwardX.value = ctx.listener.direction[0];
      listener.forwardY.value = ctx.listener.direction[1];
      listener.forwardZ.value = ctx.listener.direction[2];
      listener.upX.value = ctx.listener.up[0];
      listener.upY.value = ctx.listener.up[1];
      listener.upZ.value = ctx.listener.up[2];
    } else {
      listener.setOrientation(ctx.listener.direction[0], ctx.listener.direction[1], ctx.listener.direction[2], ctx.listener.up[0], ctx.listener.up[1], ctx.listener.up[2]);
    }
    // Update sources that are relative to the listener
    for (var i in ctx.sources) {
      AL.updateSourceSpace(ctx.sources[i]);
    }
  },
  updateSourceSpace: src => {
    if (!src.panner) {
      return;
    }
    var panner = src.panner;
    var posX = src.position[0];
    var posY = src.position[1];
    var posZ = src.position[2];
    var dirX = src.direction[0];
    var dirY = src.direction[1];
    var dirZ = src.direction[2];
    var listener = src.context.listener;
    var lPosX = listener.position[0];
    var lPosY = listener.position[1];
    var lPosZ = listener.position[2];
    // WebAudio does spatialization in world-space coordinates, meaning both the buffer sources and
    // the listener position are in the same absolute coordinate system relative to a fixed origin.
    // By default, OpenAL works this way as well, but it also provides a "listener relative" mode, where
    // a buffer source's coordinate are interpreted not in absolute world space, but as being relative
    // to the listener object itself, so as the listener moves the source appears to move with it
    // with no update required. Since web audio does not support this mode, we must transform the source
    // coordinates from listener-relative space to absolute world space.
    // We do this via affine transformation matrices applied to the source position and source direction.
    // A change-of-basis converts from listener-space displacements to world-space displacements,
    // which must be done for both the source position and direction. Lastly, the source position must be
    // added to the listener position to get the final source position, since the source position represents
    // a displacement from the listener.
    if (src.relative) {
      // Negate the listener direction since forward is -Z.
      var lBackX = -listener.direction[0];
      var lBackY = -listener.direction[1];
      var lBackZ = -listener.direction[2];
      var lUpX = listener.up[0];
      var lUpY = listener.up[1];
      var lUpZ = listener.up[2];
      var inverseMagnitude = (x, y, z) => {
        var length = Math.sqrt(x * x + y * y + z * z);
        if (length < Number.EPSILON) {
          return 0;
        }
        return 1 / length;
      };
      // Normalize the Back vector
      var invMag = inverseMagnitude(lBackX, lBackY, lBackZ);
      lBackX *= invMag;
      lBackY *= invMag;
      lBackZ *= invMag;
      // ...and the Up vector
      invMag = inverseMagnitude(lUpX, lUpY, lUpZ);
      lUpX *= invMag;
      lUpY *= invMag;
      lUpZ *= invMag;
      // Calculate the Right vector as the cross product of the Up and Back vectors
      var lRightX = (lUpY * lBackZ - lUpZ * lBackY);
      var lRightY = (lUpZ * lBackX - lUpX * lBackZ);
      var lRightZ = (lUpX * lBackY - lUpY * lBackX);
      // Back and Up might not be exactly perpendicular, so the cross product also needs normalization
      invMag = inverseMagnitude(lRightX, lRightY, lRightZ);
      lRightX *= invMag;
      lRightY *= invMag;
      lRightZ *= invMag;
      // Recompute Up from the now orthonormal Right and Back vectors so we have a fully orthonormal basis
      lUpX = (lBackY * lRightZ - lBackZ * lRightY);
      lUpY = (lBackZ * lRightX - lBackX * lRightZ);
      lUpZ = (lBackX * lRightY - lBackY * lRightX);
      var oldX = dirX;
      var oldY = dirY;
      var oldZ = dirZ;
      // Use our 3 vectors to apply a change-of-basis matrix to the source direction
      dirX = oldX * lRightX + oldY * lUpX + oldZ * lBackX;
      dirY = oldX * lRightY + oldY * lUpY + oldZ * lBackY;
      dirZ = oldX * lRightZ + oldY * lUpZ + oldZ * lBackZ;
      oldX = posX;
      oldY = posY;
      oldZ = posZ;
      // ...and to the source position
      posX = oldX * lRightX + oldY * lUpX + oldZ * lBackX;
      posY = oldX * lRightY + oldY * lUpY + oldZ * lBackY;
      posZ = oldX * lRightZ + oldY * lUpZ + oldZ * lBackZ;
      // The change-of-basis corrects the orientation, but the origin is still the listener.
      // Translate the source position by the listener position to finish.
      posX += lPosX;
      posY += lPosY;
      posZ += lPosZ;
    }
    if (panner.positionX) {
      // Assigning to panner.positionX/Y/Z unnecessarily seems to cause performance issues
      // See https://github.com/emscripten-core/emscripten/issues/15847
      if (posX != panner.positionX.value) panner.positionX.value = posX;
      if (posY != panner.positionY.value) panner.positionY.value = posY;
      if (posZ != panner.positionZ.value) panner.positionZ.value = posZ;
    } else {
      panner.setPosition(posX, posY, posZ);
    }
    if (panner.orientationX) {
      // Assigning to panner.orientation/Y/Z unnecessarily seems to cause performance issues
      // See https://github.com/emscripten-core/emscripten/issues/15847
      if (dirX != panner.orientationX.value) panner.orientationX.value = dirX;
      if (dirY != panner.orientationY.value) panner.orientationY.value = dirY;
      if (dirZ != panner.orientationZ.value) panner.orientationZ.value = dirZ;
    } else {
      panner.setOrientation(dirX, dirY, dirZ);
    }
    var oldShift = src.dopplerShift;
    var velX = src.velocity[0];
    var velY = src.velocity[1];
    var velZ = src.velocity[2];
    var lVelX = listener.velocity[0];
    var lVelY = listener.velocity[1];
    var lVelZ = listener.velocity[2];
    if (posX === lPosX && posY === lPosY && posZ === lPosZ || velX === lVelX && velY === lVelY && velZ === lVelZ) {
      src.dopplerShift = 1;
    } else {
      // Doppler algorithm from 1.1 spec
      var speedOfSound = src.context.speedOfSound;
      var dopplerFactor = src.context.dopplerFactor;
      var slX = lPosX - posX;
      var slY = lPosY - posY;
      var slZ = lPosZ - posZ;
      var magSl = Math.sqrt(slX * slX + slY * slY + slZ * slZ);
      var vls = (slX * lVelX + slY * lVelY + slZ * lVelZ) / magSl;
      var vss = (slX * velX + slY * velY + slZ * velZ) / magSl;
      vls = Math.min(vls, speedOfSound / dopplerFactor);
      vss = Math.min(vss, speedOfSound / dopplerFactor);
      src.dopplerShift = (speedOfSound - dopplerFactor * vls) / (speedOfSound - dopplerFactor * vss);
    }
    if (src.dopplerShift !== oldShift) {
      AL.updateSourceRate(src);
    }
  },
  updateSourceRate: src => {
    if (src.state === 4114) {
      // clear scheduled buffers
      AL.cancelPendingSourceAudio(src);
      var audioSrc = src.audioQueue[0];
      if (!audioSrc) {
        return;
      }
      // It is possible that AL.scheduleContextAudio() has not yet fed the next buffer, if so, skip.
      var duration;
      if (src.type === 4136 && src.looping) {
        duration = Number.POSITIVE_INFINITY;
      } else {
        // audioSrc._duration is expressed after factoring in playbackRate, so when changing playback rate, need
        // to recompute/rescale the rate to the new playback speed.
        duration = (audioSrc.buffer.duration - audioSrc._startOffset) / src.playbackRate;
      }
      audioSrc._duration = duration;
      audioSrc.playbackRate.value = src.playbackRate;
      // reschedule buffers with the new playbackRate
      AL.scheduleSourceAudio(src);
    }
  },
  sourceDuration: src => {
    var length = 0;
    for (var i = 0; i < src.bufQueue.length; i++) {
      var audioBuf = src.bufQueue[i].audioBuf;
      length += audioBuf ? audioBuf.duration : 0;
    }
    return length;
  },
  sourceTell: src => {
    AL.updateSourceTime(src);
    var offset = 0;
    for (var i = 0; i < src.bufsProcessed; i++) {
      if (src.bufQueue[i].audioBuf) {
        offset += src.bufQueue[i].audioBuf.duration;
      }
    }
    offset += src.bufOffset;
    return offset;
  },
  sourceSeek: (src, offset) => {
    var playing = src.state == 4114;
    if (playing) {
      AL.setSourceState(src, 4113);
    }
    if (src.bufQueue[src.bufsProcessed].audioBuf !== null) {
      src.bufsProcessed = 0;
      while (offset > src.bufQueue[src.bufsProcessed].audioBuf.duration) {
        offset -= src.bufQueue[src.bufsProcessed].audioBuf.duration;
        src.bufsProcessed++;
      }
      src.bufOffset = offset;
    }
    if (playing) {
      AL.setSourceState(src, 4114);
    }
  },
  getGlobalParam: (funcname, param) => {
    if (!AL.currentCtx) {
      return null;
    }
    switch (param) {
     case 49152:
      return AL.currentCtx.dopplerFactor;

     case 49155:
      return AL.currentCtx.speedOfSound;

     case 53248:
      return AL.currentCtx.distanceModel;

     default:
      AL.currentCtx.err = 40962;
      return null;
    }
  },
  setGlobalParam: (funcname, param, value) => {
    if (!AL.currentCtx) {
      return;
    }
    switch (param) {
     case 49152:
      if (!Number.isFinite(value) || value < 0) {
        // Strictly negative values are disallowed
        AL.currentCtx.err = 40963;
        return;
      }
      AL.currentCtx.dopplerFactor = value;
      AL.updateListenerSpace(AL.currentCtx);
      break;

     case 49155:
      if (!Number.isFinite(value) || value <= 0) {
        // Negative or zero values are disallowed
        AL.currentCtx.err = 40963;
        return;
      }
      AL.currentCtx.speedOfSound = value;
      AL.updateListenerSpace(AL.currentCtx);
      break;

     case 53248:
      switch (value) {
       case 0:
       case 53249:
       /* AL_INVERSE_DISTANCE */ case 53250:
       /* AL_INVERSE_DISTANCE_CLAMPED */ case 53251:
       /* AL_LINEAR_DISTANCE */ case 53252:
       /* AL_LINEAR_DISTANCE_CLAMPED */ case 53253:
       /* AL_EXPONENT_DISTANCE */ case 53254:
        /* AL_EXPONENT_DISTANCE_CLAMPED */ AL.currentCtx.distanceModel = value;
        AL.updateContextGlobal(AL.currentCtx);
        break;

       default:
        AL.currentCtx.err = 40963;
        return;
      }
      break;

     default:
      AL.currentCtx.err = 40962;
      return;
    }
  },
  getListenerParam: (funcname, param) => {
    if (!AL.currentCtx) {
      return null;
    }
    switch (param) {
     case 4100:
      return AL.currentCtx.listener.position;

     case 4102:
      return AL.currentCtx.listener.velocity;

     case 4111:
      return AL.currentCtx.listener.direction.concat(AL.currentCtx.listener.up);

     case 4106:
      return AL.currentCtx.gain.gain.value;

     default:
      AL.currentCtx.err = 40962;
      return null;
    }
  },
  setListenerParam: (funcname, param, value) => {
    if (!AL.currentCtx) {
      return;
    }
    if (value === null) {
      AL.currentCtx.err = 40962;
      return;
    }
    var listener = AL.currentCtx.listener;
    switch (param) {
     case 4100:
      if (!Number.isFinite(value[0]) || !Number.isFinite(value[1]) || !Number.isFinite(value[2])) {
        AL.currentCtx.err = 40963;
        return;
      }
      listener.position[0] = value[0];
      listener.position[1] = value[1];
      listener.position[2] = value[2];
      AL.updateListenerSpace(AL.currentCtx);
      break;

     case 4102:
      if (!Number.isFinite(value[0]) || !Number.isFinite(value[1]) || !Number.isFinite(value[2])) {
        AL.currentCtx.err = 40963;
        return;
      }
      listener.velocity[0] = value[0];
      listener.velocity[1] = value[1];
      listener.velocity[2] = value[2];
      AL.updateListenerSpace(AL.currentCtx);
      break;

     case 4106:
      if (!Number.isFinite(value) || value < 0) {
        AL.currentCtx.err = 40963;
        return;
      }
      AL.currentCtx.gain.gain.value = value;
      break;

     case 4111:
      if (!Number.isFinite(value[0]) || !Number.isFinite(value[1]) || !Number.isFinite(value[2]) || !Number.isFinite(value[3]) || !Number.isFinite(value[4]) || !Number.isFinite(value[5])) {
        AL.currentCtx.err = 40963;
        return;
      }
      listener.direction[0] = value[0];
      listener.direction[1] = value[1];
      listener.direction[2] = value[2];
      listener.up[0] = value[3];
      listener.up[1] = value[4];
      listener.up[2] = value[5];
      AL.updateListenerSpace(AL.currentCtx);
      break;

     default:
      AL.currentCtx.err = 40962;
      return;
    }
  },
  getBufferParam: (funcname, bufferId, param) => {
    if (!AL.currentCtx) {
      return;
    }
    var buf = AL.buffers[bufferId];
    if (!buf || bufferId === 0) {
      AL.currentCtx.err = 40961;
      return;
    }
    switch (param) {
     case 8193:
      /* AL_FREQUENCY */ return buf.frequency;

     case 8194:
      /* AL_BITS */ return buf.bytesPerSample * 8;

     case 8195:
      /* AL_CHANNELS */ return buf.channels;

     case 8196:
      /* AL_SIZE */ return buf.length * buf.bytesPerSample * buf.channels;

     case 8213:
      /* AL_LOOP_POINTS_SOFT */ if (buf.length === 0) {
        return [ 0, 0 ];
      }
      return [ (buf.audioBuf._loopStart || 0) * buf.frequency, (buf.audioBuf._loopEnd || buf.length) * buf.frequency ];

     default:
      AL.currentCtx.err = 40962;
      return null;
    }
  },
  setBufferParam: (funcname, bufferId, param, value) => {
    if (!AL.currentCtx) {
      return;
    }
    var buf = AL.buffers[bufferId];
    if (!buf || bufferId === 0) {
      AL.currentCtx.err = 40961;
      return;
    }
    if (value === null) {
      AL.currentCtx.err = 40962;
      return;
    }
    switch (param) {
     case 8196:
      /* AL_SIZE */ if (value !== 0) {
        AL.currentCtx.err = 40963;
        return;
      }
      // Per the spec, setting AL_SIZE to 0 is a legal NOP.
      break;

     case 8213:
      /* AL_LOOP_POINTS_SOFT */ if (value[0] < 0 || value[0] > buf.length || value[1] < 0 || value[1] > buf.Length || value[0] >= value[1]) {
        AL.currentCtx.err = 40963;
        return;
      }
      if (buf.refCount > 0) {
        AL.currentCtx.err = 40964;
        return;
      }
      if (buf.audioBuf) {
        buf.audioBuf._loopStart = value[0] / buf.frequency;
        buf.audioBuf._loopEnd = value[1] / buf.frequency;
      }
      break;

     default:
      AL.currentCtx.err = 40962;
      return;
    }
  },
  getSourceParam: (funcname, sourceId, param) => {
    if (!AL.currentCtx) {
      return null;
    }
    var src = AL.currentCtx.sources[sourceId];
    if (!src) {
      AL.currentCtx.err = 40961;
      return null;
    }
    switch (param) {
     case 514:
      /* AL_SOURCE_RELATIVE */ return src.relative;

     case 4097:
      /* AL_CONE_INNER_ANGLE */ return src.coneInnerAngle;

     case 4098:
      /* AL_CONE_OUTER_ANGLE */ return src.coneOuterAngle;

     case 4099:
      /* AL_PITCH */ return src.pitch;

     case 4100:
      return src.position;

     case 4101:
      return src.direction;

     case 4102:
      return src.velocity;

     case 4103:
      /* AL_LOOPING */ return src.looping;

     case 4105:
      /* AL_BUFFER */ if (src.type === 4136) {
        return src.bufQueue[0].id;
      }
      return 0;

     case 4106:
      return src.gain.gain.value;

     case 4109:
      /* AL_MIN_GAIN */ return src.minGain;

     case 4110:
      /* AL_MAX_GAIN */ return src.maxGain;

     case 4112:
      /* AL_SOURCE_STATE */ return src.state;

     case 4117:
      /* AL_BUFFERS_QUEUED */ if (src.bufQueue.length === 1 && src.bufQueue[0].id === 0) {
        return 0;
      }
      return src.bufQueue.length;

     case 4118:
      /* AL_BUFFERS_PROCESSED */ if ((src.bufQueue.length === 1 && src.bufQueue[0].id === 0) || src.looping) {
        return 0;
      }
      return src.bufsProcessed;

     case 4128:
      /* AL_REFERENCE_DISTANCE */ return src.refDistance;

     case 4129:
      /* AL_ROLLOFF_FACTOR */ return src.rolloffFactor;

     case 4130:
      /* AL_CONE_OUTER_GAIN */ return src.coneOuterGain;

     case 4131:
      /* AL_MAX_DISTANCE */ return src.maxDistance;

     case 4132:
      /* AL_SEC_OFFSET */ return AL.sourceTell(src);

     case 4133:
      /* AL_SAMPLE_OFFSET */ var offset = AL.sourceTell(src);
      if (offset > 0) {
        offset *= src.bufQueue[0].frequency;
      }
      return offset;

     case 4134:
      /* AL_BYTE_OFFSET */ var offset = AL.sourceTell(src);
      if (offset > 0) {
        offset *= src.bufQueue[0].frequency * src.bufQueue[0].bytesPerSample;
      }
      return offset;

     case 4135:
      /* AL_SOURCE_TYPE */ return src.type;

     case 4628:
      /* AL_SOURCE_SPATIALIZE_SOFT */ return src.spatialize;

     case 8201:
      /* AL_BYTE_LENGTH_SOFT */ var length = 0;
      var bytesPerFrame = 0;
      for (var i = 0; i < src.bufQueue.length; i++) {
        length += src.bufQueue[i].length;
        if (src.bufQueue[i].id !== 0) {
          bytesPerFrame = src.bufQueue[i].bytesPerSample * src.bufQueue[i].channels;
        }
      }
      return length * bytesPerFrame;

     case 8202:
      /* AL_SAMPLE_LENGTH_SOFT */ var length = 0;
      for (var i = 0; i < src.bufQueue.length; i++) {
        length += src.bufQueue[i].length;
      }
      return length;

     case 8203:
      /* AL_SEC_LENGTH_SOFT */ return AL.sourceDuration(src);

     case 53248:
      return src.distanceModel;

     default:
      AL.currentCtx.err = 40962;
      return null;
    }
  },
  setSourceParam: (funcname, sourceId, param, value) => {
    if (!AL.currentCtx) {
      return;
    }
    var src = AL.currentCtx.sources[sourceId];
    if (!src) {
      AL.currentCtx.err = 40961;
      return;
    }
    if (value === null) {
      AL.currentCtx.err = 40962;
      return;
    }
    switch (param) {
     case 514:
      /* AL_SOURCE_RELATIVE */ if (value === 1) {
        src.relative = true;
        AL.updateSourceSpace(src);
      } else if (value === 0) {
        src.relative = false;
        AL.updateSourceSpace(src);
      } else {
        AL.currentCtx.err = 40963;
        return;
      }
      break;

     case 4097:
      /* AL_CONE_INNER_ANGLE */ if (!Number.isFinite(value)) {
        AL.currentCtx.err = 40963;
        return;
      }
      src.coneInnerAngle = value;
      if (src.panner) {
        src.panner.coneInnerAngle = value % 360;
      }
      break;

     case 4098:
      /* AL_CONE_OUTER_ANGLE */ if (!Number.isFinite(value)) {
        AL.currentCtx.err = 40963;
        return;
      }
      src.coneOuterAngle = value;
      if (src.panner) {
        src.panner.coneOuterAngle = value % 360;
      }
      break;

     case 4099:
      /* AL_PITCH */ if (!Number.isFinite(value) || value <= 0) {
        AL.currentCtx.err = 40963;
        return;
      }
      if (src.pitch === value) {
        break;
      }
      src.pitch = value;
      AL.updateSourceRate(src);
      break;

     case 4100:
      if (!Number.isFinite(value[0]) || !Number.isFinite(value[1]) || !Number.isFinite(value[2])) {
        AL.currentCtx.err = 40963;
        return;
      }
      src.position[0] = value[0];
      src.position[1] = value[1];
      src.position[2] = value[2];
      AL.updateSourceSpace(src);
      break;

     case 4101:
      if (!Number.isFinite(value[0]) || !Number.isFinite(value[1]) || !Number.isFinite(value[2])) {
        AL.currentCtx.err = 40963;
        return;
      }
      src.direction[0] = value[0];
      src.direction[1] = value[1];
      src.direction[2] = value[2];
      AL.updateSourceSpace(src);
      break;

     case 4102:
      if (!Number.isFinite(value[0]) || !Number.isFinite(value[1]) || !Number.isFinite(value[2])) {
        AL.currentCtx.err = 40963;
        return;
      }
      src.velocity[0] = value[0];
      src.velocity[1] = value[1];
      src.velocity[2] = value[2];
      AL.updateSourceSpace(src);
      break;

     case 4103:
      /* AL_LOOPING */ if (value === 1) {
        src.looping = true;
        AL.updateSourceTime(src);
        if (src.type === 4136 && src.audioQueue.length > 0) {
          var audioSrc = src.audioQueue[0];
          audioSrc.loop = true;
          audioSrc._duration = Number.POSITIVE_INFINITY;
        }
      } else if (value === 0) {
        src.looping = false;
        var currentTime = AL.updateSourceTime(src);
        if (src.type === 4136 && src.audioQueue.length > 0) {
          var audioSrc = src.audioQueue[0];
          audioSrc.loop = false;
          audioSrc._duration = src.bufQueue[0].audioBuf.duration / src.playbackRate;
          audioSrc._startTime = currentTime - src.bufOffset / src.playbackRate;
        }
      } else {
        AL.currentCtx.err = 40963;
        return;
      }
      break;

     case 4105:
      /* AL_BUFFER */ if (src.state === 4114 || src.state === 4115) {
        AL.currentCtx.err = 40964;
        return;
      }
      if (value === 0) {
        for (var i in src.bufQueue) {
          src.bufQueue[i].refCount--;
        }
        src.bufQueue.length = 1;
        src.bufQueue[0] = AL.buffers[0];
        src.bufsProcessed = 0;
        src.type = 4144;
      } else /* AL_UNDETERMINED */ {
        var buf = AL.buffers[value];
        if (!buf) {
          AL.currentCtx.err = 40963;
          return;
        }
        for (var i in src.bufQueue) {
          src.bufQueue[i].refCount--;
        }
        src.bufQueue.length = 0;
        buf.refCount++;
        src.bufQueue = [ buf ];
        src.bufsProcessed = 0;
        src.type = 4136;
      }
      AL.initSourcePanner(src);
      AL.scheduleSourceAudio(src);
      break;

     case 4106:
      if (!Number.isFinite(value) || value < 0) {
        AL.currentCtx.err = 40963;
        return;
      }
      src.gain.gain.value = value;
      break;

     case 4109:
      /* AL_MIN_GAIN */ if (!Number.isFinite(value) || value < 0 || value > Math.min(src.maxGain, 1)) {
        AL.currentCtx.err = 40963;
        return;
      }
      src.minGain = value;
      break;

     case 4110:
      /* AL_MAX_GAIN */ if (!Number.isFinite(value) || value < Math.max(0, src.minGain) || value > 1) {
        AL.currentCtx.err = 40963;
        return;
      }
      src.maxGain = value;
      break;

     case 4128:
      /* AL_REFERENCE_DISTANCE */ if (!Number.isFinite(value) || value < 0) {
        AL.currentCtx.err = 40963;
        return;
      }
      src.refDistance = value;
      if (src.panner) {
        src.panner.refDistance = value;
      }
      break;

     case 4129:
      /* AL_ROLLOFF_FACTOR */ if (!Number.isFinite(value) || value < 0) {
        AL.currentCtx.err = 40963;
        return;
      }
      src.rolloffFactor = value;
      if (src.panner) {
        src.panner.rolloffFactor = value;
      }
      break;

     case 4130:
      /* AL_CONE_OUTER_GAIN */ if (!Number.isFinite(value) || value < 0 || value > 1) {
        AL.currentCtx.err = 40963;
        return;
      }
      src.coneOuterGain = value;
      if (src.panner) {
        src.panner.coneOuterGain = value;
      }
      break;

     case 4131:
      /* AL_MAX_DISTANCE */ if (!Number.isFinite(value) || value < 0) {
        AL.currentCtx.err = 40963;
        return;
      }
      src.maxDistance = value;
      if (src.panner) {
        src.panner.maxDistance = value;
      }
      break;

     case 4132:
      /* AL_SEC_OFFSET */ if (value < 0 || value > AL.sourceDuration(src)) {
        AL.currentCtx.err = 40963;
        return;
      }
      AL.sourceSeek(src, value);
      break;

     case 4133:
      /* AL_SAMPLE_OFFSET */ var srcLen = AL.sourceDuration(src);
      if (srcLen > 0) {
        var frequency;
        for (var bufId in src.bufQueue) {
          if (bufId) {
            frequency = src.bufQueue[bufId].frequency;
            break;
          }
        }
        value /= frequency;
      }
      if (value < 0 || value > srcLen) {
        AL.currentCtx.err = 40963;
        return;
      }
      AL.sourceSeek(src, value);
      break;

     case 4134:
      /* AL_BYTE_OFFSET */ var srcLen = AL.sourceDuration(src);
      if (srcLen > 0) {
        var bytesPerSec;
        for (var bufId in src.bufQueue) {
          if (bufId) {
            var buf = src.bufQueue[bufId];
            bytesPerSec = buf.frequency * buf.bytesPerSample * buf.channels;
            break;
          }
        }
        value /= bytesPerSec;
      }
      if (value < 0 || value > srcLen) {
        AL.currentCtx.err = 40963;
        return;
      }
      AL.sourceSeek(src, value);
      break;

     case 4628:
      /* AL_SOURCE_SPATIALIZE_SOFT */ if (value !== 0 && value !== 1 && value !== 2) /* AL_AUTO_SOFT */ {
        AL.currentCtx.err = 40963;
        return;
      }
      src.spatialize = value;
      AL.initSourcePanner(src);
      break;

     case 8201:
     /* AL_BYTE_LENGTH_SOFT */ case 8202:
     /* AL_SAMPLE_LENGTH_SOFT */ case 8203:
      /* AL_SEC_LENGTH_SOFT */ AL.currentCtx.err = 40964;
      break;

     case 53248:
      switch (value) {
       case 0:
       case 53249:
       /* AL_INVERSE_DISTANCE */ case 53250:
       /* AL_INVERSE_DISTANCE_CLAMPED */ case 53251:
       /* AL_LINEAR_DISTANCE */ case 53252:
       /* AL_LINEAR_DISTANCE_CLAMPED */ case 53253:
       /* AL_EXPONENT_DISTANCE */ case 53254:
        /* AL_EXPONENT_DISTANCE_CLAMPED */ src.distanceModel = value;
        if (AL.currentCtx.sourceDistanceModel) {
          AL.updateContextGlobal(AL.currentCtx);
        }
        break;

       default:
        AL.currentCtx.err = 40963;
        return;
      }
      break;

     default:
      AL.currentCtx.err = 40962;
      return;
    }
  },
  captures: {},
  sharedCaptureAudioCtx: null,
  requireValidCaptureDevice: (deviceId, funcname) => {
    if (deviceId === 0) {
      AL.alcErr = 40961;
      return null;
    }
    var c = AL.captures[deviceId];
    if (!c) {
      AL.alcErr = 40961;
      return null;
    }
    var err = c.mediaStreamError;
    if (err) {
      AL.alcErr = 40961;
      return null;
    }
    return c;
  }
};

function _alBuffer3f(bufferId, param, value0, value1, value2) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(19, 0, 1, bufferId, param, value0, value1, value2);
  AL.setBufferParam("alBuffer3f", bufferId, param, null);
}

function _alBuffer3i(bufferId, param, value0, value1, value2) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(20, 0, 1, bufferId, param, value0, value1, value2);
  AL.setBufferParam("alBuffer3i", bufferId, param, null);
}

function _alBufferData(bufferId, format, pData, size, freq) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(21, 0, 1, bufferId, format, pData, size, freq);
  if (!AL.currentCtx) {
    return;
  }
  var buf = AL.buffers[bufferId];
  if (!buf) {
    AL.currentCtx.err = 40963;
    return;
  }
  if (freq <= 0) {
    AL.currentCtx.err = 40963;
    return;
  }
  var audioBuf = null;
  try {
    switch (format) {
     case 4352:
      /* AL_FORMAT_MONO8 */ if (size > 0) {
        audioBuf = AL.currentCtx.audioCtx.createBuffer(1, size, freq);
        var channel0 = audioBuf.getChannelData(0);
        for (var i = 0; i < size; ++i) {
          channel0[i] = GROWABLE_HEAP_U8()[pData++] * .0078125 - /* 1/128 */ 1;
        }
      }
      buf.bytesPerSample = 1;
      buf.channels = 1;
      buf.length = size;
      break;

     case 4353:
      /* AL_FORMAT_MONO16 */ if (size > 0) {
        audioBuf = AL.currentCtx.audioCtx.createBuffer(1, size >> 1, freq);
        var channel0 = audioBuf.getChannelData(0);
        pData >>= 1;
        for (var i = 0; i < size >> 1; ++i) {
          channel0[i] = GROWABLE_HEAP_I16()[pData++] * 30517578125e-15;
        }
      }
      buf.bytesPerSample = 2;
      buf.channels = 1;
      buf.length = size >> 1;
      break;

     case 4354:
      /* AL_FORMAT_STEREO8 */ if (size > 0) {
        audioBuf = AL.currentCtx.audioCtx.createBuffer(2, size >> 1, freq);
        var channel0 = audioBuf.getChannelData(0);
        var channel1 = audioBuf.getChannelData(1);
        for (var i = 0; i < size >> 1; ++i) {
          channel0[i] = GROWABLE_HEAP_U8()[pData++] * .0078125 - /* 1/128 */ 1;
          channel1[i] = GROWABLE_HEAP_U8()[pData++] * .0078125 - /* 1/128 */ 1;
        }
      }
      buf.bytesPerSample = 1;
      buf.channels = 2;
      buf.length = size >> 1;
      break;

     case 4355:
      /* AL_FORMAT_STEREO16 */ if (size > 0) {
        audioBuf = AL.currentCtx.audioCtx.createBuffer(2, size >> 2, freq);
        var channel0 = audioBuf.getChannelData(0);
        var channel1 = audioBuf.getChannelData(1);
        pData >>= 1;
        for (var i = 0; i < size >> 2; ++i) {
          channel0[i] = GROWABLE_HEAP_I16()[pData++] * 30517578125e-15;
          /* 1/32768 */ channel1[i] = GROWABLE_HEAP_I16()[pData++] * 30517578125e-15;
        }
      }
      buf.bytesPerSample = 2;
      buf.channels = 2;
      buf.length = size >> 2;
      break;

     case 65552:
      /* AL_FORMAT_MONO_FLOAT32 */ if (size > 0) {
        audioBuf = AL.currentCtx.audioCtx.createBuffer(1, size >> 2, freq);
        var channel0 = audioBuf.getChannelData(0);
        pData >>= 2;
        for (var i = 0; i < size >> 2; ++i) {
          channel0[i] = GROWABLE_HEAP_F32()[pData++];
        }
      }
      buf.bytesPerSample = 4;
      buf.channels = 1;
      buf.length = size >> 2;
      break;

     case 65553:
      /* AL_FORMAT_STEREO_FLOAT32 */ if (size > 0) {
        audioBuf = AL.currentCtx.audioCtx.createBuffer(2, size >> 3, freq);
        var channel0 = audioBuf.getChannelData(0);
        var channel1 = audioBuf.getChannelData(1);
        pData >>= 2;
        for (var i = 0; i < size >> 3; ++i) {
          channel0[i] = GROWABLE_HEAP_F32()[pData++];
          channel1[i] = GROWABLE_HEAP_F32()[pData++];
        }
      }
      buf.bytesPerSample = 4;
      buf.channels = 2;
      buf.length = size >> 3;
      break;

     default:
      AL.currentCtx.err = 40963;
      return;
    }
    buf.frequency = freq;
    buf.audioBuf = audioBuf;
  } catch (e) {
    AL.currentCtx.err = 40963;
    return;
  }
}

function _alBufferf(bufferId, param, value) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(22, 0, 1, bufferId, param, value);
  AL.setBufferParam("alBufferf", bufferId, param, null);
}

function _alBufferfv(bufferId, param, pValues) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(23, 0, 1, bufferId, param, pValues);
  if (!AL.currentCtx) {
    return;
  }
  if (!pValues) {
    AL.currentCtx.err = 40963;
    return;
  }
  AL.setBufferParam("alBufferfv", bufferId, param, null);
}

function _alBufferi(bufferId, param, value) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(24, 0, 1, bufferId, param, value);
  AL.setBufferParam("alBufferi", bufferId, param, null);
}

function _alBufferiv(bufferId, param, pValues) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(25, 0, 1, bufferId, param, pValues);
  if (!AL.currentCtx) {
    return;
  }
  if (!pValues) {
    AL.currentCtx.err = 40963;
    return;
  }
  switch (param) {
   case 8213:
    /* AL_LOOP_POINTS_SOFT */ AL.paramArray[0] = GROWABLE_HEAP_I32()[((pValues) >> 2)];
    AL.paramArray[1] = GROWABLE_HEAP_I32()[(((pValues) + (4)) >> 2)];
    AL.setBufferParam("alBufferiv", bufferId, param, AL.paramArray);
    break;

   default:
    AL.setBufferParam("alBufferiv", bufferId, param, null);
    break;
  }
}

function _alDeleteBuffers(count, pBufferIds) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(26, 0, 1, count, pBufferIds);
  if (!AL.currentCtx) {
    return;
  }
  for (var i = 0; i < count; ++i) {
    var bufId = GROWABLE_HEAP_I32()[(((pBufferIds) + (i * 4)) >> 2)];
    /// Deleting the zero buffer is a legal NOP, so ignore it
    if (bufId === 0) {
      continue;
    }
    // Make sure the buffer index is valid.
    if (!AL.buffers[bufId]) {
      AL.currentCtx.err = 40961;
      return;
    }
    // Make sure the buffer is no longer in use.
    if (AL.buffers[bufId].refCount) {
      AL.currentCtx.err = 40964;
      return;
    }
  }
  for (var i = 0; i < count; ++i) {
    var bufId = GROWABLE_HEAP_I32()[(((pBufferIds) + (i * 4)) >> 2)];
    if (bufId === 0) {
      continue;
    }
    AL.deviceRefCounts[AL.buffers[bufId].deviceId]--;
    delete AL.buffers[bufId];
    AL.freeIds.push(bufId);
  }
}

function _alSourcei(sourceId, param, value) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(28, 0, 1, sourceId, param, value);
  switch (param) {
   case 514:
   /* AL_SOURCE_RELATIVE */ case 4097:
   /* AL_CONE_INNER_ANGLE */ case 4098:
   /* AL_CONE_OUTER_ANGLE */ case 4103:
   /* AL_LOOPING */ case 4105:
   /* AL_BUFFER */ case 4128:
   /* AL_REFERENCE_DISTANCE */ case 4129:
   /* AL_ROLLOFF_FACTOR */ case 4131:
   /* AL_MAX_DISTANCE */ case 4132:
   /* AL_SEC_OFFSET */ case 4133:
   /* AL_SAMPLE_OFFSET */ case 4134:
   /* AL_BYTE_OFFSET */ case 4628:
   /* AL_SOURCE_SPATIALIZE_SOFT */ case 8201:
   /* AL_BYTE_LENGTH_SOFT */ case 8202:
   /* AL_SAMPLE_LENGTH_SOFT */ case 53248:
    AL.setSourceParam("alSourcei", sourceId, param, value);
    break;

   default:
    AL.setSourceParam("alSourcei", sourceId, param, null);
    break;
  }
}

function _alDeleteSources(count, pSourceIds) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(27, 0, 1, count, pSourceIds);
  if (!AL.currentCtx) {
    return;
  }
  for (var i = 0; i < count; ++i) {
    var srcId = GROWABLE_HEAP_I32()[(((pSourceIds) + (i * 4)) >> 2)];
    if (!AL.currentCtx.sources[srcId]) {
      AL.currentCtx.err = 40961;
      return;
    }
  }
  for (var i = 0; i < count; ++i) {
    var srcId = GROWABLE_HEAP_I32()[(((pSourceIds) + (i * 4)) >> 2)];
    AL.setSourceState(AL.currentCtx.sources[srcId], 4116);
    _alSourcei(srcId, 4105, /* AL_BUFFER */ 0);
    delete AL.currentCtx.sources[srcId];
    AL.freeIds.push(srcId);
  }
}

function _alDisable(param) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(29, 0, 1, param);
  if (!AL.currentCtx) {
    return;
  }
  switch (param) {
   case 512:
    /* AL_SOURCE_DISTANCE_MODEL */ AL.currentCtx.sourceDistanceModel = false;
    AL.updateContextGlobal(AL.currentCtx);
    break;

   default:
    AL.currentCtx.err = 40962;
    return;
  }
}

function _alDistanceModel(model) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(30, 0, 1, model);
  AL.setGlobalParam("alDistanceModel", 53248, model);
}

function _alDopplerFactor(value) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(31, 0, 1, value);
  AL.setGlobalParam("alDopplerFactor", 49152, value);
}

function _alDopplerVelocity(value) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(32, 0, 1, value);
  warnOnce("alDopplerVelocity() is deprecated, and only kept for compatibility with OpenAL 1.0. Use alSpeedOfSound() instead.");
  if (!AL.currentCtx) {
    return;
  }
  if (value <= 0) {
    // Negative or zero values are disallowed
    AL.currentCtx.err = 40963;
    return;
  }
}

function _alEnable(param) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(33, 0, 1, param);
  if (!AL.currentCtx) {
    return;
  }
  switch (param) {
   case 512:
    /* AL_SOURCE_DISTANCE_MODEL */ AL.currentCtx.sourceDistanceModel = true;
    AL.updateContextGlobal(AL.currentCtx);
    break;

   default:
    AL.currentCtx.err = 40962;
    return;
  }
}

function _alGenBuffers(count, pBufferIds) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(34, 0, 1, count, pBufferIds);
  if (!AL.currentCtx) {
    return;
  }
  for (var i = 0; i < count; ++i) {
    var buf = {
      deviceId: AL.currentCtx.deviceId,
      id: AL.newId(),
      refCount: 0,
      audioBuf: null,
      frequency: 0,
      bytesPerSample: 2,
      channels: 1,
      length: 0
    };
    AL.deviceRefCounts[buf.deviceId]++;
    AL.buffers[buf.id] = buf;
    GROWABLE_HEAP_I32()[(((pBufferIds) + (i * 4)) >> 2)] = buf.id;
    checkInt32(buf.id);
  }
}

function _alGenSources(count, pSourceIds) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(35, 0, 1, count, pSourceIds);
  if (!AL.currentCtx) {
    return;
  }
  for (var i = 0; i < count; ++i) {
    var gain = AL.currentCtx.audioCtx.createGain();
    gain.connect(AL.currentCtx.gain);
    var src = {
      context: AL.currentCtx,
      id: AL.newId(),
      type: 4144,
      /* AL_UNDETERMINED */ state: 4113,
      bufQueue: [ AL.buffers[0] ],
      audioQueue: [],
      looping: false,
      pitch: 1,
      dopplerShift: 1,
      gain,
      minGain: 0,
      maxGain: 1,
      panner: null,
      bufsProcessed: 0,
      bufStartTime: Number.NEGATIVE_INFINITY,
      bufOffset: 0,
      relative: false,
      refDistance: 1,
      maxDistance: 340282e33,
      /* FLT_MAX */ rolloffFactor: 1,
      position: [ 0, 0, 0 ],
      velocity: [ 0, 0, 0 ],
      direction: [ 0, 0, 0 ],
      coneOuterGain: 0,
      coneInnerAngle: 360,
      coneOuterAngle: 360,
      distanceModel: 53250,
      /* AL_INVERSE_DISTANCE_CLAMPED */ spatialize: 2,
      /* AL_AUTO_SOFT */ get playbackRate() {
        return this.pitch * this.dopplerShift;
      }
    };
    AL.currentCtx.sources[src.id] = src;
    GROWABLE_HEAP_I32()[(((pSourceIds) + (i * 4)) >> 2)] = src.id;
    checkInt32(src.id);
  }
}

function _alGetBoolean(param) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(36, 0, 1, param);
  var val = AL.getGlobalParam("alGetBoolean", param);
  if (val === null) {
    return 0;
  }
  switch (param) {
   case 49152:
   case 49155:
   case 53248:
    return val !== 0 ? 1 : 0;

   default:
    AL.currentCtx.err = 40962;
    return 0;
  }
}

function _alGetBooleanv(param, pValues) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(37, 0, 1, param, pValues);
  var val = AL.getGlobalParam("alGetBooleanv", param);
  // Silently ignore null destinations, as per the spec for global state functions
  if (val === null || !pValues) {
    return;
  }
  switch (param) {
   case 49152:
   case 49155:
   case 53248:
    GROWABLE_HEAP_I8()[pValues] = val;
    checkInt8(val);
    break;

   default:
    AL.currentCtx.err = 40962;
    return;
  }
}

function _alGetBuffer3f(bufferId, param, pValue0, pValue1, pValue2) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(38, 0, 1, bufferId, param, pValue0, pValue1, pValue2);
  var val = AL.getBufferParam("alGetBuffer3f", bufferId, param);
  if (val === null) {
    return;
  }
  if (!pValue0 || !pValue1 || !pValue2) {
    AL.currentCtx.err = 40963;
    return;
  }
  AL.currentCtx.err = 40962;
}

function _alGetBuffer3i(bufferId, param, pValue0, pValue1, pValue2) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(39, 0, 1, bufferId, param, pValue0, pValue1, pValue2);
  var val = AL.getBufferParam("alGetBuffer3i", bufferId, param);
  if (val === null) {
    return;
  }
  if (!pValue0 || !pValue1 || !pValue2) {
    AL.currentCtx.err = 40963;
    return;
  }
  AL.currentCtx.err = 40962;
}

function _alGetBufferf(bufferId, param, pValue) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(40, 0, 1, bufferId, param, pValue);
  var val = AL.getBufferParam("alGetBufferf", bufferId, param);
  if (val === null) {
    return;
  }
  if (!pValue) {
    AL.currentCtx.err = 40963;
    return;
  }
  AL.currentCtx.err = 40962;
}

function _alGetBufferfv(bufferId, param, pValues) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(41, 0, 1, bufferId, param, pValues);
  var val = AL.getBufferParam("alGetBufferfv", bufferId, param);
  if (val === null) {
    return;
  }
  if (!pValues) {
    AL.currentCtx.err = 40963;
    return;
  }
  AL.currentCtx.err = 40962;
}

function _alGetBufferi(bufferId, param, pValue) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(42, 0, 1, bufferId, param, pValue);
  var val = AL.getBufferParam("alGetBufferi", bufferId, param);
  if (val === null) {
    return;
  }
  if (!pValue) {
    AL.currentCtx.err = 40963;
    return;
  }
  switch (param) {
   case 8193:
   /* AL_FREQUENCY */ case 8194:
   /* AL_BITS */ case 8195:
   /* AL_CHANNELS */ case 8196:
    /* AL_SIZE */ GROWABLE_HEAP_I32()[((pValue) >> 2)] = val;
    checkInt32(val);
    break;

   default:
    AL.currentCtx.err = 40962;
    return;
  }
}

function _alGetBufferiv(bufferId, param, pValues) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(43, 0, 1, bufferId, param, pValues);
  var val = AL.getBufferParam("alGetBufferiv", bufferId, param);
  if (val === null) {
    return;
  }
  if (!pValues) {
    AL.currentCtx.err = 40963;
    return;
  }
  switch (param) {
   case 8193:
   /* AL_FREQUENCY */ case 8194:
   /* AL_BITS */ case 8195:
   /* AL_CHANNELS */ case 8196:
    /* AL_SIZE */ GROWABLE_HEAP_I32()[((pValues) >> 2)] = val;
    checkInt32(val);
    break;

   case 8213:
    /* AL_LOOP_POINTS_SOFT */ GROWABLE_HEAP_I32()[((pValues) >> 2)] = val[0];
    checkInt32(val[0]);
    GROWABLE_HEAP_I32()[(((pValues) + (4)) >> 2)] = val[1];
    checkInt32(val[1]);
    break;

   default:
    AL.currentCtx.err = 40962;
    return;
  }
}

function _alGetDouble(param) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(44, 0, 1, param);
  var val = AL.getGlobalParam("alGetDouble", param);
  if (val === null) {
    return 0;
  }
  switch (param) {
   case 49152:
   case 49155:
   case 53248:
    return val;

   default:
    AL.currentCtx.err = 40962;
    return 0;
  }
}

function _alGetDoublev(param, pValues) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(45, 0, 1, param, pValues);
  var val = AL.getGlobalParam("alGetDoublev", param);
  // Silently ignore null destinations, as per the spec for global state functions
  if (val === null || !pValues) {
    return;
  }
  switch (param) {
   case 49152:
   case 49155:
   case 53248:
    GROWABLE_HEAP_F64()[((pValues) >> 3)] = val;
    break;

   default:
    AL.currentCtx.err = 40962;
    return;
  }
}

function _alGetEnumValue(pEnumName) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(46, 0, 1, pEnumName);
  if (!AL.currentCtx) {
    return 0;
  }
  if (!pEnumName) {
    AL.currentCtx.err = 40963;
    return 0;
  }
  var name = UTF8ToString(pEnumName);
  switch (name) {
   // Spec doesn't clearly state that alGetEnumValue() is required to
    // support _only_ extension tokens.
    // We should probably follow OpenAL-Soft's example and support all
    // of the names we know.
    // See http://repo.or.cz/openal-soft.git/blob/HEAD:/Alc/ALc.c
    case "AL_BITS":
    return 8194;

   case "AL_BUFFER":
    return 4105;

   case "AL_BUFFERS_PROCESSED":
    return 4118;

   case "AL_BUFFERS_QUEUED":
    return 4117;

   case "AL_BYTE_OFFSET":
    return 4134;

   case "AL_CHANNELS":
    return 8195;

   case "AL_CONE_INNER_ANGLE":
    return 4097;

   case "AL_CONE_OUTER_ANGLE":
    return 4098;

   case "AL_CONE_OUTER_GAIN":
    return 4130;

   case "AL_DIRECTION":
    return 4101;

   case "AL_DISTANCE_MODEL":
    return 53248;

   case "AL_DOPPLER_FACTOR":
    return 49152;

   case "AL_DOPPLER_VELOCITY":
    return 49153;

   case "AL_EXPONENT_DISTANCE":
    return 53253;

   case "AL_EXPONENT_DISTANCE_CLAMPED":
    return 53254;

   case "AL_EXTENSIONS":
    return 45060;

   case "AL_FORMAT_MONO16":
    return 4353;

   case "AL_FORMAT_MONO8":
    return 4352;

   case "AL_FORMAT_STEREO16":
    return 4355;

   case "AL_FORMAT_STEREO8":
    return 4354;

   case "AL_FREQUENCY":
    return 8193;

   case "AL_GAIN":
    return 4106;

   case "AL_INITIAL":
    return 4113;

   case "AL_INVALID":
    return -1;

   case "AL_ILLEGAL_ENUM":
   // fallthrough
    case "AL_INVALID_ENUM":
    return 40962;

   case "AL_INVALID_NAME":
    return 40961;

   case "AL_ILLEGAL_COMMAND":
   // fallthrough
    case "AL_INVALID_OPERATION":
    return 40964;

   case "AL_INVALID_VALUE":
    return 40963;

   case "AL_INVERSE_DISTANCE":
    return 53249;

   case "AL_INVERSE_DISTANCE_CLAMPED":
    return 53250;

   case "AL_LINEAR_DISTANCE":
    return 53251;

   case "AL_LINEAR_DISTANCE_CLAMPED":
    return 53252;

   case "AL_LOOPING":
    return 4103;

   case "AL_MAX_DISTANCE":
    return 4131;

   case "AL_MAX_GAIN":
    return 4110;

   case "AL_MIN_GAIN":
    return 4109;

   case "AL_NONE":
    return 0;

   case "AL_NO_ERROR":
    return 0;

   case "AL_ORIENTATION":
    return 4111;

   case "AL_OUT_OF_MEMORY":
    return 40965;

   case "AL_PAUSED":
    return 4115;

   case "AL_PENDING":
    return 8209;

   case "AL_PITCH":
    return 4099;

   case "AL_PLAYING":
    return 4114;

   case "AL_POSITION":
    return 4100;

   case "AL_PROCESSED":
    return 8210;

   case "AL_REFERENCE_DISTANCE":
    return 4128;

   case "AL_RENDERER":
    return 45059;

   case "AL_ROLLOFF_FACTOR":
    return 4129;

   case "AL_SAMPLE_OFFSET":
    return 4133;

   case "AL_SEC_OFFSET":
    return 4132;

   case "AL_SIZE":
    return 8196;

   case "AL_SOURCE_RELATIVE":
    return 514;

   case "AL_SOURCE_STATE":
    return 4112;

   case "AL_SOURCE_TYPE":
    return 4135;

   case "AL_SPEED_OF_SOUND":
    return 49155;

   case "AL_STATIC":
    return 4136;

   case "AL_STOPPED":
    return 4116;

   case "AL_STREAMING":
    return 4137;

   case "AL_UNDETERMINED":
    return 4144;

   case "AL_UNUSED":
    return 8208;

   case "AL_VELOCITY":
    return 4102;

   case "AL_VENDOR":
    return 45057;

   case "AL_VERSION":
    return 45058;

   /* Extensions */ case "AL_AUTO_SOFT":
    return 2;

   case "AL_SOURCE_DISTANCE_MODEL":
    return 512;

   case "AL_SOURCE_SPATIALIZE_SOFT":
    return 4628;

   case "AL_LOOP_POINTS_SOFT":
    return 8213;

   case "AL_BYTE_LENGTH_SOFT":
    return 8201;

   case "AL_SAMPLE_LENGTH_SOFT":
    return 8202;

   case "AL_SEC_LENGTH_SOFT":
    return 8203;

   case "AL_FORMAT_MONO_FLOAT32":
    return 65552;

   case "AL_FORMAT_STEREO_FLOAT32":
    return 65553;

   default:
    AL.currentCtx.err = 40963;
    return 0;
  }
}

function _alGetError() {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(47, 0, 1);
  if (!AL.currentCtx) {
    return 40964;
  }
  // Reset error on get.
  var err = AL.currentCtx.err;
  AL.currentCtx.err = 0;
  return err;
}

function _alGetFloat(param) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(48, 0, 1, param);
  var val = AL.getGlobalParam("alGetFloat", param);
  if (val === null) {
    return 0;
  }
  switch (param) {
   case 49152:
   case 49155:
   case 53248:
    return val;

   default:
    return 0;
  }
}

function _alGetFloatv(param, pValues) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(49, 0, 1, param, pValues);
  var val = AL.getGlobalParam("alGetFloatv", param);
  // Silently ignore null destinations, as per the spec for global state functions
  if (val === null || !pValues) {
    return;
  }
  switch (param) {
   case 49152:
   case 49155:
   case 53248:
    GROWABLE_HEAP_F32()[((pValues) >> 2)] = val;
    break;

   default:
    AL.currentCtx.err = 40962;
    return;
  }
}

function _alGetInteger(param) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(50, 0, 1, param);
  var val = AL.getGlobalParam("alGetInteger", param);
  if (val === null) {
    return 0;
  }
  switch (param) {
   case 49152:
   case 49155:
   case 53248:
    return val;

   default:
    AL.currentCtx.err = 40962;
    return 0;
  }
}

function _alGetIntegerv(param, pValues) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(51, 0, 1, param, pValues);
  var val = AL.getGlobalParam("alGetIntegerv", param);
  // Silently ignore null destinations, as per the spec for global state functions
  if (val === null || !pValues) {
    return;
  }
  switch (param) {
   case 49152:
   case 49155:
   case 53248:
    GROWABLE_HEAP_I32()[((pValues) >> 2)] = val;
    checkInt32(val);
    break;

   default:
    AL.currentCtx.err = 40962;
    return;
  }
}

function _alGetListener3f(param, pValue0, pValue1, pValue2) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(52, 0, 1, param, pValue0, pValue1, pValue2);
  var val = AL.getListenerParam("alGetListener3f", param);
  if (val === null) {
    return;
  }
  if (!pValue0 || !pValue1 || !pValue2) {
    AL.currentCtx.err = 40963;
    return;
  }
  switch (param) {
   case 4100:
   case 4102:
    GROWABLE_HEAP_F32()[((pValue0) >> 2)] = val[0];
    GROWABLE_HEAP_F32()[((pValue1) >> 2)] = val[1];
    GROWABLE_HEAP_F32()[((pValue2) >> 2)] = val[2];
    break;

   default:
    AL.currentCtx.err = 40962;
    return;
  }
}

function _alGetListener3i(param, pValue0, pValue1, pValue2) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(53, 0, 1, param, pValue0, pValue1, pValue2);
  var val = AL.getListenerParam("alGetListener3i", param);
  if (val === null) {
    return;
  }
  if (!pValue0 || !pValue1 || !pValue2) {
    AL.currentCtx.err = 40963;
    return;
  }
  switch (param) {
   case 4100:
   case 4102:
    GROWABLE_HEAP_I32()[((pValue0) >> 2)] = val[0];
    checkInt32(val[0]);
    GROWABLE_HEAP_I32()[((pValue1) >> 2)] = val[1];
    checkInt32(val[1]);
    GROWABLE_HEAP_I32()[((pValue2) >> 2)] = val[2];
    checkInt32(val[2]);
    break;

   default:
    AL.currentCtx.err = 40962;
    return;
  }
}

function _alGetListenerf(param, pValue) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(54, 0, 1, param, pValue);
  var val = AL.getListenerParam("alGetListenerf", param);
  if (val === null) {
    return;
  }
  if (!pValue) {
    AL.currentCtx.err = 40963;
    return;
  }
  switch (param) {
   case 4106:
    GROWABLE_HEAP_F32()[((pValue) >> 2)] = val;
    break;

   default:
    AL.currentCtx.err = 40962;
    return;
  }
}

function _alGetListenerfv(param, pValues) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(55, 0, 1, param, pValues);
  var val = AL.getListenerParam("alGetListenerfv", param);
  if (val === null) {
    return;
  }
  if (!pValues) {
    AL.currentCtx.err = 40963;
    return;
  }
  switch (param) {
   case 4100:
   case 4102:
    GROWABLE_HEAP_F32()[((pValues) >> 2)] = val[0];
    GROWABLE_HEAP_F32()[(((pValues) + (4)) >> 2)] = val[1];
    GROWABLE_HEAP_F32()[(((pValues) + (8)) >> 2)] = val[2];
    break;

   case 4111:
    GROWABLE_HEAP_F32()[((pValues) >> 2)] = val[0];
    GROWABLE_HEAP_F32()[(((pValues) + (4)) >> 2)] = val[1];
    GROWABLE_HEAP_F32()[(((pValues) + (8)) >> 2)] = val[2];
    GROWABLE_HEAP_F32()[(((pValues) + (12)) >> 2)] = val[3];
    GROWABLE_HEAP_F32()[(((pValues) + (16)) >> 2)] = val[4];
    GROWABLE_HEAP_F32()[(((pValues) + (20)) >> 2)] = val[5];
    break;

   default:
    AL.currentCtx.err = 40962;
    return;
  }
}

function _alGetListeneri(param, pValue) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(56, 0, 1, param, pValue);
  var val = AL.getListenerParam("alGetListeneri", param);
  if (val === null) {
    return;
  }
  if (!pValue) {
    AL.currentCtx.err = 40963;
    return;
  }
  AL.currentCtx.err = 40962;
}

function _alGetListeneriv(param, pValues) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(57, 0, 1, param, pValues);
  var val = AL.getListenerParam("alGetListeneriv", param);
  if (val === null) {
    return;
  }
  if (!pValues) {
    AL.currentCtx.err = 40963;
    return;
  }
  switch (param) {
   case 4100:
   case 4102:
    GROWABLE_HEAP_I32()[((pValues) >> 2)] = val[0];
    checkInt32(val[0]);
    GROWABLE_HEAP_I32()[(((pValues) + (4)) >> 2)] = val[1];
    checkInt32(val[1]);
    GROWABLE_HEAP_I32()[(((pValues) + (8)) >> 2)] = val[2];
    checkInt32(val[2]);
    break;

   case 4111:
    GROWABLE_HEAP_I32()[((pValues) >> 2)] = val[0];
    checkInt32(val[0]);
    GROWABLE_HEAP_I32()[(((pValues) + (4)) >> 2)] = val[1];
    checkInt32(val[1]);
    GROWABLE_HEAP_I32()[(((pValues) + (8)) >> 2)] = val[2];
    checkInt32(val[2]);
    GROWABLE_HEAP_I32()[(((pValues) + (12)) >> 2)] = val[3];
    checkInt32(val[3]);
    GROWABLE_HEAP_I32()[(((pValues) + (16)) >> 2)] = val[4];
    checkInt32(val[4]);
    GROWABLE_HEAP_I32()[(((pValues) + (20)) >> 2)] = val[5];
    checkInt32(val[5]);
    break;

   default:
    AL.currentCtx.err = 40962;
    return;
  }
}

function _alGetSource3f(sourceId, param, pValue0, pValue1, pValue2) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(58, 0, 1, sourceId, param, pValue0, pValue1, pValue2);
  var val = AL.getSourceParam("alGetSource3f", sourceId, param);
  if (val === null) {
    return;
  }
  if (!pValue0 || !pValue1 || !pValue2) {
    AL.currentCtx.err = 40963;
    return;
  }
  switch (param) {
   case 4100:
   case 4101:
   case 4102:
    GROWABLE_HEAP_F32()[((pValue0) >> 2)] = val[0];
    GROWABLE_HEAP_F32()[((pValue1) >> 2)] = val[1];
    GROWABLE_HEAP_F32()[((pValue2) >> 2)] = val[2];
    break;

   default:
    AL.currentCtx.err = 40962;
    return;
  }
}

function _alGetSource3i(sourceId, param, pValue0, pValue1, pValue2) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(59, 0, 1, sourceId, param, pValue0, pValue1, pValue2);
  var val = AL.getSourceParam("alGetSource3i", sourceId, param);
  if (val === null) {
    return;
  }
  if (!pValue0 || !pValue1 || !pValue2) {
    AL.currentCtx.err = 40963;
    return;
  }
  switch (param) {
   case 4100:
   case 4101:
   case 4102:
    GROWABLE_HEAP_I32()[((pValue0) >> 2)] = val[0];
    checkInt32(val[0]);
    GROWABLE_HEAP_I32()[((pValue1) >> 2)] = val[1];
    checkInt32(val[1]);
    GROWABLE_HEAP_I32()[((pValue2) >> 2)] = val[2];
    checkInt32(val[2]);
    break;

   default:
    AL.currentCtx.err = 40962;
    return;
  }
}

function _alGetSourcef(sourceId, param, pValue) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(60, 0, 1, sourceId, param, pValue);
  var val = AL.getSourceParam("alGetSourcef", sourceId, param);
  if (val === null) {
    return;
  }
  if (!pValue) {
    AL.currentCtx.err = 40963;
    return;
  }
  switch (param) {
   case 4097:
   /* AL_CONE_INNER_ANGLE */ case 4098:
   /* AL_CONE_OUTER_ANGLE */ case 4099:
   /* AL_PITCH */ case 4106:
   case 4109:
   /* AL_MIN_GAIN */ case 4110:
   /* AL_MAX_GAIN */ case 4128:
   /* AL_REFERENCE_DISTANCE */ case 4129:
   /* AL_ROLLOFF_FACTOR */ case 4130:
   /* AL_CONE_OUTER_GAIN */ case 4131:
   /* AL_MAX_DISTANCE */ case 4132:
   /* AL_SEC_OFFSET */ case 4133:
   /* AL_SAMPLE_OFFSET */ case 4134:
   /* AL_BYTE_OFFSET */ case 8203:
    /* AL_SEC_LENGTH_SOFT */ GROWABLE_HEAP_F32()[((pValue) >> 2)] = val;
    break;

   default:
    AL.currentCtx.err = 40962;
    return;
  }
}

function _alGetSourcefv(sourceId, param, pValues) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(61, 0, 1, sourceId, param, pValues);
  var val = AL.getSourceParam("alGetSourcefv", sourceId, param);
  if (val === null) {
    return;
  }
  if (!pValues) {
    AL.currentCtx.err = 40963;
    return;
  }
  switch (param) {
   case 4097:
   /* AL_CONE_INNER_ANGLE */ case 4098:
   /* AL_CONE_OUTER_ANGLE */ case 4099:
   /* AL_PITCH */ case 4106:
   case 4109:
   /* AL_MIN_GAIN */ case 4110:
   /* AL_MAX_GAIN */ case 4128:
   /* AL_REFERENCE_DISTANCE */ case 4129:
   /* AL_ROLLOFF_FACTOR */ case 4130:
   /* AL_CONE_OUTER_GAIN */ case 4131:
   /* AL_MAX_DISTANCE */ case 4132:
   /* AL_SEC_OFFSET */ case 4133:
   /* AL_SAMPLE_OFFSET */ case 4134:
   /* AL_BYTE_OFFSET */ case 8203:
    /* AL_SEC_LENGTH_SOFT */ GROWABLE_HEAP_F32()[((pValues) >> 2)] = val[0];
    break;

   case 4100:
   case 4101:
   case 4102:
    GROWABLE_HEAP_F32()[((pValues) >> 2)] = val[0];
    GROWABLE_HEAP_F32()[(((pValues) + (4)) >> 2)] = val[1];
    GROWABLE_HEAP_F32()[(((pValues) + (8)) >> 2)] = val[2];
    break;

   default:
    AL.currentCtx.err = 40962;
    return;
  }
}

function _alGetSourcei(sourceId, param, pValue) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(62, 0, 1, sourceId, param, pValue);
  var val = AL.getSourceParam("alGetSourcei", sourceId, param);
  if (val === null) {
    return;
  }
  if (!pValue) {
    AL.currentCtx.err = 40963;
    return;
  }
  switch (param) {
   case 514:
   /* AL_SOURCE_RELATIVE */ case 4097:
   /* AL_CONE_INNER_ANGLE */ case 4098:
   /* AL_CONE_OUTER_ANGLE */ case 4103:
   /* AL_LOOPING */ case 4105:
   /* AL_BUFFER */ case 4112:
   /* AL_SOURCE_STATE */ case 4117:
   /* AL_BUFFERS_QUEUED */ case 4118:
   /* AL_BUFFERS_PROCESSED */ case 4128:
   /* AL_REFERENCE_DISTANCE */ case 4129:
   /* AL_ROLLOFF_FACTOR */ case 4131:
   /* AL_MAX_DISTANCE */ case 4132:
   /* AL_SEC_OFFSET */ case 4133:
   /* AL_SAMPLE_OFFSET */ case 4134:
   /* AL_BYTE_OFFSET */ case 4135:
   /* AL_SOURCE_TYPE */ case 4628:
   /* AL_SOURCE_SPATIALIZE_SOFT */ case 8201:
   /* AL_BYTE_LENGTH_SOFT */ case 8202:
   /* AL_SAMPLE_LENGTH_SOFT */ case 53248:
    GROWABLE_HEAP_I32()[((pValue) >> 2)] = val;
    checkInt32(val);
    break;

   default:
    AL.currentCtx.err = 40962;
    return;
  }
}

function _alGetSourceiv(sourceId, param, pValues) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(63, 0, 1, sourceId, param, pValues);
  var val = AL.getSourceParam("alGetSourceiv", sourceId, param);
  if (val === null) {
    return;
  }
  if (!pValues) {
    AL.currentCtx.err = 40963;
    return;
  }
  switch (param) {
   case 514:
   /* AL_SOURCE_RELATIVE */ case 4097:
   /* AL_CONE_INNER_ANGLE */ case 4098:
   /* AL_CONE_OUTER_ANGLE */ case 4103:
   /* AL_LOOPING */ case 4105:
   /* AL_BUFFER */ case 4112:
   /* AL_SOURCE_STATE */ case 4117:
   /* AL_BUFFERS_QUEUED */ case 4118:
   /* AL_BUFFERS_PROCESSED */ case 4128:
   /* AL_REFERENCE_DISTANCE */ case 4129:
   /* AL_ROLLOFF_FACTOR */ case 4131:
   /* AL_MAX_DISTANCE */ case 4132:
   /* AL_SEC_OFFSET */ case 4133:
   /* AL_SAMPLE_OFFSET */ case 4134:
   /* AL_BYTE_OFFSET */ case 4135:
   /* AL_SOURCE_TYPE */ case 4628:
   /* AL_SOURCE_SPATIALIZE_SOFT */ case 8201:
   /* AL_BYTE_LENGTH_SOFT */ case 8202:
   /* AL_SAMPLE_LENGTH_SOFT */ case 53248:
    GROWABLE_HEAP_I32()[((pValues) >> 2)] = val;
    checkInt32(val);
    break;

   case 4100:
   case 4101:
   case 4102:
    GROWABLE_HEAP_I32()[((pValues) >> 2)] = val[0];
    checkInt32(val[0]);
    GROWABLE_HEAP_I32()[(((pValues) + (4)) >> 2)] = val[1];
    checkInt32(val[1]);
    GROWABLE_HEAP_I32()[(((pValues) + (8)) >> 2)] = val[2];
    checkInt32(val[2]);
    break;

   default:
    AL.currentCtx.err = 40962;
    return;
  }
}

var stringToNewUTF8 = str => {
  var size = lengthBytesUTF8(str) + 1;
  var ret = _malloc(size);
  if (ret) stringToUTF8(str, ret, size);
  return ret;
};

function _alGetString(param) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(64, 0, 1, param);
  if (AL.stringCache[param]) {
    return AL.stringCache[param];
  }
  var ret;
  switch (param) {
   case 0:
    ret = "No Error";
    break;

   case 40961:
    ret = "Invalid Name";
    break;

   case 40962:
    ret = "Invalid Enum";
    break;

   case 40963:
    ret = "Invalid Value";
    break;

   case 40964:
    ret = "Invalid Operation";
    break;

   case 40965:
    /* AL_OUT_OF_MEMORY */ ret = "Out of Memory";
    break;

   case 45057:
    /* AL_VENDOR */ ret = "Emscripten";
    break;

   case 45058:
    /* AL_VERSION */ ret = "1.1";
    break;

   case 45059:
    /* AL_RENDERER */ ret = "WebAudio";
    break;

   case 45060:
    /* AL_EXTENSIONS */ ret = Object.keys(AL.AL_EXTENSIONS).join(" ");
    break;

   default:
    if (AL.currentCtx) {
      AL.currentCtx.err = 40962;
    } else {}
    return 0;
  }
  ret = stringToNewUTF8(ret);
  AL.stringCache[param] = ret;
  return ret;
}

function _alIsBuffer(bufferId) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(65, 0, 1, bufferId);
  if (!AL.currentCtx) {
    return false;
  }
  if (bufferId > AL.buffers.length) {
    return false;
  }
  if (!AL.buffers[bufferId]) {
    return false;
  }
  return true;
}

function _alIsEnabled(param) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(66, 0, 1, param);
  if (!AL.currentCtx) {
    return 0;
  }
  switch (param) {
   case 512:
    /* AL_SOURCE_DISTANCE_MODEL */ return AL.currentCtx.sourceDistanceModel ? 0 : 1;

   default:
    AL.currentCtx.err = 40962;
    return 0;
  }
}

function _alIsExtensionPresent(pExtName) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(67, 0, 1, pExtName);
  var name = UTF8ToString(pExtName);
  return AL.AL_EXTENSIONS[name] ? 1 : 0;
}

function _alIsSource(sourceId) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(68, 0, 1, sourceId);
  if (!AL.currentCtx) {
    return false;
  }
  if (!AL.currentCtx.sources[sourceId]) {
    return false;
  }
  return true;
}

function _alListener3f(param, value0, value1, value2) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(69, 0, 1, param, value0, value1, value2);
  switch (param) {
   case 4100:
   case 4102:
    AL.paramArray[0] = value0;
    AL.paramArray[1] = value1;
    AL.paramArray[2] = value2;
    AL.setListenerParam("alListener3f", param, AL.paramArray);
    break;

   default:
    AL.setListenerParam("alListener3f", param, null);
    break;
  }
}

function _alListener3i(param, value0, value1, value2) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(70, 0, 1, param, value0, value1, value2);
  switch (param) {
   case 4100:
   case 4102:
    AL.paramArray[0] = value0;
    AL.paramArray[1] = value1;
    AL.paramArray[2] = value2;
    AL.setListenerParam("alListener3i", param, AL.paramArray);
    break;

   default:
    AL.setListenerParam("alListener3i", param, null);
    break;
  }
}

function _alListenerf(param, value) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(71, 0, 1, param, value);
  switch (param) {
   case 4106:
    AL.setListenerParam("alListenerf", param, value);
    break;

   default:
    AL.setListenerParam("alListenerf", param, null);
    break;
  }
}

function _alListenerfv(param, pValues) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(72, 0, 1, param, pValues);
  if (!AL.currentCtx) {
    return;
  }
  if (!pValues) {
    AL.currentCtx.err = 40963;
    return;
  }
  switch (param) {
   case 4100:
   case 4102:
    AL.paramArray[0] = GROWABLE_HEAP_F32()[((pValues) >> 2)];
    AL.paramArray[1] = GROWABLE_HEAP_F32()[(((pValues) + (4)) >> 2)];
    AL.paramArray[2] = GROWABLE_HEAP_F32()[(((pValues) + (8)) >> 2)];
    AL.setListenerParam("alListenerfv", param, AL.paramArray);
    break;

   case 4111:
    AL.paramArray[0] = GROWABLE_HEAP_F32()[((pValues) >> 2)];
    AL.paramArray[1] = GROWABLE_HEAP_F32()[(((pValues) + (4)) >> 2)];
    AL.paramArray[2] = GROWABLE_HEAP_F32()[(((pValues) + (8)) >> 2)];
    AL.paramArray[3] = GROWABLE_HEAP_F32()[(((pValues) + (12)) >> 2)];
    AL.paramArray[4] = GROWABLE_HEAP_F32()[(((pValues) + (16)) >> 2)];
    AL.paramArray[5] = GROWABLE_HEAP_F32()[(((pValues) + (20)) >> 2)];
    AL.setListenerParam("alListenerfv", param, AL.paramArray);
    break;

   default:
    AL.setListenerParam("alListenerfv", param, null);
    break;
  }
}

function _alListeneri(param, value) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(73, 0, 1, param, value);
  AL.setListenerParam("alListeneri", param, null);
}

function _alListeneriv(param, pValues) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(74, 0, 1, param, pValues);
  if (!AL.currentCtx) {
    return;
  }
  if (!pValues) {
    AL.currentCtx.err = 40963;
    return;
  }
  switch (param) {
   case 4100:
   case 4102:
    AL.paramArray[0] = GROWABLE_HEAP_I32()[((pValues) >> 2)];
    AL.paramArray[1] = GROWABLE_HEAP_I32()[(((pValues) + (4)) >> 2)];
    AL.paramArray[2] = GROWABLE_HEAP_I32()[(((pValues) + (8)) >> 2)];
    AL.setListenerParam("alListeneriv", param, AL.paramArray);
    break;

   case 4111:
    AL.paramArray[0] = GROWABLE_HEAP_I32()[((pValues) >> 2)];
    AL.paramArray[1] = GROWABLE_HEAP_I32()[(((pValues) + (4)) >> 2)];
    AL.paramArray[2] = GROWABLE_HEAP_I32()[(((pValues) + (8)) >> 2)];
    AL.paramArray[3] = GROWABLE_HEAP_I32()[(((pValues) + (12)) >> 2)];
    AL.paramArray[4] = GROWABLE_HEAP_I32()[(((pValues) + (16)) >> 2)];
    AL.paramArray[5] = GROWABLE_HEAP_I32()[(((pValues) + (20)) >> 2)];
    AL.setListenerParam("alListeneriv", param, AL.paramArray);
    break;

   default:
    AL.setListenerParam("alListeneriv", param, null);
    break;
  }
}

function _alSource3f(sourceId, param, value0, value1, value2) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(75, 0, 1, sourceId, param, value0, value1, value2);
  switch (param) {
   case 4100:
   case 4101:
   case 4102:
    AL.paramArray[0] = value0;
    AL.paramArray[1] = value1;
    AL.paramArray[2] = value2;
    AL.setSourceParam("alSource3f", sourceId, param, AL.paramArray);
    break;

   default:
    AL.setSourceParam("alSource3f", sourceId, param, null);
    break;
  }
}

function _alSource3i(sourceId, param, value0, value1, value2) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(76, 0, 1, sourceId, param, value0, value1, value2);
  switch (param) {
   case 4100:
   case 4101:
   case 4102:
    AL.paramArray[0] = value0;
    AL.paramArray[1] = value1;
    AL.paramArray[2] = value2;
    AL.setSourceParam("alSource3i", sourceId, param, AL.paramArray);
    break;

   default:
    AL.setSourceParam("alSource3i", sourceId, param, null);
    break;
  }
}

function _alSourcePause(sourceId) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(77, 0, 1, sourceId);
  if (!AL.currentCtx) {
    return;
  }
  var src = AL.currentCtx.sources[sourceId];
  if (!src) {
    AL.currentCtx.err = 40961;
    return;
  }
  AL.setSourceState(src, 4115);
}

function _alSourcePausev(count, pSourceIds) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(78, 0, 1, count, pSourceIds);
  if (!AL.currentCtx) {
    return;
  }
  if (!pSourceIds) {
    AL.currentCtx.err = 40963;
  }
  for (var i = 0; i < count; ++i) {
    if (!AL.currentCtx.sources[GROWABLE_HEAP_I32()[(((pSourceIds) + (i * 4)) >> 2)]]) {
      AL.currentCtx.err = 40961;
      return;
    }
  }
  for (var i = 0; i < count; ++i) {
    var srcId = GROWABLE_HEAP_I32()[(((pSourceIds) + (i * 4)) >> 2)];
    AL.setSourceState(AL.currentCtx.sources[srcId], 4115);
  }
}

function _alSourcePlay(sourceId) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(79, 0, 1, sourceId);
  if (!AL.currentCtx) {
    return;
  }
  var src = AL.currentCtx.sources[sourceId];
  if (!src) {
    AL.currentCtx.err = 40961;
    return;
  }
  AL.setSourceState(src, 4114);
}

function _alSourcePlayv(count, pSourceIds) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(80, 0, 1, count, pSourceIds);
  if (!AL.currentCtx) {
    return;
  }
  if (!pSourceIds) {
    AL.currentCtx.err = 40963;
  }
  for (var i = 0; i < count; ++i) {
    if (!AL.currentCtx.sources[GROWABLE_HEAP_I32()[(((pSourceIds) + (i * 4)) >> 2)]]) {
      AL.currentCtx.err = 40961;
      return;
    }
  }
  for (var i = 0; i < count; ++i) {
    var srcId = GROWABLE_HEAP_I32()[(((pSourceIds) + (i * 4)) >> 2)];
    AL.setSourceState(AL.currentCtx.sources[srcId], 4114);
  }
}

function _alSourceQueueBuffers(sourceId, count, pBufferIds) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(81, 0, 1, sourceId, count, pBufferIds);
  if (!AL.currentCtx) {
    return;
  }
  var src = AL.currentCtx.sources[sourceId];
  if (!src) {
    AL.currentCtx.err = 40961;
    return;
  }
  if (src.type === 4136) {
    AL.currentCtx.err = 40964;
    return;
  }
  if (count === 0) {
    return;
  }
  // Find the first non-zero buffer in the queue to determine the proper format
  var templateBuf = AL.buffers[0];
  for (var i = 0; i < src.bufQueue.length; i++) {
    if (src.bufQueue[i].id !== 0) {
      templateBuf = src.bufQueue[i];
      break;
    }
  }
  for (var i = 0; i < count; ++i) {
    var bufId = GROWABLE_HEAP_I32()[(((pBufferIds) + (i * 4)) >> 2)];
    var buf = AL.buffers[bufId];
    if (!buf) {
      AL.currentCtx.err = 40961;
      return;
    }
    // Check that the added buffer has the correct format. If the template is the zero buffer, any format is valid.
    if (templateBuf.id !== 0 && (buf.frequency !== templateBuf.frequency || buf.bytesPerSample !== templateBuf.bytesPerSample || buf.channels !== templateBuf.channels)) {
      AL.currentCtx.err = 40964;
    }
  }
  // If the only buffer in the queue is the zero buffer, clear the queue before we add anything.
  if (src.bufQueue.length === 1 && src.bufQueue[0].id === 0) {
    src.bufQueue.length = 0;
  }
  src.type = 4137;
  /* AL_STREAMING */ for (var i = 0; i < count; ++i) {
    var bufId = GROWABLE_HEAP_I32()[(((pBufferIds) + (i * 4)) >> 2)];
    var buf = AL.buffers[bufId];
    buf.refCount++;
    src.bufQueue.push(buf);
  }
  // if the source is looping, cancel the schedule so we can reschedule the loop order
  if (src.looping) {
    AL.cancelPendingSourceAudio(src);
  }
  AL.initSourcePanner(src);
  AL.scheduleSourceAudio(src);
}

function _alSourceRewind(sourceId) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(82, 0, 1, sourceId);
  if (!AL.currentCtx) {
    return;
  }
  var src = AL.currentCtx.sources[sourceId];
  if (!src) {
    AL.currentCtx.err = 40961;
    return;
  }
  // Stop the source first to clear the source queue
  AL.setSourceState(src, 4116);
  // Now set the state of AL_INITIAL according to the specification
  AL.setSourceState(src, 4113);
}

function _alSourceRewindv(count, pSourceIds) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(83, 0, 1, count, pSourceIds);
  if (!AL.currentCtx) {
    return;
  }
  if (!pSourceIds) {
    AL.currentCtx.err = 40963;
  }
  for (var i = 0; i < count; ++i) {
    if (!AL.currentCtx.sources[GROWABLE_HEAP_I32()[(((pSourceIds) + (i * 4)) >> 2)]]) {
      AL.currentCtx.err = 40961;
      return;
    }
  }
  for (var i = 0; i < count; ++i) {
    var srcId = GROWABLE_HEAP_I32()[(((pSourceIds) + (i * 4)) >> 2)];
    AL.setSourceState(AL.currentCtx.sources[srcId], 4113);
  }
}

function _alSourceStop(sourceId) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(84, 0, 1, sourceId);
  if (!AL.currentCtx) {
    return;
  }
  var src = AL.currentCtx.sources[sourceId];
  if (!src) {
    AL.currentCtx.err = 40961;
    return;
  }
  AL.setSourceState(src, 4116);
}

function _alSourceStopv(count, pSourceIds) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(85, 0, 1, count, pSourceIds);
  if (!AL.currentCtx) {
    return;
  }
  if (!pSourceIds) {
    AL.currentCtx.err = 40963;
  }
  for (var i = 0; i < count; ++i) {
    if (!AL.currentCtx.sources[GROWABLE_HEAP_I32()[(((pSourceIds) + (i * 4)) >> 2)]]) {
      AL.currentCtx.err = 40961;
      return;
    }
  }
  for (var i = 0; i < count; ++i) {
    var srcId = GROWABLE_HEAP_I32()[(((pSourceIds) + (i * 4)) >> 2)];
    AL.setSourceState(AL.currentCtx.sources[srcId], 4116);
  }
}

function _alSourceUnqueueBuffers(sourceId, count, pBufferIds) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(86, 0, 1, sourceId, count, pBufferIds);
  if (!AL.currentCtx) {
    return;
  }
  var src = AL.currentCtx.sources[sourceId];
  if (!src) {
    AL.currentCtx.err = 40961;
    return;
  }
  if (count > (src.bufQueue.length === 1 && src.bufQueue[0].id === 0 ? 0 : src.bufsProcessed)) {
    AL.currentCtx.err = 40963;
    return;
  }
  if (count === 0) {
    return;
  }
  for (var i = 0; i < count; i++) {
    var buf = src.bufQueue.shift();
    buf.refCount--;
    // Write the buffers index out to the return list.
    GROWABLE_HEAP_I32()[(((pBufferIds) + (i * 4)) >> 2)] = buf.id;
    checkInt32(buf.id);
    src.bufsProcessed--;
  }
  /// If the queue is empty, put the zero buffer back in
  if (src.bufQueue.length === 0) {
    src.bufQueue.push(AL.buffers[0]);
  }
  AL.initSourcePanner(src);
  AL.scheduleSourceAudio(src);
}

function _alSourcef(sourceId, param, value) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(87, 0, 1, sourceId, param, value);
  switch (param) {
   case 4097:
   /* AL_CONE_INNER_ANGLE */ case 4098:
   /* AL_CONE_OUTER_ANGLE */ case 4099:
   /* AL_PITCH */ case 4106:
   case 4109:
   /* AL_MIN_GAIN */ case 4110:
   /* AL_MAX_GAIN */ case 4128:
   /* AL_REFERENCE_DISTANCE */ case 4129:
   /* AL_ROLLOFF_FACTOR */ case 4130:
   /* AL_CONE_OUTER_GAIN */ case 4131:
   /* AL_MAX_DISTANCE */ case 4132:
   /* AL_SEC_OFFSET */ case 4133:
   /* AL_SAMPLE_OFFSET */ case 4134:
   /* AL_BYTE_OFFSET */ case 8203:
    /* AL_SEC_LENGTH_SOFT */ AL.setSourceParam("alSourcef", sourceId, param, value);
    break;

   default:
    AL.setSourceParam("alSourcef", sourceId, param, null);
    break;
  }
}

function _alSourcefv(sourceId, param, pValues) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(88, 0, 1, sourceId, param, pValues);
  if (!AL.currentCtx) {
    return;
  }
  if (!pValues) {
    AL.currentCtx.err = 40963;
    return;
  }
  switch (param) {
   case 4097:
   /* AL_CONE_INNER_ANGLE */ case 4098:
   /* AL_CONE_OUTER_ANGLE */ case 4099:
   /* AL_PITCH */ case 4106:
   case 4109:
   /* AL_MIN_GAIN */ case 4110:
   /* AL_MAX_GAIN */ case 4128:
   /* AL_REFERENCE_DISTANCE */ case 4129:
   /* AL_ROLLOFF_FACTOR */ case 4130:
   /* AL_CONE_OUTER_GAIN */ case 4131:
   /* AL_MAX_DISTANCE */ case 4132:
   /* AL_SEC_OFFSET */ case 4133:
   /* AL_SAMPLE_OFFSET */ case 4134:
   /* AL_BYTE_OFFSET */ case 8203:
    /* AL_SEC_LENGTH_SOFT */ var val = GROWABLE_HEAP_F32()[((pValues) >> 2)];
    AL.setSourceParam("alSourcefv", sourceId, param, val);
    break;

   case 4100:
   case 4101:
   case 4102:
    AL.paramArray[0] = GROWABLE_HEAP_F32()[((pValues) >> 2)];
    AL.paramArray[1] = GROWABLE_HEAP_F32()[(((pValues) + (4)) >> 2)];
    AL.paramArray[2] = GROWABLE_HEAP_F32()[(((pValues) + (8)) >> 2)];
    AL.setSourceParam("alSourcefv", sourceId, param, AL.paramArray);
    break;

   default:
    AL.setSourceParam("alSourcefv", sourceId, param, null);
    break;
  }
}

function _alSourceiv(sourceId, param, pValues) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(89, 0, 1, sourceId, param, pValues);
  if (!AL.currentCtx) {
    return;
  }
  if (!pValues) {
    AL.currentCtx.err = 40963;
    return;
  }
  switch (param) {
   case 514:
   /* AL_SOURCE_RELATIVE */ case 4097:
   /* AL_CONE_INNER_ANGLE */ case 4098:
   /* AL_CONE_OUTER_ANGLE */ case 4103:
   /* AL_LOOPING */ case 4105:
   /* AL_BUFFER */ case 4128:
   /* AL_REFERENCE_DISTANCE */ case 4129:
   /* AL_ROLLOFF_FACTOR */ case 4131:
   /* AL_MAX_DISTANCE */ case 4132:
   /* AL_SEC_OFFSET */ case 4133:
   /* AL_SAMPLE_OFFSET */ case 4134:
   /* AL_BYTE_OFFSET */ case 4628:
   /* AL_SOURCE_SPATIALIZE_SOFT */ case 8201:
   /* AL_BYTE_LENGTH_SOFT */ case 8202:
   /* AL_SAMPLE_LENGTH_SOFT */ case 53248:
    var val = GROWABLE_HEAP_I32()[((pValues) >> 2)];
    AL.setSourceParam("alSourceiv", sourceId, param, val);
    break;

   case 4100:
   case 4101:
   case 4102:
    AL.paramArray[0] = GROWABLE_HEAP_I32()[((pValues) >> 2)];
    AL.paramArray[1] = GROWABLE_HEAP_I32()[(((pValues) + (4)) >> 2)];
    AL.paramArray[2] = GROWABLE_HEAP_I32()[(((pValues) + (8)) >> 2)];
    AL.setSourceParam("alSourceiv", sourceId, param, AL.paramArray);
    break;

   default:
    AL.setSourceParam("alSourceiv", sourceId, param, null);
    break;
  }
}

function _alSpeedOfSound(value) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(90, 0, 1, value);
  AL.setGlobalParam("alSpeedOfSound", 49155, value);
}

function _alcCloseDevice(deviceId) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(91, 0, 1, deviceId);
  if (!(deviceId in AL.deviceRefCounts) || AL.deviceRefCounts[deviceId] > 0) {
    return 0;
  }
  delete AL.deviceRefCounts[deviceId];
  AL.freeIds.push(deviceId);
  return 1;
}

var listenOnce = (object, event, func) => object.addEventListener(event, func, {
  "once": true
});

/** @param {Object=} elements */ var autoResumeAudioContext = (ctx, elements) => {
  if (!elements) {
    elements = [ document, document.getElementById("canvas") ];
  }
  [ "keydown", "mousedown", "touchstart" ].forEach(event => {
    elements.forEach(element => {
      if (element) {
        listenOnce(element, event, () => {
          if (ctx.state === "suspended") ctx.resume();
        });
      }
    });
  });
};

function _alcCreateContext(deviceId, pAttrList) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(92, 0, 1, deviceId, pAttrList);
  if (!(deviceId in AL.deviceRefCounts)) {
    AL.alcErr = 40961;
    /* ALC_INVALID_DEVICE */ return 0;
  }
  var options = null;
  var attrs = [];
  var hrtf = null;
  pAttrList >>= 2;
  if (pAttrList) {
    var attr = 0;
    var val = 0;
    while (true) {
      attr = GROWABLE_HEAP_I32()[pAttrList++];
      attrs.push(attr);
      if (attr === 0) {
        break;
      }
      val = GROWABLE_HEAP_I32()[pAttrList++];
      attrs.push(val);
      switch (attr) {
       case 4103:
        /* ALC_FREQUENCY */ if (!options) {
          options = {};
        }
        options.sampleRate = val;
        break;

       case 4112:
       // fallthrough
        case 4113:
        // Do nothing; these hints are satisfied by default
        break;

       case 6546:
        /* ALC_HRTF_SOFT */ switch (val) {
         case 0:
          hrtf = false;
          break;

         case 1:
          hrtf = true;
          break;

         case 2:
          /* ALC_DONT_CARE_SOFT */ break;

         default:
          AL.alcErr = 40964;
          return 0;
        }
        break;

       case 6550:
        /* ALC_HRTF_ID_SOFT */ if (val !== 0) {
          AL.alcErr = 40964;
          return 0;
        }
        break;

       default:
        AL.alcErr = 40964;
        /* ALC_INVALID_VALUE */ return 0;
      }
    }
  }
  var AudioContext = window.AudioContext || window.webkitAudioContext;
  var ac = null;
  try {
    // Only try to pass options if there are any, for compat with browsers that don't support this
    if (options) {
      ac = new AudioContext(options);
    } else {
      ac = new AudioContext;
    }
  } catch (e) {
    if (e.name === "NotSupportedError") {
      AL.alcErr = 40964;
    } else /* ALC_INVALID_VALUE */ {
      AL.alcErr = 40961;
    }
    /* ALC_INVALID_DEVICE */ return 0;
  }
  autoResumeAudioContext(ac);
  // Old Web Audio API (e.g. Safari 6.0.5) had an inconsistently named createGainNode function.
  if (typeof ac.createGain == "undefined") {
    ac.createGain = ac.createGainNode;
  }
  var gain = ac.createGain();
  gain.connect(ac.destination);
  var ctx = {
    deviceId,
    id: AL.newId(),
    attrs,
    audioCtx: ac,
    listener: {
      position: [ 0, 0, 0 ],
      velocity: [ 0, 0, 0 ],
      direction: [ 0, 0, 0 ],
      up: [ 0, 0, 0 ]
    },
    sources: [],
    interval: setInterval(() => AL.scheduleContextAudio(ctx), AL.QUEUE_INTERVAL),
    gain,
    distanceModel: 53250,
    /* AL_INVERSE_DISTANCE_CLAMPED */ speedOfSound: 343.3,
    dopplerFactor: 1,
    sourceDistanceModel: false,
    hrtf: hrtf || false,
    _err: 0,
    get err() {
      return this._err;
    },
    set err(val) {
      // Errors should not be overwritten by later errors until they are cleared by a query.
      if (this._err === 0 || val === 0) {
        this._err = val;
      }
    }
  };
  AL.deviceRefCounts[deviceId]++;
  AL.contexts[ctx.id] = ctx;
  if (hrtf !== null) {
    // Apply hrtf attrib to all contexts for this device
    for (var ctxId in AL.contexts) {
      var c = AL.contexts[ctxId];
      if (c.deviceId === deviceId) {
        c.hrtf = hrtf;
        AL.updateContextGlobal(c);
      }
    }
  }
  return ctx.id;
}

function _alcDestroyContext(contextId) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(93, 0, 1, contextId);
  var ctx = AL.contexts[contextId];
  if (AL.currentCtx === ctx) {
    AL.alcErr = 40962;
    /* ALC_INVALID_CONTEXT */ return;
  }
  // Stop playback, etc
  if (AL.contexts[contextId].interval) {
    clearInterval(AL.contexts[contextId].interval);
  }
  AL.deviceRefCounts[ctx.deviceId]--;
  delete AL.contexts[contextId];
  AL.freeIds.push(contextId);
}

function _alcGetIntegerv(deviceId, param, size, pValues) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(94, 0, 1, deviceId, param, size, pValues);
  if (size === 0 || !pValues) {
    // Ignore the query, per the spec
    return;
  }
  switch (param) {
   case 4096:
    /* ALC_MAJOR_VERSION */ GROWABLE_HEAP_I32()[((pValues) >> 2)] = 1;
    checkInt32(1);
    break;

   case 4097:
    /* ALC_MINOR_VERSION */ GROWABLE_HEAP_I32()[((pValues) >> 2)] = 1;
    checkInt32(1);
    break;

   case 4098:
    /* ALC_ATTRIBUTES_SIZE */ if (!(deviceId in AL.deviceRefCounts)) {
      AL.alcErr = 40961;
      return;
    }
    if (!AL.currentCtx) {
      AL.alcErr = 40962;
      /* ALC_INVALID_CONTEXT */ return;
    }
    GROWABLE_HEAP_I32()[((pValues) >> 2)] = AL.currentCtx.attrs.length;
    checkInt32(AL.currentCtx.attrs.length);
    break;

   case 4099:
    /* ALC_ALL_ATTRIBUTES */ if (!(deviceId in AL.deviceRefCounts)) {
      AL.alcErr = 40961;
      return;
    }
    if (!AL.currentCtx) {
      AL.alcErr = 40962;
      /* ALC_INVALID_CONTEXT */ return;
    }
    for (var i = 0; i < AL.currentCtx.attrs.length; i++) {
      GROWABLE_HEAP_I32()[(((pValues) + (i * 4)) >> 2)] = AL.currentCtx.attrs[i];
      checkInt32(AL.currentCtx.attrs[i]);
    }
    break;

   case 4103:
    /* ALC_FREQUENCY */ if (!(deviceId in AL.deviceRefCounts)) {
      AL.alcErr = 40961;
      return;
    }
    if (!AL.currentCtx) {
      AL.alcErr = 40962;
      /* ALC_INVALID_CONTEXT */ return;
    }
    GROWABLE_HEAP_I32()[((pValues) >> 2)] = AL.currentCtx.audioCtx.sampleRate;
    checkInt32(AL.currentCtx.audioCtx.sampleRate);
    break;

   case 4112:
   /* ALC_MONO_SOURCES */ case 4113:
    /* ALC_STEREO_SOURCES */ if (!(deviceId in AL.deviceRefCounts)) {
      AL.alcErr = 40961;
      return;
    }
    if (!AL.currentCtx) {
      AL.alcErr = 40962;
      /* ALC_INVALID_CONTEXT */ return;
    }
    GROWABLE_HEAP_I32()[((pValues) >> 2)] = 2147483647;
    checkInt32(2147483647);
    break;

   case 6546:
   /* ALC_HRTF_SOFT */ case 6547:
    /* ALC_HRTF_STATUS_SOFT */ if (!(deviceId in AL.deviceRefCounts)) {
      AL.alcErr = 40961;
      return;
    }
    var hrtfStatus = 0;
    /* ALC_HRTF_DISABLED_SOFT */ for (var ctxId in AL.contexts) {
      var ctx = AL.contexts[ctxId];
      if (ctx.deviceId === deviceId) {
        hrtfStatus = ctx.hrtf ? 1 : /* ALC_HRTF_ENABLED_SOFT */ 0;
      }
    }
    GROWABLE_HEAP_I32()[((pValues) >> 2)] = hrtfStatus;
    checkInt32(hrtfStatus);
    break;

   case 6548:
    /* ALC_NUM_HRTF_SPECIFIERS_SOFT */ if (!(deviceId in AL.deviceRefCounts)) {
      AL.alcErr = 40961;
      return;
    }
    GROWABLE_HEAP_I32()[((pValues) >> 2)] = 1;
    checkInt32(1);
    break;

   case 131075:
    /* ALC_MAX_AUXILIARY_SENDS */ if (!(deviceId in AL.deviceRefCounts)) {
      AL.alcErr = 40961;
      return;
    }
    if (!AL.currentCtx) {
      AL.alcErr = 40962;
      /* ALC_INVALID_CONTEXT */ return;
    }
    GROWABLE_HEAP_I32()[((pValues) >> 2)] = 1;
    checkInt32(1);

   case 786:
    /* ALC_CAPTURE_SAMPLES */ var c = AL.requireValidCaptureDevice(deviceId, "alcGetIntegerv");
    if (!c) {
      return;
    }
    var n = c.capturedFrameCount;
    var dstfreq = c.requestedSampleRate;
    var srcfreq = c.audioCtx.sampleRate;
    var nsamples = Math.floor(n * (dstfreq / srcfreq));
    GROWABLE_HEAP_I32()[((pValues) >> 2)] = nsamples;
    checkInt32(nsamples);
    break;

   default:
    AL.alcErr = 40963;
    return;
  }
}

function _alcGetString(deviceId, param) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(95, 0, 1, deviceId, param);
  if (AL.alcStringCache[param]) {
    return AL.alcStringCache[param];
  }
  var ret;
  switch (param) {
   case 0:
    ret = "No Error";
    break;

   case 40961:
    ret = "Invalid Device";
    break;

   case 40962:
    /* ALC_INVALID_CONTEXT */ ret = "Invalid Context";
    break;

   case 40963:
    ret = "Invalid Enum";
    break;

   case 40964:
    ret = "Invalid Value";
    break;

   case 40965:
    /* ALC_OUT_OF_MEMORY */ ret = "Out of Memory";
    break;

   case 4100:
    /* ALC_DEFAULT_DEVICE_SPECIFIER */ if (typeof AudioContext != "undefined" || typeof webkitAudioContext != "undefined") {
      ret = AL.DEVICE_NAME;
    } else {
      return 0;
    }
    break;

   case 4101:
    /* ALC_DEVICE_SPECIFIER */ if (typeof AudioContext != "undefined" || typeof webkitAudioContext != "undefined") {
      ret = AL.DEVICE_NAME + "\0";
    } else {
      ret = "\0";
    }
    break;

   case 785:
    /* ALC_CAPTURE_DEFAULT_DEVICE_SPECIFIER */ ret = AL.CAPTURE_DEVICE_NAME;
    break;

   case 784:
    /* ALC_CAPTURE_DEVICE_SPECIFIER */ if (deviceId === 0) {
      ret = AL.CAPTURE_DEVICE_NAME + "\0";
    } else {
      var c = AL.requireValidCaptureDevice(deviceId, "alcGetString");
      if (!c) {
        return 0;
      }
      ret = c.deviceName;
    }
    break;

   case 4102:
    /* ALC_EXTENSIONS */ if (!deviceId) {
      AL.alcErr = 40961;
      return 0;
    }
    ret = Object.keys(AL.ALC_EXTENSIONS).join(" ");
    break;

   default:
    AL.alcErr = 40963;
    return 0;
  }
  ret = stringToNewUTF8(ret);
  AL.alcStringCache[param] = ret;
  return ret;
}

function _alcIsExtensionPresent(deviceId, pExtName) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(96, 0, 1, deviceId, pExtName);
  var name = UTF8ToString(pExtName);
  return AL.ALC_EXTENSIONS[name] ? 1 : 0;
}

function _alcMakeContextCurrent(contextId) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(97, 0, 1, contextId);
  if (contextId === 0) {
    AL.currentCtx = null;
  } else {
    AL.currentCtx = AL.contexts[contextId];
  }
  return 1;
}

function _alcOpenDevice(pDeviceName) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(98, 0, 1, pDeviceName);
  if (pDeviceName) {
    var name = UTF8ToString(pDeviceName);
    if (name !== AL.DEVICE_NAME) {
      return 0;
    }
  }
  if (typeof AudioContext != "undefined" || typeof webkitAudioContext != "undefined") {
    var deviceId = AL.newId();
    AL.deviceRefCounts[deviceId] = 0;
    return deviceId;
  }
  return 0;
}

var _alcSuspendContext = contextId => {};

var _emscripten_date_now = () => Date.now();

var nowIsMonotonic = 1;

var checkWasiClock = clock_id => clock_id >= 0 && clock_id <= 3;

function _clock_time_get(clk_id, ignored_precision_low, ignored_precision_high, ptime) {
  var ignored_precision = convertI32PairToI53Checked(ignored_precision_low, ignored_precision_high);
  if (!checkWasiClock(clk_id)) {
    return 28;
  }
  var now;
  // all wasi clocks but realtime are monotonic
  if (clk_id === 0) {
    now = _emscripten_date_now();
  } else if (nowIsMonotonic) {
    now = _emscripten_get_now();
  } else {
    return 52;
  }
  // "now" is in ms, and wasi times are in ns.
  var nsec = Math.round(now * 1e3 * 1e3);
  (tempI64 = [ nsec >>> 0, (tempDouble = nsec, (+(Math.abs(tempDouble))) >= 1 ? (tempDouble > 0 ? (+(Math.floor((tempDouble) / 4294967296))) >>> 0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble))) >>> 0)) / 4294967296))))) >>> 0) : 0) ], 
  GROWABLE_HEAP_I32()[((ptime) >> 2)] = tempI64[0], GROWABLE_HEAP_I32()[(((ptime) + (4)) >> 2)] = tempI64[1]);
  checkInt64(nsec);
  return 0;
}

var readEmAsmArgsArray = [];

var readEmAsmArgs = (sigPtr, buf) => {
  // Nobody should have mutated _readEmAsmArgsArray underneath us to be something else than an array.
  assert(Array.isArray(readEmAsmArgsArray));
  // The input buffer is allocated on the stack, so it must be stack-aligned.
  assert(buf % 16 == 0);
  readEmAsmArgsArray.length = 0;
  var ch;
  // Most arguments are i32s, so shift the buffer pointer so it is a plain
  // index into HEAP32.
  while (ch = GROWABLE_HEAP_U8()[sigPtr++]) {
    var chr = String.fromCharCode(ch);
    var validChars = [ "d", "f", "i", "p" ];
    assert(validChars.includes(chr), `Invalid character ${ch}("${chr}") in readEmAsmArgs! Use only [${validChars}], and do not specify "v" for void return argument.`);
    // Floats are always passed as doubles, so all types except for 'i'
    // are 8 bytes and require alignment.
    var wide = (ch != 105);
    wide &= (ch != 112);
    buf += wide && (buf % 8) ? 4 : 0;
    readEmAsmArgsArray.push(// Special case for pointers under wasm64 or CAN_ADDRESS_2GB mode.
    ch == 112 ? GROWABLE_HEAP_U32()[((buf) >> 2)] : ch == 105 ? GROWABLE_HEAP_I32()[((buf) >> 2)] : GROWABLE_HEAP_F64()[((buf) >> 3)]);
    buf += wide ? 8 : 4;
  }
  return readEmAsmArgsArray;
};

var runEmAsmFunction = (code, sigPtr, argbuf) => {
  var args = readEmAsmArgs(sigPtr, argbuf);
  assert(ASM_CONSTS.hasOwnProperty(code), `No EM_ASM constant found at address ${code}.  The loaded WebAssembly file is likely out of sync with the generated JavaScript.`);
  return ASM_CONSTS[code](...args);
};

var _emscripten_asm_const_int = (code, sigPtr, argbuf) => runEmAsmFunction(code, sigPtr, argbuf);

var _emscripten_cancel_main_loop = () => {
  MainLoop.pause();
  MainLoop.func = null;
};

var _emscripten_check_blocking_allowed = () => {
  if (ENVIRONMENT_IS_NODE) return;
  if (ENVIRONMENT_IS_WORKER) return;
  // Blocking in a worker/pthread is fine.
  warnOnce("Blocking on the main thread is very dangerous, see https://emscripten.org/docs/porting/pthreads.html#blocking-on-the-main-browser-thread");
};

var _emscripten_err = str => err(UTF8ToString(str));

var _emscripten_exit_with_live_runtime = () => {
  runtimeKeepalivePush();
  throw "unwind";
};

var GLctx;

var webgl_enable_WEBGL_draw_instanced_base_vertex_base_instance = ctx => // Closure is expected to be allowed to minify the '.dibvbi' property, so not accessing it quoted.
!!(ctx.dibvbi = ctx.getExtension("WEBGL_draw_instanced_base_vertex_base_instance"));

var webgl_enable_WEBGL_multi_draw_instanced_base_vertex_base_instance = ctx => !!(ctx.mdibvbi = ctx.getExtension("WEBGL_multi_draw_instanced_base_vertex_base_instance"));

var webgl_enable_EXT_polygon_offset_clamp = ctx => !!(ctx.extPolygonOffsetClamp = ctx.getExtension("EXT_polygon_offset_clamp"));

var webgl_enable_EXT_clip_control = ctx => !!(ctx.extClipControl = ctx.getExtension("EXT_clip_control"));

var webgl_enable_WEBGL_polygon_mode = ctx => !!(ctx.webglPolygonMode = ctx.getExtension("WEBGL_polygon_mode"));

var webgl_enable_WEBGL_multi_draw = ctx => // Closure is expected to be allowed to minify the '.multiDrawWebgl' property, so not accessing it quoted.
!!(ctx.multiDrawWebgl = ctx.getExtension("WEBGL_multi_draw"));

var getEmscriptenSupportedExtensions = ctx => {
  // Restrict the list of advertised extensions to those that we actually
  // support.
  var supportedExtensions = [ // WebGL 2 extensions
  "EXT_color_buffer_float", "EXT_conservative_depth", "EXT_disjoint_timer_query_webgl2", "EXT_texture_norm16", "NV_shader_noperspective_interpolation", "WEBGL_clip_cull_distance", // WebGL 1 and WebGL 2 extensions
  "EXT_clip_control", "EXT_color_buffer_half_float", "EXT_depth_clamp", "EXT_float_blend", "EXT_polygon_offset_clamp", "EXT_texture_compression_bptc", "EXT_texture_compression_rgtc", "EXT_texture_filter_anisotropic", "KHR_parallel_shader_compile", "OES_texture_float_linear", "WEBGL_blend_func_extended", "WEBGL_compressed_texture_astc", "WEBGL_compressed_texture_etc", "WEBGL_compressed_texture_etc1", "WEBGL_compressed_texture_s3tc", "WEBGL_compressed_texture_s3tc_srgb", "WEBGL_debug_renderer_info", "WEBGL_debug_shaders", "WEBGL_lose_context", "WEBGL_multi_draw", "WEBGL_polygon_mode" ];
  // .getSupportedExtensions() can return null if context is lost, so coerce to empty array.
  return (ctx.getSupportedExtensions() || []).filter(ext => supportedExtensions.includes(ext));
};

var GL = {
  counter: 1,
  buffers: [],
  programs: [],
  framebuffers: [],
  renderbuffers: [],
  textures: [],
  shaders: [],
  vaos: [],
  contexts: {},
  offscreenCanvases: {},
  queries: [],
  samplers: [],
  transformFeedbacks: [],
  syncs: [],
  stringCache: {},
  stringiCache: {},
  unpackAlignment: 4,
  unpackRowLength: 0,
  recordError: errorCode => {
    if (!GL.lastError) {
      GL.lastError = errorCode;
    }
  },
  getNewId: table => {
    var ret = GL.counter++;
    for (var i = table.length; i < ret; i++) {
      table[i] = null;
    }
    return ret;
  },
  genObject: (n, buffers, createFunction, objectTable) => {
    for (var i = 0; i < n; i++) {
      var buffer = GLctx[createFunction]();
      var id = buffer && GL.getNewId(objectTable);
      if (buffer) {
        buffer.name = id;
        objectTable[id] = buffer;
      } else {
        GL.recordError(1282);
      }
      GROWABLE_HEAP_I32()[(((buffers) + (i * 4)) >> 2)] = id;
      checkInt32(id);
    }
  },
  getSource: (shader, count, string, length) => {
    var source = "";
    for (var i = 0; i < count; ++i) {
      var len = length ? GROWABLE_HEAP_U32()[(((length) + (i * 4)) >> 2)] : undefined;
      source += UTF8ToString(GROWABLE_HEAP_U32()[(((string) + (i * 4)) >> 2)], len);
    }
    return source;
  },
  createContext: (/** @type {HTMLCanvasElement} */ canvas, webGLContextAttributes) => {
    // BUG: Workaround Safari WebGL issue: After successfully acquiring WebGL
    // context on a canvas, calling .getContext() will always return that
    // context independent of which 'webgl' or 'webgl2'
    // context version was passed. See:
    //   https://bugs.webkit.org/show_bug.cgi?id=222758
    // and:
    //   https://github.com/emscripten-core/emscripten/issues/13295.
    // TODO: Once the bug is fixed and shipped in Safari, adjust the Safari
    // version field in above check.
    if (!canvas.getContextSafariWebGL2Fixed) {
      canvas.getContextSafariWebGL2Fixed = canvas.getContext;
      /** @type {function(this:HTMLCanvasElement, string, (Object|null)=): (Object|null)} */ function fixedGetContext(ver, attrs) {
        var gl = canvas.getContextSafariWebGL2Fixed(ver, attrs);
        return ((ver == "webgl") == (gl instanceof WebGLRenderingContext)) ? gl : null;
      }
      canvas.getContext = fixedGetContext;
    }
    var ctx = canvas.getContext("webgl2", webGLContextAttributes);
    if (!ctx) return 0;
    var handle = GL.registerContext(ctx, webGLContextAttributes);
    return handle;
  },
  registerContext: (ctx, webGLContextAttributes) => {
    // with pthreads a context is a location in memory with some synchronized
    // data between threads
    var handle = _malloc(8);
    GROWABLE_HEAP_U32()[(((handle) + (4)) >> 2)] = _pthread_self();
    // the thread pointer of the thread that owns the control of the context
    var context = {
      handle,
      attributes: webGLContextAttributes,
      version: webGLContextAttributes.majorVersion,
      GLctx: ctx
    };
    // Store the created context object so that we can access the context
    // given a canvas without having to pass the parameters again.
    if (ctx.canvas) ctx.canvas.GLctxObject = context;
    GL.contexts[handle] = context;
    if (typeof webGLContextAttributes.enableExtensionsByDefault == "undefined" || webGLContextAttributes.enableExtensionsByDefault) {
      GL.initExtensions(context);
    }
    return handle;
  },
  makeContextCurrent: contextHandle => {
    // Active Emscripten GL layer context object.
    GL.currentContext = GL.contexts[contextHandle];
    // Active WebGL context object.
    Module["ctx"] = GLctx = GL.currentContext?.GLctx;
    return !(contextHandle && !GLctx);
  },
  getContext: contextHandle => GL.contexts[contextHandle],
  deleteContext: contextHandle => {
    if (GL.currentContext === GL.contexts[contextHandle]) {
      GL.currentContext = null;
    }
    if (typeof JSEvents == "object") {
      // Release all JS event handlers on the DOM element that the GL context is
      // associated with since the context is now deleted.
      JSEvents.removeAllHandlersOnTarget(GL.contexts[contextHandle].GLctx.canvas);
    }
    // Make sure the canvas object no longer refers to the context object so
    // there are no GC surprises.
    if (GL.contexts[contextHandle] && GL.contexts[contextHandle].GLctx.canvas) {
      GL.contexts[contextHandle].GLctx.canvas.GLctxObject = undefined;
    }
    _free(GL.contexts[contextHandle].handle);
    GL.contexts[contextHandle] = null;
  },
  initExtensions: context => {
    // If this function is called without a specific context object, init the
    // extensions of the currently active context.
    context ||= GL.currentContext;
    if (context.initExtensionsDone) return;
    context.initExtensionsDone = true;
    var GLctx = context.GLctx;
    // Detect the presence of a few extensions manually, ction GL interop
    // layer itself will need to know if they exist.
    // Extensions that are available in both WebGL 1 and WebGL 2
    webgl_enable_WEBGL_multi_draw(GLctx);
    webgl_enable_EXT_polygon_offset_clamp(GLctx);
    webgl_enable_EXT_clip_control(GLctx);
    webgl_enable_WEBGL_polygon_mode(GLctx);
    // Extensions that are available from WebGL >= 2 (no-op if called on a WebGL 1 context active)
    webgl_enable_WEBGL_draw_instanced_base_vertex_base_instance(GLctx);
    webgl_enable_WEBGL_multi_draw_instanced_base_vertex_base_instance(GLctx);
    // On WebGL 2, EXT_disjoint_timer_query is replaced with an alternative
    // that's based on core APIs, and exposes only the queryCounterEXT()
    // entrypoint.
    if (context.version >= 2) {
      GLctx.disjointTimerQueryExt = GLctx.getExtension("EXT_disjoint_timer_query_webgl2");
    }
    // However, Firefox exposes the WebGL 1 version on WebGL 2 as well and
    // thus we look for the WebGL 1 version again if the WebGL 2 version
    // isn't present. https://bugzilla.mozilla.org/show_bug.cgi?id=1328882
    if (context.version < 2 || !GLctx.disjointTimerQueryExt) {
      GLctx.disjointTimerQueryExt = GLctx.getExtension("EXT_disjoint_timer_query");
    }
    getEmscriptenSupportedExtensions(GLctx).forEach(ext => {
      // WEBGL_lose_context, WEBGL_debug_renderer_info and WEBGL_debug_shaders
      // are not enabled by default.
      if (!ext.includes("lose_context") && !ext.includes("debug")) {
        // Call .getExtension() to enable that extension permanently.
        GLctx.getExtension(ext);
      }
    });
  }
};

/** @suppress {duplicate } */ var _glActiveTexture = x0 => GLctx.activeTexture(x0);

var _emscripten_glActiveTexture = _glActiveTexture;

/** @suppress {duplicate } */ var _glAttachShader = (program, shader) => {
  GLctx.attachShader(GL.programs[program], GL.shaders[shader]);
};

var _emscripten_glAttachShader = _glAttachShader;

/** @suppress {duplicate } */ var _glBeginQuery = (target, id) => {
  GLctx.beginQuery(target, GL.queries[id]);
};

var _emscripten_glBeginQuery = _glBeginQuery;

/** @suppress {duplicate } */ var _glBeginQueryEXT = (target, id) => {
  GLctx.disjointTimerQueryExt["beginQueryEXT"](target, GL.queries[id]);
};

var _emscripten_glBeginQueryEXT = _glBeginQueryEXT;

/** @suppress {duplicate } */ var _glBeginTransformFeedback = x0 => GLctx.beginTransformFeedback(x0);

var _emscripten_glBeginTransformFeedback = _glBeginTransformFeedback;

/** @suppress {duplicate } */ var _glBindAttribLocation = (program, index, name) => {
  GLctx.bindAttribLocation(GL.programs[program], index, UTF8ToString(name));
};

var _emscripten_glBindAttribLocation = _glBindAttribLocation;

/** @suppress {duplicate } */ var _glBindBuffer = (target, buffer) => {
  if (target == 35051) /*GL_PIXEL_PACK_BUFFER*/ {
    // In WebGL 2 glReadPixels entry point, we need to use a different WebGL 2
    // API function call when a buffer is bound to
    // GL_PIXEL_PACK_BUFFER_BINDING point, so must keep track whether that
    // binding point is non-null to know what is the proper API function to
    // call.
    GLctx.currentPixelPackBufferBinding = buffer;
  } else if (target == 35052) /*GL_PIXEL_UNPACK_BUFFER*/ {
    // In WebGL 2 gl(Compressed)Tex(Sub)Image[23]D entry points, we need to
    // use a different WebGL 2 API function call when a buffer is bound to
    // GL_PIXEL_UNPACK_BUFFER_BINDING point, so must keep track whether that
    // binding point is non-null to know what is the proper API function to
    // call.
    GLctx.currentPixelUnpackBufferBinding = buffer;
  }
  GLctx.bindBuffer(target, GL.buffers[buffer]);
};

var _emscripten_glBindBuffer = _glBindBuffer;

/** @suppress {duplicate } */ var _glBindBufferBase = (target, index, buffer) => {
  GLctx.bindBufferBase(target, index, GL.buffers[buffer]);
};

var _emscripten_glBindBufferBase = _glBindBufferBase;

/** @suppress {duplicate } */ var _glBindBufferRange = (target, index, buffer, offset, ptrsize) => {
  GLctx.bindBufferRange(target, index, GL.buffers[buffer], offset, ptrsize);
};

var _emscripten_glBindBufferRange = _glBindBufferRange;

/** @suppress {duplicate } */ var _glBindFramebuffer = (target, framebuffer) => {
  GLctx.bindFramebuffer(target, GL.framebuffers[framebuffer]);
};

var _emscripten_glBindFramebuffer = _glBindFramebuffer;

/** @suppress {duplicate } */ var _glBindRenderbuffer = (target, renderbuffer) => {
  GLctx.bindRenderbuffer(target, GL.renderbuffers[renderbuffer]);
};

var _emscripten_glBindRenderbuffer = _glBindRenderbuffer;

/** @suppress {duplicate } */ var _glBindSampler = (unit, sampler) => {
  GLctx.bindSampler(unit, GL.samplers[sampler]);
};

var _emscripten_glBindSampler = _glBindSampler;

/** @suppress {duplicate } */ var _glBindTexture = (target, texture) => {
  GLctx.bindTexture(target, GL.textures[texture]);
};

var _emscripten_glBindTexture = _glBindTexture;

/** @suppress {duplicate } */ var _glBindTransformFeedback = (target, id) => {
  GLctx.bindTransformFeedback(target, GL.transformFeedbacks[id]);
};

var _emscripten_glBindTransformFeedback = _glBindTransformFeedback;

/** @suppress {duplicate } */ var _glBindVertexArray = vao => {
  GLctx.bindVertexArray(GL.vaos[vao]);
};

var _emscripten_glBindVertexArray = _glBindVertexArray;

/** @suppress {duplicate } */ var _glBindVertexArrayOES = _glBindVertexArray;

var _emscripten_glBindVertexArrayOES = _glBindVertexArrayOES;

/** @suppress {duplicate } */ var _glBlendColor = (x0, x1, x2, x3) => GLctx.blendColor(x0, x1, x2, x3);

var _emscripten_glBlendColor = _glBlendColor;

/** @suppress {duplicate } */ var _glBlendEquation = x0 => GLctx.blendEquation(x0);

var _emscripten_glBlendEquation = _glBlendEquation;

/** @suppress {duplicate } */ var _glBlendEquationSeparate = (x0, x1) => GLctx.blendEquationSeparate(x0, x1);

var _emscripten_glBlendEquationSeparate = _glBlendEquationSeparate;

/** @suppress {duplicate } */ var _glBlendFunc = (x0, x1) => GLctx.blendFunc(x0, x1);

var _emscripten_glBlendFunc = _glBlendFunc;

/** @suppress {duplicate } */ var _glBlendFuncSeparate = (x0, x1, x2, x3) => GLctx.blendFuncSeparate(x0, x1, x2, x3);

var _emscripten_glBlendFuncSeparate = _glBlendFuncSeparate;

/** @suppress {duplicate } */ var _glBlitFramebuffer = (x0, x1, x2, x3, x4, x5, x6, x7, x8, x9) => GLctx.blitFramebuffer(x0, x1, x2, x3, x4, x5, x6, x7, x8, x9);

var _emscripten_glBlitFramebuffer = _glBlitFramebuffer;

/** @suppress {duplicate } */ var _glBufferData = (target, size, data, usage) => {
  if (true) {
    // If size is zero, WebGL would interpret uploading the whole input
    // arraybuffer (starting from given offset), which would not make sense in
    // WebAssembly, so avoid uploading if size is zero. However we must still
    // call bufferData to establish a backing storage of zero bytes.
    if (data && size) {
      GLctx.bufferData(target, GROWABLE_HEAP_U8(), usage, data, size);
    } else {
      GLctx.bufferData(target, size, usage);
    }
    return;
  }
};

var _emscripten_glBufferData = _glBufferData;

/** @suppress {duplicate } */ var _glBufferSubData = (target, offset, size, data) => {
  if (true) {
    size && GLctx.bufferSubData(target, offset, GROWABLE_HEAP_U8(), data, size);
    return;
  }
};

var _emscripten_glBufferSubData = _glBufferSubData;

/** @suppress {duplicate } */ var _glCheckFramebufferStatus = x0 => GLctx.checkFramebufferStatus(x0);

var _emscripten_glCheckFramebufferStatus = _glCheckFramebufferStatus;

/** @suppress {duplicate } */ var _glClear = x0 => GLctx.clear(x0);

var _emscripten_glClear = _glClear;

/** @suppress {duplicate } */ var _glClearBufferfi = (x0, x1, x2, x3) => GLctx.clearBufferfi(x0, x1, x2, x3);

var _emscripten_glClearBufferfi = _glClearBufferfi;

/** @suppress {duplicate } */ var _glClearBufferfv = (buffer, drawbuffer, value) => {
  GLctx.clearBufferfv(buffer, drawbuffer, GROWABLE_HEAP_F32(), ((value) >> 2));
};

var _emscripten_glClearBufferfv = _glClearBufferfv;

/** @suppress {duplicate } */ var _glClearBufferiv = (buffer, drawbuffer, value) => {
  GLctx.clearBufferiv(buffer, drawbuffer, GROWABLE_HEAP_I32(), ((value) >> 2));
};

var _emscripten_glClearBufferiv = _glClearBufferiv;

/** @suppress {duplicate } */ var _glClearBufferuiv = (buffer, drawbuffer, value) => {
  GLctx.clearBufferuiv(buffer, drawbuffer, GROWABLE_HEAP_U32(), ((value) >> 2));
};

var _emscripten_glClearBufferuiv = _glClearBufferuiv;

/** @suppress {duplicate } */ var _glClearColor = (x0, x1, x2, x3) => GLctx.clearColor(x0, x1, x2, x3);

var _emscripten_glClearColor = _glClearColor;

/** @suppress {duplicate } */ var _glClearDepthf = x0 => GLctx.clearDepth(x0);

var _emscripten_glClearDepthf = _glClearDepthf;

/** @suppress {duplicate } */ var _glClearStencil = x0 => GLctx.clearStencil(x0);

var _emscripten_glClearStencil = _glClearStencil;

var convertI32PairToI53 = (lo, hi) => {
  // This function should not be getting called with too large unsigned numbers
  // in high part (if hi >= 0x7FFFFFFFF, one should have been calling
  // convertU32PairToI53())
  assert(hi === (hi | 0));
  return (lo >>> 0) + hi * 4294967296;
};

/** @suppress {duplicate } */ var _glClientWaitSync = (sync, flags, timeout_low, timeout_high) => {
  // WebGL2 vs GLES3 differences: in GLES3, the timeout parameter is a uint64, where 0xFFFFFFFFFFFFFFFFULL means GL_TIMEOUT_IGNORED.
  // In JS, there's no 64-bit value types, so instead timeout is taken to be signed, and GL_TIMEOUT_IGNORED is given value -1.
  // Inherently the value accepted in the timeout is lossy, and can't take in arbitrary u64 bit pattern (but most likely doesn't matter)
  // See https://www.khronos.org/registry/webgl/specs/latest/2.0/#5.15
  var timeout = convertI32PairToI53(timeout_low, timeout_high);
  return GLctx.clientWaitSync(GL.syncs[sync], flags, timeout);
};

var _emscripten_glClientWaitSync = _glClientWaitSync;

/** @suppress {duplicate } */ var _glClipControlEXT = (origin, depth) => {
  GLctx.extClipControl["clipControlEXT"](origin, depth);
};

var _emscripten_glClipControlEXT = _glClipControlEXT;

/** @suppress {duplicate } */ var _glColorMask = (red, green, blue, alpha) => {
  GLctx.colorMask(!!red, !!green, !!blue, !!alpha);
};

var _emscripten_glColorMask = _glColorMask;

/** @suppress {duplicate } */ var _glCompileShader = shader => {
  GLctx.compileShader(GL.shaders[shader]);
};

var _emscripten_glCompileShader = _glCompileShader;

/** @suppress {duplicate } */ var _glCompressedTexImage2D = (target, level, internalFormat, width, height, border, imageSize, data) => {
  // `data` may be null here, which means "allocate uniniitalized space but
  // don't upload" in GLES parlance, but `compressedTexImage2D` requires the
  // final data parameter, so we simply pass a heap view starting at zero
  // effectively uploading whatever happens to be near address zero.  See
  // https://github.com/emscripten-core/emscripten/issues/19300.
  if (true) {
    if (GLctx.currentPixelUnpackBufferBinding || !imageSize) {
      GLctx.compressedTexImage2D(target, level, internalFormat, width, height, border, imageSize, data);
      return;
    }
    GLctx.compressedTexImage2D(target, level, internalFormat, width, height, border, GROWABLE_HEAP_U8(), data, imageSize);
    return;
  }
};

var _emscripten_glCompressedTexImage2D = _glCompressedTexImage2D;

/** @suppress {duplicate } */ var _glCompressedTexImage3D = (target, level, internalFormat, width, height, depth, border, imageSize, data) => {
  if (GLctx.currentPixelUnpackBufferBinding) {
    GLctx.compressedTexImage3D(target, level, internalFormat, width, height, depth, border, imageSize, data);
  } else {
    GLctx.compressedTexImage3D(target, level, internalFormat, width, height, depth, border, GROWABLE_HEAP_U8(), data, imageSize);
  }
};

var _emscripten_glCompressedTexImage3D = _glCompressedTexImage3D;

/** @suppress {duplicate } */ var _glCompressedTexSubImage2D = (target, level, xoffset, yoffset, width, height, format, imageSize, data) => {
  if (true) {
    if (GLctx.currentPixelUnpackBufferBinding || !imageSize) {
      GLctx.compressedTexSubImage2D(target, level, xoffset, yoffset, width, height, format, imageSize, data);
      return;
    }
    GLctx.compressedTexSubImage2D(target, level, xoffset, yoffset, width, height, format, GROWABLE_HEAP_U8(), data, imageSize);
    return;
  }
};

var _emscripten_glCompressedTexSubImage2D = _glCompressedTexSubImage2D;

/** @suppress {duplicate } */ var _glCompressedTexSubImage3D = (target, level, xoffset, yoffset, zoffset, width, height, depth, format, imageSize, data) => {
  if (GLctx.currentPixelUnpackBufferBinding) {
    GLctx.compressedTexSubImage3D(target, level, xoffset, yoffset, zoffset, width, height, depth, format, imageSize, data);
  } else {
    GLctx.compressedTexSubImage3D(target, level, xoffset, yoffset, zoffset, width, height, depth, format, GROWABLE_HEAP_U8(), data, imageSize);
  }
};

var _emscripten_glCompressedTexSubImage3D = _glCompressedTexSubImage3D;

/** @suppress {duplicate } */ var _glCopyBufferSubData = (x0, x1, x2, x3, x4) => GLctx.copyBufferSubData(x0, x1, x2, x3, x4);

var _emscripten_glCopyBufferSubData = _glCopyBufferSubData;

/** @suppress {duplicate } */ var _glCopyTexImage2D = (x0, x1, x2, x3, x4, x5, x6, x7) => GLctx.copyTexImage2D(x0, x1, x2, x3, x4, x5, x6, x7);

var _emscripten_glCopyTexImage2D = _glCopyTexImage2D;

/** @suppress {duplicate } */ var _glCopyTexSubImage2D = (x0, x1, x2, x3, x4, x5, x6, x7) => GLctx.copyTexSubImage2D(x0, x1, x2, x3, x4, x5, x6, x7);

var _emscripten_glCopyTexSubImage2D = _glCopyTexSubImage2D;

/** @suppress {duplicate } */ var _glCopyTexSubImage3D = (x0, x1, x2, x3, x4, x5, x6, x7, x8) => GLctx.copyTexSubImage3D(x0, x1, x2, x3, x4, x5, x6, x7, x8);

var _emscripten_glCopyTexSubImage3D = _glCopyTexSubImage3D;

/** @suppress {duplicate } */ var _glCreateProgram = () => {
  var id = GL.getNewId(GL.programs);
  var program = GLctx.createProgram();
  // Store additional information needed for each shader program:
  program.name = id;
  // Lazy cache results of
  // glGetProgramiv(GL_ACTIVE_UNIFORM_MAX_LENGTH/GL_ACTIVE_ATTRIBUTE_MAX_LENGTH/GL_ACTIVE_UNIFORM_BLOCK_MAX_NAME_LENGTH)
  program.maxUniformLength = program.maxAttributeLength = program.maxUniformBlockNameLength = 0;
  program.uniformIdCounter = 1;
  GL.programs[id] = program;
  return id;
};

var _emscripten_glCreateProgram = _glCreateProgram;

/** @suppress {duplicate } */ var _glCreateShader = shaderType => {
  var id = GL.getNewId(GL.shaders);
  GL.shaders[id] = GLctx.createShader(shaderType);
  return id;
};

var _emscripten_glCreateShader = _glCreateShader;

/** @suppress {duplicate } */ var _glCullFace = x0 => GLctx.cullFace(x0);

var _emscripten_glCullFace = _glCullFace;

/** @suppress {duplicate } */ var _glDeleteBuffers = (n, buffers) => {
  for (var i = 0; i < n; i++) {
    var id = GROWABLE_HEAP_I32()[(((buffers) + (i * 4)) >> 2)];
    var buffer = GL.buffers[id];
    // From spec: "glDeleteBuffers silently ignores 0's and names that do not
    // correspond to existing buffer objects."
    if (!buffer) continue;
    GLctx.deleteBuffer(buffer);
    buffer.name = 0;
    GL.buffers[id] = null;
    if (id == GLctx.currentPixelPackBufferBinding) GLctx.currentPixelPackBufferBinding = 0;
    if (id == GLctx.currentPixelUnpackBufferBinding) GLctx.currentPixelUnpackBufferBinding = 0;
  }
};

var _emscripten_glDeleteBuffers = _glDeleteBuffers;

/** @suppress {duplicate } */ var _glDeleteFramebuffers = (n, framebuffers) => {
  for (var i = 0; i < n; ++i) {
    var id = GROWABLE_HEAP_I32()[(((framebuffers) + (i * 4)) >> 2)];
    var framebuffer = GL.framebuffers[id];
    if (!framebuffer) continue;
    // GL spec: "glDeleteFramebuffers silently ignores 0s and names that do not correspond to existing framebuffer objects".
    GLctx.deleteFramebuffer(framebuffer);
    framebuffer.name = 0;
    GL.framebuffers[id] = null;
  }
};

var _emscripten_glDeleteFramebuffers = _glDeleteFramebuffers;

/** @suppress {duplicate } */ var _glDeleteProgram = id => {
  if (!id) return;
  var program = GL.programs[id];
  if (!program) {
    // glDeleteProgram actually signals an error when deleting a nonexisting
    // object, unlike some other GL delete functions.
    GL.recordError(1281);
    /* GL_INVALID_VALUE */ return;
  }
  GLctx.deleteProgram(program);
  program.name = 0;
  GL.programs[id] = null;
};

var _emscripten_glDeleteProgram = _glDeleteProgram;

/** @suppress {duplicate } */ var _glDeleteQueries = (n, ids) => {
  for (var i = 0; i < n; i++) {
    var id = GROWABLE_HEAP_I32()[(((ids) + (i * 4)) >> 2)];
    var query = GL.queries[id];
    if (!query) continue;
    // GL spec: "unused names in ids are ignored, as is the name zero."
    GLctx.deleteQuery(query);
    GL.queries[id] = null;
  }
};

var _emscripten_glDeleteQueries = _glDeleteQueries;

/** @suppress {duplicate } */ var _glDeleteQueriesEXT = (n, ids) => {
  for (var i = 0; i < n; i++) {
    var id = GROWABLE_HEAP_I32()[(((ids) + (i * 4)) >> 2)];
    var query = GL.queries[id];
    if (!query) continue;
    // GL spec: "unused names in ids are ignored, as is the name zero."
    GLctx.disjointTimerQueryExt["deleteQueryEXT"](query);
    GL.queries[id] = null;
  }
};

var _emscripten_glDeleteQueriesEXT = _glDeleteQueriesEXT;

/** @suppress {duplicate } */ var _glDeleteRenderbuffers = (n, renderbuffers) => {
  for (var i = 0; i < n; i++) {
    var id = GROWABLE_HEAP_I32()[(((renderbuffers) + (i * 4)) >> 2)];
    var renderbuffer = GL.renderbuffers[id];
    if (!renderbuffer) continue;
    // GL spec: "glDeleteRenderbuffers silently ignores 0s and names that do not correspond to existing renderbuffer objects".
    GLctx.deleteRenderbuffer(renderbuffer);
    renderbuffer.name = 0;
    GL.renderbuffers[id] = null;
  }
};

var _emscripten_glDeleteRenderbuffers = _glDeleteRenderbuffers;

/** @suppress {duplicate } */ var _glDeleteSamplers = (n, samplers) => {
  for (var i = 0; i < n; i++) {
    var id = GROWABLE_HEAP_I32()[(((samplers) + (i * 4)) >> 2)];
    var sampler = GL.samplers[id];
    if (!sampler) continue;
    GLctx.deleteSampler(sampler);
    sampler.name = 0;
    GL.samplers[id] = null;
  }
};

var _emscripten_glDeleteSamplers = _glDeleteSamplers;

/** @suppress {duplicate } */ var _glDeleteShader = id => {
  if (!id) return;
  var shader = GL.shaders[id];
  if (!shader) {
    // glDeleteShader actually signals an error when deleting a nonexisting
    // object, unlike some other GL delete functions.
    GL.recordError(1281);
    /* GL_INVALID_VALUE */ return;
  }
  GLctx.deleteShader(shader);
  GL.shaders[id] = null;
};

var _emscripten_glDeleteShader = _glDeleteShader;

/** @suppress {duplicate } */ var _glDeleteSync = id => {
  if (!id) return;
  var sync = GL.syncs[id];
  if (!sync) {
    // glDeleteSync signals an error when deleting a nonexisting object, unlike some other GL delete functions.
    GL.recordError(1281);
    /* GL_INVALID_VALUE */ return;
  }
  GLctx.deleteSync(sync);
  sync.name = 0;
  GL.syncs[id] = null;
};

var _emscripten_glDeleteSync = _glDeleteSync;

/** @suppress {duplicate } */ var _glDeleteTextures = (n, textures) => {
  for (var i = 0; i < n; i++) {
    var id = GROWABLE_HEAP_I32()[(((textures) + (i * 4)) >> 2)];
    var texture = GL.textures[id];
    // GL spec: "glDeleteTextures silently ignores 0s and names that do not
    // correspond to existing textures".
    if (!texture) continue;
    GLctx.deleteTexture(texture);
    texture.name = 0;
    GL.textures[id] = null;
  }
};

var _emscripten_glDeleteTextures = _glDeleteTextures;

/** @suppress {duplicate } */ var _glDeleteTransformFeedbacks = (n, ids) => {
  for (var i = 0; i < n; i++) {
    var id = GROWABLE_HEAP_I32()[(((ids) + (i * 4)) >> 2)];
    var transformFeedback = GL.transformFeedbacks[id];
    if (!transformFeedback) continue;
    // GL spec: "unused names in ids are ignored, as is the name zero."
    GLctx.deleteTransformFeedback(transformFeedback);
    transformFeedback.name = 0;
    GL.transformFeedbacks[id] = null;
  }
};

var _emscripten_glDeleteTransformFeedbacks = _glDeleteTransformFeedbacks;

/** @suppress {duplicate } */ var _glDeleteVertexArrays = (n, vaos) => {
  for (var i = 0; i < n; i++) {
    var id = GROWABLE_HEAP_I32()[(((vaos) + (i * 4)) >> 2)];
    GLctx.deleteVertexArray(GL.vaos[id]);
    GL.vaos[id] = null;
  }
};

var _emscripten_glDeleteVertexArrays = _glDeleteVertexArrays;

/** @suppress {duplicate } */ var _glDeleteVertexArraysOES = _glDeleteVertexArrays;

var _emscripten_glDeleteVertexArraysOES = _glDeleteVertexArraysOES;

/** @suppress {duplicate } */ var _glDepthFunc = x0 => GLctx.depthFunc(x0);

var _emscripten_glDepthFunc = _glDepthFunc;

/** @suppress {duplicate } */ var _glDepthMask = flag => {
  GLctx.depthMask(!!flag);
};

var _emscripten_glDepthMask = _glDepthMask;

/** @suppress {duplicate } */ var _glDepthRangef = (x0, x1) => GLctx.depthRange(x0, x1);

var _emscripten_glDepthRangef = _glDepthRangef;

/** @suppress {duplicate } */ var _glDetachShader = (program, shader) => {
  GLctx.detachShader(GL.programs[program], GL.shaders[shader]);
};

var _emscripten_glDetachShader = _glDetachShader;

/** @suppress {duplicate } */ var _glDisable = x0 => GLctx.disable(x0);

var _emscripten_glDisable = _glDisable;

/** @suppress {duplicate } */ var _glDisableVertexAttribArray = index => {
  GLctx.disableVertexAttribArray(index);
};

var _emscripten_glDisableVertexAttribArray = _glDisableVertexAttribArray;

/** @suppress {duplicate } */ var _glDrawArrays = (mode, first, count) => {
  GLctx.drawArrays(mode, first, count);
};

var _emscripten_glDrawArrays = _glDrawArrays;

/** @suppress {duplicate } */ var _glDrawArraysInstanced = (mode, first, count, primcount) => {
  GLctx.drawArraysInstanced(mode, first, count, primcount);
};

var _emscripten_glDrawArraysInstanced = _glDrawArraysInstanced;

/** @suppress {duplicate } */ var _glDrawArraysInstancedANGLE = _glDrawArraysInstanced;

var _emscripten_glDrawArraysInstancedANGLE = _glDrawArraysInstancedANGLE;

/** @suppress {duplicate } */ var _glDrawArraysInstancedARB = _glDrawArraysInstanced;

var _emscripten_glDrawArraysInstancedARB = _glDrawArraysInstancedARB;

/** @suppress {duplicate } */ var _glDrawArraysInstancedEXT = _glDrawArraysInstanced;

var _emscripten_glDrawArraysInstancedEXT = _glDrawArraysInstancedEXT;

/** @suppress {duplicate } */ var _glDrawArraysInstancedNV = _glDrawArraysInstanced;

var _emscripten_glDrawArraysInstancedNV = _glDrawArraysInstancedNV;

var tempFixedLengthArray = [];

/** @suppress {duplicate } */ var _glDrawBuffers = (n, bufs) => {
  var bufArray = tempFixedLengthArray[n];
  for (var i = 0; i < n; i++) {
    bufArray[i] = GROWABLE_HEAP_I32()[(((bufs) + (i * 4)) >> 2)];
  }
  GLctx.drawBuffers(bufArray);
};

var _emscripten_glDrawBuffers = _glDrawBuffers;

/** @suppress {duplicate } */ var _glDrawBuffersEXT = _glDrawBuffers;

var _emscripten_glDrawBuffersEXT = _glDrawBuffersEXT;

/** @suppress {duplicate } */ var _glDrawBuffersWEBGL = _glDrawBuffers;

var _emscripten_glDrawBuffersWEBGL = _glDrawBuffersWEBGL;

/** @suppress {duplicate } */ var _glDrawElements = (mode, count, type, indices) => {
  GLctx.drawElements(mode, count, type, indices);
};

var _emscripten_glDrawElements = _glDrawElements;

/** @suppress {duplicate } */ var _glDrawElementsInstanced = (mode, count, type, indices, primcount) => {
  GLctx.drawElementsInstanced(mode, count, type, indices, primcount);
};

var _emscripten_glDrawElementsInstanced = _glDrawElementsInstanced;

/** @suppress {duplicate } */ var _glDrawElementsInstancedANGLE = _glDrawElementsInstanced;

var _emscripten_glDrawElementsInstancedANGLE = _glDrawElementsInstancedANGLE;

/** @suppress {duplicate } */ var _glDrawElementsInstancedARB = _glDrawElementsInstanced;

var _emscripten_glDrawElementsInstancedARB = _glDrawElementsInstancedARB;

/** @suppress {duplicate } */ var _glDrawElementsInstancedEXT = _glDrawElementsInstanced;

var _emscripten_glDrawElementsInstancedEXT = _glDrawElementsInstancedEXT;

/** @suppress {duplicate } */ var _glDrawElementsInstancedNV = _glDrawElementsInstanced;

var _emscripten_glDrawElementsInstancedNV = _glDrawElementsInstancedNV;

/** @suppress {duplicate } */ var _glDrawRangeElements = (mode, start, end, count, type, indices) => {
  // TODO: This should be a trivial pass-though function registered at the bottom of this page as
  // glFuncs[6][1] += ' drawRangeElements';
  // but due to https://bugzilla.mozilla.org/show_bug.cgi?id=1202427,
  // we work around by ignoring the range.
  _glDrawElements(mode, count, type, indices);
};

var _emscripten_glDrawRangeElements = _glDrawRangeElements;

/** @suppress {duplicate } */ var _glEnable = x0 => GLctx.enable(x0);

var _emscripten_glEnable = _glEnable;

/** @suppress {duplicate } */ var _glEnableVertexAttribArray = index => {
  GLctx.enableVertexAttribArray(index);
};

var _emscripten_glEnableVertexAttribArray = _glEnableVertexAttribArray;

/** @suppress {duplicate } */ var _glEndQuery = x0 => GLctx.endQuery(x0);

var _emscripten_glEndQuery = _glEndQuery;

/** @suppress {duplicate } */ var _glEndQueryEXT = target => {
  GLctx.disjointTimerQueryExt["endQueryEXT"](target);
};

var _emscripten_glEndQueryEXT = _glEndQueryEXT;

/** @suppress {duplicate } */ var _glEndTransformFeedback = () => GLctx.endTransformFeedback();

var _emscripten_glEndTransformFeedback = _glEndTransformFeedback;

/** @suppress {duplicate } */ var _glFenceSync = (condition, flags) => {
  var sync = GLctx.fenceSync(condition, flags);
  if (sync) {
    var id = GL.getNewId(GL.syncs);
    sync.name = id;
    GL.syncs[id] = sync;
    return id;
  }
  return 0;
};

// Failed to create a sync object
var _emscripten_glFenceSync = _glFenceSync;

/** @suppress {duplicate } */ var _glFinish = () => GLctx.finish();

var _emscripten_glFinish = _glFinish;

/** @suppress {duplicate } */ var _glFlush = () => GLctx.flush();

var _emscripten_glFlush = _glFlush;

/** @suppress {duplicate } */ var _glFramebufferRenderbuffer = (target, attachment, renderbuffertarget, renderbuffer) => {
  GLctx.framebufferRenderbuffer(target, attachment, renderbuffertarget, GL.renderbuffers[renderbuffer]);
};

var _emscripten_glFramebufferRenderbuffer = _glFramebufferRenderbuffer;

/** @suppress {duplicate } */ var _glFramebufferTexture2D = (target, attachment, textarget, texture, level) => {
  GLctx.framebufferTexture2D(target, attachment, textarget, GL.textures[texture], level);
};

var _emscripten_glFramebufferTexture2D = _glFramebufferTexture2D;

/** @suppress {duplicate } */ var _glFramebufferTextureLayer = (target, attachment, texture, level, layer) => {
  GLctx.framebufferTextureLayer(target, attachment, GL.textures[texture], level, layer);
};

var _emscripten_glFramebufferTextureLayer = _glFramebufferTextureLayer;

/** @suppress {duplicate } */ var _glFrontFace = x0 => GLctx.frontFace(x0);

var _emscripten_glFrontFace = _glFrontFace;

/** @suppress {duplicate } */ var _glGenBuffers = (n, buffers) => {
  GL.genObject(n, buffers, "createBuffer", GL.buffers);
};

var _emscripten_glGenBuffers = _glGenBuffers;

/** @suppress {duplicate } */ var _glGenFramebuffers = (n, ids) => {
  GL.genObject(n, ids, "createFramebuffer", GL.framebuffers);
};

var _emscripten_glGenFramebuffers = _glGenFramebuffers;

/** @suppress {duplicate } */ var _glGenQueries = (n, ids) => {
  GL.genObject(n, ids, "createQuery", GL.queries);
};

var _emscripten_glGenQueries = _glGenQueries;

/** @suppress {duplicate } */ var _glGenQueriesEXT = (n, ids) => {
  for (var i = 0; i < n; i++) {
    var query = GLctx.disjointTimerQueryExt["createQueryEXT"]();
    if (!query) {
      GL.recordError(1282);
      /* GL_INVALID_OPERATION */ while (i < n) GROWABLE_HEAP_I32()[(((ids) + (i++ * 4)) >> 2)] = 0;
      checkInt32(0);
      return;
    }
    var id = GL.getNewId(GL.queries);
    query.name = id;
    GL.queries[id] = query;
    GROWABLE_HEAP_I32()[(((ids) + (i * 4)) >> 2)] = id;
    checkInt32(id);
  }
};

var _emscripten_glGenQueriesEXT = _glGenQueriesEXT;

/** @suppress {duplicate } */ var _glGenRenderbuffers = (n, renderbuffers) => {
  GL.genObject(n, renderbuffers, "createRenderbuffer", GL.renderbuffers);
};

var _emscripten_glGenRenderbuffers = _glGenRenderbuffers;

/** @suppress {duplicate } */ var _glGenSamplers = (n, samplers) => {
  GL.genObject(n, samplers, "createSampler", GL.samplers);
};

var _emscripten_glGenSamplers = _glGenSamplers;

/** @suppress {duplicate } */ var _glGenTextures = (n, textures) => {
  GL.genObject(n, textures, "createTexture", GL.textures);
};

var _emscripten_glGenTextures = _glGenTextures;

/** @suppress {duplicate } */ var _glGenTransformFeedbacks = (n, ids) => {
  GL.genObject(n, ids, "createTransformFeedback", GL.transformFeedbacks);
};

var _emscripten_glGenTransformFeedbacks = _glGenTransformFeedbacks;

/** @suppress {duplicate } */ var _glGenVertexArrays = (n, arrays) => {
  GL.genObject(n, arrays, "createVertexArray", GL.vaos);
};

var _emscripten_glGenVertexArrays = _glGenVertexArrays;

/** @suppress {duplicate } */ var _glGenVertexArraysOES = _glGenVertexArrays;

var _emscripten_glGenVertexArraysOES = _glGenVertexArraysOES;

/** @suppress {duplicate } */ var _glGenerateMipmap = x0 => GLctx.generateMipmap(x0);

var _emscripten_glGenerateMipmap = _glGenerateMipmap;

var __glGetActiveAttribOrUniform = (funcName, program, index, bufSize, length, size, type, name) => {
  program = GL.programs[program];
  var info = GLctx[funcName](program, index);
  if (info) {
    // If an error occurs, nothing will be written to length, size and type and name.
    var numBytesWrittenExclNull = name && stringToUTF8(info.name, name, bufSize);
    if (length) GROWABLE_HEAP_I32()[((length) >> 2)] = numBytesWrittenExclNull;
    checkInt32(numBytesWrittenExclNull);
    if (size) GROWABLE_HEAP_I32()[((size) >> 2)] = info.size;
    checkInt32(info.size);
    if (type) GROWABLE_HEAP_I32()[((type) >> 2)] = info.type;
    checkInt32(info.type);
  }
};

/** @suppress {duplicate } */ var _glGetActiveAttrib = (program, index, bufSize, length, size, type, name) => __glGetActiveAttribOrUniform("getActiveAttrib", program, index, bufSize, length, size, type, name);

var _emscripten_glGetActiveAttrib = _glGetActiveAttrib;

/** @suppress {duplicate } */ var _glGetActiveUniform = (program, index, bufSize, length, size, type, name) => __glGetActiveAttribOrUniform("getActiveUniform", program, index, bufSize, length, size, type, name);

var _emscripten_glGetActiveUniform = _glGetActiveUniform;

/** @suppress {duplicate } */ var _glGetActiveUniformBlockName = (program, uniformBlockIndex, bufSize, length, uniformBlockName) => {
  program = GL.programs[program];
  var result = GLctx.getActiveUniformBlockName(program, uniformBlockIndex);
  if (!result) return;
  // If an error occurs, nothing will be written to uniformBlockName or length.
  if (uniformBlockName && bufSize > 0) {
    var numBytesWrittenExclNull = stringToUTF8(result, uniformBlockName, bufSize);
    if (length) GROWABLE_HEAP_I32()[((length) >> 2)] = numBytesWrittenExclNull;
    checkInt32(numBytesWrittenExclNull);
  } else {
    if (length) GROWABLE_HEAP_I32()[((length) >> 2)] = 0;
    checkInt32(0);
  }
};

var _emscripten_glGetActiveUniformBlockName = _glGetActiveUniformBlockName;

/** @suppress {duplicate } */ var _glGetActiveUniformBlockiv = (program, uniformBlockIndex, pname, params) => {
  if (!params) {
    // GLES2 specification does not specify how to behave if params is a null pointer. Since calling this function does not make sense
    // if params == null, issue a GL error to notify user about it.
    GL.recordError(1281);
    /* GL_INVALID_VALUE */ return;
  }
  program = GL.programs[program];
  if (pname == 35393) /* GL_UNIFORM_BLOCK_NAME_LENGTH */ {
    var name = GLctx.getActiveUniformBlockName(program, uniformBlockIndex);
    GROWABLE_HEAP_I32()[((params) >> 2)] = name.length + 1;
    checkInt32(name.length + 1);
    return;
  }
  var result = GLctx.getActiveUniformBlockParameter(program, uniformBlockIndex, pname);
  if (result === null) return;
  // If an error occurs, nothing should be written to params.
  if (pname == 35395) /*GL_UNIFORM_BLOCK_ACTIVE_UNIFORM_INDICES*/ {
    for (var i = 0; i < result.length; i++) {
      GROWABLE_HEAP_I32()[(((params) + (i * 4)) >> 2)] = result[i];
      checkInt32(result[i]);
    }
  } else {
    GROWABLE_HEAP_I32()[((params) >> 2)] = result;
    checkInt32(result);
  }
};

var _emscripten_glGetActiveUniformBlockiv = _glGetActiveUniformBlockiv;

/** @suppress {duplicate } */ var _glGetActiveUniformsiv = (program, uniformCount, uniformIndices, pname, params) => {
  if (!params) {
    // GLES2 specification does not specify how to behave if params is a null pointer. Since calling this function does not make sense
    // if params == null, issue a GL error to notify user about it.
    GL.recordError(1281);
    /* GL_INVALID_VALUE */ return;
  }
  if (uniformCount > 0 && uniformIndices == 0) {
    GL.recordError(1281);
    /* GL_INVALID_VALUE */ return;
  }
  program = GL.programs[program];
  var ids = [];
  for (var i = 0; i < uniformCount; i++) {
    ids.push(GROWABLE_HEAP_I32()[(((uniformIndices) + (i * 4)) >> 2)]);
  }
  var result = GLctx.getActiveUniforms(program, ids, pname);
  if (!result) return;
  // GL spec: If an error is generated, nothing is written out to params.
  var len = result.length;
  for (var i = 0; i < len; i++) {
    GROWABLE_HEAP_I32()[(((params) + (i * 4)) >> 2)] = result[i];
    checkInt32(result[i]);
  }
};

var _emscripten_glGetActiveUniformsiv = _glGetActiveUniformsiv;

/** @suppress {duplicate } */ var _glGetAttachedShaders = (program, maxCount, count, shaders) => {
  var result = GLctx.getAttachedShaders(GL.programs[program]);
  var len = result.length;
  if (len > maxCount) {
    len = maxCount;
  }
  GROWABLE_HEAP_I32()[((count) >> 2)] = len;
  checkInt32(len);
  for (var i = 0; i < len; ++i) {
    var id = GL.shaders.indexOf(result[i]);
    GROWABLE_HEAP_I32()[(((shaders) + (i * 4)) >> 2)] = id;
    checkInt32(id);
  }
};

var _emscripten_glGetAttachedShaders = _glGetAttachedShaders;

/** @suppress {duplicate } */ var _glGetAttribLocation = (program, name) => GLctx.getAttribLocation(GL.programs[program], UTF8ToString(name));

var _emscripten_glGetAttribLocation = _glGetAttribLocation;

var readI53FromI64 = ptr => GROWABLE_HEAP_U32()[((ptr) >> 2)] + GROWABLE_HEAP_I32()[(((ptr) + (4)) >> 2)] * 4294967296;

var readI53FromU64 = ptr => GROWABLE_HEAP_U32()[((ptr) >> 2)] + GROWABLE_HEAP_U32()[(((ptr) + (4)) >> 2)] * 4294967296;

var writeI53ToI64 = (ptr, num) => {
  GROWABLE_HEAP_U32()[((ptr) >> 2)] = num;
  checkInt32(num);
  var lower = GROWABLE_HEAP_U32()[((ptr) >> 2)];
  GROWABLE_HEAP_U32()[(((ptr) + (4)) >> 2)] = (num - lower) / 4294967296;
  checkInt32((num - lower) / 4294967296);
  var deserialized = (num >= 0) ? readI53FromU64(ptr) : readI53FromI64(ptr);
  var offset = ((ptr) >> 2);
  if (deserialized != num) warnOnce(`writeI53ToI64() out of range: serialized JS Number ${num} to Wasm heap as bytes lo=${ptrToString(GROWABLE_HEAP_U32()[offset])}, hi=${ptrToString(GROWABLE_HEAP_U32()[offset + 1])}, which deserializes back to ${deserialized} instead!`);
};

var webglGetExtensions = () => {
  var exts = getEmscriptenSupportedExtensions(GLctx);
  exts = exts.concat(exts.map(e => "GL_" + e));
  return exts;
};

var emscriptenWebGLGet = (name_, p, type) => {
  // Guard against user passing a null pointer.
  // Note that GLES2 spec does not say anything about how passing a null
  // pointer should be treated.  Testing on desktop core GL 3, the application
  // crashes on glGetIntegerv to a null pointer, but better to report an error
  // instead of doing anything random.
  if (!p) {
    GL.recordError(1281);
    /* GL_INVALID_VALUE */ return;
  }
  var ret = undefined;
  switch (name_) {
   // Handle a few trivial GLES values
    case 36346:
    // GL_SHADER_COMPILER
    ret = 1;
    break;

   case 36344:
    // GL_SHADER_BINARY_FORMATS
    if (type != 0 && type != 1) {
      GL.recordError(1280);
    }
    // Do not write anything to the out pointer, since no binary formats are
    // supported.
    return;

   case 34814:
   // GL_NUM_PROGRAM_BINARY_FORMATS
    case 36345:
    // GL_NUM_SHADER_BINARY_FORMATS
    ret = 0;
    break;

   case 34466:
    // GL_NUM_COMPRESSED_TEXTURE_FORMATS
    // WebGL doesn't have GL_NUM_COMPRESSED_TEXTURE_FORMATS (it's obsolete
    // since GL_COMPRESSED_TEXTURE_FORMATS returns a JS array that can be
    // queried for length), so implement it ourselves to allow C++ GLES2
    // code get the length.
    var formats = GLctx.getParameter(34467);
    /*GL_COMPRESSED_TEXTURE_FORMATS*/ ret = formats ? formats.length : 0;
    break;

   case 33309:
    // GL_NUM_EXTENSIONS
    if (GL.currentContext.version < 2) {
      // Calling GLES3/WebGL2 function with a GLES2/WebGL1 context
      GL.recordError(1282);
      /* GL_INVALID_OPERATION */ return;
    }
    ret = webglGetExtensions().length;
    break;

   case 33307:
   // GL_MAJOR_VERSION
    case 33308:
    // GL_MINOR_VERSION
    if (GL.currentContext.version < 2) {
      GL.recordError(1280);
      // GL_INVALID_ENUM
      return;
    }
    ret = name_ == 33307 ? 3 : 0;
    // return version 3.0
    break;
  }
  if (ret === undefined) {
    var result = GLctx.getParameter(name_);
    switch (typeof result) {
     case "number":
      ret = result;
      break;

     case "boolean":
      ret = result ? 1 : 0;
      break;

     case "string":
      GL.recordError(1280);
      // GL_INVALID_ENUM
      return;

     case "object":
      if (result === null) {
        // null is a valid result for some (e.g., which buffer is bound -
        // perhaps nothing is bound), but otherwise can mean an invalid
        // name_, which we need to report as an error
        switch (name_) {
         case 34964:
         // ARRAY_BUFFER_BINDING
          case 35725:
         // CURRENT_PROGRAM
          case 34965:
         // ELEMENT_ARRAY_BUFFER_BINDING
          case 36006:
         // FRAMEBUFFER_BINDING or DRAW_FRAMEBUFFER_BINDING
          case 36007:
         // RENDERBUFFER_BINDING
          case 32873:
         // TEXTURE_BINDING_2D
          case 34229:
         // WebGL 2 GL_VERTEX_ARRAY_BINDING, or WebGL 1 extension OES_vertex_array_object GL_VERTEX_ARRAY_BINDING_OES
          case 36662:
         // COPY_READ_BUFFER_BINDING or COPY_READ_BUFFER
          case 36663:
         // COPY_WRITE_BUFFER_BINDING or COPY_WRITE_BUFFER
          case 35053:
         // PIXEL_PACK_BUFFER_BINDING
          case 35055:
         // PIXEL_UNPACK_BUFFER_BINDING
          case 36010:
         // READ_FRAMEBUFFER_BINDING
          case 35097:
         // SAMPLER_BINDING
          case 35869:
         // TEXTURE_BINDING_2D_ARRAY
          case 32874:
         // TEXTURE_BINDING_3D
          case 36389:
         // TRANSFORM_FEEDBACK_BINDING
          case 35983:
         // TRANSFORM_FEEDBACK_BUFFER_BINDING
          case 35368:
         // UNIFORM_BUFFER_BINDING
          case 34068:
          {
            // TEXTURE_BINDING_CUBE_MAP
            ret = 0;
            break;
          }

         default:
          {
            GL.recordError(1280);
            // GL_INVALID_ENUM
            return;
          }
        }
      } else if (result instanceof Float32Array || result instanceof Uint32Array || result instanceof Int32Array || result instanceof Array) {
        for (var i = 0; i < result.length; ++i) {
          switch (type) {
           case 0:
            GROWABLE_HEAP_I32()[(((p) + (i * 4)) >> 2)] = result[i];
            checkInt32(result[i]);
            break;

           case 2:
            GROWABLE_HEAP_F32()[(((p) + (i * 4)) >> 2)] = result[i];
            break;

           case 4:
            GROWABLE_HEAP_I8()[(p) + (i)] = result[i] ? 1 : 0;
            checkInt8(result[i] ? 1 : 0);
            break;
          }
        }
        return;
      } else {
        try {
          ret = result.name | 0;
        } catch (e) {
          GL.recordError(1280);
          // GL_INVALID_ENUM
          err(`GL_INVALID_ENUM in glGet${type}v: Unknown object returned from WebGL getParameter(${name_})! (error: ${e})`);
          return;
        }
      }
      break;

     default:
      GL.recordError(1280);
      // GL_INVALID_ENUM
      err(`GL_INVALID_ENUM in glGet${type}v: Native code calling glGet${type}v(${name_}) and it returns ${result} of type ${typeof (result)}!`);
      return;
    }
  }
  switch (type) {
   case 1:
    writeI53ToI64(p, ret);
    break;

   case 0:
    GROWABLE_HEAP_I32()[((p) >> 2)] = ret;
    checkInt32(ret);
    break;

   case 2:
    GROWABLE_HEAP_F32()[((p) >> 2)] = ret;
    break;

   case 4:
    GROWABLE_HEAP_I8()[p] = ret ? 1 : 0;
    checkInt8(ret ? 1 : 0);
    break;
  }
};

/** @suppress {duplicate } */ var _glGetBooleanv = (name_, p) => emscriptenWebGLGet(name_, p, 4);

var _emscripten_glGetBooleanv = _glGetBooleanv;

/** @suppress {duplicate } */ var _glGetBufferParameteri64v = (target, value, data) => {
  if (!data) {
    // GLES2 specification does not specify how to behave if data is a null pointer. Since calling this function does not make sense
    // if data == null, issue a GL error to notify user about it.
    GL.recordError(1281);
    /* GL_INVALID_VALUE */ return;
  }
  writeI53ToI64(data, GLctx.getBufferParameter(target, value));
};

var _emscripten_glGetBufferParameteri64v = _glGetBufferParameteri64v;

/** @suppress {duplicate } */ var _glGetBufferParameteriv = (target, value, data) => {
  if (!data) {
    // GLES2 specification does not specify how to behave if data is a null
    // pointer. Since calling this function does not make sense if data ==
    // null, issue a GL error to notify user about it.
    GL.recordError(1281);
    /* GL_INVALID_VALUE */ return;
  }
  GROWABLE_HEAP_I32()[((data) >> 2)] = GLctx.getBufferParameter(target, value);
  checkInt32(GLctx.getBufferParameter(target, value));
};

var _emscripten_glGetBufferParameteriv = _glGetBufferParameteriv;

/** @suppress {duplicate } */ var _glGetError = () => {
  var error = GLctx.getError() || GL.lastError;
  GL.lastError = 0;
  /*GL_NO_ERROR*/ return error;
};

var _emscripten_glGetError = _glGetError;

/** @suppress {duplicate } */ var _glGetFloatv = (name_, p) => emscriptenWebGLGet(name_, p, 2);

var _emscripten_glGetFloatv = _glGetFloatv;

/** @suppress {duplicate } */ var _glGetFragDataLocation = (program, name) => GLctx.getFragDataLocation(GL.programs[program], UTF8ToString(name));

var _emscripten_glGetFragDataLocation = _glGetFragDataLocation;

/** @suppress {duplicate } */ var _glGetFramebufferAttachmentParameteriv = (target, attachment, pname, params) => {
  var result = GLctx.getFramebufferAttachmentParameter(target, attachment, pname);
  if (result instanceof WebGLRenderbuffer || result instanceof WebGLTexture) {
    result = result.name | 0;
  }
  GROWABLE_HEAP_I32()[((params) >> 2)] = result;
  checkInt32(result);
};

var _emscripten_glGetFramebufferAttachmentParameteriv = _glGetFramebufferAttachmentParameteriv;

var emscriptenWebGLGetIndexed = (target, index, data, type) => {
  if (!data) {
    // GLES2 specification does not specify how to behave if data is a null pointer. Since calling this function does not make sense
    // if data == null, issue a GL error to notify user about it.
    GL.recordError(1281);
    /* GL_INVALID_VALUE */ return;
  }
  var result = GLctx.getIndexedParameter(target, index);
  var ret;
  switch (typeof result) {
   case "boolean":
    ret = result ? 1 : 0;
    break;

   case "number":
    ret = result;
    break;

   case "object":
    if (result === null) {
      switch (target) {
       case 35983:
       // TRANSFORM_FEEDBACK_BUFFER_BINDING
        case 35368:
        // UNIFORM_BUFFER_BINDING
        ret = 0;
        break;

       default:
        {
          GL.recordError(1280);
          // GL_INVALID_ENUM
          return;
        }
      }
    } else if (result instanceof WebGLBuffer) {
      ret = result.name | 0;
    } else {
      GL.recordError(1280);
      // GL_INVALID_ENUM
      return;
    }
    break;

   default:
    GL.recordError(1280);
    // GL_INVALID_ENUM
    return;
  }
  switch (type) {
   case 1:
    writeI53ToI64(data, ret);
    break;

   case 0:
    GROWABLE_HEAP_I32()[((data) >> 2)] = ret;
    checkInt32(ret);
    break;

   case 2:
    GROWABLE_HEAP_F32()[((data) >> 2)] = ret;
    break;

   case 4:
    GROWABLE_HEAP_I8()[data] = ret ? 1 : 0;
    checkInt8(ret ? 1 : 0);
    break;

   default:
    throw "internal emscriptenWebGLGetIndexed() error, bad type: " + type;
  }
};

/** @suppress {duplicate } */ var _glGetInteger64i_v = (target, index, data) => emscriptenWebGLGetIndexed(target, index, data, 1);

var _emscripten_glGetInteger64i_v = _glGetInteger64i_v;

/** @suppress {duplicate } */ var _glGetInteger64v = (name_, p) => {
  emscriptenWebGLGet(name_, p, 1);
};

var _emscripten_glGetInteger64v = _glGetInteger64v;

/** @suppress {duplicate } */ var _glGetIntegeri_v = (target, index, data) => emscriptenWebGLGetIndexed(target, index, data, 0);

var _emscripten_glGetIntegeri_v = _glGetIntegeri_v;

/** @suppress {duplicate } */ var _glGetIntegerv = (name_, p) => emscriptenWebGLGet(name_, p, 0);

var _emscripten_glGetIntegerv = _glGetIntegerv;

/** @suppress {duplicate } */ var _glGetInternalformativ = (target, internalformat, pname, bufSize, params) => {
  if (bufSize < 0) {
    GL.recordError(1281);
    /* GL_INVALID_VALUE */ return;
  }
  if (!params) {
    // GLES3 specification does not specify how to behave if values is a null pointer. Since calling this function does not make sense
    // if values == null, issue a GL error to notify user about it.
    GL.recordError(1281);
    /* GL_INVALID_VALUE */ return;
  }
  var ret = GLctx.getInternalformatParameter(target, internalformat, pname);
  if (ret === null) return;
  for (var i = 0; i < ret.length && i < bufSize; ++i) {
    GROWABLE_HEAP_I32()[(((params) + (i * 4)) >> 2)] = ret[i];
    checkInt32(ret[i]);
  }
};

var _emscripten_glGetInternalformativ = _glGetInternalformativ;

/** @suppress {duplicate } */ var _glGetProgramBinary = (program, bufSize, length, binaryFormat, binary) => {
  GL.recordError(1282);
};

/*GL_INVALID_OPERATION*/ var _emscripten_glGetProgramBinary = _glGetProgramBinary;

/** @suppress {duplicate } */ var _glGetProgramInfoLog = (program, maxLength, length, infoLog) => {
  var log = GLctx.getProgramInfoLog(GL.programs[program]);
  if (log === null) log = "(unknown error)";
  var numBytesWrittenExclNull = (maxLength > 0 && infoLog) ? stringToUTF8(log, infoLog, maxLength) : 0;
  if (length) GROWABLE_HEAP_I32()[((length) >> 2)] = numBytesWrittenExclNull;
  checkInt32(numBytesWrittenExclNull);
};

var _emscripten_glGetProgramInfoLog = _glGetProgramInfoLog;

/** @suppress {duplicate } */ var _glGetProgramiv = (program, pname, p) => {
  if (!p) {
    // GLES2 specification does not specify how to behave if p is a null
    // pointer. Since calling this function does not make sense if p == null,
    // issue a GL error to notify user about it.
    GL.recordError(1281);
    /* GL_INVALID_VALUE */ return;
  }
  if (program >= GL.counter) {
    GL.recordError(1281);
    /* GL_INVALID_VALUE */ return;
  }
  program = GL.programs[program];
  if (pname == 35716) {
    // GL_INFO_LOG_LENGTH
    var log = GLctx.getProgramInfoLog(program);
    if (log === null) log = "(unknown error)";
    GROWABLE_HEAP_I32()[((p) >> 2)] = log.length + 1;
    checkInt32(log.length + 1);
  } else if (pname == 35719) /* GL_ACTIVE_UNIFORM_MAX_LENGTH */ {
    if (!program.maxUniformLength) {
      var numActiveUniforms = GLctx.getProgramParameter(program, 35718);
      /*GL_ACTIVE_UNIFORMS*/ for (var i = 0; i < numActiveUniforms; ++i) {
        program.maxUniformLength = Math.max(program.maxUniformLength, GLctx.getActiveUniform(program, i).name.length + 1);
      }
    }
    GROWABLE_HEAP_I32()[((p) >> 2)] = program.maxUniformLength;
    checkInt32(program.maxUniformLength);
  } else if (pname == 35722) /* GL_ACTIVE_ATTRIBUTE_MAX_LENGTH */ {
    if (!program.maxAttributeLength) {
      var numActiveAttributes = GLctx.getProgramParameter(program, 35721);
      /*GL_ACTIVE_ATTRIBUTES*/ for (var i = 0; i < numActiveAttributes; ++i) {
        program.maxAttributeLength = Math.max(program.maxAttributeLength, GLctx.getActiveAttrib(program, i).name.length + 1);
      }
    }
    GROWABLE_HEAP_I32()[((p) >> 2)] = program.maxAttributeLength;
    checkInt32(program.maxAttributeLength);
  } else if (pname == 35381) /* GL_ACTIVE_UNIFORM_BLOCK_MAX_NAME_LENGTH */ {
    if (!program.maxUniformBlockNameLength) {
      var numActiveUniformBlocks = GLctx.getProgramParameter(program, 35382);
      /*GL_ACTIVE_UNIFORM_BLOCKS*/ for (var i = 0; i < numActiveUniformBlocks; ++i) {
        program.maxUniformBlockNameLength = Math.max(program.maxUniformBlockNameLength, GLctx.getActiveUniformBlockName(program, i).length + 1);
      }
    }
    GROWABLE_HEAP_I32()[((p) >> 2)] = program.maxUniformBlockNameLength;
    checkInt32(program.maxUniformBlockNameLength);
  } else {
    GROWABLE_HEAP_I32()[((p) >> 2)] = GLctx.getProgramParameter(program, pname);
    checkInt32(GLctx.getProgramParameter(program, pname));
  }
};

var _emscripten_glGetProgramiv = _glGetProgramiv;

/** @suppress {duplicate } */ var _glGetQueryObjecti64vEXT = (id, pname, params) => {
  if (!params) {
    // GLES2 specification does not specify how to behave if params is a null pointer. Since calling this function does not make sense
    // if p == null, issue a GL error to notify user about it.
    GL.recordError(1281);
    /* GL_INVALID_VALUE */ return;
  }
  var query = GL.queries[id];
  var param;
  if (GL.currentContext.version < 2) {
    param = GLctx.disjointTimerQueryExt["getQueryObjectEXT"](query, pname);
  } else {
    param = GLctx.getQueryParameter(query, pname);
  }
  var ret;
  if (typeof param == "boolean") {
    ret = param ? 1 : 0;
  } else {
    ret = param;
  }
  writeI53ToI64(params, ret);
};

var _emscripten_glGetQueryObjecti64vEXT = _glGetQueryObjecti64vEXT;

/** @suppress {duplicate } */ var _glGetQueryObjectivEXT = (id, pname, params) => {
  if (!params) {
    // GLES2 specification does not specify how to behave if params is a null pointer. Since calling this function does not make sense
    // if p == null, issue a GL error to notify user about it.
    GL.recordError(1281);
    /* GL_INVALID_VALUE */ return;
  }
  var query = GL.queries[id];
  var param = GLctx.disjointTimerQueryExt["getQueryObjectEXT"](query, pname);
  var ret;
  if (typeof param == "boolean") {
    ret = param ? 1 : 0;
  } else {
    ret = param;
  }
  GROWABLE_HEAP_I32()[((params) >> 2)] = ret;
  checkInt32(ret);
};

var _emscripten_glGetQueryObjectivEXT = _glGetQueryObjectivEXT;

/** @suppress {duplicate } */ var _glGetQueryObjectui64vEXT = _glGetQueryObjecti64vEXT;

var _emscripten_glGetQueryObjectui64vEXT = _glGetQueryObjectui64vEXT;

/** @suppress {duplicate } */ var _glGetQueryObjectuiv = (id, pname, params) => {
  if (!params) {
    // GLES2 specification does not specify how to behave if params is a null pointer. Since calling this function does not make sense
    // if p == null, issue a GL error to notify user about it.
    GL.recordError(1281);
    /* GL_INVALID_VALUE */ return;
  }
  var query = GL.queries[id];
  var param = GLctx.getQueryParameter(query, pname);
  var ret;
  if (typeof param == "boolean") {
    ret = param ? 1 : 0;
  } else {
    ret = param;
  }
  GROWABLE_HEAP_I32()[((params) >> 2)] = ret;
  checkInt32(ret);
};

var _emscripten_glGetQueryObjectuiv = _glGetQueryObjectuiv;

/** @suppress {duplicate } */ var _glGetQueryObjectuivEXT = _glGetQueryObjectivEXT;

var _emscripten_glGetQueryObjectuivEXT = _glGetQueryObjectuivEXT;

/** @suppress {duplicate } */ var _glGetQueryiv = (target, pname, params) => {
  if (!params) {
    // GLES2 specification does not specify how to behave if params is a null pointer. Since calling this function does not make sense
    // if p == null, issue a GL error to notify user about it.
    GL.recordError(1281);
    /* GL_INVALID_VALUE */ return;
  }
  GROWABLE_HEAP_I32()[((params) >> 2)] = GLctx.getQuery(target, pname);
  checkInt32(GLctx.getQuery(target, pname));
};

var _emscripten_glGetQueryiv = _glGetQueryiv;

/** @suppress {duplicate } */ var _glGetQueryivEXT = (target, pname, params) => {
  if (!params) {
    // GLES2 specification does not specify how to behave if params is a null pointer. Since calling this function does not make sense
    // if p == null, issue a GL error to notify user about it.
    GL.recordError(1281);
    /* GL_INVALID_VALUE */ return;
  }
  GROWABLE_HEAP_I32()[((params) >> 2)] = GLctx.disjointTimerQueryExt["getQueryEXT"](target, pname);
  checkInt32(GLctx.disjointTimerQueryExt["getQueryEXT"](target, pname));
};

var _emscripten_glGetQueryivEXT = _glGetQueryivEXT;

/** @suppress {duplicate } */ var _glGetRenderbufferParameteriv = (target, pname, params) => {
  if (!params) {
    // GLES2 specification does not specify how to behave if params is a null pointer. Since calling this function does not make sense
    // if params == null, issue a GL error to notify user about it.
    GL.recordError(1281);
    /* GL_INVALID_VALUE */ return;
  }
  GROWABLE_HEAP_I32()[((params) >> 2)] = GLctx.getRenderbufferParameter(target, pname);
  checkInt32(GLctx.getRenderbufferParameter(target, pname));
};

var _emscripten_glGetRenderbufferParameteriv = _glGetRenderbufferParameteriv;

/** @suppress {duplicate } */ var _glGetSamplerParameterfv = (sampler, pname, params) => {
  if (!params) {
    // GLES3 specification does not specify how to behave if params is a null pointer. Since calling this function does not make sense
    // if p == null, issue a GL error to notify user about it.
    GL.recordError(1281);
    /* GL_INVALID_VALUE */ return;
  }
  GROWABLE_HEAP_F32()[((params) >> 2)] = GLctx.getSamplerParameter(GL.samplers[sampler], pname);
};

var _emscripten_glGetSamplerParameterfv = _glGetSamplerParameterfv;

/** @suppress {duplicate } */ var _glGetSamplerParameteriv = (sampler, pname, params) => {
  if (!params) {
    // GLES3 specification does not specify how to behave if params is a null pointer. Since calling this function does not make sense
    // if p == null, issue a GL error to notify user about it.
    GL.recordError(1281);
    /* GL_INVALID_VALUE */ return;
  }
  GROWABLE_HEAP_I32()[((params) >> 2)] = GLctx.getSamplerParameter(GL.samplers[sampler], pname);
  checkInt32(GLctx.getSamplerParameter(GL.samplers[sampler], pname));
};

var _emscripten_glGetSamplerParameteriv = _glGetSamplerParameteriv;

/** @suppress {duplicate } */ var _glGetShaderInfoLog = (shader, maxLength, length, infoLog) => {
  var log = GLctx.getShaderInfoLog(GL.shaders[shader]);
  if (log === null) log = "(unknown error)";
  var numBytesWrittenExclNull = (maxLength > 0 && infoLog) ? stringToUTF8(log, infoLog, maxLength) : 0;
  if (length) GROWABLE_HEAP_I32()[((length) >> 2)] = numBytesWrittenExclNull;
  checkInt32(numBytesWrittenExclNull);
};

var _emscripten_glGetShaderInfoLog = _glGetShaderInfoLog;

/** @suppress {duplicate } */ var _glGetShaderPrecisionFormat = (shaderType, precisionType, range, precision) => {
  var result = GLctx.getShaderPrecisionFormat(shaderType, precisionType);
  GROWABLE_HEAP_I32()[((range) >> 2)] = result.rangeMin;
  checkInt32(result.rangeMin);
  GROWABLE_HEAP_I32()[(((range) + (4)) >> 2)] = result.rangeMax;
  checkInt32(result.rangeMax);
  GROWABLE_HEAP_I32()[((precision) >> 2)] = result.precision;
  checkInt32(result.precision);
};

var _emscripten_glGetShaderPrecisionFormat = _glGetShaderPrecisionFormat;

/** @suppress {duplicate } */ var _glGetShaderSource = (shader, bufSize, length, source) => {
  var result = GLctx.getShaderSource(GL.shaders[shader]);
  if (!result) return;
  // If an error occurs, nothing will be written to length or source.
  var numBytesWrittenExclNull = (bufSize > 0 && source) ? stringToUTF8(result, source, bufSize) : 0;
  if (length) GROWABLE_HEAP_I32()[((length) >> 2)] = numBytesWrittenExclNull;
  checkInt32(numBytesWrittenExclNull);
};

var _emscripten_glGetShaderSource = _glGetShaderSource;

/** @suppress {duplicate } */ var _glGetShaderiv = (shader, pname, p) => {
  if (!p) {
    // GLES2 specification does not specify how to behave if p is a null
    // pointer. Since calling this function does not make sense if p == null,
    // issue a GL error to notify user about it.
    GL.recordError(1281);
    /* GL_INVALID_VALUE */ return;
  }
  if (pname == 35716) {
    // GL_INFO_LOG_LENGTH
    var log = GLctx.getShaderInfoLog(GL.shaders[shader]);
    if (log === null) log = "(unknown error)";
    // The GLES2 specification says that if the shader has an empty info log,
    // a value of 0 is returned. Otherwise the log has a null char appended.
    // (An empty string is falsey, so we can just check that instead of
    // looking at log.length.)
    var logLength = log ? log.length + 1 : 0;
    GROWABLE_HEAP_I32()[((p) >> 2)] = logLength;
    checkInt32(logLength);
  } else if (pname == 35720) {
    // GL_SHADER_SOURCE_LENGTH
    var source = GLctx.getShaderSource(GL.shaders[shader]);
    // source may be a null, or the empty string, both of which are falsey
    // values that we report a 0 length for.
    var sourceLength = source ? source.length + 1 : 0;
    GROWABLE_HEAP_I32()[((p) >> 2)] = sourceLength;
    checkInt32(sourceLength);
  } else {
    GROWABLE_HEAP_I32()[((p) >> 2)] = GLctx.getShaderParameter(GL.shaders[shader], pname);
    checkInt32(GLctx.getShaderParameter(GL.shaders[shader], pname));
  }
};

var _emscripten_glGetShaderiv = _glGetShaderiv;

/** @suppress {duplicate } */ var _glGetString = name_ => {
  var ret = GL.stringCache[name_];
  if (!ret) {
    switch (name_) {
     case 7939:
      /* GL_EXTENSIONS */ ret = stringToNewUTF8(webglGetExtensions().join(" "));
      break;

     case 7936:
     /* GL_VENDOR */ case 7937:
     /* GL_RENDERER */ case 37445:
     /* UNMASKED_VENDOR_WEBGL */ case 37446:
      /* UNMASKED_RENDERER_WEBGL */ var s = GLctx.getParameter(name_);
      if (!s) {
        GL.recordError(1280);
      }
      ret = s ? stringToNewUTF8(s) : 0;
      break;

     case 7938:
      /* GL_VERSION */ var webGLVersion = GLctx.getParameter(7938);
      // return GLES version string corresponding to the version of the WebGL context
      var glVersion = `OpenGL ES 2.0 (${webGLVersion})`;
      if (true) glVersion = `OpenGL ES 3.0 (${webGLVersion})`;
      ret = stringToNewUTF8(glVersion);
      break;

     case 35724:
      /* GL_SHADING_LANGUAGE_VERSION */ var glslVersion = GLctx.getParameter(35724);
      // extract the version number 'N.M' from the string 'WebGL GLSL ES N.M ...'
      var ver_re = /^WebGL GLSL ES ([0-9]\.[0-9][0-9]?)(?:$| .*)/;
      var ver_num = glslVersion.match(ver_re);
      if (ver_num !== null) {
        if (ver_num[1].length == 3) ver_num[1] = ver_num[1] + "0";
        // ensure minor version has 2 digits
        glslVersion = `OpenGL ES GLSL ES ${ver_num[1]} (${glslVersion})`;
      }
      ret = stringToNewUTF8(glslVersion);
      break;

     default:
      GL.recordError(1280);
    }
    // fall through
    GL.stringCache[name_] = ret;
  }
  return ret;
};

var _emscripten_glGetString = _glGetString;

/** @suppress {duplicate } */ var _glGetStringi = (name, index) => {
  if (GL.currentContext.version < 2) {
    GL.recordError(1282);
    // Calling GLES3/WebGL2 function with a GLES2/WebGL1 context
    return 0;
  }
  var stringiCache = GL.stringiCache[name];
  if (stringiCache) {
    if (index < 0 || index >= stringiCache.length) {
      GL.recordError(1281);
      /*GL_INVALID_VALUE*/ return 0;
    }
    return stringiCache[index];
  }
  switch (name) {
   case 7939:
    /* GL_EXTENSIONS */ var exts = webglGetExtensions().map(stringToNewUTF8);
    stringiCache = GL.stringiCache[name] = exts;
    if (index < 0 || index >= stringiCache.length) {
      GL.recordError(1281);
      /*GL_INVALID_VALUE*/ return 0;
    }
    return stringiCache[index];

   default:
    GL.recordError(1280);
    /*GL_INVALID_ENUM*/ return 0;
  }
};

var _emscripten_glGetStringi = _glGetStringi;

/** @suppress {duplicate } */ var _glGetSynciv = (sync, pname, bufSize, length, values) => {
  if (bufSize < 0) {
    // GLES3 specification does not specify how to behave if bufSize < 0, however in the spec wording for glGetInternalformativ, it does say that GL_INVALID_VALUE should be raised,
    // so raise GL_INVALID_VALUE here as well.
    GL.recordError(1281);
    /* GL_INVALID_VALUE */ return;
  }
  if (!values) {
    // GLES3 specification does not specify how to behave if values is a null pointer. Since calling this function does not make sense
    // if values == null, issue a GL error to notify user about it.
    GL.recordError(1281);
    /* GL_INVALID_VALUE */ return;
  }
  var ret = GLctx.getSyncParameter(GL.syncs[sync], pname);
  if (ret !== null) {
    GROWABLE_HEAP_I32()[((values) >> 2)] = ret;
    checkInt32(ret);
    if (length) GROWABLE_HEAP_I32()[((length) >> 2)] = 1;
    checkInt32(1);
  }
};

// Report a single value outputted.
var _emscripten_glGetSynciv = _glGetSynciv;

/** @suppress {duplicate } */ var _glGetTexParameterfv = (target, pname, params) => {
  if (!params) {
    // GLES2 specification does not specify how to behave if params is a null
    // pointer. Since calling this function does not make sense if p == null,
    // issue a GL error to notify user about it.
    GL.recordError(1281);
    /* GL_INVALID_VALUE */ return;
  }
  GROWABLE_HEAP_F32()[((params) >> 2)] = GLctx.getTexParameter(target, pname);
};

var _emscripten_glGetTexParameterfv = _glGetTexParameterfv;

/** @suppress {duplicate } */ var _glGetTexParameteriv = (target, pname, params) => {
  if (!params) {
    // GLES2 specification does not specify how to behave if params is a null
    // pointer. Since calling this function does not make sense if p == null,
    // issue a GL error to notify user about it.
    GL.recordError(1281);
    /* GL_INVALID_VALUE */ return;
  }
  GROWABLE_HEAP_I32()[((params) >> 2)] = GLctx.getTexParameter(target, pname);
  checkInt32(GLctx.getTexParameter(target, pname));
};

var _emscripten_glGetTexParameteriv = _glGetTexParameteriv;

/** @suppress {duplicate } */ var _glGetTransformFeedbackVarying = (program, index, bufSize, length, size, type, name) => {
  program = GL.programs[program];
  var info = GLctx.getTransformFeedbackVarying(program, index);
  if (!info) return;
  // If an error occurred, the return parameters length, size, type and name will be unmodified.
  if (name && bufSize > 0) {
    var numBytesWrittenExclNull = stringToUTF8(info.name, name, bufSize);
    if (length) GROWABLE_HEAP_I32()[((length) >> 2)] = numBytesWrittenExclNull;
    checkInt32(numBytesWrittenExclNull);
  } else {
    if (length) GROWABLE_HEAP_I32()[((length) >> 2)] = 0;
    checkInt32(0);
  }
  if (size) GROWABLE_HEAP_I32()[((size) >> 2)] = info.size;
  checkInt32(info.size);
  if (type) GROWABLE_HEAP_I32()[((type) >> 2)] = info.type;
  checkInt32(info.type);
};

var _emscripten_glGetTransformFeedbackVarying = _glGetTransformFeedbackVarying;

/** @suppress {duplicate } */ var _glGetUniformBlockIndex = (program, uniformBlockName) => GLctx.getUniformBlockIndex(GL.programs[program], UTF8ToString(uniformBlockName));

var _emscripten_glGetUniformBlockIndex = _glGetUniformBlockIndex;

/** @suppress {duplicate } */ var _glGetUniformIndices = (program, uniformCount, uniformNames, uniformIndices) => {
  if (!uniformIndices) {
    // GLES2 specification does not specify how to behave if uniformIndices is a null pointer. Since calling this function does not make sense
    // if uniformIndices == null, issue a GL error to notify user about it.
    GL.recordError(1281);
    /* GL_INVALID_VALUE */ return;
  }
  if (uniformCount > 0 && (uniformNames == 0 || uniformIndices == 0)) {
    GL.recordError(1281);
    /* GL_INVALID_VALUE */ return;
  }
  program = GL.programs[program];
  var names = [];
  for (var i = 0; i < uniformCount; i++) names.push(UTF8ToString(GROWABLE_HEAP_I32()[(((uniformNames) + (i * 4)) >> 2)]));
  var result = GLctx.getUniformIndices(program, names);
  if (!result) return;
  // GL spec: If an error is generated, nothing is written out to uniformIndices.
  var len = result.length;
  for (var i = 0; i < len; i++) {
    GROWABLE_HEAP_I32()[(((uniformIndices) + (i * 4)) >> 2)] = result[i];
    checkInt32(result[i]);
  }
};

var _emscripten_glGetUniformIndices = _glGetUniformIndices;

/** @suppress {checkTypes} */ var jstoi_q = str => parseInt(str);

/** @noinline */ var webglGetLeftBracePos = name => name.slice(-1) == "]" && name.lastIndexOf("[");

var webglPrepareUniformLocationsBeforeFirstUse = program => {
  var uniformLocsById = program.uniformLocsById, // Maps GLuint -> WebGLUniformLocation
  uniformSizeAndIdsByName = program.uniformSizeAndIdsByName, // Maps name -> [uniform array length, GLuint]
  i, j;
  // On the first time invocation of glGetUniformLocation on this shader program:
  // initialize cache data structures and discover which uniforms are arrays.
  if (!uniformLocsById) {
    // maps GLint integer locations to WebGLUniformLocations
    program.uniformLocsById = uniformLocsById = {};
    // maps integer locations back to uniform name strings, so that we can lazily fetch uniform array locations
    program.uniformArrayNamesById = {};
    var numActiveUniforms = GLctx.getProgramParameter(program, 35718);
    /*GL_ACTIVE_UNIFORMS*/ for (i = 0; i < numActiveUniforms; ++i) {
      var u = GLctx.getActiveUniform(program, i);
      var nm = u.name;
      var sz = u.size;
      var lb = webglGetLeftBracePos(nm);
      var arrayName = lb > 0 ? nm.slice(0, lb) : nm;
      // Assign a new location.
      var id = program.uniformIdCounter;
      program.uniformIdCounter += sz;
      // Eagerly get the location of the uniformArray[0] base element.
      // The remaining indices >0 will be left for lazy evaluation to
      // improve performance. Those may never be needed to fetch, if the
      // application fills arrays always in full starting from the first
      // element of the array.
      uniformSizeAndIdsByName[arrayName] = [ sz, id ];
      // Store placeholder integers in place that highlight that these
      // >0 index locations are array indices pending population.
      for (j = 0; j < sz; ++j) {
        uniformLocsById[id] = j;
        program.uniformArrayNamesById[id++] = arrayName;
      }
    }
  }
};

/** @suppress {duplicate } */ var _glGetUniformLocation = (program, name) => {
  name = UTF8ToString(name);
  if (program = GL.programs[program]) {
    webglPrepareUniformLocationsBeforeFirstUse(program);
    var uniformLocsById = program.uniformLocsById;
    // Maps GLuint -> WebGLUniformLocation
    var arrayIndex = 0;
    var uniformBaseName = name;
    // Invariant: when populating integer IDs for uniform locations, we must
    // maintain the precondition that arrays reside in contiguous addresses,
    // i.e. for a 'vec4 colors[10];', colors[4] must be at location
    // colors[0]+4.  However, user might call glGetUniformLocation(program,
    // "colors") for an array, so we cannot discover based on the user input
    // arguments whether the uniform we are dealing with is an array. The only
    // way to discover which uniforms are arrays is to enumerate over all the
    // active uniforms in the program.
    var leftBrace = webglGetLeftBracePos(name);
    // If user passed an array accessor "[index]", parse the array index off the accessor.
    if (leftBrace > 0) {
      arrayIndex = jstoi_q(name.slice(leftBrace + 1)) >>> 0;
      // "index]", coerce parseInt(']') with >>>0 to treat "foo[]" as "foo[0]" and foo[-1] as unsigned out-of-bounds.
      uniformBaseName = name.slice(0, leftBrace);
    }
    // Have we cached the location of this uniform before?
    // A pair [array length, GLint of the uniform location]
    var sizeAndId = program.uniformSizeAndIdsByName[uniformBaseName];
    // If an uniform with this name exists, and if its index is within the
    // array limits (if it's even an array), query the WebGLlocation, or
    // return an existing cached location.
    if (sizeAndId && arrayIndex < sizeAndId[0]) {
      arrayIndex += sizeAndId[1];
      // Add the base location of the uniform to the array index offset.
      if ((uniformLocsById[arrayIndex] = uniformLocsById[arrayIndex] || GLctx.getUniformLocation(program, name))) {
        return arrayIndex;
      }
    }
  } else {
    // N.b. we are currently unable to distinguish between GL program IDs that
    // never existed vs GL program IDs that have been deleted, so report
    // GL_INVALID_VALUE in both cases.
    GL.recordError(1281);
  }
  /* GL_INVALID_VALUE */ return -1;
};

var _emscripten_glGetUniformLocation = _glGetUniformLocation;

var webglGetUniformLocation = location => {
  var p = GLctx.currentProgram;
  if (p) {
    var webglLoc = p.uniformLocsById[location];
    // p.uniformLocsById[location] stores either an integer, or a
    // WebGLUniformLocation.
    // If an integer, we have not yet bound the location, so do it now. The
    // integer value specifies the array index we should bind to.
    if (typeof webglLoc == "number") {
      p.uniformLocsById[location] = webglLoc = GLctx.getUniformLocation(p, p.uniformArrayNamesById[location] + (webglLoc > 0 ? `[${webglLoc}]` : ""));
    }
    // Else an already cached WebGLUniformLocation, return it.
    return webglLoc;
  } else {
    GL.recordError(1282);
  }
};

/** @suppress{checkTypes} */ var emscriptenWebGLGetUniform = (program, location, params, type) => {
  if (!params) {
    // GLES2 specification does not specify how to behave if params is a null
    // pointer. Since calling this function does not make sense if params ==
    // null, issue a GL error to notify user about it.
    GL.recordError(1281);
    /* GL_INVALID_VALUE */ return;
  }
  program = GL.programs[program];
  webglPrepareUniformLocationsBeforeFirstUse(program);
  var data = GLctx.getUniform(program, webglGetUniformLocation(location));
  if (typeof data == "number" || typeof data == "boolean") {
    switch (type) {
     case 0:
      GROWABLE_HEAP_I32()[((params) >> 2)] = data;
      checkInt32(data);
      break;

     case 2:
      GROWABLE_HEAP_F32()[((params) >> 2)] = data;
      break;
    }
  } else {
    for (var i = 0; i < data.length; i++) {
      switch (type) {
       case 0:
        GROWABLE_HEAP_I32()[(((params) + (i * 4)) >> 2)] = data[i];
        checkInt32(data[i]);
        break;

       case 2:
        GROWABLE_HEAP_F32()[(((params) + (i * 4)) >> 2)] = data[i];
        break;
      }
    }
  }
};

/** @suppress {duplicate } */ var _glGetUniformfv = (program, location, params) => {
  emscriptenWebGLGetUniform(program, location, params, 2);
};

var _emscripten_glGetUniformfv = _glGetUniformfv;

/** @suppress {duplicate } */ var _glGetUniformiv = (program, location, params) => {
  emscriptenWebGLGetUniform(program, location, params, 0);
};

var _emscripten_glGetUniformiv = _glGetUniformiv;

/** @suppress {duplicate } */ var _glGetUniformuiv = (program, location, params) => emscriptenWebGLGetUniform(program, location, params, 0);

var _emscripten_glGetUniformuiv = _glGetUniformuiv;

/** @suppress{checkTypes} */ var emscriptenWebGLGetVertexAttrib = (index, pname, params, type) => {
  if (!params) {
    // GLES2 specification does not specify how to behave if params is a null
    // pointer. Since calling this function does not make sense if params ==
    // null, issue a GL error to notify user about it.
    GL.recordError(1281);
    /* GL_INVALID_VALUE */ return;
  }
  var data = GLctx.getVertexAttrib(index, pname);
  if (pname == 34975) /*VERTEX_ATTRIB_ARRAY_BUFFER_BINDING*/ {
    GROWABLE_HEAP_I32()[((params) >> 2)] = data && data["name"];
    checkInt32(data && data["name"]);
  } else if (typeof data == "number" || typeof data == "boolean") {
    switch (type) {
     case 0:
      GROWABLE_HEAP_I32()[((params) >> 2)] = data;
      checkInt32(data);
      break;

     case 2:
      GROWABLE_HEAP_F32()[((params) >> 2)] = data;
      break;

     case 5:
      GROWABLE_HEAP_I32()[((params) >> 2)] = Math.fround(data);
      checkInt32(Math.fround(data));
      break;
    }
  } else {
    for (var i = 0; i < data.length; i++) {
      switch (type) {
       case 0:
        GROWABLE_HEAP_I32()[(((params) + (i * 4)) >> 2)] = data[i];
        checkInt32(data[i]);
        break;

       case 2:
        GROWABLE_HEAP_F32()[(((params) + (i * 4)) >> 2)] = data[i];
        break;

       case 5:
        GROWABLE_HEAP_I32()[(((params) + (i * 4)) >> 2)] = Math.fround(data[i]);
        checkInt32(Math.fround(data[i]));
        break;
      }
    }
  }
};

/** @suppress {duplicate } */ var _glGetVertexAttribIiv = (index, pname, params) => {
  // N.B. This function may only be called if the vertex attribute was specified using the function glVertexAttribI4iv(),
  // otherwise the results are undefined. (GLES3 spec 6.1.12)
  emscriptenWebGLGetVertexAttrib(index, pname, params, 0);
};

var _emscripten_glGetVertexAttribIiv = _glGetVertexAttribIiv;

/** @suppress {duplicate } */ var _glGetVertexAttribIuiv = _glGetVertexAttribIiv;

var _emscripten_glGetVertexAttribIuiv = _glGetVertexAttribIuiv;

/** @suppress {duplicate } */ var _glGetVertexAttribPointerv = (index, pname, pointer) => {
  if (!pointer) {
    // GLES2 specification does not specify how to behave if pointer is a null
    // pointer. Since calling this function does not make sense if pointer ==
    // null, issue a GL error to notify user about it.
    GL.recordError(1281);
    /* GL_INVALID_VALUE */ return;
  }
  GROWABLE_HEAP_I32()[((pointer) >> 2)] = GLctx.getVertexAttribOffset(index, pname);
  checkInt32(GLctx.getVertexAttribOffset(index, pname));
};

var _emscripten_glGetVertexAttribPointerv = _glGetVertexAttribPointerv;

/** @suppress {duplicate } */ var _glGetVertexAttribfv = (index, pname, params) => {
  // N.B. This function may only be called if the vertex attribute was
  // specified using the function glVertexAttrib*f(), otherwise the results
  // are undefined. (GLES3 spec 6.1.12)
  emscriptenWebGLGetVertexAttrib(index, pname, params, 2);
};

var _emscripten_glGetVertexAttribfv = _glGetVertexAttribfv;

/** @suppress {duplicate } */ var _glGetVertexAttribiv = (index, pname, params) => {
  // N.B. This function may only be called if the vertex attribute was
  // specified using the function glVertexAttrib*f(), otherwise the results
  // are undefined. (GLES3 spec 6.1.12)
  emscriptenWebGLGetVertexAttrib(index, pname, params, 5);
};

var _emscripten_glGetVertexAttribiv = _glGetVertexAttribiv;

/** @suppress {duplicate } */ var _glHint = (x0, x1) => GLctx.hint(x0, x1);

var _emscripten_glHint = _glHint;

/** @suppress {duplicate } */ var _glInvalidateFramebuffer = (target, numAttachments, attachments) => {
  var list = tempFixedLengthArray[numAttachments];
  for (var i = 0; i < numAttachments; i++) {
    list[i] = GROWABLE_HEAP_I32()[(((attachments) + (i * 4)) >> 2)];
  }
  GLctx.invalidateFramebuffer(target, list);
};

var _emscripten_glInvalidateFramebuffer = _glInvalidateFramebuffer;

/** @suppress {duplicate } */ var _glInvalidateSubFramebuffer = (target, numAttachments, attachments, x, y, width, height) => {
  var list = tempFixedLengthArray[numAttachments];
  for (var i = 0; i < numAttachments; i++) {
    list[i] = GROWABLE_HEAP_I32()[(((attachments) + (i * 4)) >> 2)];
  }
  GLctx.invalidateSubFramebuffer(target, list, x, y, width, height);
};

var _emscripten_glInvalidateSubFramebuffer = _glInvalidateSubFramebuffer;

/** @suppress {duplicate } */ var _glIsBuffer = buffer => {
  var b = GL.buffers[buffer];
  if (!b) return 0;
  return GLctx.isBuffer(b);
};

var _emscripten_glIsBuffer = _glIsBuffer;

/** @suppress {duplicate } */ var _glIsEnabled = x0 => GLctx.isEnabled(x0);

var _emscripten_glIsEnabled = _glIsEnabled;

/** @suppress {duplicate } */ var _glIsFramebuffer = framebuffer => {
  var fb = GL.framebuffers[framebuffer];
  if (!fb) return 0;
  return GLctx.isFramebuffer(fb);
};

var _emscripten_glIsFramebuffer = _glIsFramebuffer;

/** @suppress {duplicate } */ var _glIsProgram = program => {
  program = GL.programs[program];
  if (!program) return 0;
  return GLctx.isProgram(program);
};

var _emscripten_glIsProgram = _glIsProgram;

/** @suppress {duplicate } */ var _glIsQuery = id => {
  var query = GL.queries[id];
  if (!query) return 0;
  return GLctx.isQuery(query);
};

var _emscripten_glIsQuery = _glIsQuery;

/** @suppress {duplicate } */ var _glIsQueryEXT = id => {
  var query = GL.queries[id];
  if (!query) return 0;
  return GLctx.disjointTimerQueryExt["isQueryEXT"](query);
};

var _emscripten_glIsQueryEXT = _glIsQueryEXT;

/** @suppress {duplicate } */ var _glIsRenderbuffer = renderbuffer => {
  var rb = GL.renderbuffers[renderbuffer];
  if (!rb) return 0;
  return GLctx.isRenderbuffer(rb);
};

var _emscripten_glIsRenderbuffer = _glIsRenderbuffer;

/** @suppress {duplicate } */ var _glIsSampler = id => {
  var sampler = GL.samplers[id];
  if (!sampler) return 0;
  return GLctx.isSampler(sampler);
};

var _emscripten_glIsSampler = _glIsSampler;

/** @suppress {duplicate } */ var _glIsShader = shader => {
  var s = GL.shaders[shader];
  if (!s) return 0;
  return GLctx.isShader(s);
};

var _emscripten_glIsShader = _glIsShader;

/** @suppress {duplicate } */ var _glIsSync = sync => GLctx.isSync(GL.syncs[sync]);

var _emscripten_glIsSync = _glIsSync;

/** @suppress {duplicate } */ var _glIsTexture = id => {
  var texture = GL.textures[id];
  if (!texture) return 0;
  return GLctx.isTexture(texture);
};

var _emscripten_glIsTexture = _glIsTexture;

/** @suppress {duplicate } */ var _glIsTransformFeedback = id => GLctx.isTransformFeedback(GL.transformFeedbacks[id]);

var _emscripten_glIsTransformFeedback = _glIsTransformFeedback;

/** @suppress {duplicate } */ var _glIsVertexArray = array => {
  var vao = GL.vaos[array];
  if (!vao) return 0;
  return GLctx.isVertexArray(vao);
};

var _emscripten_glIsVertexArray = _glIsVertexArray;

/** @suppress {duplicate } */ var _glIsVertexArrayOES = _glIsVertexArray;

var _emscripten_glIsVertexArrayOES = _glIsVertexArrayOES;

/** @suppress {duplicate } */ var _glLineWidth = x0 => GLctx.lineWidth(x0);

var _emscripten_glLineWidth = _glLineWidth;

/** @suppress {duplicate } */ var _glLinkProgram = program => {
  program = GL.programs[program];
  GLctx.linkProgram(program);
  // Invalidate earlier computed uniform->ID mappings, those have now become stale
  program.uniformLocsById = 0;
  // Mark as null-like so that glGetUniformLocation() knows to populate this again.
  program.uniformSizeAndIdsByName = {};
};

var _emscripten_glLinkProgram = _glLinkProgram;

/** @suppress {duplicate } */ var _glPauseTransformFeedback = () => GLctx.pauseTransformFeedback();

var _emscripten_glPauseTransformFeedback = _glPauseTransformFeedback;

/** @suppress {duplicate } */ var _glPixelStorei = (pname, param) => {
  if (pname == 3317) {
    GL.unpackAlignment = param;
  } else if (pname == 3314) {
    GL.unpackRowLength = param;
  }
  GLctx.pixelStorei(pname, param);
};

var _emscripten_glPixelStorei = _glPixelStorei;

/** @suppress {duplicate } */ var _glPolygonModeWEBGL = (face, mode) => {
  GLctx.webglPolygonMode["polygonModeWEBGL"](face, mode);
};

var _emscripten_glPolygonModeWEBGL = _glPolygonModeWEBGL;

/** @suppress {duplicate } */ var _glPolygonOffset = (x0, x1) => GLctx.polygonOffset(x0, x1);

var _emscripten_glPolygonOffset = _glPolygonOffset;

/** @suppress {duplicate } */ var _glPolygonOffsetClampEXT = (factor, units, clamp) => {
  GLctx.extPolygonOffsetClamp["polygonOffsetClampEXT"](factor, units, clamp);
};

var _emscripten_glPolygonOffsetClampEXT = _glPolygonOffsetClampEXT;

/** @suppress {duplicate } */ var _glProgramBinary = (program, binaryFormat, binary, length) => {
  GL.recordError(1280);
};

/*GL_INVALID_ENUM*/ var _emscripten_glProgramBinary = _glProgramBinary;

/** @suppress {duplicate } */ var _glProgramParameteri = (program, pname, value) => {
  GL.recordError(1280);
};

/*GL_INVALID_ENUM*/ var _emscripten_glProgramParameteri = _glProgramParameteri;

/** @suppress {duplicate } */ var _glQueryCounterEXT = (id, target) => {
  GLctx.disjointTimerQueryExt["queryCounterEXT"](GL.queries[id], target);
};

var _emscripten_glQueryCounterEXT = _glQueryCounterEXT;

/** @suppress {duplicate } */ var _glReadBuffer = x0 => GLctx.readBuffer(x0);

var _emscripten_glReadBuffer = _glReadBuffer;

var computeUnpackAlignedImageSize = (width, height, sizePerPixel) => {
  function roundedToNextMultipleOf(x, y) {
    return (x + y - 1) & -y;
  }
  var plainRowSize = (GL.unpackRowLength || width) * sizePerPixel;
  var alignedRowSize = roundedToNextMultipleOf(plainRowSize, GL.unpackAlignment);
  return height * alignedRowSize;
};

var colorChannelsInGlTextureFormat = format => {
  // Micro-optimizations for size: map format to size by subtracting smallest
  // enum value (0x1902) from all values first.  Also omit the most common
  // size value (1) from the list, which is assumed by formats not on the
  // list.
  var colorChannels = {
    // 0x1902 /* GL_DEPTH_COMPONENT */ - 0x1902: 1,
    // 0x1906 /* GL_ALPHA */ - 0x1902: 1,
    5: 3,
    6: 4,
    // 0x1909 /* GL_LUMINANCE */ - 0x1902: 1,
    8: 2,
    29502: 3,
    29504: 4,
    // 0x1903 /* GL_RED */ - 0x1902: 1,
    26917: 2,
    26918: 2,
    // 0x8D94 /* GL_RED_INTEGER */ - 0x1902: 1,
    29846: 3,
    29847: 4
  };
  return colorChannels[format - 6402] || 1;
};

var heapObjectForWebGLType = type => {
  // Micro-optimization for size: Subtract lowest GL enum number (0x1400/* GL_BYTE */) from type to compare
  // smaller values for the heap, for shorter generated code size.
  // Also the type HEAPU16 is not tested for explicitly, but any unrecognized type will return out HEAPU16.
  // (since most types are HEAPU16)
  type -= 5120;
  if (type == 0) return GROWABLE_HEAP_I8();
  if (type == 1) return GROWABLE_HEAP_U8();
  if (type == 2) return GROWABLE_HEAP_I16();
  if (type == 4) return GROWABLE_HEAP_I32();
  if (type == 6) return GROWABLE_HEAP_F32();
  if (type == 5 || type == 28922 || type == 28520 || type == 30779 || type == 30782) return GROWABLE_HEAP_U32();
  return GROWABLE_HEAP_U16();
};

var toTypedArrayIndex = (pointer, heap) => pointer >>> (31 - Math.clz32(heap.BYTES_PER_ELEMENT));

var emscriptenWebGLGetTexPixelData = (type, format, width, height, pixels, internalFormat) => {
  var heap = heapObjectForWebGLType(type);
  var sizePerPixel = colorChannelsInGlTextureFormat(format) * heap.BYTES_PER_ELEMENT;
  var bytes = computeUnpackAlignedImageSize(width, height, sizePerPixel);
  return heap.subarray(toTypedArrayIndex(pixels, heap), toTypedArrayIndex(pixels + bytes, heap));
};

/** @suppress {duplicate } */ var _glReadPixels = (x, y, width, height, format, type, pixels) => {
  if (true) {
    if (GLctx.currentPixelPackBufferBinding) {
      GLctx.readPixels(x, y, width, height, format, type, pixels);
      return;
    }
    var heap = heapObjectForWebGLType(type);
    var target = toTypedArrayIndex(pixels, heap);
    GLctx.readPixels(x, y, width, height, format, type, heap, target);
    return;
  }
};

var _emscripten_glReadPixels = _glReadPixels;

/** @suppress {duplicate } */ var _glReleaseShaderCompiler = () => {};

// NOP (as allowed by GLES 2.0 spec)
var _emscripten_glReleaseShaderCompiler = _glReleaseShaderCompiler;

/** @suppress {duplicate } */ var _glRenderbufferStorage = (x0, x1, x2, x3) => GLctx.renderbufferStorage(x0, x1, x2, x3);

var _emscripten_glRenderbufferStorage = _glRenderbufferStorage;

/** @suppress {duplicate } */ var _glRenderbufferStorageMultisample = (x0, x1, x2, x3, x4) => GLctx.renderbufferStorageMultisample(x0, x1, x2, x3, x4);

var _emscripten_glRenderbufferStorageMultisample = _glRenderbufferStorageMultisample;

/** @suppress {duplicate } */ var _glResumeTransformFeedback = () => GLctx.resumeTransformFeedback();

var _emscripten_glResumeTransformFeedback = _glResumeTransformFeedback;

/** @suppress {duplicate } */ var _glSampleCoverage = (value, invert) => {
  GLctx.sampleCoverage(value, !!invert);
};

var _emscripten_glSampleCoverage = _glSampleCoverage;

/** @suppress {duplicate } */ var _glSamplerParameterf = (sampler, pname, param) => {
  GLctx.samplerParameterf(GL.samplers[sampler], pname, param);
};

var _emscripten_glSamplerParameterf = _glSamplerParameterf;

/** @suppress {duplicate } */ var _glSamplerParameterfv = (sampler, pname, params) => {
  var param = GROWABLE_HEAP_F32()[((params) >> 2)];
  GLctx.samplerParameterf(GL.samplers[sampler], pname, param);
};

var _emscripten_glSamplerParameterfv = _glSamplerParameterfv;

/** @suppress {duplicate } */ var _glSamplerParameteri = (sampler, pname, param) => {
  GLctx.samplerParameteri(GL.samplers[sampler], pname, param);
};

var _emscripten_glSamplerParameteri = _glSamplerParameteri;

/** @suppress {duplicate } */ var _glSamplerParameteriv = (sampler, pname, params) => {
  var param = GROWABLE_HEAP_I32()[((params) >> 2)];
  GLctx.samplerParameteri(GL.samplers[sampler], pname, param);
};

var _emscripten_glSamplerParameteriv = _glSamplerParameteriv;

/** @suppress {duplicate } */ var _glScissor = (x0, x1, x2, x3) => GLctx.scissor(x0, x1, x2, x3);

var _emscripten_glScissor = _glScissor;

/** @suppress {duplicate } */ var _glShaderBinary = (count, shaders, binaryformat, binary, length) => {
  GL.recordError(1280);
};

/*GL_INVALID_ENUM*/ var _emscripten_glShaderBinary = _glShaderBinary;

/** @suppress {duplicate } */ var _glShaderSource = (shader, count, string, length) => {
  var source = GL.getSource(shader, count, string, length);
  GLctx.shaderSource(GL.shaders[shader], source);
};

var _emscripten_glShaderSource = _glShaderSource;

/** @suppress {duplicate } */ var _glStencilFunc = (x0, x1, x2) => GLctx.stencilFunc(x0, x1, x2);

var _emscripten_glStencilFunc = _glStencilFunc;

/** @suppress {duplicate } */ var _glStencilFuncSeparate = (x0, x1, x2, x3) => GLctx.stencilFuncSeparate(x0, x1, x2, x3);

var _emscripten_glStencilFuncSeparate = _glStencilFuncSeparate;

/** @suppress {duplicate } */ var _glStencilMask = x0 => GLctx.stencilMask(x0);

var _emscripten_glStencilMask = _glStencilMask;

/** @suppress {duplicate } */ var _glStencilMaskSeparate = (x0, x1) => GLctx.stencilMaskSeparate(x0, x1);

var _emscripten_glStencilMaskSeparate = _glStencilMaskSeparate;

/** @suppress {duplicate } */ var _glStencilOp = (x0, x1, x2) => GLctx.stencilOp(x0, x1, x2);

var _emscripten_glStencilOp = _glStencilOp;

/** @suppress {duplicate } */ var _glStencilOpSeparate = (x0, x1, x2, x3) => GLctx.stencilOpSeparate(x0, x1, x2, x3);

var _emscripten_glStencilOpSeparate = _glStencilOpSeparate;

/** @suppress {duplicate } */ var _glTexImage2D = (target, level, internalFormat, width, height, border, format, type, pixels) => {
  if (true) {
    if (GLctx.currentPixelUnpackBufferBinding) {
      GLctx.texImage2D(target, level, internalFormat, width, height, border, format, type, pixels);
      return;
    }
    if (pixels) {
      var heap = heapObjectForWebGLType(type);
      var index = toTypedArrayIndex(pixels, heap);
      GLctx.texImage2D(target, level, internalFormat, width, height, border, format, type, heap, index);
      return;
    }
  }
  var pixelData = pixels ? emscriptenWebGLGetTexPixelData(type, format, width, height, pixels, internalFormat) : null;
  GLctx.texImage2D(target, level, internalFormat, width, height, border, format, type, pixelData);
};

var _emscripten_glTexImage2D = _glTexImage2D;

/** @suppress {duplicate } */ var _glTexImage3D = (target, level, internalFormat, width, height, depth, border, format, type, pixels) => {
  if (GLctx.currentPixelUnpackBufferBinding) {
    GLctx.texImage3D(target, level, internalFormat, width, height, depth, border, format, type, pixels);
  } else if (pixels) {
    var heap = heapObjectForWebGLType(type);
    GLctx.texImage3D(target, level, internalFormat, width, height, depth, border, format, type, heap, toTypedArrayIndex(pixels, heap));
  } else {
    GLctx.texImage3D(target, level, internalFormat, width, height, depth, border, format, type, null);
  }
};

var _emscripten_glTexImage3D = _glTexImage3D;

/** @suppress {duplicate } */ var _glTexParameterf = (x0, x1, x2) => GLctx.texParameterf(x0, x1, x2);

var _emscripten_glTexParameterf = _glTexParameterf;

/** @suppress {duplicate } */ var _glTexParameterfv = (target, pname, params) => {
  var param = GROWABLE_HEAP_F32()[((params) >> 2)];
  GLctx.texParameterf(target, pname, param);
};

var _emscripten_glTexParameterfv = _glTexParameterfv;

/** @suppress {duplicate } */ var _glTexParameteri = (x0, x1, x2) => GLctx.texParameteri(x0, x1, x2);

var _emscripten_glTexParameteri = _glTexParameteri;

/** @suppress {duplicate } */ var _glTexParameteriv = (target, pname, params) => {
  var param = GROWABLE_HEAP_I32()[((params) >> 2)];
  GLctx.texParameteri(target, pname, param);
};

var _emscripten_glTexParameteriv = _glTexParameteriv;

/** @suppress {duplicate } */ var _glTexStorage2D = (x0, x1, x2, x3, x4) => GLctx.texStorage2D(x0, x1, x2, x3, x4);

var _emscripten_glTexStorage2D = _glTexStorage2D;

/** @suppress {duplicate } */ var _glTexStorage3D = (x0, x1, x2, x3, x4, x5) => GLctx.texStorage3D(x0, x1, x2, x3, x4, x5);

var _emscripten_glTexStorage3D = _glTexStorage3D;

/** @suppress {duplicate } */ var _glTexSubImage2D = (target, level, xoffset, yoffset, width, height, format, type, pixels) => {
  if (true) {
    if (GLctx.currentPixelUnpackBufferBinding) {
      GLctx.texSubImage2D(target, level, xoffset, yoffset, width, height, format, type, pixels);
      return;
    }
    if (pixels) {
      var heap = heapObjectForWebGLType(type);
      GLctx.texSubImage2D(target, level, xoffset, yoffset, width, height, format, type, heap, toTypedArrayIndex(pixels, heap));
      return;
    }
  }
  var pixelData = pixels ? emscriptenWebGLGetTexPixelData(type, format, width, height, pixels, 0) : null;
  GLctx.texSubImage2D(target, level, xoffset, yoffset, width, height, format, type, pixelData);
};

var _emscripten_glTexSubImage2D = _glTexSubImage2D;

/** @suppress {duplicate } */ var _glTexSubImage3D = (target, level, xoffset, yoffset, zoffset, width, height, depth, format, type, pixels) => {
  if (GLctx.currentPixelUnpackBufferBinding) {
    GLctx.texSubImage3D(target, level, xoffset, yoffset, zoffset, width, height, depth, format, type, pixels);
  } else if (pixels) {
    var heap = heapObjectForWebGLType(type);
    GLctx.texSubImage3D(target, level, xoffset, yoffset, zoffset, width, height, depth, format, type, heap, toTypedArrayIndex(pixels, heap));
  } else {
    GLctx.texSubImage3D(target, level, xoffset, yoffset, zoffset, width, height, depth, format, type, null);
  }
};

var _emscripten_glTexSubImage3D = _glTexSubImage3D;

/** @suppress {duplicate } */ var _glTransformFeedbackVaryings = (program, count, varyings, bufferMode) => {
  program = GL.programs[program];
  var vars = [];
  for (var i = 0; i < count; i++) vars.push(UTF8ToString(GROWABLE_HEAP_I32()[(((varyings) + (i * 4)) >> 2)]));
  GLctx.transformFeedbackVaryings(program, vars, bufferMode);
};

var _emscripten_glTransformFeedbackVaryings = _glTransformFeedbackVaryings;

/** @suppress {duplicate } */ var _glUniform1f = (location, v0) => {
  GLctx.uniform1f(webglGetUniformLocation(location), v0);
};

var _emscripten_glUniform1f = _glUniform1f;

/** @suppress {duplicate } */ var _glUniform1fv = (location, count, value) => {
  count && GLctx.uniform1fv(webglGetUniformLocation(location), GROWABLE_HEAP_F32(), ((value) >> 2), count);
};

var _emscripten_glUniform1fv = _glUniform1fv;

/** @suppress {duplicate } */ var _glUniform1i = (location, v0) => {
  GLctx.uniform1i(webglGetUniformLocation(location), v0);
};

var _emscripten_glUniform1i = _glUniform1i;

/** @suppress {duplicate } */ var _glUniform1iv = (location, count, value) => {
  count && GLctx.uniform1iv(webglGetUniformLocation(location), GROWABLE_HEAP_I32(), ((value) >> 2), count);
};

var _emscripten_glUniform1iv = _glUniform1iv;

/** @suppress {duplicate } */ var _glUniform1ui = (location, v0) => {
  GLctx.uniform1ui(webglGetUniformLocation(location), v0);
};

var _emscripten_glUniform1ui = _glUniform1ui;

/** @suppress {duplicate } */ var _glUniform1uiv = (location, count, value) => {
  count && GLctx.uniform1uiv(webglGetUniformLocation(location), GROWABLE_HEAP_U32(), ((value) >> 2), count);
};

var _emscripten_glUniform1uiv = _glUniform1uiv;

/** @suppress {duplicate } */ var _glUniform2f = (location, v0, v1) => {
  GLctx.uniform2f(webglGetUniformLocation(location), v0, v1);
};

var _emscripten_glUniform2f = _glUniform2f;

/** @suppress {duplicate } */ var _glUniform2fv = (location, count, value) => {
  count && GLctx.uniform2fv(webglGetUniformLocation(location), GROWABLE_HEAP_F32(), ((value) >> 2), count * 2);
};

var _emscripten_glUniform2fv = _glUniform2fv;

/** @suppress {duplicate } */ var _glUniform2i = (location, v0, v1) => {
  GLctx.uniform2i(webglGetUniformLocation(location), v0, v1);
};

var _emscripten_glUniform2i = _glUniform2i;

/** @suppress {duplicate } */ var _glUniform2iv = (location, count, value) => {
  count && GLctx.uniform2iv(webglGetUniformLocation(location), GROWABLE_HEAP_I32(), ((value) >> 2), count * 2);
};

var _emscripten_glUniform2iv = _glUniform2iv;

/** @suppress {duplicate } */ var _glUniform2ui = (location, v0, v1) => {
  GLctx.uniform2ui(webglGetUniformLocation(location), v0, v1);
};

var _emscripten_glUniform2ui = _glUniform2ui;

/** @suppress {duplicate } */ var _glUniform2uiv = (location, count, value) => {
  count && GLctx.uniform2uiv(webglGetUniformLocation(location), GROWABLE_HEAP_U32(), ((value) >> 2), count * 2);
};

var _emscripten_glUniform2uiv = _glUniform2uiv;

/** @suppress {duplicate } */ var _glUniform3f = (location, v0, v1, v2) => {
  GLctx.uniform3f(webglGetUniformLocation(location), v0, v1, v2);
};

var _emscripten_glUniform3f = _glUniform3f;

/** @suppress {duplicate } */ var _glUniform3fv = (location, count, value) => {
  count && GLctx.uniform3fv(webglGetUniformLocation(location), GROWABLE_HEAP_F32(), ((value) >> 2), count * 3);
};

var _emscripten_glUniform3fv = _glUniform3fv;

/** @suppress {duplicate } */ var _glUniform3i = (location, v0, v1, v2) => {
  GLctx.uniform3i(webglGetUniformLocation(location), v0, v1, v2);
};

var _emscripten_glUniform3i = _glUniform3i;

/** @suppress {duplicate } */ var _glUniform3iv = (location, count, value) => {
  count && GLctx.uniform3iv(webglGetUniformLocation(location), GROWABLE_HEAP_I32(), ((value) >> 2), count * 3);
};

var _emscripten_glUniform3iv = _glUniform3iv;

/** @suppress {duplicate } */ var _glUniform3ui = (location, v0, v1, v2) => {
  GLctx.uniform3ui(webglGetUniformLocation(location), v0, v1, v2);
};

var _emscripten_glUniform3ui = _glUniform3ui;

/** @suppress {duplicate } */ var _glUniform3uiv = (location, count, value) => {
  count && GLctx.uniform3uiv(webglGetUniformLocation(location), GROWABLE_HEAP_U32(), ((value) >> 2), count * 3);
};

var _emscripten_glUniform3uiv = _glUniform3uiv;

/** @suppress {duplicate } */ var _glUniform4f = (location, v0, v1, v2, v3) => {
  GLctx.uniform4f(webglGetUniformLocation(location), v0, v1, v2, v3);
};

var _emscripten_glUniform4f = _glUniform4f;

/** @suppress {duplicate } */ var _glUniform4fv = (location, count, value) => {
  count && GLctx.uniform4fv(webglGetUniformLocation(location), GROWABLE_HEAP_F32(), ((value) >> 2), count * 4);
};

var _emscripten_glUniform4fv = _glUniform4fv;

/** @suppress {duplicate } */ var _glUniform4i = (location, v0, v1, v2, v3) => {
  GLctx.uniform4i(webglGetUniformLocation(location), v0, v1, v2, v3);
};

var _emscripten_glUniform4i = _glUniform4i;

/** @suppress {duplicate } */ var _glUniform4iv = (location, count, value) => {
  count && GLctx.uniform4iv(webglGetUniformLocation(location), GROWABLE_HEAP_I32(), ((value) >> 2), count * 4);
};

var _emscripten_glUniform4iv = _glUniform4iv;

/** @suppress {duplicate } */ var _glUniform4ui = (location, v0, v1, v2, v3) => {
  GLctx.uniform4ui(webglGetUniformLocation(location), v0, v1, v2, v3);
};

var _emscripten_glUniform4ui = _glUniform4ui;

/** @suppress {duplicate } */ var _glUniform4uiv = (location, count, value) => {
  count && GLctx.uniform4uiv(webglGetUniformLocation(location), GROWABLE_HEAP_U32(), ((value) >> 2), count * 4);
};

var _emscripten_glUniform4uiv = _glUniform4uiv;

/** @suppress {duplicate } */ var _glUniformBlockBinding = (program, uniformBlockIndex, uniformBlockBinding) => {
  program = GL.programs[program];
  GLctx.uniformBlockBinding(program, uniformBlockIndex, uniformBlockBinding);
};

var _emscripten_glUniformBlockBinding = _glUniformBlockBinding;

/** @suppress {duplicate } */ var _glUniformMatrix2fv = (location, count, transpose, value) => {
  count && GLctx.uniformMatrix2fv(webglGetUniformLocation(location), !!transpose, GROWABLE_HEAP_F32(), ((value) >> 2), count * 4);
};

var _emscripten_glUniformMatrix2fv = _glUniformMatrix2fv;

/** @suppress {duplicate } */ var _glUniformMatrix2x3fv = (location, count, transpose, value) => {
  count && GLctx.uniformMatrix2x3fv(webglGetUniformLocation(location), !!transpose, GROWABLE_HEAP_F32(), ((value) >> 2), count * 6);
};

var _emscripten_glUniformMatrix2x3fv = _glUniformMatrix2x3fv;

/** @suppress {duplicate } */ var _glUniformMatrix2x4fv = (location, count, transpose, value) => {
  count && GLctx.uniformMatrix2x4fv(webglGetUniformLocation(location), !!transpose, GROWABLE_HEAP_F32(), ((value) >> 2), count * 8);
};

var _emscripten_glUniformMatrix2x4fv = _glUniformMatrix2x4fv;

/** @suppress {duplicate } */ var _glUniformMatrix3fv = (location, count, transpose, value) => {
  count && GLctx.uniformMatrix3fv(webglGetUniformLocation(location), !!transpose, GROWABLE_HEAP_F32(), ((value) >> 2), count * 9);
};

var _emscripten_glUniformMatrix3fv = _glUniformMatrix3fv;

/** @suppress {duplicate } */ var _glUniformMatrix3x2fv = (location, count, transpose, value) => {
  count && GLctx.uniformMatrix3x2fv(webglGetUniformLocation(location), !!transpose, GROWABLE_HEAP_F32(), ((value) >> 2), count * 6);
};

var _emscripten_glUniformMatrix3x2fv = _glUniformMatrix3x2fv;

/** @suppress {duplicate } */ var _glUniformMatrix3x4fv = (location, count, transpose, value) => {
  count && GLctx.uniformMatrix3x4fv(webglGetUniformLocation(location), !!transpose, GROWABLE_HEAP_F32(), ((value) >> 2), count * 12);
};

var _emscripten_glUniformMatrix3x4fv = _glUniformMatrix3x4fv;

/** @suppress {duplicate } */ var _glUniformMatrix4fv = (location, count, transpose, value) => {
  count && GLctx.uniformMatrix4fv(webglGetUniformLocation(location), !!transpose, GROWABLE_HEAP_F32(), ((value) >> 2), count * 16);
};

var _emscripten_glUniformMatrix4fv = _glUniformMatrix4fv;

/** @suppress {duplicate } */ var _glUniformMatrix4x2fv = (location, count, transpose, value) => {
  count && GLctx.uniformMatrix4x2fv(webglGetUniformLocation(location), !!transpose, GROWABLE_HEAP_F32(), ((value) >> 2), count * 8);
};

var _emscripten_glUniformMatrix4x2fv = _glUniformMatrix4x2fv;

/** @suppress {duplicate } */ var _glUniformMatrix4x3fv = (location, count, transpose, value) => {
  count && GLctx.uniformMatrix4x3fv(webglGetUniformLocation(location), !!transpose, GROWABLE_HEAP_F32(), ((value) >> 2), count * 12);
};

var _emscripten_glUniformMatrix4x3fv = _glUniformMatrix4x3fv;

/** @suppress {duplicate } */ var _glUseProgram = program => {
  program = GL.programs[program];
  GLctx.useProgram(program);
  // Record the currently active program so that we can access the uniform
  // mapping table of that program.
  GLctx.currentProgram = program;
};

var _emscripten_glUseProgram = _glUseProgram;

/** @suppress {duplicate } */ var _glValidateProgram = program => {
  GLctx.validateProgram(GL.programs[program]);
};

var _emscripten_glValidateProgram = _glValidateProgram;

/** @suppress {duplicate } */ var _glVertexAttrib1f = (x0, x1) => GLctx.vertexAttrib1f(x0, x1);

var _emscripten_glVertexAttrib1f = _glVertexAttrib1f;

/** @suppress {duplicate } */ var _glVertexAttrib1fv = (index, v) => {
  GLctx.vertexAttrib1f(index, GROWABLE_HEAP_F32()[v >> 2]);
};

var _emscripten_glVertexAttrib1fv = _glVertexAttrib1fv;

/** @suppress {duplicate } */ var _glVertexAttrib2f = (x0, x1, x2) => GLctx.vertexAttrib2f(x0, x1, x2);

var _emscripten_glVertexAttrib2f = _glVertexAttrib2f;

/** @suppress {duplicate } */ var _glVertexAttrib2fv = (index, v) => {
  GLctx.vertexAttrib2f(index, GROWABLE_HEAP_F32()[v >> 2], GROWABLE_HEAP_F32()[v + 4 >> 2]);
};

var _emscripten_glVertexAttrib2fv = _glVertexAttrib2fv;

/** @suppress {duplicate } */ var _glVertexAttrib3f = (x0, x1, x2, x3) => GLctx.vertexAttrib3f(x0, x1, x2, x3);

var _emscripten_glVertexAttrib3f = _glVertexAttrib3f;

/** @suppress {duplicate } */ var _glVertexAttrib3fv = (index, v) => {
  GLctx.vertexAttrib3f(index, GROWABLE_HEAP_F32()[v >> 2], GROWABLE_HEAP_F32()[v + 4 >> 2], GROWABLE_HEAP_F32()[v + 8 >> 2]);
};

var _emscripten_glVertexAttrib3fv = _glVertexAttrib3fv;

/** @suppress {duplicate } */ var _glVertexAttrib4f = (x0, x1, x2, x3, x4) => GLctx.vertexAttrib4f(x0, x1, x2, x3, x4);

var _emscripten_glVertexAttrib4f = _glVertexAttrib4f;

/** @suppress {duplicate } */ var _glVertexAttrib4fv = (index, v) => {
  GLctx.vertexAttrib4f(index, GROWABLE_HEAP_F32()[v >> 2], GROWABLE_HEAP_F32()[v + 4 >> 2], GROWABLE_HEAP_F32()[v + 8 >> 2], GROWABLE_HEAP_F32()[v + 12 >> 2]);
};

var _emscripten_glVertexAttrib4fv = _glVertexAttrib4fv;

/** @suppress {duplicate } */ var _glVertexAttribDivisor = (index, divisor) => {
  GLctx.vertexAttribDivisor(index, divisor);
};

var _emscripten_glVertexAttribDivisor = _glVertexAttribDivisor;

/** @suppress {duplicate } */ var _glVertexAttribDivisorANGLE = _glVertexAttribDivisor;

var _emscripten_glVertexAttribDivisorANGLE = _glVertexAttribDivisorANGLE;

/** @suppress {duplicate } */ var _glVertexAttribDivisorARB = _glVertexAttribDivisor;

var _emscripten_glVertexAttribDivisorARB = _glVertexAttribDivisorARB;

/** @suppress {duplicate } */ var _glVertexAttribDivisorEXT = _glVertexAttribDivisor;

var _emscripten_glVertexAttribDivisorEXT = _glVertexAttribDivisorEXT;

/** @suppress {duplicate } */ var _glVertexAttribDivisorNV = _glVertexAttribDivisor;

var _emscripten_glVertexAttribDivisorNV = _glVertexAttribDivisorNV;

/** @suppress {duplicate } */ var _glVertexAttribI4i = (x0, x1, x2, x3, x4) => GLctx.vertexAttribI4i(x0, x1, x2, x3, x4);

var _emscripten_glVertexAttribI4i = _glVertexAttribI4i;

/** @suppress {duplicate } */ var _glVertexAttribI4iv = (index, v) => {
  GLctx.vertexAttribI4i(index, GROWABLE_HEAP_I32()[v >> 2], GROWABLE_HEAP_I32()[v + 4 >> 2], GROWABLE_HEAP_I32()[v + 8 >> 2], GROWABLE_HEAP_I32()[v + 12 >> 2]);
};

var _emscripten_glVertexAttribI4iv = _glVertexAttribI4iv;

/** @suppress {duplicate } */ var _glVertexAttribI4ui = (x0, x1, x2, x3, x4) => GLctx.vertexAttribI4ui(x0, x1, x2, x3, x4);

var _emscripten_glVertexAttribI4ui = _glVertexAttribI4ui;

/** @suppress {duplicate } */ var _glVertexAttribI4uiv = (index, v) => {
  GLctx.vertexAttribI4ui(index, GROWABLE_HEAP_U32()[v >> 2], GROWABLE_HEAP_U32()[v + 4 >> 2], GROWABLE_HEAP_U32()[v + 8 >> 2], GROWABLE_HEAP_U32()[v + 12 >> 2]);
};

var _emscripten_glVertexAttribI4uiv = _glVertexAttribI4uiv;

/** @suppress {duplicate } */ var _glVertexAttribIPointer = (index, size, type, stride, ptr) => {
  GLctx.vertexAttribIPointer(index, size, type, stride, ptr);
};

var _emscripten_glVertexAttribIPointer = _glVertexAttribIPointer;

/** @suppress {duplicate } */ var _glVertexAttribPointer = (index, size, type, normalized, stride, ptr) => {
  GLctx.vertexAttribPointer(index, size, type, !!normalized, stride, ptr);
};

var _emscripten_glVertexAttribPointer = _glVertexAttribPointer;

/** @suppress {duplicate } */ var _glViewport = (x0, x1, x2, x3) => GLctx.viewport(x0, x1, x2, x3);

var _emscripten_glViewport = _glViewport;

/** @suppress {duplicate } */ var _glWaitSync = (sync, flags, timeout_low, timeout_high) => {
  // See WebGL2 vs GLES3 difference on GL_TIMEOUT_IGNORED above (https://www.khronos.org/registry/webgl/specs/latest/2.0/#5.15)
  var timeout = convertI32PairToI53(timeout_low, timeout_high);
  GLctx.waitSync(GL.syncs[sync], flags, timeout);
};

var _emscripten_glWaitSync = _glWaitSync;

var getHeapMax = () => // Stay one Wasm page short of 4GB: while e.g. Chrome is able to allocate
// full 4GB Wasm memories, the size will wrap back to 0 bytes in Wasm side
// for any code that deals with heap sizes, which would require special
// casing all heap size related code to treat 0 specially.
2147483648;

var growMemory = size => {
  var b = wasmMemory.buffer;
  var pages = ((size - b.byteLength + 65535) / 65536) | 0;
  try {
    // round size grow request up to wasm page size (fixed 64KB per spec)
    wasmMemory.grow(pages);
    // .grow() takes a delta compared to the previous size
    updateMemoryViews();
    return 1;
  } /*success*/ catch (e) {
    err(`growMemory: Attempted to grow heap from ${b.byteLength} bytes to ${size} bytes, but got error: ${e}`);
  }
};

// implicit 0 return to save code size (caller will cast "undefined" into 0
// anyhow)
var _emscripten_resize_heap = requestedSize => {
  var oldSize = GROWABLE_HEAP_U8().length;
  // With CAN_ADDRESS_2GB or MEMORY64, pointers are already unsigned.
  requestedSize >>>= 0;
  // With multithreaded builds, races can happen (another thread might increase the size
  // in between), so return a failure, and let the caller retry.
  if (requestedSize <= oldSize) {
    return false;
  }
  // Memory resize rules:
  // 1.  Always increase heap size to at least the requested size, rounded up
  //     to next page multiple.
  // 2a. If MEMORY_GROWTH_LINEAR_STEP == -1, excessively resize the heap
  //     geometrically: increase the heap size according to
  //     MEMORY_GROWTH_GEOMETRIC_STEP factor (default +20%), At most
  //     overreserve by MEMORY_GROWTH_GEOMETRIC_CAP bytes (default 96MB).
  // 2b. If MEMORY_GROWTH_LINEAR_STEP != -1, excessively resize the heap
  //     linearly: increase the heap size by at least
  //     MEMORY_GROWTH_LINEAR_STEP bytes.
  // 3.  Max size for the heap is capped at 2048MB-WASM_PAGE_SIZE, or by
  //     MAXIMUM_MEMORY, or by ASAN limit, depending on which is smallest
  // 4.  If we were unable to allocate as much memory, it may be due to
  //     over-eager decision to excessively reserve due to (3) above.
  //     Hence if an allocation fails, cut down on the amount of excess
  //     growth, in an attempt to succeed to perform a smaller allocation.
  // A limit is set for how much we can grow. We should not exceed that
  // (the wasm binary specifies it, so if we tried, we'd fail anyhow).
  var maxHeapSize = getHeapMax();
  if (requestedSize > maxHeapSize) {
    err(`Cannot enlarge memory, requested ${requestedSize} bytes, but the limit is ${maxHeapSize} bytes!`);
    return false;
  }
  // Loop through potential heap size increases. If we attempt a too eager
  // reservation that fails, cut down on the attempted size and reserve a
  // smaller bump instead. (max 3 times, chosen somewhat arbitrarily)
  for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
    var overGrownHeapSize = oldSize * (1 + .2 / cutDown);
    // ensure geometric growth
    // but limit overreserving (default to capping at +96MB overgrowth at most)
    overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296);
    var newSize = Math.min(maxHeapSize, alignMemory(Math.max(requestedSize, overGrownHeapSize), 65536));
    var t0 = _emscripten_get_now();
    var replacement = growMemory(newSize);
    var t1 = _emscripten_get_now();
    dbg(`Heap resize call from ${oldSize} to ${newSize} took ${(t1 - t0)} msecs. Success: ${!!replacement}`);
    if (replacement) {
      return true;
    }
  }
  err(`Failed to grow the heap from ${oldSize} bytes to ${newSize} bytes, not enough memory!`);
  return false;
};

var _emscripten_set_main_loop = (func, fps, simulateInfiniteLoop) => {
  var iterFunc = getWasmTableEntry(func);
  setMainLoop(iterFunc, fps, simulateInfiniteLoop);
};

var _emscripten_unwind_to_js_event_loop = () => {
  throw "unwind";
};

var ENV = {};

var getExecutableName = () => thisProgram || "./this.program";

var getEnvStrings = () => {
  if (!getEnvStrings.strings) {
    // Default values.
    // Browser language detection #8751
    var lang = ((typeof navigator == "object" && navigator.languages && navigator.languages[0]) || "C").replace("-", "_") + ".UTF-8";
    var env = {
      "USER": "web_user",
      "LOGNAME": "web_user",
      "PATH": "/",
      "PWD": "/",
      "HOME": "/home/web_user",
      "LANG": lang,
      "_": getExecutableName()
    };
    // Apply the user-provided values, if any.
    for (var x in ENV) {
      // x is a key in ENV; if ENV[x] is undefined, that means it was
      // explicitly set to be so. We allow user code to do that to
      // force variables with default values to remain unset.
      if (ENV[x] === undefined) delete env[x]; else env[x] = ENV[x];
    }
    var strings = [];
    for (var x in env) {
      strings.push(`${x}=${env[x]}`);
    }
    getEnvStrings.strings = strings;
  }
  return getEnvStrings.strings;
};

var stringToAscii = (str, buffer) => {
  for (var i = 0; i < str.length; ++i) {
    assert(str.charCodeAt(i) === (str.charCodeAt(i) & 255));
    GROWABLE_HEAP_I8()[buffer++] = str.charCodeAt(i);
    checkInt8(str.charCodeAt(i));
  }
  // Null-terminate the string
  GROWABLE_HEAP_I8()[buffer] = 0;
  checkInt8(0);
};

var _environ_get = function(__environ, environ_buf) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(99, 0, 1, __environ, environ_buf);
  var bufSize = 0;
  getEnvStrings().forEach((string, i) => {
    var ptr = environ_buf + bufSize;
    GROWABLE_HEAP_U32()[(((__environ) + (i * 4)) >> 2)] = ptr;
    checkInt32(ptr);
    stringToAscii(string, ptr);
    bufSize += string.length + 1;
  });
  return 0;
};

var _environ_sizes_get = function(penviron_count, penviron_buf_size) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(100, 0, 1, penviron_count, penviron_buf_size);
  var strings = getEnvStrings();
  GROWABLE_HEAP_U32()[((penviron_count) >> 2)] = strings.length;
  checkInt32(strings.length);
  var bufSize = 0;
  strings.forEach(string => bufSize += string.length + 1);
  GROWABLE_HEAP_U32()[((penviron_buf_size) >> 2)] = bufSize;
  checkInt32(bufSize);
  return 0;
};

function _fd_close(fd) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(101, 0, 1, fd);
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    FS.close(stream);
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return e.errno;
  }
}

/** @param {number=} offset */ var doReadv = (stream, iov, iovcnt, offset) => {
  var ret = 0;
  for (var i = 0; i < iovcnt; i++) {
    var ptr = GROWABLE_HEAP_U32()[((iov) >> 2)];
    var len = GROWABLE_HEAP_U32()[(((iov) + (4)) >> 2)];
    iov += 8;
    var curr = FS.read(stream, GROWABLE_HEAP_I8(), ptr, len, offset);
    if (curr < 0) return -1;
    ret += curr;
    if (curr < len) break;
    // nothing more to read
    if (typeof offset != "undefined") {
      offset += curr;
    }
  }
  return ret;
};

function _fd_read(fd, iov, iovcnt, pnum) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(102, 0, 1, fd, iov, iovcnt, pnum);
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    var num = doReadv(stream, iov, iovcnt);
    GROWABLE_HEAP_U32()[((pnum) >> 2)] = num;
    checkInt32(num);
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return e.errno;
  }
}

function _fd_seek(fd, offset_low, offset_high, whence, newOffset) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(103, 0, 1, fd, offset_low, offset_high, whence, newOffset);
  var offset = convertI32PairToI53Checked(offset_low, offset_high);
  try {
    if (isNaN(offset)) return 61;
    var stream = SYSCALLS.getStreamFromFD(fd);
    FS.llseek(stream, offset, whence);
    (tempI64 = [ stream.position >>> 0, (tempDouble = stream.position, (+(Math.abs(tempDouble))) >= 1 ? (tempDouble > 0 ? (+(Math.floor((tempDouble) / 4294967296))) >>> 0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble))) >>> 0)) / 4294967296))))) >>> 0) : 0) ], 
    GROWABLE_HEAP_I32()[((newOffset) >> 2)] = tempI64[0], GROWABLE_HEAP_I32()[(((newOffset) + (4)) >> 2)] = tempI64[1]);
    checkInt64(stream.position);
    if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null;
    // reset readdir state
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return e.errno;
  }
}

/** @param {number=} offset */ var doWritev = (stream, iov, iovcnt, offset) => {
  var ret = 0;
  for (var i = 0; i < iovcnt; i++) {
    var ptr = GROWABLE_HEAP_U32()[((iov) >> 2)];
    var len = GROWABLE_HEAP_U32()[(((iov) + (4)) >> 2)];
    iov += 8;
    var curr = FS.write(stream, GROWABLE_HEAP_I8(), ptr, len, offset);
    if (curr < 0) return -1;
    ret += curr;
    if (curr < len) {
      // No more space to write.
      break;
    }
    if (typeof offset != "undefined") {
      offset += curr;
    }
  }
  return ret;
};

function _fd_write(fd, iov, iovcnt, pnum) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(104, 0, 1, fd, iov, iovcnt, pnum);
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    var num = doWritev(stream, iov, iovcnt);
    GROWABLE_HEAP_U32()[((pnum) >> 2)] = num;
    checkInt32(num);
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return e.errno;
  }
}

/** @param {number=} timeout */ var safeSetTimeout = (func, timeout) => {
  runtimeKeepalivePush();
  return setTimeout(() => {
    runtimeKeepalivePop();
    callUserCallback(func);
  }, timeout);
};

var Browser = {
  useWebGL: false,
  isFullscreen: false,
  pointerLock: false,
  moduleContextCreatedCallbacks: [],
  workers: [],
  preloadedImages: {},
  preloadedAudios: {},
  init() {
    if (Browser.initted) return;
    Browser.initted = true;
    // Support for plugins that can process preloaded files. You can add more of these to
    // your app by creating and appending to preloadPlugins.
    // Each plugin is asked if it can handle a file based on the file's name. If it can,
    // it is given the file's raw data. When it is done, it calls a callback with the file's
    // (possibly modified) data. For example, a plugin might decompress a file, or it
    // might create some side data structure for use later (like an Image element, etc.).
    var imagePlugin = {};
    imagePlugin["canHandle"] = function imagePlugin_canHandle(name) {
      return !Module["noImageDecoding"] && /\.(jpg|jpeg|png|bmp|webp)$/i.test(name);
    };
    imagePlugin["handle"] = function imagePlugin_handle(byteArray, name, onload, onerror) {
      var b = new Blob([ byteArray ], {
        type: Browser.getMimetype(name)
      });
      if (b.size !== byteArray.length) {
        // Safari bug #118630
        // Safari's Blob can only take an ArrayBuffer
        b = new Blob([ (new Uint8Array(byteArray)).buffer ], {
          type: Browser.getMimetype(name)
        });
      }
      var url = URL.createObjectURL(b);
      assert(typeof url == "string", "createObjectURL must return a url as a string");
      var img = new Image;
      img.onload = () => {
        assert(img.complete, `Image ${name} could not be decoded`);
        var canvas = /** @type {!HTMLCanvasElement} */ (document.createElement("canvas"));
        canvas.width = img.width;
        canvas.height = img.height;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        Browser.preloadedImages[name] = canvas;
        URL.revokeObjectURL(url);
        onload?.(byteArray);
      };
      img.onerror = event => {
        err(`Image ${url} could not be decoded`);
        onerror?.();
      };
      img.src = url;
    };
    preloadPlugins.push(imagePlugin);
    var audioPlugin = {};
    audioPlugin["canHandle"] = function audioPlugin_canHandle(name) {
      return !Module["noAudioDecoding"] && name.substr(-4) in {
        ".ogg": 1,
        ".wav": 1,
        ".mp3": 1
      };
    };
    audioPlugin["handle"] = function audioPlugin_handle(byteArray, name, onload, onerror) {
      var done = false;
      function finish(audio) {
        if (done) return;
        done = true;
        Browser.preloadedAudios[name] = audio;
        onload?.(byteArray);
      }
      var b = new Blob([ byteArray ], {
        type: Browser.getMimetype(name)
      });
      var url = URL.createObjectURL(b);
      // XXX we never revoke this!
      assert(typeof url == "string", "createObjectURL must return a url as a string");
      var audio = new Audio;
      audio.addEventListener("canplaythrough", () => finish(audio), false);
      // use addEventListener due to chromium bug 124926
      audio.onerror = function audio_onerror(event) {
        if (done) return;
        err(`warning: browser could not fully decode audio ${name}, trying slower base64 approach`);
        function encode64(data) {
          var BASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
          var PAD = "=";
          var ret = "";
          var leftchar = 0;
          var leftbits = 0;
          for (var i = 0; i < data.length; i++) {
            leftchar = (leftchar << 8) | data[i];
            leftbits += 8;
            while (leftbits >= 6) {
              var curr = (leftchar >> (leftbits - 6)) & 63;
              leftbits -= 6;
              ret += BASE[curr];
            }
          }
          if (leftbits == 2) {
            ret += BASE[(leftchar & 3) << 4];
            ret += PAD + PAD;
          } else if (leftbits == 4) {
            ret += BASE[(leftchar & 15) << 2];
            ret += PAD;
          }
          return ret;
        }
        audio.src = "data:audio/x-" + name.substr(-3) + ";base64," + encode64(byteArray);
        finish(audio);
      };
      // we don't wait for confirmation this worked - but it's worth trying
      audio.src = url;
      // workaround for chrome bug 124926 - we do not always get oncanplaythrough or onerror
      safeSetTimeout(() => {
        finish(audio);
      }, // try to use it even though it is not necessarily ready to play
      1e4);
    };
    preloadPlugins.push(audioPlugin);
    // Canvas event setup
    function pointerLockChange() {
      Browser.pointerLock = document["pointerLockElement"] === Module["canvas"] || document["mozPointerLockElement"] === Module["canvas"] || document["webkitPointerLockElement"] === Module["canvas"] || document["msPointerLockElement"] === Module["canvas"];
    }
    var canvas = Module["canvas"];
    if (canvas) {
      // forced aspect ratio can be enabled by defining 'forcedAspectRatio' on Module
      // Module['forcedAspectRatio'] = 4 / 3;
      canvas.requestPointerLock = canvas["requestPointerLock"] || canvas["mozRequestPointerLock"] || canvas["webkitRequestPointerLock"] || canvas["msRequestPointerLock"] || (() => {});
      canvas.exitPointerLock = document["exitPointerLock"] || document["mozExitPointerLock"] || document["webkitExitPointerLock"] || document["msExitPointerLock"] || (() => {});
      // no-op if function does not exist
      canvas.exitPointerLock = canvas.exitPointerLock.bind(document);
      document.addEventListener("pointerlockchange", pointerLockChange, false);
      document.addEventListener("mozpointerlockchange", pointerLockChange, false);
      document.addEventListener("webkitpointerlockchange", pointerLockChange, false);
      document.addEventListener("mspointerlockchange", pointerLockChange, false);
      if (Module["elementPointerLock"]) {
        canvas.addEventListener("click", ev => {
          if (!Browser.pointerLock && Module["canvas"].requestPointerLock) {
            Module["canvas"].requestPointerLock();
            ev.preventDefault();
          }
        }, false);
      }
    }
  },
  createContext(/** @type {HTMLCanvasElement} */ canvas, useWebGL, setInModule, webGLContextAttributes) {
    if (useWebGL && Module["ctx"] && canvas == Module["canvas"]) return Module["ctx"];
    // no need to recreate GL context if it's already been created for this canvas.
    var ctx;
    var contextHandle;
    if (useWebGL) {
      // For GLES2/desktop GL compatibility, adjust a few defaults to be different to WebGL defaults, so that they align better with the desktop defaults.
      var contextAttributes = {
        antialias: false,
        alpha: false,
        majorVersion: 2
      };
      if (webGLContextAttributes) {
        for (var attribute in webGLContextAttributes) {
          contextAttributes[attribute] = webGLContextAttributes[attribute];
        }
      }
      // This check of existence of GL is here to satisfy Closure compiler, which yells if variable GL is referenced below but GL object is not
      // actually compiled in because application is not doing any GL operations. TODO: Ideally if GL is not being used, this function
      // Browser.createContext() should not even be emitted.
      if (typeof GL != "undefined") {
        contextHandle = GL.createContext(canvas, contextAttributes);
        if (contextHandle) {
          ctx = GL.getContext(contextHandle).GLctx;
        }
      }
    } else {
      ctx = canvas.getContext("2d");
    }
    if (!ctx) return null;
    if (setInModule) {
      if (!useWebGL) assert(typeof GLctx == "undefined", "cannot set in module if GLctx is used, but we are a non-GL context that would replace it");
      Module["ctx"] = ctx;
      if (useWebGL) GL.makeContextCurrent(contextHandle);
      Browser.useWebGL = useWebGL;
      Browser.moduleContextCreatedCallbacks.forEach(callback => callback());
      Browser.init();
    }
    return ctx;
  },
  fullscreenHandlersInstalled: false,
  lockPointer: undefined,
  resizeCanvas: undefined,
  requestFullscreen(lockPointer, resizeCanvas) {
    Browser.lockPointer = lockPointer;
    Browser.resizeCanvas = resizeCanvas;
    if (typeof Browser.lockPointer == "undefined") Browser.lockPointer = true;
    if (typeof Browser.resizeCanvas == "undefined") Browser.resizeCanvas = false;
    var canvas = Module["canvas"];
    function fullscreenChange() {
      Browser.isFullscreen = false;
      var canvasContainer = canvas.parentNode;
      if ((document["fullscreenElement"] || document["mozFullScreenElement"] || document["msFullscreenElement"] || document["webkitFullscreenElement"] || document["webkitCurrentFullScreenElement"]) === canvasContainer) {
        canvas.exitFullscreen = Browser.exitFullscreen;
        if (Browser.lockPointer) canvas.requestPointerLock();
        Browser.isFullscreen = true;
        if (Browser.resizeCanvas) {
          Browser.setFullscreenCanvasSize();
        } else {
          Browser.updateCanvasDimensions(canvas);
        }
      } else {
        // remove the full screen specific parent of the canvas again to restore the HTML structure from before going full screen
        canvasContainer.parentNode.insertBefore(canvas, canvasContainer);
        canvasContainer.parentNode.removeChild(canvasContainer);
        if (Browser.resizeCanvas) {
          Browser.setWindowedCanvasSize();
        } else {
          Browser.updateCanvasDimensions(canvas);
        }
      }
      Module["onFullScreen"]?.(Browser.isFullscreen);
      Module["onFullscreen"]?.(Browser.isFullscreen);
    }
    if (!Browser.fullscreenHandlersInstalled) {
      Browser.fullscreenHandlersInstalled = true;
      document.addEventListener("fullscreenchange", fullscreenChange, false);
      document.addEventListener("mozfullscreenchange", fullscreenChange, false);
      document.addEventListener("webkitfullscreenchange", fullscreenChange, false);
      document.addEventListener("MSFullscreenChange", fullscreenChange, false);
    }
    // create a new parent to ensure the canvas has no siblings. this allows browsers to optimize full screen performance when its parent is the full screen root
    var canvasContainer = document.createElement("div");
    canvas.parentNode.insertBefore(canvasContainer, canvas);
    canvasContainer.appendChild(canvas);
    // use parent of canvas as full screen root to allow aspect ratio correction (Firefox stretches the root to screen size)
    canvasContainer.requestFullscreen = canvasContainer["requestFullscreen"] || canvasContainer["mozRequestFullScreen"] || canvasContainer["msRequestFullscreen"] || (canvasContainer["webkitRequestFullscreen"] ? () => canvasContainer["webkitRequestFullscreen"](Element["ALLOW_KEYBOARD_INPUT"]) : null) || (canvasContainer["webkitRequestFullScreen"] ? () => canvasContainer["webkitRequestFullScreen"](Element["ALLOW_KEYBOARD_INPUT"]) : null);
    canvasContainer.requestFullscreen();
  },
  requestFullScreen() {
    abort("Module.requestFullScreen has been replaced by Module.requestFullscreen (without a capital S)");
  },
  exitFullscreen() {
    // This is workaround for chrome. Trying to exit from fullscreen
    // not in fullscreen state will cause "TypeError: Document not active"
    // in chrome. See https://github.com/emscripten-core/emscripten/pull/8236
    if (!Browser.isFullscreen) {
      return false;
    }
    var CFS = document["exitFullscreen"] || document["cancelFullScreen"] || document["mozCancelFullScreen"] || document["msExitFullscreen"] || document["webkitCancelFullScreen"] || (() => {});
    CFS.apply(document, []);
    return true;
  },
  safeSetTimeout(func, timeout) {
    // Legacy function, this is used by the SDL2 port so we need to keep it
    // around at least until that is updated.
    // See https://github.com/libsdl-org/SDL/pull/6304
    return safeSetTimeout(func, timeout);
  },
  getMimetype(name) {
    return {
      "jpg": "image/jpeg",
      "jpeg": "image/jpeg",
      "png": "image/png",
      "bmp": "image/bmp",
      "ogg": "audio/ogg",
      "wav": "audio/wav",
      "mp3": "audio/mpeg"
    }[name.substr(name.lastIndexOf(".") + 1)];
  },
  getUserMedia(func) {
    window.getUserMedia ||= navigator["getUserMedia"] || navigator["mozGetUserMedia"];
    window.getUserMedia(func);
  },
  getMovementX(event) {
    return event["movementX"] || event["mozMovementX"] || event["webkitMovementX"] || 0;
  },
  getMovementY(event) {
    return event["movementY"] || event["mozMovementY"] || event["webkitMovementY"] || 0;
  },
  getMouseWheelDelta(event) {
    var delta = 0;
    switch (event.type) {
     case "DOMMouseScroll":
      // 3 lines make up a step
      delta = event.detail / 3;
      break;

     case "mousewheel":
      // 120 units make up a step
      delta = event.wheelDelta / 120;
      break;

     case "wheel":
      delta = event.deltaY;
      switch (event.deltaMode) {
       case 0:
        // DOM_DELTA_PIXEL: 100 pixels make up a step
        delta /= 100;
        break;

       case 1:
        // DOM_DELTA_LINE: 3 lines make up a step
        delta /= 3;
        break;

       case 2:
        // DOM_DELTA_PAGE: A page makes up 80 steps
        delta *= 80;
        break;

       default:
        throw "unrecognized mouse wheel delta mode: " + event.deltaMode;
      }
      break;

     default:
      throw "unrecognized mouse wheel event: " + event.type;
    }
    return delta;
  },
  mouseX: 0,
  mouseY: 0,
  mouseMovementX: 0,
  mouseMovementY: 0,
  touches: {},
  lastTouches: {},
  calculateMouseCoords(pageX, pageY) {
    // Calculate the movement based on the changes
    // in the coordinates.
    var rect = Module["canvas"].getBoundingClientRect();
    var cw = Module["canvas"].width;
    var ch = Module["canvas"].height;
    // Neither .scrollX or .pageXOffset are defined in a spec, but
    // we prefer .scrollX because it is currently in a spec draft.
    // (see: http://www.w3.org/TR/2013/WD-cssom-view-20131217/)
    var scrollX = ((typeof window.scrollX != "undefined") ? window.scrollX : window.pageXOffset);
    var scrollY = ((typeof window.scrollY != "undefined") ? window.scrollY : window.pageYOffset);
    // If this assert lands, it's likely because the browser doesn't support scrollX or pageXOffset
    // and we have no viable fallback.
    assert((typeof scrollX != "undefined") && (typeof scrollY != "undefined"), "Unable to retrieve scroll position, mouse positions likely broken.");
    var adjustedX = pageX - (scrollX + rect.left);
    var adjustedY = pageY - (scrollY + rect.top);
    // the canvas might be CSS-scaled compared to its backbuffer;
    // SDL-using content will want mouse coordinates in terms
    // of backbuffer units.
    adjustedX = adjustedX * (cw / rect.width);
    adjustedY = adjustedY * (ch / rect.height);
    return {
      x: adjustedX,
      y: adjustedY
    };
  },
  setMouseCoords(pageX, pageY) {
    const {x, y} = Browser.calculateMouseCoords(pageX, pageY);
    Browser.mouseMovementX = x - Browser.mouseX;
    Browser.mouseMovementY = y - Browser.mouseY;
    Browser.mouseX = x;
    Browser.mouseY = y;
  },
  calculateMouseEvent(event) {
    // event should be mousemove, mousedown or mouseup
    if (Browser.pointerLock) {
      // When the pointer is locked, calculate the coordinates
      // based on the movement of the mouse.
      // Workaround for Firefox bug 764498
      if (event.type != "mousemove" && ("mozMovementX" in event)) {
        Browser.mouseMovementX = Browser.mouseMovementY = 0;
      } else {
        Browser.mouseMovementX = Browser.getMovementX(event);
        Browser.mouseMovementY = Browser.getMovementY(event);
      }
      // add the mouse delta to the current absolute mouse position
      Browser.mouseX += Browser.mouseMovementX;
      Browser.mouseY += Browser.mouseMovementY;
    } else {
      if (event.type === "touchstart" || event.type === "touchend" || event.type === "touchmove") {
        var touch = event.touch;
        if (touch === undefined) {
          return;
        }
        // the "touch" property is only defined in SDL
        var coords = Browser.calculateMouseCoords(touch.pageX, touch.pageY);
        if (event.type === "touchstart") {
          Browser.lastTouches[touch.identifier] = coords;
          Browser.touches[touch.identifier] = coords;
        } else if (event.type === "touchend" || event.type === "touchmove") {
          var last = Browser.touches[touch.identifier];
          last ||= coords;
          Browser.lastTouches[touch.identifier] = last;
          Browser.touches[touch.identifier] = coords;
        }
        return;
      }
      Browser.setMouseCoords(event.pageX, event.pageY);
    }
  },
  resizeListeners: [],
  updateResizeListeners() {
    var canvas = Module["canvas"];
    Browser.resizeListeners.forEach(listener => listener(canvas.width, canvas.height));
  },
  setCanvasSize(width, height, noUpdates) {
    var canvas = Module["canvas"];
    Browser.updateCanvasDimensions(canvas, width, height);
    if (!noUpdates) Browser.updateResizeListeners();
  },
  windowedWidth: 0,
  windowedHeight: 0,
  setFullscreenCanvasSize() {
    // check if SDL is available
    if (typeof SDL != "undefined") {
      var flags = GROWABLE_HEAP_U32()[((SDL.screen) >> 2)];
      flags = flags | 8388608;
      // set SDL_FULLSCREEN flag
      GROWABLE_HEAP_I32()[((SDL.screen) >> 2)] = flags;
      checkInt32(flags);
    }
    Browser.updateCanvasDimensions(Module["canvas"]);
    Browser.updateResizeListeners();
  },
  setWindowedCanvasSize() {
    // check if SDL is available
    if (typeof SDL != "undefined") {
      var flags = GROWABLE_HEAP_U32()[((SDL.screen) >> 2)];
      flags = flags & ~8388608;
      // clear SDL_FULLSCREEN flag
      GROWABLE_HEAP_I32()[((SDL.screen) >> 2)] = flags;
      checkInt32(flags);
    }
    Browser.updateCanvasDimensions(Module["canvas"]);
    Browser.updateResizeListeners();
  },
  updateCanvasDimensions(canvas, wNative, hNative) {
    if (wNative && hNative) {
      canvas.widthNative = wNative;
      canvas.heightNative = hNative;
    } else {
      wNative = canvas.widthNative;
      hNative = canvas.heightNative;
    }
    var w = wNative;
    var h = hNative;
    if (Module["forcedAspectRatio"] && Module["forcedAspectRatio"] > 0) {
      if (w / h < Module["forcedAspectRatio"]) {
        w = Math.round(h * Module["forcedAspectRatio"]);
      } else {
        h = Math.round(w / Module["forcedAspectRatio"]);
      }
    }
    if (((document["fullscreenElement"] || document["mozFullScreenElement"] || document["msFullscreenElement"] || document["webkitFullscreenElement"] || document["webkitCurrentFullScreenElement"]) === canvas.parentNode) && (typeof screen != "undefined")) {
      var factor = Math.min(screen.width / w, screen.height / h);
      w = Math.round(w * factor);
      h = Math.round(h * factor);
    }
    if (Browser.resizeCanvas) {
      if (canvas.width != w) canvas.width = w;
      if (canvas.height != h) canvas.height = h;
      if (typeof canvas.style != "undefined") {
        canvas.style.removeProperty("width");
        canvas.style.removeProperty("height");
      }
    } else {
      if (canvas.width != wNative) canvas.width = wNative;
      if (canvas.height != hNative) canvas.height = hNative;
      if (typeof canvas.style != "undefined") {
        if (w != wNative || h != hNative) {
          canvas.style.setProperty("width", w + "px", "important");
          canvas.style.setProperty("height", h + "px", "important");
        } else {
          canvas.style.removeProperty("width");
          canvas.style.removeProperty("height");
        }
      }
    }
  }
};

/** @constructor */ function GLFW_Window(id, width, height, framebufferWidth, framebufferHeight, title, monitor, share) {
  this.id = id;
  this.x = 0;
  this.y = 0;
  this.fullscreen = false;
  // Used to determine if app in fullscreen mode
  this.storedX = 0;
  // Used to store X before fullscreen
  this.storedY = 0;
  // Used to store Y before fullscreen
  this.width = width;
  this.height = height;
  this.framebufferWidth = framebufferWidth;
  this.framebufferHeight = framebufferHeight;
  this.storedWidth = width;
  // Used to store width before fullscreen
  this.storedHeight = height;
  // Used to store height before fullscreen
  this.title = title;
  this.monitor = monitor;
  this.share = share;
  this.attributes = Object.assign({}, GLFW.hints);
  this.inputModes = {
    208897: 212993,
    // GLFW_CURSOR (GLFW_CURSOR_NORMAL)
    208898: 0,
    // GLFW_STICKY_KEYS
    208899: 0
  };
  // GLFW_STICKY_MOUSE_BUTTONS
  this.buttons = 0;
  this.keys = new Array;
  this.domKeys = new Array;
  this.shouldClose = 0;
  this.title = null;
  this.windowPosFunc = 0;
  // GLFWwindowposfun
  this.windowSizeFunc = 0;
  // GLFWwindowsizefun
  this.windowCloseFunc = 0;
  // GLFWwindowclosefun
  this.windowRefreshFunc = 0;
  // GLFWwindowrefreshfun
  this.windowFocusFunc = 0;
  // GLFWwindowfocusfun
  this.windowIconifyFunc = 0;
  // GLFWwindowiconifyfun
  this.windowMaximizeFunc = 0;
  // GLFWwindowmaximizefun
  this.framebufferSizeFunc = 0;
  // GLFWframebuffersizefun
  this.windowContentScaleFunc = 0;
  // GLFWwindowcontentscalefun
  this.mouseButtonFunc = 0;
  // GLFWmousebuttonfun
  this.cursorPosFunc = 0;
  // GLFWcursorposfun
  this.cursorEnterFunc = 0;
  // GLFWcursorenterfun
  this.scrollFunc = 0;
  // GLFWscrollfun
  this.dropFunc = 0;
  // GLFWdropfun
  this.keyFunc = 0;
  // GLFWkeyfun
  this.charFunc = 0;
  // GLFWcharfun
  this.userptr = 0;
}

function _emscripten_set_window_title(title) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(105, 0, 1, title);
  return document.title = UTF8ToString(title);
}

var GLFW = {
  WindowFromId: id => {
    if (id <= 0 || !GLFW.windows) return null;
    return GLFW.windows[id - 1];
  },
  joystickFunc: 0,
  errorFunc: 0,
  monitorFunc: 0,
  active: null,
  scale: null,
  windows: null,
  monitors: null,
  monitorString: null,
  versionString: null,
  initialTime: null,
  extensions: null,
  devicePixelRatioMQL: null,
  hints: null,
  primaryTouchId: null,
  defaultHints: {
    131073: 0,
    131074: 0,
    131075: 1,
    131076: 1,
    131077: 1,
    131082: 0,
    135169: 8,
    135170: 8,
    135171: 8,
    135172: 8,
    135173: 24,
    135174: 8,
    135175: 0,
    135176: 0,
    135177: 0,
    135178: 0,
    135179: 0,
    135180: 0,
    135181: 0,
    135182: 0,
    135183: 0,
    139265: 196609,
    139266: 1,
    139267: 0,
    139268: 0,
    139269: 0,
    139270: 0,
    139271: 0,
    139272: 0,
    139276: 0
  },
  DOMToGLFWKeyCode: keycode => {
    switch (keycode) {
     // these keycodes are only defined for GLFW3, assume they are the same for GLFW2
      case 32:
      return 32;

     // DOM_VK_SPACE -> GLFW_KEY_SPACE
      case 222:
      return 39;

     // DOM_VK_QUOTE -> GLFW_KEY_APOSTROPHE
      case 188:
      return 44;

     // DOM_VK_COMMA -> GLFW_KEY_COMMA
      case 173:
      return 45;

     // DOM_VK_HYPHEN_MINUS -> GLFW_KEY_MINUS
      case 189:
      return 45;

     // DOM_VK_MINUS -> GLFW_KEY_MINUS
      case 190:
      return 46;

     // DOM_VK_PERIOD -> GLFW_KEY_PERIOD
      case 191:
      return 47;

     // DOM_VK_SLASH -> GLFW_KEY_SLASH
      case 48:
      return 48;

     // DOM_VK_0 -> GLFW_KEY_0
      case 49:
      return 49;

     // DOM_VK_1 -> GLFW_KEY_1
      case 50:
      return 50;

     // DOM_VK_2 -> GLFW_KEY_2
      case 51:
      return 51;

     // DOM_VK_3 -> GLFW_KEY_3
      case 52:
      return 52;

     // DOM_VK_4 -> GLFW_KEY_4
      case 53:
      return 53;

     // DOM_VK_5 -> GLFW_KEY_5
      case 54:
      return 54;

     // DOM_VK_6 -> GLFW_KEY_6
      case 55:
      return 55;

     // DOM_VK_7 -> GLFW_KEY_7
      case 56:
      return 56;

     // DOM_VK_8 -> GLFW_KEY_8
      case 57:
      return 57;

     // DOM_VK_9 -> GLFW_KEY_9
      case 59:
      return 59;

     // DOM_VK_SEMICOLON -> GLFW_KEY_SEMICOLON
      case 61:
      return 61;

     // DOM_VK_EQUALS -> GLFW_KEY_EQUAL
      case 187:
      return 61;

     // DOM_VK_EQUALS -> GLFW_KEY_EQUAL
      case 65:
      return 65;

     // DOM_VK_A -> GLFW_KEY_A
      case 66:
      return 66;

     // DOM_VK_B -> GLFW_KEY_B
      case 67:
      return 67;

     // DOM_VK_C -> GLFW_KEY_C
      case 68:
      return 68;

     // DOM_VK_D -> GLFW_KEY_D
      case 69:
      return 69;

     // DOM_VK_E -> GLFW_KEY_E
      case 70:
      return 70;

     // DOM_VK_F -> GLFW_KEY_F
      case 71:
      return 71;

     // DOM_VK_G -> GLFW_KEY_G
      case 72:
      return 72;

     // DOM_VK_H -> GLFW_KEY_H
      case 73:
      return 73;

     // DOM_VK_I -> GLFW_KEY_I
      case 74:
      return 74;

     // DOM_VK_J -> GLFW_KEY_J
      case 75:
      return 75;

     // DOM_VK_K -> GLFW_KEY_K
      case 76:
      return 76;

     // DOM_VK_L -> GLFW_KEY_L
      case 77:
      return 77;

     // DOM_VK_M -> GLFW_KEY_M
      case 78:
      return 78;

     // DOM_VK_N -> GLFW_KEY_N
      case 79:
      return 79;

     // DOM_VK_O -> GLFW_KEY_O
      case 80:
      return 80;

     // DOM_VK_P -> GLFW_KEY_P
      case 81:
      return 81;

     // DOM_VK_Q -> GLFW_KEY_Q
      case 82:
      return 82;

     // DOM_VK_R -> GLFW_KEY_R
      case 83:
      return 83;

     // DOM_VK_S -> GLFW_KEY_S
      case 84:
      return 84;

     // DOM_VK_T -> GLFW_KEY_T
      case 85:
      return 85;

     // DOM_VK_U -> GLFW_KEY_U
      case 86:
      return 86;

     // DOM_VK_V -> GLFW_KEY_V
      case 87:
      return 87;

     // DOM_VK_W -> GLFW_KEY_W
      case 88:
      return 88;

     // DOM_VK_X -> GLFW_KEY_X
      case 89:
      return 89;

     // DOM_VK_Y -> GLFW_KEY_Y
      case 90:
      return 90;

     // DOM_VK_Z -> GLFW_KEY_Z
      case 219:
      return 91;

     // DOM_VK_OPEN_BRACKET -> GLFW_KEY_LEFT_BRACKET
      case 220:
      return 92;

     // DOM_VK_BACKSLASH -> GLFW_KEY_BACKSLASH
      case 221:
      return 93;

     // DOM_VK_CLOSE_BRACKET -> GLFW_KEY_RIGHT_BRACKET
      case 192:
      return 96;

     // DOM_VK_BACK_QUOTE -> GLFW_KEY_GRAVE_ACCENT
      case 27:
      return 256;

     // DOM_VK_ESCAPE -> GLFW_KEY_ESCAPE
      case 13:
      return 257;

     // DOM_VK_RETURN -> GLFW_KEY_ENTER
      case 9:
      return 258;

     // DOM_VK_TAB -> GLFW_KEY_TAB
      case 8:
      return 259;

     // DOM_VK_BACK -> GLFW_KEY_BACKSPACE
      case 45:
      return 260;

     // DOM_VK_INSERT -> GLFW_KEY_INSERT
      case 46:
      return 261;

     // DOM_VK_DELETE -> GLFW_KEY_DELETE
      case 39:
      return 262;

     // DOM_VK_RIGHT -> GLFW_KEY_RIGHT
      case 37:
      return 263;

     // DOM_VK_LEFT -> GLFW_KEY_LEFT
      case 40:
      return 264;

     // DOM_VK_DOWN -> GLFW_KEY_DOWN
      case 38:
      return 265;

     // DOM_VK_UP -> GLFW_KEY_UP
      case 33:
      return 266;

     // DOM_VK_PAGE_UP -> GLFW_KEY_PAGE_UP
      case 34:
      return 267;

     // DOM_VK_PAGE_DOWN -> GLFW_KEY_PAGE_DOWN
      case 36:
      return 268;

     // DOM_VK_HOME -> GLFW_KEY_HOME
      case 35:
      return 269;

     // DOM_VK_END -> GLFW_KEY_END
      case 20:
      return 280;

     // DOM_VK_CAPS_LOCK -> GLFW_KEY_CAPS_LOCK
      case 145:
      return 281;

     // DOM_VK_SCROLL_LOCK -> GLFW_KEY_SCROLL_LOCK
      case 144:
      return 282;

     // DOM_VK_NUM_LOCK -> GLFW_KEY_NUM_LOCK
      case 44:
      return 283;

     // DOM_VK_SNAPSHOT -> GLFW_KEY_PRINT_SCREEN
      case 19:
      return 284;

     // DOM_VK_PAUSE -> GLFW_KEY_PAUSE
      case 112:
      return 290;

     // DOM_VK_F1 -> GLFW_KEY_F1
      case 113:
      return 291;

     // DOM_VK_F2 -> GLFW_KEY_F2
      case 114:
      return 292;

     // DOM_VK_F3 -> GLFW_KEY_F3
      case 115:
      return 293;

     // DOM_VK_F4 -> GLFW_KEY_F4
      case 116:
      return 294;

     // DOM_VK_F5 -> GLFW_KEY_F5
      case 117:
      return 295;

     // DOM_VK_F6 -> GLFW_KEY_F6
      case 118:
      return 296;

     // DOM_VK_F7 -> GLFW_KEY_F7
      case 119:
      return 297;

     // DOM_VK_F8 -> GLFW_KEY_F8
      case 120:
      return 298;

     // DOM_VK_F9 -> GLFW_KEY_F9
      case 121:
      return 299;

     // DOM_VK_F10 -> GLFW_KEY_F10
      case 122:
      return 300;

     // DOM_VK_F11 -> GLFW_KEY_F11
      case 123:
      return 301;

     // DOM_VK_F12 -> GLFW_KEY_F12
      case 124:
      return 302;

     // DOM_VK_F13 -> GLFW_KEY_F13
      case 125:
      return 303;

     // DOM_VK_F14 -> GLFW_KEY_F14
      case 126:
      return 304;

     // DOM_VK_F15 -> GLFW_KEY_F15
      case 127:
      return 305;

     // DOM_VK_F16 -> GLFW_KEY_F16
      case 128:
      return 306;

     // DOM_VK_F17 -> GLFW_KEY_F17
      case 129:
      return 307;

     // DOM_VK_F18 -> GLFW_KEY_F18
      case 130:
      return 308;

     // DOM_VK_F19 -> GLFW_KEY_F19
      case 131:
      return 309;

     // DOM_VK_F20 -> GLFW_KEY_F20
      case 132:
      return 310;

     // DOM_VK_F21 -> GLFW_KEY_F21
      case 133:
      return 311;

     // DOM_VK_F22 -> GLFW_KEY_F22
      case 134:
      return 312;

     // DOM_VK_F23 -> GLFW_KEY_F23
      case 135:
      return 313;

     // DOM_VK_F24 -> GLFW_KEY_F24
      case 136:
      return 314;

     // 0x88 (not used?) -> GLFW_KEY_F25
      case 96:
      return 320;

     // DOM_VK_NUMPAD0 -> GLFW_KEY_KP_0
      case 97:
      return 321;

     // DOM_VK_NUMPAD1 -> GLFW_KEY_KP_1
      case 98:
      return 322;

     // DOM_VK_NUMPAD2 -> GLFW_KEY_KP_2
      case 99:
      return 323;

     // DOM_VK_NUMPAD3 -> GLFW_KEY_KP_3
      case 100:
      return 324;

     // DOM_VK_NUMPAD4 -> GLFW_KEY_KP_4
      case 101:
      return 325;

     // DOM_VK_NUMPAD5 -> GLFW_KEY_KP_5
      case 102:
      return 326;

     // DOM_VK_NUMPAD6 -> GLFW_KEY_KP_6
      case 103:
      return 327;

     // DOM_VK_NUMPAD7 -> GLFW_KEY_KP_7
      case 104:
      return 328;

     // DOM_VK_NUMPAD8 -> GLFW_KEY_KP_8
      case 105:
      return 329;

     // DOM_VK_NUMPAD9 -> GLFW_KEY_KP_9
      case 110:
      return 330;

     // DOM_VK_DECIMAL -> GLFW_KEY_KP_DECIMAL
      case 111:
      return 331;

     // DOM_VK_DIVIDE -> GLFW_KEY_KP_DIVIDE
      case 106:
      return 332;

     // DOM_VK_MULTIPLY -> GLFW_KEY_KP_MULTIPLY
      case 109:
      return 333;

     // DOM_VK_SUBTRACT -> GLFW_KEY_KP_SUBTRACT
      case 107:
      return 334;

     // DOM_VK_ADD -> GLFW_KEY_KP_ADD
      // case 0x0D:return 335; // DOM_VK_RETURN -> GLFW_KEY_KP_ENTER (DOM_KEY_LOCATION_RIGHT)
      // case 0x61:return 336; // DOM_VK_EQUALS -> GLFW_KEY_KP_EQUAL (DOM_KEY_LOCATION_RIGHT)
      case 16:
      return 340;

     // DOM_VK_SHIFT -> GLFW_KEY_LEFT_SHIFT
      case 17:
      return 341;

     // DOM_VK_CONTROL -> GLFW_KEY_LEFT_CONTROL
      case 18:
      return 342;

     // DOM_VK_ALT -> GLFW_KEY_LEFT_ALT
      case 91:
      return 343;

     // DOM_VK_WIN -> GLFW_KEY_LEFT_SUPER
      case 224:
      return 343;

     // DOM_VK_META -> GLFW_KEY_LEFT_SUPER
      // case 0x10:return 344; // DOM_VK_SHIFT -> GLFW_KEY_RIGHT_SHIFT (DOM_KEY_LOCATION_RIGHT)
      // case 0x11:return 345; // DOM_VK_CONTROL -> GLFW_KEY_RIGHT_CONTROL (DOM_KEY_LOCATION_RIGHT)
      // case 0x12:return 346; // DOM_VK_ALT -> GLFW_KEY_RIGHT_ALT (DOM_KEY_LOCATION_RIGHT)
      // case 0x5B:return 347; // DOM_VK_WIN -> GLFW_KEY_RIGHT_SUPER (DOM_KEY_LOCATION_RIGHT)
      case 93:
      return 348;

     // DOM_VK_CONTEXT_MENU -> GLFW_KEY_MENU
      // XXX: GLFW_KEY_WORLD_1, GLFW_KEY_WORLD_2 what are these?
      default:
      return -1;
    }
  },
  getModBits: win => {
    var mod = 0;
    if (win.keys[340]) mod |= 1;
    // GLFW_MOD_SHIFT
    if (win.keys[341]) mod |= 2;
    // GLFW_MOD_CONTROL
    if (win.keys[342]) mod |= 4;
    // GLFW_MOD_ALT
    if (win.keys[343] || win.keys[348]) mod |= 8;
    // GLFW_MOD_SUPER
    // add caps and num lock keys? only if lock_key_mod is set
    return mod;
  },
  onKeyPress: event => {
    if (!GLFW.active || !GLFW.active.charFunc) return;
    if (event.ctrlKey || event.metaKey) return;
    // correct unicode charCode is only available with onKeyPress event
    var charCode = event.charCode;
    if (charCode == 0 || (charCode >= 0 && charCode <= 31)) return;
    getWasmTableEntry(GLFW.active.charFunc)(GLFW.active.id, charCode);
  },
  onKeyChanged: (keyCode, status) => {
    if (!GLFW.active) return;
    var key = GLFW.DOMToGLFWKeyCode(keyCode);
    if (key == -1) return;
    var repeat = status && GLFW.active.keys[key];
    GLFW.active.keys[key] = status;
    GLFW.active.domKeys[keyCode] = status;
    if (GLFW.active.keyFunc) {
      if (repeat) status = 2;
      // GLFW_REPEAT
      getWasmTableEntry(GLFW.active.keyFunc)(GLFW.active.id, key, keyCode, status, GLFW.getModBits(GLFW.active));
    }
  },
  onGamepadConnected: event => {
    GLFW.refreshJoysticks();
  },
  onGamepadDisconnected: event => {
    GLFW.refreshJoysticks();
  },
  onKeydown: event => {
    GLFW.onKeyChanged(event.keyCode, 1);
    // GLFW_PRESS or GLFW_REPEAT
    // This logic comes directly from the sdl implementation. We cannot
    // call preventDefault on all keydown events otherwise onKeyPress will
    // not get called
    if (event.key == "Backspace" || event.key == "Tab") {
      event.preventDefault();
    }
  },
  onKeyup: event => {
    GLFW.onKeyChanged(event.keyCode, 0);
  },
  // GLFW_RELEASE
  onBlur: event => {
    if (!GLFW.active) return;
    for (var i = 0; i < GLFW.active.domKeys.length; ++i) {
      if (GLFW.active.domKeys[i]) {
        GLFW.onKeyChanged(i, 0);
      }
    }
  },
  onMousemove: event => {
    if (!GLFW.active) return;
    if (event.type === "touchmove") {
      // Handling for touch events that are being converted to mouse input.
      // Don't let the browser fire a duplicate mouse event.
      event.preventDefault();
      let primaryChanged = false;
      for (let i of event.changedTouches) {
        // If our chosen primary touch moved, update Browser mouse coords
        if (GLFW.primaryTouchId === i.identifier) {
          Browser.setMouseCoords(i.pageX, i.pageY);
          primaryChanged = true;
          break;
        }
      }
      if (!primaryChanged) {
        // Do not send mouse events if some touch other than the primary triggered this.
        return;
      }
    } else {
      // Handling for non-touch mouse input events.
      Browser.calculateMouseEvent(event);
    }
    if (event.target != Module["canvas"] || !GLFW.active.cursorPosFunc) return;
    if (GLFW.active.cursorPosFunc) {
      getWasmTableEntry(GLFW.active.cursorPosFunc)(GLFW.active.id, Browser.mouseX, Browser.mouseY);
    }
  },
  DOMToGLFWMouseButton: event => {
    // DOM and glfw have different button codes.
    // See http://www.w3schools.com/jsref/event_button.asp.
    var eventButton = event["button"];
    if (eventButton > 0) {
      if (eventButton == 1) {
        eventButton = 2;
      } else {
        eventButton = 1;
      }
    }
    return eventButton;
  },
  onMouseenter: event => {
    if (!GLFW.active) return;
    if (event.target != Module["canvas"]) return;
    if (GLFW.active.cursorEnterFunc) {
      getWasmTableEntry(GLFW.active.cursorEnterFunc)(GLFW.active.id, 1);
    }
  },
  onMouseleave: event => {
    if (!GLFW.active) return;
    if (event.target != Module["canvas"]) return;
    if (GLFW.active.cursorEnterFunc) {
      getWasmTableEntry(GLFW.active.cursorEnterFunc)(GLFW.active.id, 0);
    }
  },
  onMouseButtonChanged: (event, status) => {
    if (!GLFW.active) return;
    if (event.target != Module["canvas"]) return;
    // Is this from a touch event?
    const isTouchType = event.type === "touchstart" || event.type === "touchend" || event.type === "touchcancel";
    // Only emulating mouse left-click behavior for touches.
    let eventButton = 0;
    if (isTouchType) {
      // Handling for touch events that are being converted to mouse input.
      // Don't let the browser fire a duplicate mouse event.
      event.preventDefault();
      let primaryChanged = false;
      // Set a primary touch if we have none.
      if (GLFW.primaryTouchId === null && event.type === "touchstart" && event.targetTouches.length > 0) {
        // Pick the first touch that started in the canvas and treat it as primary.
        const chosenTouch = event.targetTouches[0];
        GLFW.primaryTouchId = chosenTouch.identifier;
        Browser.setMouseCoords(chosenTouch.pageX, chosenTouch.pageY);
        primaryChanged = true;
      } else if (event.type === "touchend" || event.type === "touchcancel") {
        // Clear the primary touch if it ended.
        for (let i of event.changedTouches) {
          // If our chosen primary touch ended, remove it.
          if (GLFW.primaryTouchId === i.identifier) {
            GLFW.primaryTouchId = null;
            primaryChanged = true;
            break;
          }
        }
      }
      if (!primaryChanged) {
        // Do not send mouse events if some touch other than the primary triggered this.
        return;
      }
    } else {
      // Handling for non-touch mouse input events.
      Browser.calculateMouseEvent(event);
      eventButton = GLFW.DOMToGLFWMouseButton(event);
    }
    if (status == 1) {
      // GLFW_PRESS
      GLFW.active.buttons |= (1 << eventButton);
      try {
        event.target.setCapture();
      } catch (e) {}
    } else {
      // GLFW_RELEASE
      GLFW.active.buttons &= ~(1 << eventButton);
    }
    // Send mouse event to GLFW.
    if (GLFW.active.mouseButtonFunc) {
      getWasmTableEntry(GLFW.active.mouseButtonFunc)(GLFW.active.id, eventButton, status, GLFW.getModBits(GLFW.active));
    }
  },
  onMouseButtonDown: event => {
    if (!GLFW.active) return;
    GLFW.onMouseButtonChanged(event, 1);
  },
  // GLFW_PRESS
  onMouseButtonUp: event => {
    if (!GLFW.active) return;
    GLFW.onMouseButtonChanged(event, 0);
  },
  // GLFW_RELEASE
  onMouseWheel: event => {
    // Note the minus sign that flips browser wheel direction (positive direction scrolls page down) to native wheel direction (positive direction is mouse wheel up)
    var delta = -Browser.getMouseWheelDelta(event);
    delta = (delta == 0) ? 0 : (delta > 0 ? Math.max(delta, 1) : Math.min(delta, -1));
    // Quantize to integer so that minimum scroll is at least +/- 1.
    GLFW.wheelPos += delta;
    if (!GLFW.active || !GLFW.active.scrollFunc || event.target != Module["canvas"]) return;
    var sx = 0;
    var sy = delta;
    if (event.type == "mousewheel") {
      sx = event.wheelDeltaX;
    } else {
      sx = event.deltaX;
    }
    getWasmTableEntry(GLFW.active.scrollFunc)(GLFW.active.id, sx, sy);
    event.preventDefault();
  },
  onCanvasResize: (width, height, framebufferWidth, framebufferHeight) => {
    if (!GLFW.active) return;
    var resizeNeeded = false;
    // If the client is requesting fullscreen mode
    if (document["fullscreen"] || document["fullScreen"] || document["mozFullScreen"] || document["webkitIsFullScreen"]) {
      if (!GLFW.active.fullscreen) {
        resizeNeeded = width != screen.width || height != screen.height;
        GLFW.active.storedX = GLFW.active.x;
        GLFW.active.storedY = GLFW.active.y;
        GLFW.active.storedWidth = GLFW.active.width;
        GLFW.active.storedHeight = GLFW.active.height;
        GLFW.active.x = GLFW.active.y = 0;
        GLFW.active.width = screen.width;
        GLFW.active.height = screen.height;
        GLFW.active.fullscreen = true;
      }
    } else // If the client is reverting from fullscreen mode
    if (GLFW.active.fullscreen == true) {
      resizeNeeded = width != GLFW.active.storedWidth || height != GLFW.active.storedHeight;
      GLFW.active.x = GLFW.active.storedX;
      GLFW.active.y = GLFW.active.storedY;
      GLFW.active.width = GLFW.active.storedWidth;
      GLFW.active.height = GLFW.active.storedHeight;
      GLFW.active.fullscreen = false;
    }
    if (resizeNeeded) {
      // width or height is changed (fullscreen / exit fullscreen) which will call this listener back
      // with proper framebufferWidth/framebufferHeight
      Browser.setCanvasSize(GLFW.active.width, GLFW.active.height);
    } else if (GLFW.active.width != width || GLFW.active.height != height || GLFW.active.framebufferWidth != framebufferWidth || GLFW.active.framebufferHeight != framebufferHeight) {
      GLFW.active.width = width;
      GLFW.active.height = height;
      GLFW.active.framebufferWidth = framebufferWidth;
      GLFW.active.framebufferHeight = framebufferHeight;
      GLFW.onWindowSizeChanged();
      GLFW.onFramebufferSizeChanged();
    }
  },
  onWindowSizeChanged: () => {
    if (!GLFW.active) return;
    if (GLFW.active.windowSizeFunc) {
      getWasmTableEntry(GLFW.active.windowSizeFunc)(GLFW.active.id, GLFW.active.width, GLFW.active.height);
    }
  },
  onFramebufferSizeChanged: () => {
    if (!GLFW.active) return;
    if (GLFW.active.framebufferSizeFunc) {
      getWasmTableEntry(GLFW.active.framebufferSizeFunc)(GLFW.active.id, GLFW.active.framebufferWidth, GLFW.active.framebufferHeight);
    }
  },
  onWindowContentScaleChanged: scale => {
    GLFW.scale = scale;
    if (!GLFW.active) return;
    if (GLFW.active.windowContentScaleFunc) {
      getWasmTableEntry(GLFW.active.windowContentScaleFunc)(GLFW.active.id, GLFW.scale, GLFW.scale);
    }
  },
  getTime: () => _emscripten_get_now() / 1e3,
  setWindowTitle: (winid, title) => {
    var win = GLFW.WindowFromId(winid);
    if (!win) return;
    win.title = title;
    if (GLFW.active.id == win.id) {
      _emscripten_set_window_title(title);
    }
  },
  setJoystickCallback: cbfun => {
    var prevcbfun = GLFW.joystickFunc;
    GLFW.joystickFunc = cbfun;
    GLFW.refreshJoysticks();
    return prevcbfun;
  },
  joys: {},
  lastGamepadState: [],
  lastGamepadStateFrame: null,
  refreshJoysticks: () => {
    // Produce a new Gamepad API sample if we are ticking a new game frame, or if not using emscripten_set_main_loop() at all to drive animation.
    if (MainLoop.currentFrameNumber !== GLFW.lastGamepadStateFrame || !MainLoop.currentFrameNumber) {
      GLFW.lastGamepadState = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads || []);
      GLFW.lastGamepadStateFrame = MainLoop.currentFrameNumber;
      for (var joy = 0; joy < GLFW.lastGamepadState.length; ++joy) {
        var gamepad = GLFW.lastGamepadState[joy];
        if (gamepad) {
          if (!GLFW.joys[joy]) {
            out("glfw joystick connected:", joy);
            GLFW.joys[joy] = {
              id: stringToNewUTF8(gamepad.id),
              buttonsCount: gamepad.buttons.length,
              axesCount: gamepad.axes.length,
              buttons: _malloc(gamepad.buttons.length),
              axes: _malloc(gamepad.axes.length * 4)
            };
            if (GLFW.joystickFunc) {
              getWasmTableEntry(GLFW.joystickFunc)(joy, 262145);
            }
          }
          var data = GLFW.joys[joy];
          for (var i = 0; i < gamepad.buttons.length; ++i) {
            GROWABLE_HEAP_I8()[data.buttons + i] = gamepad.buttons[i].pressed;
            checkInt8(gamepad.buttons[i].pressed);
          }
          for (var i = 0; i < gamepad.axes.length; ++i) {
            GROWABLE_HEAP_F32()[((data.axes + i * 4) >> 2)] = gamepad.axes[i];
          }
        } else {
          if (GLFW.joys[joy]) {
            out("glfw joystick disconnected", joy);
            if (GLFW.joystickFunc) {
              getWasmTableEntry(GLFW.joystickFunc)(joy, 262146);
            }
            _free(GLFW.joys[joy].id);
            _free(GLFW.joys[joy].buttons);
            _free(GLFW.joys[joy].axes);
            delete GLFW.joys[joy];
          }
        }
      }
    }
  },
  setKeyCallback: (winid, cbfun) => {
    var win = GLFW.WindowFromId(winid);
    if (!win) return null;
    var prevcbfun = win.keyFunc;
    win.keyFunc = cbfun;
    return prevcbfun;
  },
  setCharCallback: (winid, cbfun) => {
    var win = GLFW.WindowFromId(winid);
    if (!win) return null;
    var prevcbfun = win.charFunc;
    win.charFunc = cbfun;
    return prevcbfun;
  },
  setMouseButtonCallback: (winid, cbfun) => {
    var win = GLFW.WindowFromId(winid);
    if (!win) return null;
    var prevcbfun = win.mouseButtonFunc;
    win.mouseButtonFunc = cbfun;
    return prevcbfun;
  },
  setCursorPosCallback: (winid, cbfun) => {
    var win = GLFW.WindowFromId(winid);
    if (!win) return null;
    var prevcbfun = win.cursorPosFunc;
    win.cursorPosFunc = cbfun;
    return prevcbfun;
  },
  setScrollCallback: (winid, cbfun) => {
    var win = GLFW.WindowFromId(winid);
    if (!win) return null;
    var prevcbfun = win.scrollFunc;
    win.scrollFunc = cbfun;
    return prevcbfun;
  },
  setDropCallback: (winid, cbfun) => {
    var win = GLFW.WindowFromId(winid);
    if (!win) return null;
    var prevcbfun = win.dropFunc;
    win.dropFunc = cbfun;
    return prevcbfun;
  },
  onDrop: event => {
    if (!GLFW.active || !GLFW.active.dropFunc) return;
    if (!event.dataTransfer || !event.dataTransfer.files || event.dataTransfer.files.length == 0) return;
    event.preventDefault();
    var filenames = _malloc(event.dataTransfer.files.length * 4);
    var filenamesArray = [];
    var count = event.dataTransfer.files.length;
    // Read and save the files to emscripten's FS
    var written = 0;
    var drop_dir = ".glfw_dropped_files";
    FS.createPath("/", drop_dir);
    function save(file) {
      var path = "/" + drop_dir + "/" + file.name.replace(/\//g, "_");
      var reader = new FileReader;
      reader.onloadend = e => {
        if (reader.readyState != 2) {
          // not DONE
          ++written;
          out("failed to read dropped file: " + file.name + ": " + reader.error);
          return;
        }
        var data = e.target.result;
        FS.writeFile(path, new Uint8Array(data));
        if (++written === count) {
          getWasmTableEntry(GLFW.active.dropFunc)(GLFW.active.id, count, filenames);
          for (var i = 0; i < filenamesArray.length; ++i) {
            _free(filenamesArray[i]);
          }
          _free(filenames);
        }
      };
      reader.readAsArrayBuffer(file);
      var filename = stringToNewUTF8(path);
      filenamesArray.push(filename);
      GROWABLE_HEAP_U32()[((filenames + i * 4) >> 2)] = filename;
      checkInt32(filename);
    }
    for (var i = 0; i < count; ++i) {
      save(event.dataTransfer.files[i]);
    }
    return false;
  },
  onDragover: event => {
    if (!GLFW.active || !GLFW.active.dropFunc) return;
    event.preventDefault();
    return false;
  },
  setWindowSizeCallback: (winid, cbfun) => {
    var win = GLFW.WindowFromId(winid);
    if (!win) return null;
    var prevcbfun = win.windowSizeFunc;
    win.windowSizeFunc = cbfun;
    return prevcbfun;
  },
  setWindowCloseCallback: (winid, cbfun) => {
    var win = GLFW.WindowFromId(winid);
    if (!win) return null;
    var prevcbfun = win.windowCloseFunc;
    win.windowCloseFunc = cbfun;
    return prevcbfun;
  },
  setWindowRefreshCallback: (winid, cbfun) => {
    var win = GLFW.WindowFromId(winid);
    if (!win) return null;
    var prevcbfun = win.windowRefreshFunc;
    win.windowRefreshFunc = cbfun;
    return prevcbfun;
  },
  onClickRequestPointerLock: e => {
    if (!Browser.pointerLock && Module["canvas"].requestPointerLock) {
      Module["canvas"].requestPointerLock();
      e.preventDefault();
    }
  },
  setInputMode: (winid, mode, value) => {
    var win = GLFW.WindowFromId(winid);
    if (!win) return;
    switch (mode) {
     case 208897:
      {
        // GLFW_CURSOR
        switch (value) {
         case 212993:
          {
            // GLFW_CURSOR_NORMAL
            win.inputModes[mode] = value;
            Module["canvas"].removeEventListener("click", GLFW.onClickRequestPointerLock, true);
            Module["canvas"].exitPointerLock();
            break;
          }

         case 212994:
          {
            // GLFW_CURSOR_HIDDEN
            err("glfwSetInputMode called with GLFW_CURSOR_HIDDEN value not implemented");
            break;
          }

         case 212995:
          {
            // GLFW_CURSOR_DISABLED
            win.inputModes[mode] = value;
            Module["canvas"].addEventListener("click", GLFW.onClickRequestPointerLock, true);
            Module["canvas"].requestPointerLock();
            break;
          }

         default:
          {
            err(`glfwSetInputMode called with unknown value parameter value: ${value}`);
            break;
          }
        }
        break;
      }

     case 208898:
      {
        // GLFW_STICKY_KEYS
        err("glfwSetInputMode called with GLFW_STICKY_KEYS mode not implemented");
        break;
      }

     case 208899:
      {
        // GLFW_STICKY_MOUSE_BUTTONS
        err("glfwSetInputMode called with GLFW_STICKY_MOUSE_BUTTONS mode not implemented");
        break;
      }

     case 208900:
      {
        // GLFW_LOCK_KEY_MODS
        err("glfwSetInputMode called with GLFW_LOCK_KEY_MODS mode not implemented");
        break;
      }

     case 3342341:
      {
        // GLFW_RAW_MOUSE_MOTION
        err("glfwSetInputMode called with GLFW_RAW_MOUSE_MOTION mode not implemented");
        break;
      }

     default:
      {
        err(`glfwSetInputMode called with unknown mode parameter value: ${mode}`);
        break;
      }
    }
  },
  getKey: (winid, key) => {
    var win = GLFW.WindowFromId(winid);
    if (!win) return 0;
    return win.keys[key];
  },
  getMouseButton: (winid, button) => {
    var win = GLFW.WindowFromId(winid);
    if (!win) return 0;
    return (win.buttons & (1 << button)) > 0;
  },
  getCursorPos: (winid, x, y) => {
    GROWABLE_HEAP_F64()[((x) >> 3)] = Browser.mouseX;
    GROWABLE_HEAP_F64()[((y) >> 3)] = Browser.mouseY;
  },
  getMousePos: (winid, x, y) => {
    GROWABLE_HEAP_I32()[((x) >> 2)] = Browser.mouseX;
    checkInt32(Browser.mouseX);
    GROWABLE_HEAP_I32()[((y) >> 2)] = Browser.mouseY;
    checkInt32(Browser.mouseY);
  },
  setCursorPos: (winid, x, y) => {},
  getWindowPos: (winid, x, y) => {
    var wx = 0;
    var wy = 0;
    var win = GLFW.WindowFromId(winid);
    if (win) {
      wx = win.x;
      wy = win.y;
    }
    if (x) {
      GROWABLE_HEAP_I32()[((x) >> 2)] = wx;
      checkInt32(wx);
    }
    if (y) {
      GROWABLE_HEAP_I32()[((y) >> 2)] = wy;
      checkInt32(wy);
    }
  },
  setWindowPos: (winid, x, y) => {
    var win = GLFW.WindowFromId(winid);
    if (!win) return;
    win.x = x;
    win.y = y;
  },
  getWindowSize: (winid, width, height) => {
    var ww = 0;
    var wh = 0;
    var win = GLFW.WindowFromId(winid);
    if (win) {
      ww = win.width;
      wh = win.height;
    }
    if (width) {
      GROWABLE_HEAP_I32()[((width) >> 2)] = ww;
      checkInt32(ww);
    }
    if (height) {
      GROWABLE_HEAP_I32()[((height) >> 2)] = wh;
      checkInt32(wh);
    }
  },
  setWindowSize: (winid, width, height) => {
    var win = GLFW.WindowFromId(winid);
    if (!win) return;
    if (GLFW.active.id == win.id) {
      Browser.setCanvasSize(width, height);
    }
  },
  // triggers the listener (onCanvasResize) + windowSizeFunc
  defaultWindowHints: () => {
    GLFW.hints = Object.assign({}, GLFW.defaultHints);
  },
  createWindow: (width, height, title, monitor, share) => {
    var i, id;
    for (i = 0; i < GLFW.windows.length && GLFW.windows[i] !== null; i++) {}
    // no-op
    if (i > 0) throw "glfwCreateWindow only supports one window at time currently";
    // id for window
    id = i + 1;
    // not valid
    if (width <= 0 || height <= 0) return 0;
    if (monitor) {
      Browser.requestFullscreen();
    } else {
      Browser.setCanvasSize(width, height);
    }
    // Create context when there are no existing alive windows
    for (i = 0; i < GLFW.windows.length && GLFW.windows[i] == null; i++) {}
    // no-op
    var useWebGL = GLFW.hints[139265] > 0;
    // Use WebGL when we are told to based on GLFW_CLIENT_API
    if (i == GLFW.windows.length) {
      if (useWebGL) {
        var contextAttributes = {
          antialias: (GLFW.hints[135181] > 1),
          // GLFW_SAMPLES
          depth: (GLFW.hints[135173] > 0),
          // GLFW_DEPTH_BITS
          stencil: (GLFW.hints[135174] > 0),
          // GLFW_STENCIL_BITS
          alpha: (GLFW.hints[135172] > 0),
          // GLFW_ALPHA_BITS
          preserveDrawingBuffer: true
        };
        /* [b2glfw] B3.x evidence-harness tweak (documented in B2 §toolchain-local) */ console.log("[b2glfw] contextAttributes=" + JSON.stringify(contextAttributes));
        Browser.createContext(Module["canvas"], /*useWebGL=*/ true, /*setInModule=*/ true, contextAttributes);
      } else {
        Browser.init();
      }
    }
    // If context creation failed, do not return a valid window
    if (!Module["ctx"] && useWebGL) return 0;
    // Initializes the framebuffer size from the canvas
    const canvas = Module["canvas"];
    var win = new GLFW_Window(id, width, height, canvas.width, canvas.height, title, monitor, share);
    // Set window to array
    if (id - 1 == GLFW.windows.length) {
      GLFW.windows.push(win);
    } else {
      GLFW.windows[id - 1] = win;
    }
    GLFW.active = win;
    GLFW.adjustCanvasDimensions();
    return win.id;
  },
  destroyWindow: winid => {
    var win = GLFW.WindowFromId(winid);
    if (!win) return;
    if (win.windowCloseFunc) {
      getWasmTableEntry(win.windowCloseFunc)(win.id);
    }
    GLFW.windows[win.id - 1] = null;
    if (GLFW.active.id == win.id) GLFW.active = null;
    // Destroy context when no alive windows
    for (var i = 0; i < GLFW.windows.length; i++) if (GLFW.windows[i] !== null) return;
    delete Module["ctx"];
  },
  swapBuffers: winid => {},
  requestFullscreen(lockPointer, resizeCanvas) {
    Browser.lockPointer = lockPointer;
    Browser.resizeCanvas = resizeCanvas;
    if (typeof Browser.lockPointer == "undefined") Browser.lockPointer = true;
    if (typeof Browser.resizeCanvas == "undefined") Browser.resizeCanvas = false;
    var canvas = Module["canvas"];
    function fullscreenChange() {
      Browser.isFullscreen = false;
      var canvasContainer = canvas.parentNode;
      if ((document["fullscreenElement"] || document["mozFullScreenElement"] || document["msFullscreenElement"] || document["webkitFullscreenElement"] || document["webkitCurrentFullScreenElement"]) === canvasContainer) {
        canvas.exitFullscreen = Browser.exitFullscreen;
        if (Browser.lockPointer) canvas.requestPointerLock();
        Browser.isFullscreen = true;
        if (Browser.resizeCanvas) {
          Browser.setFullscreenCanvasSize();
        } else {
          Browser.updateCanvasDimensions(canvas);
          Browser.updateResizeListeners();
        }
      } else {
        // remove the full screen specific parent of the canvas again to restore the HTML structure from before going full screen
        canvasContainer.parentNode.insertBefore(canvas, canvasContainer);
        canvasContainer.parentNode.removeChild(canvasContainer);
        if (Browser.resizeCanvas) {
          Browser.setWindowedCanvasSize();
        } else {
          Browser.updateCanvasDimensions(canvas);
          Browser.updateResizeListeners();
        }
      }
      Module["onFullScreen"]?.(Browser.isFullscreen);
      Module["onFullscreen"]?.(Browser.isFullscreen);
    }
    if (!Browser.fullscreenHandlersInstalled) {
      Browser.fullscreenHandlersInstalled = true;
      document.addEventListener("fullscreenchange", fullscreenChange, false);
      document.addEventListener("mozfullscreenchange", fullscreenChange, false);
      document.addEventListener("webkitfullscreenchange", fullscreenChange, false);
      document.addEventListener("MSFullscreenChange", fullscreenChange, false);
    }
    // create a new parent to ensure the canvas has no siblings. this allows browsers to optimize full screen performance when its parent is the full screen root
    var canvasContainer = document.createElement("div");
    canvas.parentNode.insertBefore(canvasContainer, canvas);
    canvasContainer.appendChild(canvas);
    // use parent of canvas as full screen root to allow aspect ratio correction (Firefox stretches the root to screen size)
    canvasContainer.requestFullscreen = canvasContainer["requestFullscreen"] || canvasContainer["mozRequestFullScreen"] || canvasContainer["msRequestFullscreen"] || (canvasContainer["webkitRequestFullscreen"] ? () => canvasContainer["webkitRequestFullscreen"](Element["ALLOW_KEYBOARD_INPUT"]) : null) || (canvasContainer["webkitRequestFullScreen"] ? () => canvasContainer["webkitRequestFullScreen"](Element["ALLOW_KEYBOARD_INPUT"]) : null);
    canvasContainer.requestFullscreen();
  },
  updateCanvasDimensions(canvas, wNative, hNative) {
    const scale = GLFW.getHiDPIScale();
    if (wNative && hNative) {
      canvas.widthNative = wNative;
      canvas.heightNative = hNative;
    } else {
      wNative = canvas.widthNative;
      hNative = canvas.heightNative;
    }
    var w = wNative;
    var h = hNative;
    if (Module["forcedAspectRatio"] && Module["forcedAspectRatio"] > 0) {
      if (w / h < Module["forcedAspectRatio"]) {
        w = Math.round(h * Module["forcedAspectRatio"]);
      } else {
        h = Math.round(w / Module["forcedAspectRatio"]);
      }
    }
    if (((document["fullscreenElement"] || document["mozFullScreenElement"] || document["msFullscreenElement"] || document["webkitFullscreenElement"] || document["webkitCurrentFullScreenElement"]) === canvas.parentNode) && (typeof screen != "undefined")) {
      var factor = Math.min(screen.width / w, screen.height / h);
      w = Math.round(w * factor);
      h = Math.round(h * factor);
    }
    if (Browser.resizeCanvas) {
      wNative = w;
      hNative = h;
    }
    const wNativeScaled = Math.floor(wNative * scale);
    const hNativeScaled = Math.floor(hNative * scale);
    if (canvas.width != wNativeScaled) canvas.width = wNativeScaled;
    if (canvas.height != hNativeScaled) canvas.height = hNativeScaled;
    if (typeof canvas.style != "undefined") {
      if (!GLFW.isCSSScalingEnabled()) {
        canvas.style.setProperty("width", wNative + "px", "important");
        canvas.style.setProperty("height", hNative + "px", "important");
      } else {
        canvas.style.removeProperty("width");
        canvas.style.removeProperty("height");
      }
    }
  },
  calculateMouseCoords(pageX, pageY) {
    // Calculate the movement based on the changes
    // in the coordinates.
    const rect = Module["canvas"].getBoundingClientRect();
    // Neither .scrollX or .pageXOffset are defined in a spec, but
    // we prefer .scrollX because it is currently in a spec draft.
    // (see: http://www.w3.org/TR/2013/WD-cssom-view-20131217/)
    var scrollX = ((typeof window.scrollX != "undefined") ? window.scrollX : window.pageXOffset);
    var scrollY = ((typeof window.scrollY != "undefined") ? window.scrollY : window.pageYOffset);
    // If this assert lands, it's likely because the browser doesn't support scrollX or pageXOffset
    // and we have no viable fallback.
    assert((typeof scrollX != "undefined") && (typeof scrollY != "undefined"), "Unable to retrieve scroll position, mouse positions likely broken.");
    var adjustedX = pageX - (scrollX + rect.left);
    var adjustedY = pageY - (scrollY + rect.top);
    // getBoundingClientRect() returns dimension affected by CSS, so as a result:
    // - when CSS scaling is enabled, this will fix the mouse coordinates to match the width/height of the window
    // - otherwise the CSS width/height are forced to the width/height of the GLFW window (see updateCanvasDimensions),
    //   so there is no need to adjust the position
    if (GLFW.isCSSScalingEnabled() && GLFW.active) {
      adjustedX = adjustedX * (GLFW.active.width / rect.width);
      adjustedY = adjustedY * (GLFW.active.height / rect.height);
    }
    return {
      x: adjustedX,
      y: adjustedY
    };
  },
  setWindowAttrib: (winid, attrib, value) => {
    var win = GLFW.WindowFromId(winid);
    if (!win) return;
    const isHiDPIAware = GLFW.isHiDPIAware();
    win.attributes[attrib] = value;
    if (isHiDPIAware !== GLFW.isHiDPIAware()) GLFW.adjustCanvasDimensions();
  },
  getDevicePixelRatio() {
    return (typeof devicePixelRatio == "number" && devicePixelRatio) || 1;
  },
  isHiDPIAware() {
    if (GLFW.active) return GLFW.active.attributes[139276] > 0; else // GLFW_SCALE_TO_MONITOR
    return false;
  },
  isCSSScalingEnabled() {
    return !GLFW.isHiDPIAware();
  },
  adjustCanvasDimensions() {
    if (GLFW.active) {
      Browser.updateCanvasDimensions(Module["canvas"], GLFW.active.width, GLFW.active.height);
      Browser.updateResizeListeners();
    }
  },
  getHiDPIScale() {
    return GLFW.isHiDPIAware() ? GLFW.scale : 1;
  },
  onDevicePixelRatioChange() {
    GLFW.onWindowContentScaleChanged(GLFW.getDevicePixelRatio());
    GLFW.adjustCanvasDimensions();
  },
  GLFW2ParamToGLFW3Param: param => {
    var table = {
      196609: 0,
      // GLFW_MOUSE_CURSOR
      196610: 0,
      // GLFW_STICKY_KEYS
      196611: 0,
      // GLFW_STICKY_MOUSE_BUTTONS
      196612: 0,
      // GLFW_SYSTEM_KEYS
      196613: 0,
      // GLFW_KEY_REPEAT
      196614: 0,
      // GLFW_AUTO_POLL_EVENTS
      131073: 0,
      // GLFW_OPENED
      131074: 0,
      // GLFW_ACTIVE
      131075: 0,
      // GLFW_ICONIFIED
      131076: 0,
      // GLFW_ACCELERATED
      131077: 135169,
      // GLFW_RED_BITS
      131078: 135170,
      // GLFW_GREEN_BITS
      131079: 135171,
      // GLFW_BLUE_BITS
      131080: 135172,
      // GLFW_ALPHA_BITS
      131081: 135173,
      // GLFW_DEPTH_BITS
      131082: 135174,
      // GLFW_STENCIL_BITS
      131083: 135183,
      // GLFW_REFRESH_RATE
      131084: 135175,
      // GLFW_ACCUM_RED_BITS
      131085: 135176,
      // GLFW_ACCUM_GREEN_BITS
      131086: 135177,
      // GLFW_ACCUM_BLUE_BITS
      131087: 135178,
      // GLFW_ACCUM_ALPHA_BITS
      131088: 135179,
      // GLFW_AUX_BUFFERS
      131089: 135180,
      // GLFW_STEREO
      131090: 0,
      // GLFW_WINDOW_NO_RESIZE
      131091: 135181,
      // GLFW_FSAA_SAMPLES
      131092: 139266,
      // GLFW_OPENGL_VERSION_MAJOR
      131093: 139267,
      // GLFW_OPENGL_VERSION_MINOR
      131094: 139270,
      // GLFW_OPENGL_FORWARD_COMPAT
      131095: 139271,
      // GLFW_OPENGL_DEBUG_CONTEXT
      131096: 139272
    };
    // GLFW_OPENGL_PROFILE
    return table[param];
  }
};

var _glfwCreateWindow = (width, height, title, monitor, share) => GLFW.createWindow(width, height, title, monitor, share);

var _glfwDestroyWindow = winid => GLFW.destroyWindow(winid);

var _glfwGetCursorPos = (winid, x, y) => GLFW.getCursorPos(winid, x, y);

var _glfwGetFramebufferSize = (winid, width, height) => {
  var ww = 0;
  var wh = 0;
  var win = GLFW.WindowFromId(winid);
  if (win) {
    ww = win.framebufferWidth;
    wh = win.framebufferHeight;
  }
  if (width) {
    GROWABLE_HEAP_I32()[((width) >> 2)] = ww;
    checkInt32(ww);
  }
  if (height) {
    GROWABLE_HEAP_I32()[((height) >> 2)] = wh;
    checkInt32(wh);
  }
};

var _glfwGetJoystickAxes = (joy, count) => {
  GLFW.refreshJoysticks();
  var state = GLFW.joys[joy];
  if (!state || !state.axes) {
    GROWABLE_HEAP_I32()[((count) >> 2)] = 0;
    checkInt32(0);
    return;
  }
  GROWABLE_HEAP_I32()[((count) >> 2)] = state.axesCount;
  checkInt32(state.axesCount);
  return state.axes;
};

var _glfwGetJoystickButtons = (joy, count) => {
  GLFW.refreshJoysticks();
  var state = GLFW.joys[joy];
  if (!state || !state.buttons) {
    GROWABLE_HEAP_I32()[((count) >> 2)] = 0;
    checkInt32(0);
    return;
  }
  GROWABLE_HEAP_I32()[((count) >> 2)] = state.buttonsCount;
  checkInt32(state.buttonsCount);
  return state.buttons;
};

var _glfwGetJoystickName = joy => {
  if (GLFW.joys[joy]) {
    return GLFW.joys[joy].id;
  }
  return 0;
};

var _glfwGetMonitorName = mon => {
  GLFW.monitorString ||= stringToNewUTF8("HTML5 WebGL Canvas");
  return GLFW.monitorString;
};

var _glfwGetMonitors = count => {
  GROWABLE_HEAP_I32()[((count) >> 2)] = 1;
  checkInt32(1);
  if (!GLFW.monitors) {
    GLFW.monitors = _malloc(4);
    GROWABLE_HEAP_I32()[((GLFW.monitors) >> 2)] = 1;
    checkInt32(1);
  }
  return GLFW.monitors;
};

var _glfwGetMouseButton = (winid, button) => GLFW.getMouseButton(winid, button);

var _glfwGetPrimaryMonitor = () => 1;

var _glfwGetVideoMode = monitor => 0;

var _glfwGetWindowSize = (winid, width, height) => GLFW.getWindowSize(winid, width, height);

var _glfwInit = () => {
  if (GLFW.windows) return 1;
  // GL_TRUE
  GLFW.initialTime = GLFW.getTime();
  GLFW.defaultWindowHints();
  GLFW.windows = new Array;
  GLFW.active = null;
  GLFW.scale = GLFW.getDevicePixelRatio();
  window.addEventListener("gamepadconnected", GLFW.onGamepadConnected, true);
  window.addEventListener("gamepaddisconnected", GLFW.onGamepadDisconnected, true);
  window.addEventListener("keydown", GLFW.onKeydown, true);
  window.addEventListener("keypress", GLFW.onKeyPress, true);
  window.addEventListener("keyup", GLFW.onKeyup, true);
  window.addEventListener("blur", GLFW.onBlur, true);
  // watch for devicePixelRatio changes
  GLFW.devicePixelRatioMQL = window.matchMedia("(resolution: " + GLFW.getDevicePixelRatio() + "dppx)");
  GLFW.devicePixelRatioMQL.addEventListener("change", GLFW.onDevicePixelRatioChange);
  Module["canvas"].addEventListener("touchmove", GLFW.onMousemove, true);
  Module["canvas"].addEventListener("touchstart", GLFW.onMouseButtonDown, true);
  Module["canvas"].addEventListener("touchcancel", GLFW.onMouseButtonUp, true);
  Module["canvas"].addEventListener("touchend", GLFW.onMouseButtonUp, true);
  Module["canvas"].addEventListener("mousemove", GLFW.onMousemove, true);
  Module["canvas"].addEventListener("mousedown", GLFW.onMouseButtonDown, true);
  Module["canvas"].addEventListener("mouseup", GLFW.onMouseButtonUp, true);
  Module["canvas"].addEventListener("wheel", GLFW.onMouseWheel, true);
  Module["canvas"].addEventListener("mousewheel", GLFW.onMouseWheel, true);
  Module["canvas"].addEventListener("mouseenter", GLFW.onMouseenter, true);
  Module["canvas"].addEventListener("mouseleave", GLFW.onMouseleave, true);
  Module["canvas"].addEventListener("drop", GLFW.onDrop, true);
  Module["canvas"].addEventListener("dragover", GLFW.onDragover, true);
  // Overriding implementation to account for HiDPI
  Browser.requestFullscreen = GLFW.requestFullscreen;
  Browser.calculateMouseCoords = GLFW.calculateMouseCoords;
  Browser.updateCanvasDimensions = GLFW.updateCanvasDimensions;
  Browser.resizeListeners.push((width, height) => {
    if (GLFW.isHiDPIAware()) {
      var canvas = Module["canvas"];
      GLFW.onCanvasResize(canvas.clientWidth, canvas.clientHeight, width, height);
    } else {
      GLFW.onCanvasResize(width, height, width, height);
    }
  });
  return 1;
};

// GL_TRUE
var _glfwJoystickIsGamepad = jid => {
  throw "glfwJoystickIsGamepad not implemented";
};

var _glfwJoystickPresent = joy => {
  GLFW.refreshJoysticks();
  return GLFW.joys[joy] !== undefined;
};

var _glfwMakeContextCurrent = winid => {};

var _glfwPollEvents = () => {};

var _glfwSetCursorEnterCallback = (winid, cbfun) => {
  var win = GLFW.WindowFromId(winid);
  if (!win) return null;
  var prevcbfun = win.cursorEnterFunc;
  win.cursorEnterFunc = cbfun;
  return prevcbfun;
};

var _glfwSetCursorPos = (winid, x, y) => GLFW.setCursorPos(winid, x, y);

var _glfwSetCursorPosCallback = (winid, cbfun) => GLFW.setCursorPosCallback(winid, cbfun);

var _glfwSetErrorCallback = cbfun => {
  var prevcbfun = GLFW.errorFunc;
  GLFW.errorFunc = cbfun;
  return prevcbfun;
};

var _glfwSetFramebufferSizeCallback = (winid, cbfun) => {
  var win = GLFW.WindowFromId(winid);
  if (!win) return null;
  var prevcbfun = win.framebufferSizeFunc;
  win.framebufferSizeFunc = cbfun;
  return prevcbfun;
};

var _glfwSetInputMode = (winid, mode, value) => {
  GLFW.setInputMode(winid, mode, value);
};

var _glfwSetJoystickCallback = cbfun => GLFW.setJoystickCallback(cbfun);

var _glfwSetKeyCallback = (winid, cbfun) => GLFW.setKeyCallback(winid, cbfun);

var _glfwSetScrollCallback = (winid, cbfun) => GLFW.setScrollCallback(winid, cbfun);

var _glfwSetWindowFocusCallback = (winid, cbfun) => {
  var win = GLFW.WindowFromId(winid);
  if (!win) return null;
  var prevcbfun = win.windowFocusFunc;
  win.windowFocusFunc = cbfun;
  return prevcbfun;
};

var _glfwSetWindowIconifyCallback = (winid, cbfun) => {
  var win = GLFW.WindowFromId(winid);
  if (!win) return null;
  var prevcbfun = win.windowIconifyFunc;
  win.windowIconifyFunc = cbfun;
  return prevcbfun;
};

var _glfwSetWindowSize = (winid, width, height) => GLFW.setWindowSize(winid, width, height);

var _glfwSwapBuffers = winid => GLFW.swapBuffers(winid);

var _glfwSwapInterval = interval => {
  interval = Math.abs(interval);
  // GLFW uses negative values to enable GLX_EXT_swap_control_tear, which we don't have, so just treat negative and positive the same.
  if (interval == 0) _emscripten_set_main_loop_timing(0, 0); else _emscripten_set_main_loop_timing(1, interval);
};

var _glfwTerminate = () => {
  window.removeEventListener("gamepadconnected", GLFW.onGamepadConnected, true);
  window.removeEventListener("gamepaddisconnected", GLFW.onGamepadDisconnected, true);
  window.removeEventListener("keydown", GLFW.onKeydown, true);
  window.removeEventListener("keypress", GLFW.onKeyPress, true);
  window.removeEventListener("keyup", GLFW.onKeyup, true);
  window.removeEventListener("blur", GLFW.onBlur, true);
  Module["canvas"].removeEventListener("touchmove", GLFW.onMousemove, true);
  Module["canvas"].removeEventListener("touchstart", GLFW.onMouseButtonDown, true);
  Module["canvas"].removeEventListener("touchcancel", GLFW.onMouseButtonUp, true);
  Module["canvas"].removeEventListener("touchend", GLFW.onMouseButtonUp, true);
  Module["canvas"].removeEventListener("mousemove", GLFW.onMousemove, true);
  Module["canvas"].removeEventListener("mousedown", GLFW.onMouseButtonDown, true);
  Module["canvas"].removeEventListener("mouseup", GLFW.onMouseButtonUp, true);
  Module["canvas"].removeEventListener("wheel", GLFW.onMouseWheel, true);
  Module["canvas"].removeEventListener("mousewheel", GLFW.onMouseWheel, true);
  Module["canvas"].removeEventListener("mouseenter", GLFW.onMouseenter, true);
  Module["canvas"].removeEventListener("mouseleave", GLFW.onMouseleave, true);
  Module["canvas"].removeEventListener("drop", GLFW.onDrop, true);
  Module["canvas"].removeEventListener("dragover", GLFW.onDragover, true);
  if (GLFW.devicePixelRatioMQL) GLFW.devicePixelRatioMQL.removeEventListener("change", GLFW.onDevicePixelRatioChange);
  Module["canvas"].width = Module["canvas"].height = 1;
  GLFW.windows = null;
  GLFW.active = null;
};

var _glfwWindowHint = (target, hint) => {
  GLFW.hints[target] = hint;
};

var _glfwWindowShouldClose = winid => {
  var win = GLFW.WindowFromId(winid);
  if (!win) return 0;
  return win.shouldClose;
};

var stringToUTF8OnStack = str => {
  var size = lengthBytesUTF8(str) + 1;
  var ret = stackAlloc(size);
  stringToUTF8(str, ret, size);
  return ret;
};

var getCFunc = ident => {
  var func = Module["_" + ident];
  // closure exported function
  assert(func, "Cannot call unknown function " + ident + ", make sure it is exported");
  return func;
};

var writeArrayToMemory = (array, buffer) => {
  assert(array.length >= 0, "writeArrayToMemory array must have a length (should be an array or typed array)");
  GROWABLE_HEAP_I8().set(array, buffer);
};

/**
     * @param {string|null=} returnType
     * @param {Array=} argTypes
     * @param {Arguments|Array=} args
     * @param {Object=} opts
     */ var ccall = (ident, returnType, argTypes, args, opts) => {
  // For fast lookup of conversion functions
  var toC = {
    "string": str => {
      var ret = 0;
      if (str !== null && str !== undefined && str !== 0) {
        // null string
        ret = stringToUTF8OnStack(str);
      }
      return ret;
    },
    "array": arr => {
      var ret = stackAlloc(arr.length);
      writeArrayToMemory(arr, ret);
      return ret;
    }
  };
  function convertReturnValue(ret) {
    if (returnType === "string") {
      return UTF8ToString(ret);
    }
    if (returnType === "boolean") return Boolean(ret);
    return ret;
  }
  var func = getCFunc(ident);
  var cArgs = [];
  var stack = 0;
  assert(returnType !== "array", 'Return type should not be "array".');
  if (args) {
    for (var i = 0; i < args.length; i++) {
      var converter = toC[argTypes[i]];
      if (converter) {
        if (stack === 0) stack = stackSave();
        cArgs[i] = converter(args[i]);
      } else {
        cArgs[i] = args[i];
      }
    }
  }
  var ret = func(...cArgs);
  function onDone(ret) {
    if (stack !== 0) stackRestore(stack);
    return convertReturnValue(ret);
  }
  ret = onDone(ret);
  return ret;
};

var FS_createPath = FS.createPath;

var FS_unlink = path => FS.unlink(path);

var FS_createLazyFile = FS.createLazyFile;

var FS_createDevice = FS.createDevice;

PThread.init();

FS.createPreloadedFile = FS_createPreloadedFile;

FS.staticInit();

// Set module methods based on EXPORTED_RUNTIME_METHODS
Module["FS_createPath"] = FS.createPath;

Module["FS_createDataFile"] = FS.createDataFile;

Module["FS_createPreloadedFile"] = FS.createPreloadedFile;

Module["FS_unlink"] = FS.unlink;

Module["FS_createLazyFile"] = FS.createLazyFile;

Module["FS_createDevice"] = FS.createDevice;

Module["requestAnimationFrame"] = MainLoop.requestAnimationFrame;

Module["pauseMainLoop"] = MainLoop.pause;

Module["resumeMainLoop"] = MainLoop.resume;

MainLoop.init();

for (var i = 0; i < 32; ++i) tempFixedLengthArray.push(new Array(i));

// exports
Module["requestFullscreen"] = Browser.requestFullscreen;

Module["requestFullScreen"] = Browser.requestFullScreen;

Module["setCanvasSize"] = Browser.setCanvasSize;

Module["getUserMedia"] = Browser.getUserMedia;

Module["createContext"] = Browser.createContext;

// proxiedFunctionTable specifies the list of functions that can be called
// either synchronously or asynchronously from other threads in postMessage()d
// or internally queued events. This way a pthread in a Worker can synchronously
// access e.g. the DOM on the main thread.
var proxiedFunctionTable = [ _proc_exit, exitOnMainThread, pthreadCreateProxied, ___syscall__newselect, ___syscall_chdir, ___syscall_faccessat, ___syscall_fcntl64, ___syscall_fstat64, ___syscall_getcwd, ___syscall_getdents64, ___syscall_ioctl, ___syscall_lstat64, ___syscall_mkdirat, ___syscall_newfstatat, ___syscall_openat, ___syscall_readlinkat, ___syscall_renameat, ___syscall_stat64, ___syscall_unlinkat, _alBuffer3f, _alBuffer3i, _alBufferData, _alBufferf, _alBufferfv, _alBufferi, _alBufferiv, _alDeleteBuffers, _alDeleteSources, _alSourcei, _alDisable, _alDistanceModel, _alDopplerFactor, _alDopplerVelocity, _alEnable, _alGenBuffers, _alGenSources, _alGetBoolean, _alGetBooleanv, _alGetBuffer3f, _alGetBuffer3i, _alGetBufferf, _alGetBufferfv, _alGetBufferi, _alGetBufferiv, _alGetDouble, _alGetDoublev, _alGetEnumValue, _alGetError, _alGetFloat, _alGetFloatv, _alGetInteger, _alGetIntegerv, _alGetListener3f, _alGetListener3i, _alGetListenerf, _alGetListenerfv, _alGetListeneri, _alGetListeneriv, _alGetSource3f, _alGetSource3i, _alGetSourcef, _alGetSourcefv, _alGetSourcei, _alGetSourceiv, _alGetString, _alIsBuffer, _alIsEnabled, _alIsExtensionPresent, _alIsSource, _alListener3f, _alListener3i, _alListenerf, _alListenerfv, _alListeneri, _alListeneriv, _alSource3f, _alSource3i, _alSourcePause, _alSourcePausev, _alSourcePlay, _alSourcePlayv, _alSourceQueueBuffers, _alSourceRewind, _alSourceRewindv, _alSourceStop, _alSourceStopv, _alSourceUnqueueBuffers, _alSourcef, _alSourcefv, _alSourceiv, _alSpeedOfSound, _alcCloseDevice, _alcCreateContext, _alcDestroyContext, _alcGetIntegerv, _alcGetString, _alcIsExtensionPresent, _alcMakeContextCurrent, _alcOpenDevice, _environ_get, _environ_sizes_get, _fd_close, _fd_read, _fd_seek, _fd_write, _emscripten_set_window_title ];

function checkIncomingModuleAPI() {
  ignoredModuleProp("fetchSettings");
}

var wasmImports;

function assignWasmImports() {
  wasmImports = {
    /** @export */ __assert_fail: ___assert_fail,
    /** @export */ __cxa_throw: ___cxa_throw,
    /** @export */ __handle_stack_overflow: ___handle_stack_overflow,
    /** @export */ __pthread_create_js: ___pthread_create_js,
    /** @export */ __syscall__newselect: ___syscall__newselect,
    /** @export */ __syscall_chdir: ___syscall_chdir,
    /** @export */ __syscall_faccessat: ___syscall_faccessat,
    /** @export */ __syscall_fcntl64: ___syscall_fcntl64,
    /** @export */ __syscall_fstat64: ___syscall_fstat64,
    /** @export */ __syscall_getcwd: ___syscall_getcwd,
    /** @export */ __syscall_getdents64: ___syscall_getdents64,
    /** @export */ __syscall_ioctl: ___syscall_ioctl,
    /** @export */ __syscall_lstat64: ___syscall_lstat64,
    /** @export */ __syscall_mkdirat: ___syscall_mkdirat,
    /** @export */ __syscall_newfstatat: ___syscall_newfstatat,
    /** @export */ __syscall_openat: ___syscall_openat,
    /** @export */ __syscall_readlinkat: ___syscall_readlinkat,
    /** @export */ __syscall_renameat: ___syscall_renameat,
    /** @export */ __syscall_stat64: ___syscall_stat64,
    /** @export */ __syscall_unlinkat: ___syscall_unlinkat,
    /** @export */ _abort_js: __abort_js,
    /** @export */ _emscripten_init_main_thread_js: __emscripten_init_main_thread_js,
    /** @export */ _emscripten_notify_mailbox_postmessage: __emscripten_notify_mailbox_postmessage,
    /** @export */ _emscripten_receive_on_main_thread_js: __emscripten_receive_on_main_thread_js,
    /** @export */ _emscripten_thread_cleanup: __emscripten_thread_cleanup,
    /** @export */ _emscripten_thread_mailbox_await: __emscripten_thread_mailbox_await,
    /** @export */ _emscripten_thread_set_strongref: __emscripten_thread_set_strongref,
    /** @export */ _gmtime_js: __gmtime_js,
    /** @export */ _localtime_js: __localtime_js,
    /** @export */ _tzset_js: __tzset_js,
    /** @export */ alBuffer3f: _alBuffer3f,
    /** @export */ alBuffer3i: _alBuffer3i,
    /** @export */ alBufferData: _alBufferData,
    /** @export */ alBufferf: _alBufferf,
    /** @export */ alBufferfv: _alBufferfv,
    /** @export */ alBufferi: _alBufferi,
    /** @export */ alBufferiv: _alBufferiv,
    /** @export */ alDeleteBuffers: _alDeleteBuffers,
    /** @export */ alDeleteSources: _alDeleteSources,
    /** @export */ alDisable: _alDisable,
    /** @export */ alDistanceModel: _alDistanceModel,
    /** @export */ alDopplerFactor: _alDopplerFactor,
    /** @export */ alDopplerVelocity: _alDopplerVelocity,
    /** @export */ alEnable: _alEnable,
    /** @export */ alGenBuffers: _alGenBuffers,
    /** @export */ alGenSources: _alGenSources,
    /** @export */ alGetBoolean: _alGetBoolean,
    /** @export */ alGetBooleanv: _alGetBooleanv,
    /** @export */ alGetBuffer3f: _alGetBuffer3f,
    /** @export */ alGetBuffer3i: _alGetBuffer3i,
    /** @export */ alGetBufferf: _alGetBufferf,
    /** @export */ alGetBufferfv: _alGetBufferfv,
    /** @export */ alGetBufferi: _alGetBufferi,
    /** @export */ alGetBufferiv: _alGetBufferiv,
    /** @export */ alGetDouble: _alGetDouble,
    /** @export */ alGetDoublev: _alGetDoublev,
    /** @export */ alGetEnumValue: _alGetEnumValue,
    /** @export */ alGetError: _alGetError,
    /** @export */ alGetFloat: _alGetFloat,
    /** @export */ alGetFloatv: _alGetFloatv,
    /** @export */ alGetInteger: _alGetInteger,
    /** @export */ alGetIntegerv: _alGetIntegerv,
    /** @export */ alGetListener3f: _alGetListener3f,
    /** @export */ alGetListener3i: _alGetListener3i,
    /** @export */ alGetListenerf: _alGetListenerf,
    /** @export */ alGetListenerfv: _alGetListenerfv,
    /** @export */ alGetListeneri: _alGetListeneri,
    /** @export */ alGetListeneriv: _alGetListeneriv,
    /** @export */ alGetSource3f: _alGetSource3f,
    /** @export */ alGetSource3i: _alGetSource3i,
    /** @export */ alGetSourcef: _alGetSourcef,
    /** @export */ alGetSourcefv: _alGetSourcefv,
    /** @export */ alGetSourcei: _alGetSourcei,
    /** @export */ alGetSourceiv: _alGetSourceiv,
    /** @export */ alGetString: _alGetString,
    /** @export */ alIsBuffer: _alIsBuffer,
    /** @export */ alIsEnabled: _alIsEnabled,
    /** @export */ alIsExtensionPresent: _alIsExtensionPresent,
    /** @export */ alIsSource: _alIsSource,
    /** @export */ alListener3f: _alListener3f,
    /** @export */ alListener3i: _alListener3i,
    /** @export */ alListenerf: _alListenerf,
    /** @export */ alListenerfv: _alListenerfv,
    /** @export */ alListeneri: _alListeneri,
    /** @export */ alListeneriv: _alListeneriv,
    /** @export */ alSource3f: _alSource3f,
    /** @export */ alSource3i: _alSource3i,
    /** @export */ alSourcePause: _alSourcePause,
    /** @export */ alSourcePausev: _alSourcePausev,
    /** @export */ alSourcePlay: _alSourcePlay,
    /** @export */ alSourcePlayv: _alSourcePlayv,
    /** @export */ alSourceQueueBuffers: _alSourceQueueBuffers,
    /** @export */ alSourceRewind: _alSourceRewind,
    /** @export */ alSourceRewindv: _alSourceRewindv,
    /** @export */ alSourceStop: _alSourceStop,
    /** @export */ alSourceStopv: _alSourceStopv,
    /** @export */ alSourceUnqueueBuffers: _alSourceUnqueueBuffers,
    /** @export */ alSourcef: _alSourcef,
    /** @export */ alSourcefv: _alSourcefv,
    /** @export */ alSourcei: _alSourcei,
    /** @export */ alSourceiv: _alSourceiv,
    /** @export */ alSpeedOfSound: _alSpeedOfSound,
    /** @export */ alcCloseDevice: _alcCloseDevice,
    /** @export */ alcCreateContext: _alcCreateContext,
    /** @export */ alcDestroyContext: _alcDestroyContext,
    /** @export */ alcGetIntegerv: _alcGetIntegerv,
    /** @export */ alcGetString: _alcGetString,
    /** @export */ alcIsExtensionPresent: _alcIsExtensionPresent,
    /** @export */ alcMakeContextCurrent: _alcMakeContextCurrent,
    /** @export */ alcOpenDevice: _alcOpenDevice,
    /** @export */ alcSuspendContext: _alcSuspendContext,
    /** @export */ b33_img_fetch_sync,
    /** @export */ b33_img_read,
    /** @export */ b33_img_ready,
    /** @export */ b33_img_register,
    /** @export */ b33_img_size,
    /** @export */ clock_time_get: _clock_time_get,
    /** @export */ emscripten_asm_const_int: _emscripten_asm_const_int,
    /** @export */ emscripten_cancel_main_loop: _emscripten_cancel_main_loop,
    /** @export */ emscripten_check_blocking_allowed: _emscripten_check_blocking_allowed,
    /** @export */ emscripten_date_now: _emscripten_date_now,
    /** @export */ emscripten_err: _emscripten_err,
    /** @export */ emscripten_exit_with_live_runtime: _emscripten_exit_with_live_runtime,
    /** @export */ emscripten_get_now: _emscripten_get_now,
    /** @export */ emscripten_glActiveTexture: _emscripten_glActiveTexture,
    /** @export */ emscripten_glAttachShader: _emscripten_glAttachShader,
    /** @export */ emscripten_glBeginQuery: _emscripten_glBeginQuery,
    /** @export */ emscripten_glBeginQueryEXT: _emscripten_glBeginQueryEXT,
    /** @export */ emscripten_glBeginTransformFeedback: _emscripten_glBeginTransformFeedback,
    /** @export */ emscripten_glBindAttribLocation: _emscripten_glBindAttribLocation,
    /** @export */ emscripten_glBindBuffer: _emscripten_glBindBuffer,
    /** @export */ emscripten_glBindBufferBase: _emscripten_glBindBufferBase,
    /** @export */ emscripten_glBindBufferRange: _emscripten_glBindBufferRange,
    /** @export */ emscripten_glBindFramebuffer: _emscripten_glBindFramebuffer,
    /** @export */ emscripten_glBindRenderbuffer: _emscripten_glBindRenderbuffer,
    /** @export */ emscripten_glBindSampler: _emscripten_glBindSampler,
    /** @export */ emscripten_glBindTexture: _emscripten_glBindTexture,
    /** @export */ emscripten_glBindTransformFeedback: _emscripten_glBindTransformFeedback,
    /** @export */ emscripten_glBindVertexArray: _emscripten_glBindVertexArray,
    /** @export */ emscripten_glBindVertexArrayOES: _emscripten_glBindVertexArrayOES,
    /** @export */ emscripten_glBlendColor: _emscripten_glBlendColor,
    /** @export */ emscripten_glBlendEquation: _emscripten_glBlendEquation,
    /** @export */ emscripten_glBlendEquationSeparate: _emscripten_glBlendEquationSeparate,
    /** @export */ emscripten_glBlendFunc: _emscripten_glBlendFunc,
    /** @export */ emscripten_glBlendFuncSeparate: _emscripten_glBlendFuncSeparate,
    /** @export */ emscripten_glBlitFramebuffer: _emscripten_glBlitFramebuffer,
    /** @export */ emscripten_glBufferData: _emscripten_glBufferData,
    /** @export */ emscripten_glBufferSubData: _emscripten_glBufferSubData,
    /** @export */ emscripten_glCheckFramebufferStatus: _emscripten_glCheckFramebufferStatus,
    /** @export */ emscripten_glClear: _emscripten_glClear,
    /** @export */ emscripten_glClearBufferfi: _emscripten_glClearBufferfi,
    /** @export */ emscripten_glClearBufferfv: _emscripten_glClearBufferfv,
    /** @export */ emscripten_glClearBufferiv: _emscripten_glClearBufferiv,
    /** @export */ emscripten_glClearBufferuiv: _emscripten_glClearBufferuiv,
    /** @export */ emscripten_glClearColor: _emscripten_glClearColor,
    /** @export */ emscripten_glClearDepthf: _emscripten_glClearDepthf,
    /** @export */ emscripten_glClearStencil: _emscripten_glClearStencil,
    /** @export */ emscripten_glClientWaitSync: _emscripten_glClientWaitSync,
    /** @export */ emscripten_glClipControlEXT: _emscripten_glClipControlEXT,
    /** @export */ emscripten_glColorMask: _emscripten_glColorMask,
    /** @export */ emscripten_glCompileShader: _emscripten_glCompileShader,
    /** @export */ emscripten_glCompressedTexImage2D: _emscripten_glCompressedTexImage2D,
    /** @export */ emscripten_glCompressedTexImage3D: _emscripten_glCompressedTexImage3D,
    /** @export */ emscripten_glCompressedTexSubImage2D: _emscripten_glCompressedTexSubImage2D,
    /** @export */ emscripten_glCompressedTexSubImage3D: _emscripten_glCompressedTexSubImage3D,
    /** @export */ emscripten_glCopyBufferSubData: _emscripten_glCopyBufferSubData,
    /** @export */ emscripten_glCopyTexImage2D: _emscripten_glCopyTexImage2D,
    /** @export */ emscripten_glCopyTexSubImage2D: _emscripten_glCopyTexSubImage2D,
    /** @export */ emscripten_glCopyTexSubImage3D: _emscripten_glCopyTexSubImage3D,
    /** @export */ emscripten_glCreateProgram: _emscripten_glCreateProgram,
    /** @export */ emscripten_glCreateShader: _emscripten_glCreateShader,
    /** @export */ emscripten_glCullFace: _emscripten_glCullFace,
    /** @export */ emscripten_glDeleteBuffers: _emscripten_glDeleteBuffers,
    /** @export */ emscripten_glDeleteFramebuffers: _emscripten_glDeleteFramebuffers,
    /** @export */ emscripten_glDeleteProgram: _emscripten_glDeleteProgram,
    /** @export */ emscripten_glDeleteQueries: _emscripten_glDeleteQueries,
    /** @export */ emscripten_glDeleteQueriesEXT: _emscripten_glDeleteQueriesEXT,
    /** @export */ emscripten_glDeleteRenderbuffers: _emscripten_glDeleteRenderbuffers,
    /** @export */ emscripten_glDeleteSamplers: _emscripten_glDeleteSamplers,
    /** @export */ emscripten_glDeleteShader: _emscripten_glDeleteShader,
    /** @export */ emscripten_glDeleteSync: _emscripten_glDeleteSync,
    /** @export */ emscripten_glDeleteTextures: _emscripten_glDeleteTextures,
    /** @export */ emscripten_glDeleteTransformFeedbacks: _emscripten_glDeleteTransformFeedbacks,
    /** @export */ emscripten_glDeleteVertexArrays: _emscripten_glDeleteVertexArrays,
    /** @export */ emscripten_glDeleteVertexArraysOES: _emscripten_glDeleteVertexArraysOES,
    /** @export */ emscripten_glDepthFunc: _emscripten_glDepthFunc,
    /** @export */ emscripten_glDepthMask: _emscripten_glDepthMask,
    /** @export */ emscripten_glDepthRangef: _emscripten_glDepthRangef,
    /** @export */ emscripten_glDetachShader: _emscripten_glDetachShader,
    /** @export */ emscripten_glDisable: _emscripten_glDisable,
    /** @export */ emscripten_glDisableVertexAttribArray: _emscripten_glDisableVertexAttribArray,
    /** @export */ emscripten_glDrawArrays: _emscripten_glDrawArrays,
    /** @export */ emscripten_glDrawArraysInstanced: _emscripten_glDrawArraysInstanced,
    /** @export */ emscripten_glDrawArraysInstancedANGLE: _emscripten_glDrawArraysInstancedANGLE,
    /** @export */ emscripten_glDrawArraysInstancedARB: _emscripten_glDrawArraysInstancedARB,
    /** @export */ emscripten_glDrawArraysInstancedEXT: _emscripten_glDrawArraysInstancedEXT,
    /** @export */ emscripten_glDrawArraysInstancedNV: _emscripten_glDrawArraysInstancedNV,
    /** @export */ emscripten_glDrawBuffers: _emscripten_glDrawBuffers,
    /** @export */ emscripten_glDrawBuffersEXT: _emscripten_glDrawBuffersEXT,
    /** @export */ emscripten_glDrawBuffersWEBGL: _emscripten_glDrawBuffersWEBGL,
    /** @export */ emscripten_glDrawElements: _emscripten_glDrawElements,
    /** @export */ emscripten_glDrawElementsInstanced: _emscripten_glDrawElementsInstanced,
    /** @export */ emscripten_glDrawElementsInstancedANGLE: _emscripten_glDrawElementsInstancedANGLE,
    /** @export */ emscripten_glDrawElementsInstancedARB: _emscripten_glDrawElementsInstancedARB,
    /** @export */ emscripten_glDrawElementsInstancedEXT: _emscripten_glDrawElementsInstancedEXT,
    /** @export */ emscripten_glDrawElementsInstancedNV: _emscripten_glDrawElementsInstancedNV,
    /** @export */ emscripten_glDrawRangeElements: _emscripten_glDrawRangeElements,
    /** @export */ emscripten_glEnable: _emscripten_glEnable,
    /** @export */ emscripten_glEnableVertexAttribArray: _emscripten_glEnableVertexAttribArray,
    /** @export */ emscripten_glEndQuery: _emscripten_glEndQuery,
    /** @export */ emscripten_glEndQueryEXT: _emscripten_glEndQueryEXT,
    /** @export */ emscripten_glEndTransformFeedback: _emscripten_glEndTransformFeedback,
    /** @export */ emscripten_glFenceSync: _emscripten_glFenceSync,
    /** @export */ emscripten_glFinish: _emscripten_glFinish,
    /** @export */ emscripten_glFlush: _emscripten_glFlush,
    /** @export */ emscripten_glFramebufferRenderbuffer: _emscripten_glFramebufferRenderbuffer,
    /** @export */ emscripten_glFramebufferTexture2D: _emscripten_glFramebufferTexture2D,
    /** @export */ emscripten_glFramebufferTextureLayer: _emscripten_glFramebufferTextureLayer,
    /** @export */ emscripten_glFrontFace: _emscripten_glFrontFace,
    /** @export */ emscripten_glGenBuffers: _emscripten_glGenBuffers,
    /** @export */ emscripten_glGenFramebuffers: _emscripten_glGenFramebuffers,
    /** @export */ emscripten_glGenQueries: _emscripten_glGenQueries,
    /** @export */ emscripten_glGenQueriesEXT: _emscripten_glGenQueriesEXT,
    /** @export */ emscripten_glGenRenderbuffers: _emscripten_glGenRenderbuffers,
    /** @export */ emscripten_glGenSamplers: _emscripten_glGenSamplers,
    /** @export */ emscripten_glGenTextures: _emscripten_glGenTextures,
    /** @export */ emscripten_glGenTransformFeedbacks: _emscripten_glGenTransformFeedbacks,
    /** @export */ emscripten_glGenVertexArrays: _emscripten_glGenVertexArrays,
    /** @export */ emscripten_glGenVertexArraysOES: _emscripten_glGenVertexArraysOES,
    /** @export */ emscripten_glGenerateMipmap: _emscripten_glGenerateMipmap,
    /** @export */ emscripten_glGetActiveAttrib: _emscripten_glGetActiveAttrib,
    /** @export */ emscripten_glGetActiveUniform: _emscripten_glGetActiveUniform,
    /** @export */ emscripten_glGetActiveUniformBlockName: _emscripten_glGetActiveUniformBlockName,
    /** @export */ emscripten_glGetActiveUniformBlockiv: _emscripten_glGetActiveUniformBlockiv,
    /** @export */ emscripten_glGetActiveUniformsiv: _emscripten_glGetActiveUniformsiv,
    /** @export */ emscripten_glGetAttachedShaders: _emscripten_glGetAttachedShaders,
    /** @export */ emscripten_glGetAttribLocation: _emscripten_glGetAttribLocation,
    /** @export */ emscripten_glGetBooleanv: _emscripten_glGetBooleanv,
    /** @export */ emscripten_glGetBufferParameteri64v: _emscripten_glGetBufferParameteri64v,
    /** @export */ emscripten_glGetBufferParameteriv: _emscripten_glGetBufferParameteriv,
    /** @export */ emscripten_glGetError: _emscripten_glGetError,
    /** @export */ emscripten_glGetFloatv: _emscripten_glGetFloatv,
    /** @export */ emscripten_glGetFragDataLocation: _emscripten_glGetFragDataLocation,
    /** @export */ emscripten_glGetFramebufferAttachmentParameteriv: _emscripten_glGetFramebufferAttachmentParameteriv,
    /** @export */ emscripten_glGetInteger64i_v: _emscripten_glGetInteger64i_v,
    /** @export */ emscripten_glGetInteger64v: _emscripten_glGetInteger64v,
    /** @export */ emscripten_glGetIntegeri_v: _emscripten_glGetIntegeri_v,
    /** @export */ emscripten_glGetIntegerv: _emscripten_glGetIntegerv,
    /** @export */ emscripten_glGetInternalformativ: _emscripten_glGetInternalformativ,
    /** @export */ emscripten_glGetProgramBinary: _emscripten_glGetProgramBinary,
    /** @export */ emscripten_glGetProgramInfoLog: _emscripten_glGetProgramInfoLog,
    /** @export */ emscripten_glGetProgramiv: _emscripten_glGetProgramiv,
    /** @export */ emscripten_glGetQueryObjecti64vEXT: _emscripten_glGetQueryObjecti64vEXT,
    /** @export */ emscripten_glGetQueryObjectivEXT: _emscripten_glGetQueryObjectivEXT,
    /** @export */ emscripten_glGetQueryObjectui64vEXT: _emscripten_glGetQueryObjectui64vEXT,
    /** @export */ emscripten_glGetQueryObjectuiv: _emscripten_glGetQueryObjectuiv,
    /** @export */ emscripten_glGetQueryObjectuivEXT: _emscripten_glGetQueryObjectuivEXT,
    /** @export */ emscripten_glGetQueryiv: _emscripten_glGetQueryiv,
    /** @export */ emscripten_glGetQueryivEXT: _emscripten_glGetQueryivEXT,
    /** @export */ emscripten_glGetRenderbufferParameteriv: _emscripten_glGetRenderbufferParameteriv,
    /** @export */ emscripten_glGetSamplerParameterfv: _emscripten_glGetSamplerParameterfv,
    /** @export */ emscripten_glGetSamplerParameteriv: _emscripten_glGetSamplerParameteriv,
    /** @export */ emscripten_glGetShaderInfoLog: _emscripten_glGetShaderInfoLog,
    /** @export */ emscripten_glGetShaderPrecisionFormat: _emscripten_glGetShaderPrecisionFormat,
    /** @export */ emscripten_glGetShaderSource: _emscripten_glGetShaderSource,
    /** @export */ emscripten_glGetShaderiv: _emscripten_glGetShaderiv,
    /** @export */ emscripten_glGetString: _emscripten_glGetString,
    /** @export */ emscripten_glGetStringi: _emscripten_glGetStringi,
    /** @export */ emscripten_glGetSynciv: _emscripten_glGetSynciv,
    /** @export */ emscripten_glGetTexParameterfv: _emscripten_glGetTexParameterfv,
    /** @export */ emscripten_glGetTexParameteriv: _emscripten_glGetTexParameteriv,
    /** @export */ emscripten_glGetTransformFeedbackVarying: _emscripten_glGetTransformFeedbackVarying,
    /** @export */ emscripten_glGetUniformBlockIndex: _emscripten_glGetUniformBlockIndex,
    /** @export */ emscripten_glGetUniformIndices: _emscripten_glGetUniformIndices,
    /** @export */ emscripten_glGetUniformLocation: _emscripten_glGetUniformLocation,
    /** @export */ emscripten_glGetUniformfv: _emscripten_glGetUniformfv,
    /** @export */ emscripten_glGetUniformiv: _emscripten_glGetUniformiv,
    /** @export */ emscripten_glGetUniformuiv: _emscripten_glGetUniformuiv,
    /** @export */ emscripten_glGetVertexAttribIiv: _emscripten_glGetVertexAttribIiv,
    /** @export */ emscripten_glGetVertexAttribIuiv: _emscripten_glGetVertexAttribIuiv,
    /** @export */ emscripten_glGetVertexAttribPointerv: _emscripten_glGetVertexAttribPointerv,
    /** @export */ emscripten_glGetVertexAttribfv: _emscripten_glGetVertexAttribfv,
    /** @export */ emscripten_glGetVertexAttribiv: _emscripten_glGetVertexAttribiv,
    /** @export */ emscripten_glHint: _emscripten_glHint,
    /** @export */ emscripten_glInvalidateFramebuffer: _emscripten_glInvalidateFramebuffer,
    /** @export */ emscripten_glInvalidateSubFramebuffer: _emscripten_glInvalidateSubFramebuffer,
    /** @export */ emscripten_glIsBuffer: _emscripten_glIsBuffer,
    /** @export */ emscripten_glIsEnabled: _emscripten_glIsEnabled,
    /** @export */ emscripten_glIsFramebuffer: _emscripten_glIsFramebuffer,
    /** @export */ emscripten_glIsProgram: _emscripten_glIsProgram,
    /** @export */ emscripten_glIsQuery: _emscripten_glIsQuery,
    /** @export */ emscripten_glIsQueryEXT: _emscripten_glIsQueryEXT,
    /** @export */ emscripten_glIsRenderbuffer: _emscripten_glIsRenderbuffer,
    /** @export */ emscripten_glIsSampler: _emscripten_glIsSampler,
    /** @export */ emscripten_glIsShader: _emscripten_glIsShader,
    /** @export */ emscripten_glIsSync: _emscripten_glIsSync,
    /** @export */ emscripten_glIsTexture: _emscripten_glIsTexture,
    /** @export */ emscripten_glIsTransformFeedback: _emscripten_glIsTransformFeedback,
    /** @export */ emscripten_glIsVertexArray: _emscripten_glIsVertexArray,
    /** @export */ emscripten_glIsVertexArrayOES: _emscripten_glIsVertexArrayOES,
    /** @export */ emscripten_glLineWidth: _emscripten_glLineWidth,
    /** @export */ emscripten_glLinkProgram: _emscripten_glLinkProgram,
    /** @export */ emscripten_glPauseTransformFeedback: _emscripten_glPauseTransformFeedback,
    /** @export */ emscripten_glPixelStorei: _emscripten_glPixelStorei,
    /** @export */ emscripten_glPolygonModeWEBGL: _emscripten_glPolygonModeWEBGL,
    /** @export */ emscripten_glPolygonOffset: _emscripten_glPolygonOffset,
    /** @export */ emscripten_glPolygonOffsetClampEXT: _emscripten_glPolygonOffsetClampEXT,
    /** @export */ emscripten_glProgramBinary: _emscripten_glProgramBinary,
    /** @export */ emscripten_glProgramParameteri: _emscripten_glProgramParameteri,
    /** @export */ emscripten_glQueryCounterEXT: _emscripten_glQueryCounterEXT,
    /** @export */ emscripten_glReadBuffer: _emscripten_glReadBuffer,
    /** @export */ emscripten_glReadPixels: _emscripten_glReadPixels,
    /** @export */ emscripten_glReleaseShaderCompiler: _emscripten_glReleaseShaderCompiler,
    /** @export */ emscripten_glRenderbufferStorage: _emscripten_glRenderbufferStorage,
    /** @export */ emscripten_glRenderbufferStorageMultisample: _emscripten_glRenderbufferStorageMultisample,
    /** @export */ emscripten_glResumeTransformFeedback: _emscripten_glResumeTransformFeedback,
    /** @export */ emscripten_glSampleCoverage: _emscripten_glSampleCoverage,
    /** @export */ emscripten_glSamplerParameterf: _emscripten_glSamplerParameterf,
    /** @export */ emscripten_glSamplerParameterfv: _emscripten_glSamplerParameterfv,
    /** @export */ emscripten_glSamplerParameteri: _emscripten_glSamplerParameteri,
    /** @export */ emscripten_glSamplerParameteriv: _emscripten_glSamplerParameteriv,
    /** @export */ emscripten_glScissor: _emscripten_glScissor,
    /** @export */ emscripten_glShaderBinary: _emscripten_glShaderBinary,
    /** @export */ emscripten_glShaderSource: _emscripten_glShaderSource,
    /** @export */ emscripten_glStencilFunc: _emscripten_glStencilFunc,
    /** @export */ emscripten_glStencilFuncSeparate: _emscripten_glStencilFuncSeparate,
    /** @export */ emscripten_glStencilMask: _emscripten_glStencilMask,
    /** @export */ emscripten_glStencilMaskSeparate: _emscripten_glStencilMaskSeparate,
    /** @export */ emscripten_glStencilOp: _emscripten_glStencilOp,
    /** @export */ emscripten_glStencilOpSeparate: _emscripten_glStencilOpSeparate,
    /** @export */ emscripten_glTexImage2D: _emscripten_glTexImage2D,
    /** @export */ emscripten_glTexImage3D: _emscripten_glTexImage3D,
    /** @export */ emscripten_glTexParameterf: _emscripten_glTexParameterf,
    /** @export */ emscripten_glTexParameterfv: _emscripten_glTexParameterfv,
    /** @export */ emscripten_glTexParameteri: _emscripten_glTexParameteri,
    /** @export */ emscripten_glTexParameteriv: _emscripten_glTexParameteriv,
    /** @export */ emscripten_glTexStorage2D: _emscripten_glTexStorage2D,
    /** @export */ emscripten_glTexStorage3D: _emscripten_glTexStorage3D,
    /** @export */ emscripten_glTexSubImage2D: _emscripten_glTexSubImage2D,
    /** @export */ emscripten_glTexSubImage3D: _emscripten_glTexSubImage3D,
    /** @export */ emscripten_glTransformFeedbackVaryings: _emscripten_glTransformFeedbackVaryings,
    /** @export */ emscripten_glUniform1f: _emscripten_glUniform1f,
    /** @export */ emscripten_glUniform1fv: _emscripten_glUniform1fv,
    /** @export */ emscripten_glUniform1i: _emscripten_glUniform1i,
    /** @export */ emscripten_glUniform1iv: _emscripten_glUniform1iv,
    /** @export */ emscripten_glUniform1ui: _emscripten_glUniform1ui,
    /** @export */ emscripten_glUniform1uiv: _emscripten_glUniform1uiv,
    /** @export */ emscripten_glUniform2f: _emscripten_glUniform2f,
    /** @export */ emscripten_glUniform2fv: _emscripten_glUniform2fv,
    /** @export */ emscripten_glUniform2i: _emscripten_glUniform2i,
    /** @export */ emscripten_glUniform2iv: _emscripten_glUniform2iv,
    /** @export */ emscripten_glUniform2ui: _emscripten_glUniform2ui,
    /** @export */ emscripten_glUniform2uiv: _emscripten_glUniform2uiv,
    /** @export */ emscripten_glUniform3f: _emscripten_glUniform3f,
    /** @export */ emscripten_glUniform3fv: _emscripten_glUniform3fv,
    /** @export */ emscripten_glUniform3i: _emscripten_glUniform3i,
    /** @export */ emscripten_glUniform3iv: _emscripten_glUniform3iv,
    /** @export */ emscripten_glUniform3ui: _emscripten_glUniform3ui,
    /** @export */ emscripten_glUniform3uiv: _emscripten_glUniform3uiv,
    /** @export */ emscripten_glUniform4f: _emscripten_glUniform4f,
    /** @export */ emscripten_glUniform4fv: _emscripten_glUniform4fv,
    /** @export */ emscripten_glUniform4i: _emscripten_glUniform4i,
    /** @export */ emscripten_glUniform4iv: _emscripten_glUniform4iv,
    /** @export */ emscripten_glUniform4ui: _emscripten_glUniform4ui,
    /** @export */ emscripten_glUniform4uiv: _emscripten_glUniform4uiv,
    /** @export */ emscripten_glUniformBlockBinding: _emscripten_glUniformBlockBinding,
    /** @export */ emscripten_glUniformMatrix2fv: _emscripten_glUniformMatrix2fv,
    /** @export */ emscripten_glUniformMatrix2x3fv: _emscripten_glUniformMatrix2x3fv,
    /** @export */ emscripten_glUniformMatrix2x4fv: _emscripten_glUniformMatrix2x4fv,
    /** @export */ emscripten_glUniformMatrix3fv: _emscripten_glUniformMatrix3fv,
    /** @export */ emscripten_glUniformMatrix3x2fv: _emscripten_glUniformMatrix3x2fv,
    /** @export */ emscripten_glUniformMatrix3x4fv: _emscripten_glUniformMatrix3x4fv,
    /** @export */ emscripten_glUniformMatrix4fv: _emscripten_glUniformMatrix4fv,
    /** @export */ emscripten_glUniformMatrix4x2fv: _emscripten_glUniformMatrix4x2fv,
    /** @export */ emscripten_glUniformMatrix4x3fv: _emscripten_glUniformMatrix4x3fv,
    /** @export */ emscripten_glUseProgram: _emscripten_glUseProgram,
    /** @export */ emscripten_glValidateProgram: _emscripten_glValidateProgram,
    /** @export */ emscripten_glVertexAttrib1f: _emscripten_glVertexAttrib1f,
    /** @export */ emscripten_glVertexAttrib1fv: _emscripten_glVertexAttrib1fv,
    /** @export */ emscripten_glVertexAttrib2f: _emscripten_glVertexAttrib2f,
    /** @export */ emscripten_glVertexAttrib2fv: _emscripten_glVertexAttrib2fv,
    /** @export */ emscripten_glVertexAttrib3f: _emscripten_glVertexAttrib3f,
    /** @export */ emscripten_glVertexAttrib3fv: _emscripten_glVertexAttrib3fv,
    /** @export */ emscripten_glVertexAttrib4f: _emscripten_glVertexAttrib4f,
    /** @export */ emscripten_glVertexAttrib4fv: _emscripten_glVertexAttrib4fv,
    /** @export */ emscripten_glVertexAttribDivisor: _emscripten_glVertexAttribDivisor,
    /** @export */ emscripten_glVertexAttribDivisorANGLE: _emscripten_glVertexAttribDivisorANGLE,
    /** @export */ emscripten_glVertexAttribDivisorARB: _emscripten_glVertexAttribDivisorARB,
    /** @export */ emscripten_glVertexAttribDivisorEXT: _emscripten_glVertexAttribDivisorEXT,
    /** @export */ emscripten_glVertexAttribDivisorNV: _emscripten_glVertexAttribDivisorNV,
    /** @export */ emscripten_glVertexAttribI4i: _emscripten_glVertexAttribI4i,
    /** @export */ emscripten_glVertexAttribI4iv: _emscripten_glVertexAttribI4iv,
    /** @export */ emscripten_glVertexAttribI4ui: _emscripten_glVertexAttribI4ui,
    /** @export */ emscripten_glVertexAttribI4uiv: _emscripten_glVertexAttribI4uiv,
    /** @export */ emscripten_glVertexAttribIPointer: _emscripten_glVertexAttribIPointer,
    /** @export */ emscripten_glVertexAttribPointer: _emscripten_glVertexAttribPointer,
    /** @export */ emscripten_glViewport: _emscripten_glViewport,
    /** @export */ emscripten_glWaitSync: _emscripten_glWaitSync,
    /** @export */ emscripten_resize_heap: _emscripten_resize_heap,
    /** @export */ emscripten_set_main_loop: _emscripten_set_main_loop,
    /** @export */ emscripten_unwind_to_js_event_loop: _emscripten_unwind_to_js_event_loop,
    /** @export */ environ_get: _environ_get,
    /** @export */ environ_sizes_get: _environ_sizes_get,
    /** @export */ exit: _exit,
    /** @export */ fd_close: _fd_close,
    /** @export */ fd_read: _fd_read,
    /** @export */ fd_seek: _fd_seek,
    /** @export */ fd_write: _fd_write,
    /** @export */ glfwCreateWindow: _glfwCreateWindow,
    /** @export */ glfwDestroyWindow: _glfwDestroyWindow,
    /** @export */ glfwGetCursorPos: _glfwGetCursorPos,
    /** @export */ glfwGetFramebufferSize: _glfwGetFramebufferSize,
    /** @export */ glfwGetJoystickAxes: _glfwGetJoystickAxes,
    /** @export */ glfwGetJoystickButtons: _glfwGetJoystickButtons,
    /** @export */ glfwGetJoystickName: _glfwGetJoystickName,
    /** @export */ glfwGetMonitorName: _glfwGetMonitorName,
    /** @export */ glfwGetMonitors: _glfwGetMonitors,
    /** @export */ glfwGetMouseButton: _glfwGetMouseButton,
    /** @export */ glfwGetPrimaryMonitor: _glfwGetPrimaryMonitor,
    /** @export */ glfwGetVideoMode: _glfwGetVideoMode,
    /** @export */ glfwGetWindowSize: _glfwGetWindowSize,
    /** @export */ glfwInit: _glfwInit,
    /** @export */ glfwJoystickIsGamepad: _glfwJoystickIsGamepad,
    /** @export */ glfwJoystickPresent: _glfwJoystickPresent,
    /** @export */ glfwMakeContextCurrent: _glfwMakeContextCurrent,
    /** @export */ glfwPollEvents: _glfwPollEvents,
    /** @export */ glfwSetCursorEnterCallback: _glfwSetCursorEnterCallback,
    /** @export */ glfwSetCursorPos: _glfwSetCursorPos,
    /** @export */ glfwSetCursorPosCallback: _glfwSetCursorPosCallback,
    /** @export */ glfwSetErrorCallback: _glfwSetErrorCallback,
    /** @export */ glfwSetFramebufferSizeCallback: _glfwSetFramebufferSizeCallback,
    /** @export */ glfwSetInputMode: _glfwSetInputMode,
    /** @export */ glfwSetJoystickCallback: _glfwSetJoystickCallback,
    /** @export */ glfwSetKeyCallback: _glfwSetKeyCallback,
    /** @export */ glfwSetScrollCallback: _glfwSetScrollCallback,
    /** @export */ glfwSetWindowFocusCallback: _glfwSetWindowFocusCallback,
    /** @export */ glfwSetWindowIconifyCallback: _glfwSetWindowIconifyCallback,
    /** @export */ glfwSetWindowSize: _glfwSetWindowSize,
    /** @export */ glfwSwapBuffers: _glfwSwapBuffers,
    /** @export */ glfwSwapInterval: _glfwSwapInterval,
    /** @export */ glfwTerminate: _glfwTerminate,
    /** @export */ glfwWindowHint: _glfwWindowHint,
    /** @export */ glfwWindowShouldClose: _glfwWindowShouldClose,
    /** @export */ memory: wasmMemory
  };
}

var wasmExports;

createWasm();

var ___wasm_call_ctors = createExportWrapper("__wasm_call_ctors", 0);

var _free = createExportWrapper("free", 1);

var _malloc = createExportWrapper("malloc", 1);

var _main = Module["_main"] = createExportWrapper("__main_argc_argv", 2);

var _fflush = createExportWrapper("fflush", 1);

var _strerror = createExportWrapper("strerror", 1);

var __emscripten_tls_init = createExportWrapper("_emscripten_tls_init", 0);

var _pthread_self = () => (_pthread_self = wasmExports["pthread_self"])();

var __emscripten_thread_init = createExportWrapper("_emscripten_thread_init", 6);

var __emscripten_thread_crashed = createExportWrapper("_emscripten_thread_crashed", 0);

var _emscripten_stack_get_base = () => (_emscripten_stack_get_base = wasmExports["emscripten_stack_get_base"])();

var _emscripten_stack_get_end = () => (_emscripten_stack_get_end = wasmExports["emscripten_stack_get_end"])();

var __emscripten_run_on_main_thread_js = createExportWrapper("_emscripten_run_on_main_thread_js", 5);

var __emscripten_thread_free_data = createExportWrapper("_emscripten_thread_free_data", 1);

var __emscripten_thread_exit = createExportWrapper("_emscripten_thread_exit", 1);

var __emscripten_check_mailbox = createExportWrapper("_emscripten_check_mailbox", 0);

var __emscripten_tempret_set = createExportWrapper("_emscripten_tempret_set", 1);

var _emscripten_stack_init = () => (_emscripten_stack_init = wasmExports["emscripten_stack_init"])();

var _emscripten_stack_set_limits = (a0, a1) => (_emscripten_stack_set_limits = wasmExports["emscripten_stack_set_limits"])(a0, a1);

var _emscripten_stack_get_free = () => (_emscripten_stack_get_free = wasmExports["emscripten_stack_get_free"])();

var __emscripten_stack_restore = a0 => (__emscripten_stack_restore = wasmExports["_emscripten_stack_restore"])(a0);

var __emscripten_stack_alloc = a0 => (__emscripten_stack_alloc = wasmExports["_emscripten_stack_alloc"])(a0);

var _emscripten_stack_get_current = () => (_emscripten_stack_get_current = wasmExports["emscripten_stack_get_current"])();

var ___set_stack_limits = Module["___set_stack_limits"] = createExportWrapper("__set_stack_limits", 2);

var dynCall_jiji = Module["dynCall_jiji"] = createExportWrapper("dynCall_jiji", 5);

var dynCall_jij = Module["dynCall_jij"] = createExportWrapper("dynCall_jij", 4);

var dynCall_iij = Module["dynCall_iij"] = createExportWrapper("dynCall_iij", 4);

var dynCall_ji = Module["dynCall_ji"] = createExportWrapper("dynCall_ji", 2);

var dynCall_viijii = Module["dynCall_viijii"] = createExportWrapper("dynCall_viijii", 7);

var dynCall_iiiiij = Module["dynCall_iiiiij"] = createExportWrapper("dynCall_iiiiij", 7);

var dynCall_iiiiijj = Module["dynCall_iiiiijj"] = createExportWrapper("dynCall_iiiiijj", 9);

var dynCall_iiiiiijj = Module["dynCall_iiiiiijj"] = createExportWrapper("dynCall_iiiiiijj", 10);

var _gGameState = Module["_gGameState"] = 4478456;

// include: postamble.js
// === Auto-generated postamble setup entry stuff ===
Module["addRunDependency"] = addRunDependency;

Module["removeRunDependency"] = removeRunDependency;

Module["ccall"] = ccall;

Module["FS_createPreloadedFile"] = FS_createPreloadedFile;

Module["FS_unlink"] = FS_unlink;

Module["FS_createPath"] = FS_createPath;

Module["FS_createDevice"] = FS_createDevice;

Module["FS"] = FS;

Module["FS_createDataFile"] = FS_createDataFile;

Module["FS_createLazyFile"] = FS_createLazyFile;

var missingLibrarySymbols = [ "writeI53ToI64Clamped", "writeI53ToI64Signaling", "writeI53ToU64Clamped", "writeI53ToU64Signaling", "convertU32PairToI53", "getTempRet0", "setTempRet0", "inetPton4", "inetNtop4", "inetPton6", "inetNtop6", "readSockaddr", "writeSockaddr", "emscriptenLog", "runMainThreadEmAsm", "dynCallLegacy", "getDynCaller", "dynCall", "asmjsMangle", "HandleAllocator", "getNativeTypeSize", "STACK_SIZE", "STACK_ALIGN", "POINTER_SIZE", "ASSERTIONS", "cwrap", "uleb128Encode", "sigToWasmTypes", "generateFuncType", "convertJsFunctionToWasm", "getEmptyTableSlot", "updateTableMap", "getFunctionAddress", "addFunction", "removeFunction", "reallyNegative", "unSign", "strLen", "reSign", "formatString", "intArrayToString", "AsciiToString", "UTF16ToString", "stringToUTF16", "lengthBytesUTF16", "UTF32ToString", "stringToUTF32", "lengthBytesUTF32", "registerKeyEventCallback", "maybeCStringToJsString", "findEventTarget", "getBoundingClientRect", "fillMouseEventData", "registerMouseEventCallback", "registerWheelEventCallback", "registerUiEventCallback", "registerFocusEventCallback", "fillDeviceOrientationEventData", "registerDeviceOrientationEventCallback", "fillDeviceMotionEventData", "registerDeviceMotionEventCallback", "screenOrientation", "fillOrientationChangeEventData", "registerOrientationChangeEventCallback", "fillFullscreenChangeEventData", "registerFullscreenChangeEventCallback", "JSEvents_requestFullscreen", "JSEvents_resizeCanvasForFullscreen", "registerRestoreOldStyle", "hideEverythingExceptGivenElement", "restoreHiddenElements", "setLetterbox", "softFullscreenResizeWebGLRenderTarget", "doRequestFullscreen", "fillPointerlockChangeEventData", "registerPointerlockChangeEventCallback", "registerPointerlockErrorEventCallback", "requestPointerLock", "fillVisibilityChangeEventData", "registerVisibilityChangeEventCallback", "registerTouchEventCallback", "fillGamepadEventData", "registerGamepadEventCallback", "registerBeforeUnloadEventCallback", "fillBatteryEventData", "battery", "registerBatteryEventCallback", "setCanvasElementSizeCallingThread", "setCanvasElementSizeMainThread", "setCanvasElementSize", "getCanvasSizeCallingThread", "getCanvasSizeMainThread", "getCanvasElementSize", "jsStackTrace", "getCallstack", "convertPCtoSourceLocation", "wasiRightsToMuslOFlags", "wasiOFlagsToMuslOFlags", "setImmediateWrapped", "safeRequestAnimationFrame", "clearImmediateWrapped", "polyfillSetImmediate", "registerPostMainLoop", "registerPreMainLoop", "getPromise", "makePromise", "idsToPromises", "makePromiseCallback", "findMatchingCatch", "Browser_asyncPrepareDataCounter", "arraySum", "addDays", "getSocketFromFD", "getSocketAddress", "FS_mkdirTree", "_setNetworkCallback", "writeGLArray", "emscripten_webgl_destroy_context_before_on_calling_thread", "registerWebGlEventCallback", "runAndAbortIfError", "ALLOC_NORMAL", "ALLOC_STACK", "allocate", "writeStringToMemory", "writeAsciiToMemory", "setErrNo", "demangle", "stackTrace" ];

missingLibrarySymbols.forEach(missingLibrarySymbol);

var unexportedSymbols = [ "run", "addOnPreRun", "addOnInit", "addOnPreMain", "addOnExit", "addOnPostRun", "out", "err", "callMain", "abort", "wasmMemory", "wasmExports", "GROWABLE_HEAP_I8", "GROWABLE_HEAP_U8", "GROWABLE_HEAP_I16", "GROWABLE_HEAP_U16", "GROWABLE_HEAP_I32", "GROWABLE_HEAP_U32", "GROWABLE_HEAP_F32", "GROWABLE_HEAP_F64", "writeStackCookie", "checkStackCookie", "writeI53ToI64", "readI53FromI64", "readI53FromU64", "convertI32PairToI53", "convertI32PairToI53Checked", "stackSave", "stackRestore", "stackAlloc", "ptrToString", "zeroMemory", "exitJS", "getHeapMax", "growMemory", "ENV", "setStackLimits", "ERRNO_CODES", "strError", "DNS", "Protocols", "Sockets", "timers", "warnOnce", "readEmAsmArgsArray", "readEmAsmArgs", "runEmAsmFunction", "jstoi_q", "jstoi_s", "getExecutableName", "listenOnce", "autoResumeAudioContext", "handleException", "keepRuntimeAlive", "runtimeKeepalivePush", "runtimeKeepalivePop", "callUserCallback", "maybeExit", "asyncLoad", "alignMemory", "mmapAlloc", "wasmTable", "noExitRuntime", "getCFunc", "freeTableIndexes", "functionsInTableMap", "setValue", "getValue", "PATH", "PATH_FS", "UTF8Decoder", "UTF8ArrayToString", "UTF8ToString", "stringToUTF8Array", "stringToUTF8", "lengthBytesUTF8", "intArrayFromString", "stringToAscii", "UTF16Decoder", "stringToNewUTF8", "stringToUTF8OnStack", "writeArrayToMemory", "JSEvents", "specialHTMLTargets", "findCanvasEventTarget", "currentFullscreenStrategy", "restoreOldWindowedStyle", "UNWIND_CACHE", "ExitStatus", "getEnvStrings", "checkWasiClock", "doReadv", "doWritev", "initRandomFill", "randomFill", "safeSetTimeout", "promiseMap", "uncaughtExceptionCount", "exceptionLast", "exceptionCaught", "ExceptionInfo", "Browser", "getPreloadedImageData__data", "wget", "MONTH_DAYS_REGULAR", "MONTH_DAYS_LEAP", "MONTH_DAYS_REGULAR_CUMULATIVE", "MONTH_DAYS_LEAP_CUMULATIVE", "isLeapYear", "ydayFromDate", "SYSCALLS", "preloadPlugins", "FS_modeStringToFlags", "FS_getMode", "FS_stdin_getChar_buffer", "FS_stdin_getChar", "FS_readFile", "MEMFS", "TTY", "PIPEFS", "SOCKFS", "tempFixedLengthArray", "miniTempWebGLFloatBuffers", "miniTempWebGLIntBuffers", "heapObjectForWebGLType", "toTypedArrayIndex", "webgl_enable_WEBGL_multi_draw", "webgl_enable_EXT_polygon_offset_clamp", "webgl_enable_EXT_clip_control", "webgl_enable_WEBGL_polygon_mode", "GL", "emscriptenWebGLGet", "computeUnpackAlignedImageSize", "colorChannelsInGlTextureFormat", "emscriptenWebGLGetTexPixelData", "emscriptenWebGLGetUniform", "webglGetUniformLocation", "webglPrepareUniformLocationsBeforeFirstUse", "webglGetLeftBracePos", "emscriptenWebGLGetVertexAttrib", "__glGetActiveAttribOrUniform", "AL", "GLUT", "EGL", "GLEW", "IDBStore", "SDL", "SDL_gfx", "GLFW_Window", "GLFW", "emscriptenWebGLGetIndexed", "webgl_enable_WEBGL_draw_instanced_base_vertex_base_instance", "webgl_enable_WEBGL_multi_draw_instanced_base_vertex_base_instance", "allocateUTF8", "allocateUTF8OnStack", "print", "printErr", "PThread", "terminateWorker", "cleanupThread", "registerTLSInit", "spawnThread", "exitOnMainThread", "proxyToMainThread", "proxiedJSCallArgs", "invokeEntryPoint", "checkMailbox" ];

unexportedSymbols.forEach(unexportedRuntimeSymbol);

var calledRun;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!calledRun) run();
  if (!calledRun) dependenciesFulfilled = runCaller;
};

// try this again later, after new deps are fulfilled
function callMain(args = []) {
  assert(runDependencies == 0, 'cannot call main when async dependencies remain! (listen on Module["onRuntimeInitialized"])');
  assert(__ATPRERUN__.length == 0, "cannot call main when preRun functions remain to be called");
  var entryFunction = _main;
  args.unshift(thisProgram);
  var argc = args.length;
  var argv = stackAlloc((argc + 1) * 4);
  var argv_ptr = argv;
  args.forEach(arg => {
    GROWABLE_HEAP_U32()[((argv_ptr) >> 2)] = stringToUTF8OnStack(arg);
    argv_ptr += 4;
  });
  GROWABLE_HEAP_U32()[((argv_ptr) >> 2)] = 0;
  try {
    var ret = entryFunction(argc, argv);
    // if we're not running an evented main loop, it's time to exit
    exitJS(ret, /* implicit = */ true);
    return ret;
  } catch (e) {
    return handleException(e);
  }
}

function stackCheckInit() {
  // This is normally called automatically during __wasm_call_ctors but need to
  // get these values before even running any of the ctors so we call it redundantly
  // here.
  // See $establishStackSpace for the equivalent code that runs on a thread
  assert(!ENVIRONMENT_IS_PTHREAD);
  _emscripten_stack_init();
  // TODO(sbc): Move writeStackCookie to native to to avoid this.
  writeStackCookie();
}

function run(args = arguments_) {
  if (runDependencies > 0) {
    return;
  }
  if ((ENVIRONMENT_IS_PTHREAD)) {
    initRuntime();
    return;
  }
  stackCheckInit();
  preRun();
  // a preRun added a dependency, run will be called later
  if (runDependencies > 0) {
    return;
  }
  function doRun() {
    // run may have just been called through dependencies being fulfilled just in this very frame,
    // or while the async setStatus time below was happening
    if (calledRun) return;
    calledRun = true;
    Module["calledRun"] = true;
    if (ABORT) return;
    initRuntime();
    preMain();
    Module["onRuntimeInitialized"]?.();
    if (shouldRunNow) callMain(args);
    postRun();
  }
  if (Module["setStatus"]) {
    Module["setStatus"]("Running...");
    setTimeout(() => {
      setTimeout(() => Module["setStatus"](""), 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
  checkStackCookie();
}

function checkUnflushedContent() {
  // Compiler settings do not allow exiting the runtime, so flushing
  // the streams is not possible. but in ASSERTIONS mode we check
  // if there was something to flush, and if so tell the user they
  // should request that the runtime be exitable.
  // Normally we would not even include flush() at all, but in ASSERTIONS
  // builds we do so just for this check, and here we see if there is any
  // content to flush, that is, we check if there would have been
  // something a non-ASSERTIONS build would have not seen.
  // How we flush the streams depends on whether we are in SYSCALLS_REQUIRE_FILESYSTEM=0
  // mode (which has its own special function for this; otherwise, all
  // the code is inside libc)
  var oldOut = out;
  var oldErr = err;
  var has = false;
  out = err = x => {
    has = true;
  };
  try {
    // it doesn't matter if it fails
    _fflush(0);
    // also flush in the JS FS layer
    [ "stdout", "stderr" ].forEach(name => {
      var info = FS.analyzePath("/dev/" + name);
      if (!info) return;
      var stream = info.object;
      var rdev = stream.rdev;
      var tty = TTY.ttys[rdev];
      if (tty?.output?.length) {
        has = true;
      }
    });
  } catch (e) {}
  out = oldOut;
  err = oldErr;
  if (has) {
    warnOnce("stdio streams had content in them that was not flushed. you should set EXIT_RUNTIME to 1 (see the Emscripten FAQ), or make sure to emit a newline when you printf etc.");
  }
}

if (Module["preInit"]) {
  if (typeof Module["preInit"] == "function") Module["preInit"] = [ Module["preInit"] ];
  while (Module["preInit"].length > 0) {
    Module["preInit"].pop()();
  }
}

// shouldRunNow refers to calling main(), not run().
var shouldRunNow = true;

if (Module["noInitialRun"]) shouldRunNow = false;

run();
