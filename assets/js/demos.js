/* Tau Intelligence — Demos page interactivity
   - Videos: play from frame 0 on hover, pause + rewind on leave.
   - GIFs:   freeze at first frame by default (canvas snapshot),
             swap to live GIF on hover, freeze again on leave.
*/
(function () {
  document.querySelectorAll('.demo-tile').forEach(function (tile) {

    // ---- Video tiles ----
    var video = tile.querySelector('video');
    if (video) {
      tile.addEventListener('mouseenter', function () {
        video.currentTime = 0;
        video.play().catch(function () {});
      });
      tile.addEventListener('mouseleave', function () {
        video.pause();
        video.currentTime = 0;
      });
      return;
    }

    // ---- GIF tiles: freeze at first frame, unfreeze on hover ----
    var gif = tile.querySelector('.demo-gif');
    if (!gif) return;

    var realSrc = gif.getAttribute('src');
    var canvas = null;

    function freeze() {
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.width  = gif.naturalWidth  || gif.width;
        canvas.height = gif.naturalHeight || gif.height;
        canvas.className = 'demo-media';
        canvas.style.borderRadius = 'inherit';
        var ctx = canvas.getContext('2d');
        ctx.drawImage(gif, 0, 0, canvas.width, canvas.height);
        gif.parentNode.insertBefore(canvas, gif);
      }
      gif.style.display = 'none';
      canvas.style.display = 'block';
    }

    // Freeze as soon as the first frame loads
    if (gif.complete && gif.naturalWidth > 0) {
      freeze();
    } else {
      gif.addEventListener('load', function onLoad() {
        gif.removeEventListener('load', onLoad);
        freeze();
      });
    }

    tile.addEventListener('mouseenter', function () {
      if (canvas) canvas.style.display = 'none';
      gif.style.display = 'block';
      // Restart the GIF animation from frame 0
      gif.src = '';
      gif.src = realSrc;
    });
    tile.addEventListener('mouseleave', function () {
      freeze();
    });
  });
})();
