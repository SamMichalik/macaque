var inFile = document.getElementById('inFile');
var image = document.getElementById('image');
var canvas = document.getElementById('canvas');
var ctx = canvas.getContext('2d');
var img = new Image();
var imgX;
var imgY;
var focus = { x: 0, y: 0 };
var mouseDown = false;
var startX;
var startY;
var zoomX;
var zoomY;

const MIN_WIDTH = 224;
const MIN_HEIGHT = 224;
const IN_WIDTH = MIN_WIDTH;
const IN_HEIGHT = MIN_HEIGHT;


initialize();

function initialize() {
  var caption = getCaptionNodes();
  var form = document.querySelector('form');

  // register canvas functionality
  canvas.addEventListener('mouseup', () => { canvasMouseUp(); });
  canvas.addEventListener('mouseup', event => { zoom(event); });
  canvas.addEventListener('mousedown', event => { canvasMouseDown(event); });
  canvas.addEventListener('mousedown', event => { prezoom(event); });
  canvas.addEventListener('mousemove', event => { canvasMouseMove(event); });

  // register effects on the caption subject to mouse movement
  caption.forEach(word => {
    word.addEventListener('mouseover', () => { highligthWord(word); });
    word.addEventListener('mouseout', () => { unhighlightWord(word); });
  });

  // hide the default image and caption
  inFile.addEventListener('input', () => {
    image.style.display = "none";
    hideCaption();
   });

  // make canvas visible and display the image selected by the user
  inFile.addEventListener('input', () => {
    canvas.width = 1000;
    canvas.height = 800;
    focus.x = (canvas.width - IN_WIDTH) / 2;
    focus.y = (canvas.height - IN_HEIGHT) / 2;
    canvas.style.display = "block";
    displayUserImage()
  });

  // form submission event handler
  form.addEventListener('submit', event => {
    var hCanvas;
    var hCtx;

    event.preventDefault();

    hCanvas = document.createElement('canvas');
    hCanvas.width = IN_WIDTH;
    hCanvas.height = IN_HEIGHT;
    hCtx = hCanvas.getContext('2d');

    // redraw the contents of the focus box to the hidden canvas
    hCtx.drawImage(canvas, focus.x, focus.y, IN_WIDTH, IN_HEIGHT, 0, 0, IN_WIDTH, IN_HEIGHT);

    let img_url = hCanvas.toDataURL("image/jpeg", 1.);
    canvas.style.display = "none";
    image.style.display = "block";
    image.src = img_url;

    // submit the cropped image and handle the response
    hCanvas.toBlob(blob => { uploadBlob(blob); }, "image/jpeg", 1.);

    function uploadBlob(blob) {

      var formData = new FormData();
      formData.append('input-file', blob);
      var init = { method: 'POST', body: formData };

      // '/caption' responds with a json containing the generated caption
      fetch('/caption', init).then(response => {
        return response.json();
      }).then(json => {

        var tr = document.querySelector('tr.caption'),
            length = json.length,
            th,
            i;

        // display the new caption
        for (i = 0; i < json.length; i++) {
          th = document.createElement('th');
          th.className = "caption";
          th.textContent = json[i];
          tr.appendChild(th);
        }

        // fetch alphas
        fetchImages(length).then(urls => {
          var url = image.getAttribute('src');
          var nodes = getCaptionNodes();

          for (var i = length-1; i >= 0; i--) {
            let ix = i;

            nodes[ix].addEventListener('mouseover', () => {
              image.setAttribute('src', urls[ix]);
              highligthWord(nodes[ix]);
            })

            nodes[ix].addEventListener('mouseout', () => {
              image.setAttribute('src', url)
              unhighlightWord(nodes[ix]);
            })
          }

        });
      });
    }
  });
}

function highligthWord(word) {
  word.style.color = "red";
}

function unhighlightWord(word) {
  word.style.color = "black";
}

function displayUserImage() {
  var file = inFile.files[0];
  var url = URL.createObjectURL(file);

  img.src = url;
  img.onload = () => {
    centerImg();
    drawFocus();
  }
}

