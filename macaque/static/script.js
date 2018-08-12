var inFile = document.getElementById('inFile');
var image = document.getElementById('image');

initialize();

function initialize() {
  var caption = document.querySelectorAll('th.caption');
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

    fetch('/upload', init).then(response => {
      return response.json()
    }).then(json => {
      var tr = document.querySelector('tr.caption'),
          th,
          i;

      for (i = 0; i < json.length; i++) {
        th = document.createElement('th');
        th.className = "caption";
        th.textContent = json[i];
        tr.appendChild(th);
      }

      document.querySelectorAll('th.caption').forEach(word => {
        word.addEventListener('mouseover', () => { highligthWord(word); });
        word.addEventListener('mouseout', () => { unhighlightWord(word); });
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
