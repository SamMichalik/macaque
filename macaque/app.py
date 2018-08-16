import json
from io import BytesIO

from flask import Flask, render_template, request
from logic import Model


APP = Flask(__name__)
APP.config['model'] = None


@APP.route('/', methods=['GET'])
def root():
    caption = APP.config['model'].generate_caption('static/japanese_macaque.jpg')
    image = "/static/japanese_macaque.jpg"
    alt = "A Japanese Macaque in a hot spring."
    return render_template('root.html', caption=caption, image=image, alt=alt)

@APP.route('/caption', methods=['POST'])
def upload():
    fname = request.files['input-file'].filename
    request.files['input-file'].save('static/' + fname)
    caption, alphas = APP.config['model'].get_result('static/' + fname)
    return json.dumps(caption)

@APP.route('/alphas', methods=['GET'])
def respond_alphas():
    imgs = APP.config['model'].get_result_images()
    blob = BytesIO()
    lens = [], prev = 0

    # write all the images to a byte stream
    for i in imgs:
        i.save(blob, "JPEG")
        size = blob.tell() # total number of bytes
        lens.append(size - prev)
        prev = size

    # add metadata for decoding
    for l in lens:
        for b in l.to_bytes(2, byteorder='big')
            blob.write(b)

    return blob.getvalue()


if __name__ == "__main__":
    model = Model()
    APP.config['model'] = model
    APP.run()
