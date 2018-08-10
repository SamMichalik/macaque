var inFile = document.getElementById('inFile');
var image = document.getElementById('image');

function displayImage() {
  var file = inFile.files[0];
  var url = URL.createObjectURL(file);
  image.setAttribute('src', url);
  image.setAttribute('alt', "");
}

inFile.addEventListener('change', displayImage);
