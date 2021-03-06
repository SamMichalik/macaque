import json
import numpy as np

from io import BytesIO
from flask import Flask, render_template, request
from logic import Model
from neuralmonkey.beamsearch_output_graph import BeamSearchOutputGraphEncoder

import pdb

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


@APP.route('/alpha_values', methods=['GET'])
def respond_alpha_values():
    """Returns a jsonified list of numpy arrays containing
    the values of the alpha parameters.
    """

    alphas = APP.config['model'].alphas
    alphas = [a.tolist() for a in alphas]
    return json.dumps(alphas)


@APP.route('/bs_graph', methods=['GET'])
def respond_beam_search_graph():
    """Returns a json encoded BeamSearchOutputGraph object"""

    graph = APP.config['model'].beam_search_graph
    return json.dumps(graph, cls=BeamSearchOutputGraphEncoder)


@APP.route('/single_alpha', methods=['POST'])
def respond_single_alpha():
    json_data = request.get_json(force=True)

    narr = np.array(json_data)
    narr = narr.reshape((8,8))
    imgs = APP.config['model'].get_result_images([narr])
    blob = BytesIO()
    imgs[0].save(blob, "JPEG")

    return blob.getvalue()


if __name__ == "__main__":
    model = Model()
    APP.config['model'] = model
    APP.run()
