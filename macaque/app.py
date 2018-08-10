from flask import Flask, render_template, request
from logic import Model

APP = Flask(__name__)
APP.config["model"] = None

@APP.route('/', methods=['GET', 'POST'])
def root():
    if request.method == 'POST':
        # TODO: check that the input is in fact a jpg image
        fname = request.files['input-file'].filename
        request.files['input-file'].save('static/' + fname)
        caption = APP.config["model"].generate_caption('static/' + fname)
        image = '/static/' + fname
        alt = fname
    else:
        # TODO: make more independent
        caption = APP.config["model"].generate_caption('static/japanese_macaque.jpg')
        image = "/static/japanese_macaque.jpg"
        alt = "A Japanese Macaque in a hot spring."
    return render_template('root.html', caption=caption, image=image, alt=alt)

if __name__ == "__main__":
    model = Model()
    APP.config["model"] = model
    APP.run()