function hideCaption() {
  var tr = document.querySelector('tr.caption');
  var child;

  while ((child = tr.lastElementChild) !== null) {
    tr.removeChild(child);
  }
}

function fetchImages(imgCount) {

  return fetch('/alphas')
  .then(response => {
    return response.arrayBuffer();

  }).then( arrBuff => {

    let bLen = arrBuff.byteLength;

    // 2 bytes to store the length of each image
    let metaLen = 2 * imgCount;

    // get a view of the metadata
    let dView = new DataView(arrBuff, bLen - metaLen);

    let view = new Uint8Array(arrBuff);
    let offset = 0;
    let imageURLs = new Array(imgCount);

    for (var i = 0; i < imgCount; i++) {

      // decode the length of the i-th image
      let l = dView.getUint16(i * 2, false);

      // extract the image
      let subArr = view.subarray(offset, offset + l);
      imageURLs[i] = URL.createObjectURL(new Blob([subArr]));
      offset += l;
    }

    return imageURLs;
  });
}

function getCaptionNodes() {
  return document.querySelectorAll('th.caption');
}

function centerImg() {
  var w = img.width;
  var h = img.height;

  if (w > canvas.width || h > canvas.height) {
    let x = canvas.width / w;
    let y = canvas.height / h;
    let min = x < y ? x : y;
    w *= min;
    h *= min;
  }

  imgX = (canvas.width - w) / 2;
  imgY = (canvas.height - h) / 2;
  ctx.drawImage(img, imgX, imgY, w, h);
}

function drawFocus() {
  const fw = IN_WIDTH;
  const fh = IN_HEIGHT;
  const fx = focus.x;
  const fy = focus.y;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(0, 0, fx, canvas.height);
  ctx.fillRect(fx + fw, 0, canvas.width - fx - fw, canvas.height);
  ctx.fillRect(fx, 0, fw, fy);
  ctx.fillRect(fx, fy + fh, fw, canvas.height - fy - fh);
}

function canvasMouseUp() {
  mouseDown = false;
}

function canvasMouseDown(event) {
  mouseDown = true;
  startX = event.screenX;
  startY = event.screenY;
}

function canvasMouseMove(event) {
  if (mouseDown) {
    if (event.offsetX >= focus.x
      && event.offsetX <= focus.x + IN_WIDTH
      && event.offsetY >= focus.y
      && event.offsetY <= focus.y + IN_HEIGHT)
    {
      let sx = event.screenX;
      let sy = event.screenY;
      let fx = focus.x;
      let fy = focus.y

      if (fx + (sx - startX) < imgX) {
        focus.x = imgX;
      } else if (fx + (sx - startX) + IN_WIDTH > imgX + img.width) {
        focus.x = canvas.width - imgX - IN_WIDTH;
      } else {
        focus.x += sx - startX;
      }

      if (fy + (sy - startY) < imgY) {
        focus.y = imgY;
      } else if (fy + (sy - startY) + IN_HEIGHT > imgY + img.height) {
        fy = canvas.height - imgY - IN_HEIGHT;
      } else {
        focus.y += sy - startY;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      centerImg();
      drawFocus();
      startX = sx;
      startY = sy;
    }
  }
}

function prezoom(event) {
  zoomX = event.screenX;
  zoomY = event.screenY;
}

function zoom(event) {

  // the condition prevents zooming on mouseclicks which resize the focus box
  if (event.screenX === zoomX && event.screenY === zoomY) {
    const c = 0.99;
    var w = img.width;
    var h = img.height;
    var floor = Math.floor;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // if shift key was pressed, zoom out, otherwise zoom in
    if (event.shiftKey === true) {
      if (floor(w * c) >= MIN_WIDTH && floor(h * c) >= MIN_HEIGHT) {
        w = floor(w * c);
        h = floor(h * c);
      }
    } else {
      w = floor(w / c);
      h = floor(h / c);
    }

    img.width = w;
    img.height = h;
    imgX = (canvas.width - w) / 2;
    imgY = (canvas.height - h) / 2;
    ctx.drawImage(img, imgX, imgY, w, h);
    drawFocus();
  }
}
