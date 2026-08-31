window.WC = window.WC || {};
WC.photos = (function () {
  'use strict';
  var MAX_EDGE = 800;

  // Loads blobOrFile into an <img> via a temporary object URL, draws it onto
  // a canvas scaled so its long edge is at most MAX_EDGE (never upscaling a
  // smaller image), and resolves with a re-encoded JPEG Blob. Rejects with
  // Error('Unsupported image') if the source can't be decoded, or if the
  // canvas can't be exported. The object URL is revoked on every path -
  // success, decode failure, and export failure - so nothing is leaked.
  function downscale(blobOrFile) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(blobOrFile);
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
        var w = Math.round(img.naturalWidth * scale);
        var h = Math.round(img.naturalHeight * scale);
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(function (blob) {
          URL.revokeObjectURL(url);
          if (blob) { resolve(blob); } else { reject(new Error('Unsupported image')); }
        }, 'image/jpeg', 0.7);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('Unsupported image'));
      };
      img.src = url;
    });
  }

  function toObjectUrl(blob) { return URL.createObjectURL(blob); }

  function revoke(url) { URL.revokeObjectURL(url); }

  return {
    MAX_EDGE: MAX_EDGE,
    downscale: downscale,
    toObjectUrl: toObjectUrl,
    revoke: revoke
  };
})();
