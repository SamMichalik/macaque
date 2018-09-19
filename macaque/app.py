import json
from io import BytesIO

from flask import Flask, render_template, request
from logic import Model


APP = Flask(__name__)
APP.config['model'] = None


@APP.route('/', methods=['GET'])
def root():
    """Returns the main page with the default image and its caption."""

    caption, _ = APP.config['model'].generate('static/japanese_macaque.jpg')
    image = "/static/japanese_macaque.jpg"
    alt = "A Japanese Macaque in a hot spring."
    return render_template('root.html', caption=caption, image=image, alt=alt)

@APP.route('/caption', methods=['POST'])
def upload():
    """Processes the input image file sent by the user
    computing and storing both the caption and the alpha values.
    Returns the caption as jsonified array.
    """

    fname = request.files['input-file'].filename
    request.files['input-file'].save('static/' + fname + ".jpg")
    caption, alphas = APP.config['model'].generate('static/' + fname + ".jpg")
    return json.dumps(caption)

@APP.route('/alphas', methods=['GET'])
def respond_alphas():
    """Returns the images visualizing the effect of the attention
    mechanism and additional metadata for decoding in a blob.
    """

    imgs = APP.config['model'].get_result_images()
    blob = BytesIO()
    lens, prev = [], 0

    # write all the images to a byte stream and store their sizes
    for i in imgs:
        i.save(blob, "JPEG")
        size = blob.tell() # total number of bytes
        lens.append(size - prev)
        prev = size

    # add metadata for decoding
    for l in lens:
        for b in l.to_bytes(2, byteorder='big'):
            blob.write(bytes([b]))

    return blob.getvalue()


if __name__ == "__main__":
    model = Model()
    APP.config['model'] = model
    APP.run()
