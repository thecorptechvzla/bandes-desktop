'use strict';
/*
 * node-gyp-build-shim: reemplaza a node-gyp-build dentro del bundle.
 *
 * node-gyp-build busca prebuilds en <paquete>/prebuilds/<platform>-<arch>/,
 * pero pkg no incrusta fielmente los assets de node_modules con pnpm.
 * En su lugar, build-desktop.mjs copia el .node del prebuild de win32-x64
 * a dist/desktop/serialport.node (junto al bundle) y lo cargamos aquí con
 * process.dlopen probando rutas deterministas.
 */
const path = require('path');
const fs = require('fs');

const mod = { exports: {} };

function load(dir) {
  const candidates = [
    path.join(__dirname, 'serialport.node'),
    path.join(process.cwd(), 'serialport.node'),
    path.join(dir, 'prebuilds', 'win32-x64', '@serialport+bindings-cpp.node'),
    path.join(dir, 'prebuilds', 'win32-x64', 'node.napi.node'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        process.dlopen(mod, p);
        return mod.exports;
      }
    } catch (_) {
      // probar siguiente candidato
    }
  }
  throw new Error('serialport native build not found (no serialport.node embebido)');
}

module.exports = load;
module.exports.default = load;