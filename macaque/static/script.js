var inFile = document.getElementById('inFile');
var image = document.getElementById('image');

initialize();

function initialize() {
  var caption = getCaptionNodes();
  var form = document.querySelector('form');

  caption.forEach(word => {
    word.addEventListener('mouseover', () => { highligthWord(word); });
    word.addEventListener('mouseout', () => { unhighlightWord(word); });
  });

  inFile.addEventListener('change', hideCaption);
  inFile.addEventListener('change', displayImage);

  form.addEventListener('submit', event => {
    event.preventDefault();

    var formData = new FormData(form);
    var init = { method: 'POST',
                 body: formData };

    fetch('/caption', init).then(response => {
      return response.json()
    }).then(json => {
      // display new caption
      var tr = document.querySelector('tr.caption'),
          length = json.length,
          th,
          i;

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
            image.setAttribute('src', url);
            unhighlightWord(nodes[ix]);
          })
        }

      })
    });
  });
}

function highligthWord(word) {
  word.style.color = "red";
}

function unhighlightWord(word) {
  word.style.color = "black";
}

function displayImage() {
  var file = inFile.files[0];
  var url = URL.createObjectURL(file);

  image.setAttribute('src', url);
  image.setAttribute('alt', "");
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
