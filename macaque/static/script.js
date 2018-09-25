/*jshint esversion: 6 */

var inFile = document.getElementById('inFile');
var image = document.getElementById('image');
var canvas = document.getElementById('canvas');
var ctx = canvas.getContext('2d');
var img = new Image();
var focus = { x: 0, y: 0 };
var mouseDown = false;
var startX;
var startY;
var zoomX;
var zoomY;
var alphaUrls;
var caption;
var alphaValues;
var graph;
var d3Tree;

const MIN_WIDTH = 232;
const MIN_HEIGHT = 232;
const IN_WIDTH = MIN_WIDTH;
const IN_HEIGHT = MIN_HEIGHT;

const MAX_WIDTH = 1000;
const MAX_HEIGHT = 800;


initialize();

function initialize() {
  var captionNodes = getCaptionNodes();
  var form = document.querySelector('form');

  // register canvas functionality
  canvas.addEventListener('mouseup', () => { canvasMouseUp(); });
  canvas.addEventListener('mouseup', event => { zoom(event); });
  canvas.addEventListener('mousedown', event => { canvasMouseDown(event); });
  canvas.addEventListener('mousedown', event => { prezoom(event); });
  canvas.addEventListener('mousemove', event => { canvasMouseMove(event); });

  // register effects on the caption subject to mouse movement
  captionNodes.forEach(word => {
    word.addEventListener('mouseover', () => { highligthWord(word); });
    word.addEventListener('mouseout', () => { unhighlightWord(word); });
  });

  // register functionality that should occur when the user inputs an image
  inFile.addEventListener('input', () => {
    // hide the default image and caption
    image.style.display = "none";
    hideCaption();

    // make canvas visible and display the image selected by the user
    canvas.style.display = "block";
    displayUserImage();

    // display instructions for editing the user selected image
    showUserInstructions();

    // hide elements relevant when the output has been generated
    var hideables = document.getElementsByClassName('hideable');
    for (var i = 0; i < hideables.length; i++) {
      hideables[i].hidden = true;
    }

    // remove existing bs graph
    var svg = document.querySelector('svg');
    while ((child = svg.lastElementChild) !== null) {
      svg.removeChild(child);
    }

    inFile.hidden = true;

    document.getElementById('caption-button').hidden = false;
  });

  document.getElementById('unroll-button').onclick = () => {
    unroll();
  }

  // form submission event handler
  form.addEventListener('submit', event => {
    var hCanvas;
    var hCtx;
    var div;

    // prevent the default behavior; it collides with what we're about
    event.preventDefault();

    // hide 'Caption' button
    document.getElementById('caption-button').hidden = true;

    // display 'Browse' button
    inFile.hidden = false;

    // set up a hidden canvas
    hCanvas = document.createElement('canvas');
    hCanvas.width = IN_WIDTH;
    hCanvas.height = IN_HEIGHT;
    hCtx = hCanvas.getContext('2d');

    // redraw the contents of the focus box to the hidden canvas
    hCtx.drawImage(canvas, focus.x, focus.y, IN_WIDTH, IN_HEIGHT, 0, 0, IN_WIDTH, IN_HEIGHT);

    // make the cropped image accesible trough a url
    let img_url = hCanvas.toDataURL("image/jpeg", 1.0);
    // hide the main canvas
    canvas.style.display = "none";
    // display the cropped image inside a <img> tag
    image.style.display = "block";
    image.src = img_url;

    // submit the cropped image and handle the response
    hCanvas.toBlob(blob => { uploadBlob(blob); }, "image/jpeg", 1.0);

    // this function is responsible for uploading the user's image to the server
    function uploadBlob(blob) {

      // prepare the image blob for transfer
      var formData = new FormData();
      formData.append('input-file', blob);
      var init = { method: 'POST', body: formData };

      // '/caption' responds with a json containing the generated caption
      fetch('/caption', init).then(response => {
        return response.json();
      })
      .then(json => {

        // store the caption to the global variable 'caption'
        caption = json;

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

            // register callbacks for word highlighting & image switching on
            // mouse hoovering over the given word
            nodes[ix].addEventListener('mouseover', () => {
              image.setAttribute('src', urls[ix]);
              highligthWord(nodes[ix]);
            });

            // analogously, add callbacks for when the mouse leaves the word
            nodes[ix].addEventListener('mouseout', () => {
              image.setAttribute('src', url);
              unhighlightWord(nodes[ix]);
            });
          }

          // store the urls to the global variable alphaUrls
          alphaUrls = urls;
        })
        .then(() => {
          if (document.getElementById('unroll-button').textContent === "Hide") {
            // refresh, thus updating to the new image
            hideUnrolled();
            unroll();
          }
        })
        .then(() => {
          fetch('alpha_values').then(response => {
            return response.json();
          })
          .then(json => {
            // json contains a multidimensional array corresponding to
            // the original tensor of parameters
            // store the values to the global variable alphaValues
            alphaValues = json;
          });
        });

        // Fetch the beam search output graph
        fetch('bs_graph').then(response => {
          return response.json();
        })
        .then(json => {
          var width = window.innerWidth - 200;
          var height = (3 * window.innerHeight / 4) - 40;
          graph = json;

          d3Tree = d3.layout.tree()
            .size([height, width]);

          graph_update(graph);
        });

      });
    }

    // hide user instructions as they are no longer relevant
    hideUserInstructions();
  });

  // display hidden elements relevant when the caption has been displayed
  form.addEventListener('submit', () => {
    var hideables = document.getElementsByClassName('hideable');
    var button = document.getElementById('unroll-button');

    for (var i = 0; i < hideables.length; i++) {
      hideables[i].hidden = false;
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

  img.onload = () => {
    centerImg();
    setFocusToCenter();
    drawFocus();
  };
  img.src = url;
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
  })
  .then( arrBuff => {

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
  var w = img.naturalWidth; // original image width
  var h = img.naturalHeight;

  if (w > MAX_WIDTH || h > MAX_HEIGHT) {
    let x = MAX_WIDTH / w;
    let y = MAX_HEIGHT / h;
    let min = x < y ? x : y;
    w *= min;
    h *= min;
  }

  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(img, 0, 0, w, h);
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
    if (event.offsetX >= focus.x &&
      event.offsetX <= focus.x + IN_WIDTH &&
      event.offsetY >= focus.y &&
      event.offsetY <= focus.y + IN_HEIGHT)
    {
      let sx = event.screenX;
      let sy = event.screenY;
      let fx = focus.x;
      let fy = focus.y;

      if (fx + (sx - startX) < 0) {
        focus.x = 0;
      } else if (fx + (sx - startX) + IN_WIDTH > canvas.width) {
        focus.x = canvas.width - IN_WIDTH;
      } else {
        focus.x += sx - startX;
      }

      if (fy + (sy - startY) < 0) {
        focus.y = 0;
      } else if (fy + (sy - startY) + IN_HEIGHT > canvas.height) {
        fy = canvas.height - IN_HEIGHT;
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

  // the condition prevents zooming on mouseclicks which move the focus box
  if (event.screenX === zoomX && event.screenY === zoomY) {
    const c = 0.99;
    var w = img.width;
    var h = img.height;
    var oldw = w;
    var oldh = h;
    var floor = Math.floor;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // if shift key was pressed, zoom out, otherwise zoom in
    if (event.shiftKey === true) {
      if (floor(w * c) >= MIN_WIDTH && floor(h * c) >= MIN_HEIGHT) {
        w = floor(w * c);
        h = floor(h * c);
      }
    } else {
      if (floor(w / c) <= MAX_WIDTH && floor(h / c) <= MAX_HEIGHT) {
        w = floor(w / c);
        h = floor(h / c);
      }
    }

    // lock focus box
    focus.x += floor((w - oldw) / 2);
    focus.y += floor((h - oldh) / 2);

    img.width = w;
    img.height = h;
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(img, 0, 0, w, h);
    drawFocus();
  }
}

function setFocusToCenter() {
  focus.x = (canvas.width - IN_WIDTH) / 2;
  focus.y = (canvas.height - IN_HEIGHT) / 2;
}

function showUserInstructions() {
  document.getElementById('user-instructions').textContent = "Click on the \
image to zoom in. Shift-click to zoom out.\nDrag the square window to select the desired part of the image.";
}

function hideUserInstructions() {
  document.getElementById('user-instructions').textContent = "";
}

function unroll() {
  var div = document.getElementById('one-by-one-div');
  var button = document.getElementById('unroll-button');

  for (var i = 0; i < caption.length; i++) {
    var img = document.createElement('img');
    var ndiv = document.createElement('div');
    var p = document.createElement('p');
    var b = document.createElement('b');    // bold tag

    ndiv.className = "padded-div";
    b.textContent = caption[i];     // make caption bold
    p.appendChild(b);               // embed the boldened caption into a paragraph
    img.src = alphaUrls[i];
    img.wordNum = i;            // we need to store the word index for later events
    ndiv.appendChild(img);
    ndiv.appendChild(p);
    div.appendChild(ndiv);

    img.onmousemove = event => {
      showAlphaTooltip(event);
    }

    img.onmouseout = event => {
      if (document.getElementsByClassName('tooltip')[0]) {
        document.body.removeChild(document.getElementsByClassName('tooltip')[0]);
      }
    }
  }

  // reuse the same button for switching states (unrolled / hidden)
  button.onclick = () => {
    hideUnrolled();
  }
  button.textContent = "Hide";
}

function hideUnrolled() {
  var div = document.getElementById('one-by-one-div');
  var button = document.getElementById('unroll-button');

  while (div.firstChild) {
    div.removeChild(div.firstChild);
  }

  // reuse the same button for switching states (unrolled / hidden)
  button.onclick = () => {
    unroll();
  }
  button.textContent = "Unroll";
}

function showAlphaTooltip(event, wordNum) {
  var clientX = event.clientX;
  var clientY = event.clientY;
  var domRect = event.target.getBoundingClientRect();
  var unitX = MIN_WIDTH / 8; //features are of shape (8,8)
  var unitY = MIN_HEIGHT / 8;
  var column = Math.floor((clientX - domRect.x) / unitX);
  var row = Math.floor((clientY - domRect.y) / unitY);
  var value = alphaValues[event.target.wordNum][row][column];
  var tooltip;

  // remove the image title to prevent collisions with the tooltip
  event.target.removeAttribute('title');

  //remove existing tooltip
  if (document.getElementsByClassName('tooltip')[0]) {
    document.body.removeChild(document.getElementsByClassName('tooltip')[0]);
  }

  // create new tooltip
  tooltip = document.createElement('p');
  tooltip.className = 'tooltip';
  tooltip.textContent = value;
  document.body.appendChild(tooltip);
  tooltip.style.top = event.pageY + 'px';
  tooltip.style.left = event.pageX + 'px';
}

function graph_update(root) {
  var svg = d3.select("svg")
  .attr("width", window.innerWidth)
  .attr("height", 3 * window.innerHeight / 4)
  .append("g") // <g> is a container for grouping of SVG elements
  .attr("transform", "translate(" + 100 + "," + 20 + ")");

  var diagonal = d3.svg.diagonal()
  .projection(function(d) { return [d.y, d.x]; });

  var i = 0;

  // initialize the tree layout and return a list of the nodes
  var nodes = d3Tree.nodes(root).reverse();

  // collect a list of the links connecting the tree nodes
  var links = d3Tree.links(nodes);

  var node = svg.selectAll("g.node")
    .data(nodes, function(d) { return d.id || (d.id = ++i); });

  var nodeEnter = node.enter().append("g")
    .attr("class", "node")
    .attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; })
    .on("click", click);

  var link = svg.selectAll("path.link")
    .data(links, function(d) { return d.target.id; });

/*
  nodeEnter.append("circle")
    .attr("r", 10);


  nodeEnter.append("text")
    .attr("dy", "2.5em")
    .attr("text-anchor", "middle")
    .text(function(d) { return d.token });
*/
  nodeEnter.append("rect")
    .attr("width", 64)
    .attr("height", 40)
    .attr("x", -32)
    .attr("y", -20)
    .attr("rx", 4)
    .attr("ry", 4);

  nodeEnter.append("line")
    .attr("x1", -32)
    .attr("x2", 32)
    .attr("y1", 0)
    .attr("y2", 0);

  nodeEnter.append("text")
    .attr("dy", "-4")
    .attr("text-anchor", "middle")
    .text(function(d) { return d.token })

  nodeEnter.append("text")
    .attr("dy", "14")
    .attr("text-anchor", "middle")
    .text(function(d) { return d.score.toFixed(5) })

/*
  nodeEnter.append("text")
    .attr("dy", "2.5em")
    .attr("text-anchor", "middle")
    .text(function(d) { return d.score });
*/

  link.enter().insert("path", "g")
    .attr("class", "link")
    .attr("d", diagonal);
}

function click(node) {
  if (!node.imageUrl) {
    // fetch the image
    var init = {
      method: 'POST',
      body: JSON.stringify(node.alignment)
    };

    fetch('single_alpha', init).then(response => {
      response.blob().then(blob => {
        node.imageUrl = URL.createObjectURL(blob);
      })
      .then(() => {
        d3.select("img")
          .attr("src", node.imageUrl);
      });
    });
  }
  else {
    d3.select("img")
      .attr("src", node.imageUrl)
  }
}
